import { getDb } from '../db/database';
import { SimulationInput, SimulationResult, OevkSimResult } from '../types/election';
import { dhondt } from './dhondt';
import { calculateFragmentVotes, aggregateFragmentVotes, OevkCandidateResult } from './fragments';

// Magyarország szavazókorú népessége (hozzávetőleges)
const ELIGIBLE_VOTERS = 8_000_000;

/**
 * Párt-öröklési leképezés: a bázisévben szereplő pártokat hogyan kezeljük 2026-ban.
 * Pl. 2022-ben "egyseges_ellenzek" volt a fő ellenzéki erő, 2026-ban "tisza".
 * Ha a felhasználó "tisza" swing-et ad meg, az az "egyseges_ellenzek" bázis szavazataira vonatkozik.
 */
const PARTY_SUCCESSION: Record<string, string> = {
  egyseges_ellenzek: 'tisza',
  // Ha valaki MSZP/DK/Jobbik/LMP swing-et ad meg de a bázisban egyseges_ellenzek van,
  // az egyseges_ellenzek → tisza konverzió kezeli
};

/**
 * Visszafelé leképezés: melyik bázis párt felel meg a 2026-os pártnak.
 */
const PARTY_SUCCESSION_REVERSE: Record<string, string> = {
  tisza: 'egyseges_ellenzek',
};

/**
 * Clamp érték [min, max] tartományba.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Normalizálja a százalékokat, hogy összegük 100% legyen.
 */
function normalize(shares: Record<string, number>): void {
  const total = Object.values(shares).reduce((a, b) => a + b, 0);
  if (total <= 0) return;

  for (const key of Object.keys(shares)) {
    shares[key] = (shares[key] / total) * 100;
  }
}

/**
 * Fő szimulációs motor.
 *
 * 1. OEVK eredmények: bázisév + uniform swing + egyedi felülírások → győztesek
 * 2. Töredékszavazatok: szimulált OEVK-kból számolva (nem történeti!)
 * 3. Listás mandátumok: listás szavazat + töredék → D'Hondt (93 mandátum, 5% küszöb)
 * 4. Összesítés: OEVK mandátumok + listás mandátumok
 */
export function runSimulation(input: SimulationInput): SimulationResult {
  const db = getDb();

  // Bázisév OEVK eredményeinek lekérése (2026-os OEVK-kra átszámolva)
  const baseOevkResults = db.prepare(`
    SELECT oevk_id_2026, party_id, votes, vote_share_pct, is_winner
    FROM oevk_results
    WHERE election_year = ? AND oevk_id_2026 IS NOT NULL
    ORDER BY oevk_id_2026, votes DESC
  `).all(input.baseYear) as Array<{
    oevk_id_2026: string;
    party_id: string;
    votes: number;
    vote_share_pct: number;
    is_winner: number;
  }>;

  // OEVK definíciók
  const oevkDefs = db.prepare(`
    SELECT oevk_id, county, display_name
    FROM oevk_definitions
    WHERE valid_to IS NULL OR valid_to >= 2026
    ORDER BY county, oevk_number
  `).all() as Array<{
    oevk_id: string;
    county: string;
    display_name: string;
  }>;

  // Csoportosítás OEVK-nként
  const oevkMap = new Map<string, typeof baseOevkResults>();
  for (const row of baseOevkResults) {
    const id = row.oevk_id_2026;
    if (!oevkMap.has(id)) oevkMap.set(id, []);
    oevkMap.get(id)!.push(row);
  }

  // Auto-swing mód: bázis országos listás arányok kiszámítása
  // Az OEVK szintű swing = listShares[party] - baseNationalShares[party]
  let autoSwingValues: Record<string, number> = {};
  if (input.swingMode === 'auto_swing') {
    // Bázisév országos listás arányok
    let baseListRows = db.prepare(`
      SELECT party_id, SUM(votes) as total_votes
      FROM list_results WHERE election_year = ? AND level = 'national'
      GROUP BY party_id
    `).all(input.baseYear) as Array<{ party_id: string; total_votes: number }>;

    if (baseListRows.length === 0) {
      // Fallback: egyéni szavazatok összesítése
      baseListRows = db.prepare(`
        SELECT party_id, SUM(votes) as total_votes
        FROM oevk_results WHERE election_year = ?
        GROUP BY party_id
      `).all(input.baseYear) as Array<{ party_id: string; total_votes: number }>;
    }

    const baseTotal = baseListRows.reduce((s, r) => s + r.total_votes, 0);
    const baseShares: Record<string, number> = {};
    for (const r of baseListRows) {
      const displayParty = PARTY_SUCCESSION[r.party_id] || r.party_id;
      baseShares[displayParty] = (baseShares[displayParty] || 0) +
        (baseTotal > 0 ? r.total_votes / baseTotal * 100 : 0);
    }

    // Swing = beállított - bázis
    for (const [party, share] of Object.entries(input.listShares)) {
      const baseShare = baseShares[party] || 0;
      autoSwingValues[party] = share - baseShare;
    }
  }

  // Listás küszöb meghatározása: mely pártok lépik át az 5%-ot
  const listShareTotal = Object.values(input.listShares).reduce((a, b) => a + b, 0);
  const eligibleParties = new Set<string>();
  for (const [party, share] of Object.entries(input.listShares)) {
    if (listShareTotal > 0 && share / listShareTotal >= 0.05) {
      eligibleParties.add(party);
    }
  }

  // 1. OEVK szimulációk
  const oevkResults: OevkSimResult[] = [];
  const allFragments: Map<string, number>[] = [];
  const oevkSeats: Record<string, number> = {};

  const oevkIds = oevkDefs.length > 0
    ? oevkDefs.map(d => d.oevk_id)
    : Array.from(oevkMap.keys());

  for (const oevkId of oevkIds) {
    const baseResults = oevkMap.get(oevkId) || [];
    const def = oevkDefs.find(d => d.oevk_id === oevkId);

    // Swing alkalmazása
    const newShares: Record<string, number> = {};

    if (baseResults.length > 0) {
      // Van bázisadat: swing alkalmazás
      for (const result of baseResults) {
        const baseParty = result.party_id;
        // A 2026-os párt neve (öröklés): pl. egyseges_ellenzek → tisza
        const displayParty = PARTY_SUCCESSION[baseParty] || baseParty;

        // Swing keresés
        let swing: number;
        if (input.swingMode === 'auto_swing') {
          // Auto swing: listás arány különbségből számolva
          swing = autoSwingValues[displayParty] || autoSwingValues[baseParty] || 0;
        } else {
          // Manuális uniform swing
          swing = (input.uniformSwing && input.uniformSwing[displayParty]) ||
                  (input.uniformSwing && input.uniformSwing[baseParty]) || 0;
        }

        // Egyedi OEVK felülírás (szintén mindkét névvel)
        if (input.oevkOverrides?.[oevkId]?.[displayParty]) {
          swing += input.oevkOverrides[oevkId][displayParty];
        } else if (input.oevkOverrides?.[oevkId]?.[baseParty]) {
          swing += input.oevkOverrides[oevkId][baseParty];
        }

        // Az eredményt a 2026-os párt neve alatt tároljuk
        newShares[displayParty] = clamp(
          (result.vote_share_pct || 0) + swing,
          0,
          100
        );
      }
    } else {
      // Nincs bázisadat: listás arányokat használjuk
      for (const [party, share] of Object.entries(input.listShares)) {
        let swing = (input.uniformSwing && input.uniformSwing[party]) || 0;
        if (input.oevkOverrides?.[oevkId]?.[party]) {
          swing += input.oevkOverrides[oevkId][party];
        }
        newShares[party] = clamp(share + swing, 0, 100);
      }
    }

    // Normalizálás 100%-ra
    normalize(newShares);

    // Szavazatszámok becslése a részvételi arány alapján
    const oevkVoters = Math.round((ELIGIBLE_VOTERS * input.turnoutPct / 100) / 106);
    const results: Array<{ party_id: string; vote_share_pct: number; votes: number }> = [];

    for (const [party, pct] of Object.entries(newShares)) {
      if (pct > 0) {
        results.push({
          party_id: party,
          vote_share_pct: pct,
          votes: Math.round(oevkVoters * pct / 100),
        });
      }
    }

    results.sort((a, b) => b.votes - a.votes);

    const winnerParty = results.length > 0 ? results[0].party_id : '';
    const margin = results.length >= 2
      ? results[0].vote_share_pct - results[1].vote_share_pct
      : results.length > 0 ? results[0].vote_share_pct : 0;

    // OEVK mandátum
    if (winnerParty) {
      oevkSeats[winnerParty] = (oevkSeats[winnerParty] || 0) + 1;
    }

    oevkResults.push({
      oevk_id: oevkId,
      display_name: def?.display_name || oevkId,
      county: def?.county || '',
      winner_party: winnerParty,
      results,
      margin,
    });

    // 2. Töredékszavazatok kiszámítása
    const candidates: OevkCandidateResult[] = results.map(r => ({
      party_id: r.party_id,
      votes: r.votes,
      is_independent: false,
    }));

    const oevkFragments = calculateFragmentVotes(candidates, eligibleParties);
    allFragments.push(oevkFragments);
  }

  // Összesített töredékszavazatok
  const totalFragments = aggregateFragmentVotes(allFragments);
  const fragmentVotes: Record<string, number> = {};
  for (const [party, votes] of totalFragments) {
    fragmentVotes[party] = votes;
  }

  // 3. Listás mandátumok D'Hondt módszerrel
  const totalVoters = Math.round(ELIGIBLE_VOTERS * input.turnoutPct / 100);
  const listVotes = new Map<string, number>();

  for (const [party, share] of Object.entries(input.listShares)) {
    const directListVotes = Math.round(totalVoters * share / 100);
    const fragments = fragmentVotes[party] || 0;
    listVotes.set(party, directListVotes + fragments);
  }

  const listSeatAllocation = dhondt(listVotes, 93, 0.05);
  const listSeats: Record<string, number> = {};
  for (const [party, seats] of listSeatAllocation) {
    listSeats[party] = seats;
  }

  // 4. Összesítés
  const totalSeats: Record<string, number> = {};
  const allParties = new Set([...Object.keys(oevkSeats), ...Object.keys(listSeats)]);

  for (const party of allParties) {
    totalSeats[party] = (oevkSeats[party] || 0) + (listSeats[party] || 0);
  }

  // Többség meghatározása
  let majority: string | null = null;
  let supermajority = false;

  for (const [party, seats] of Object.entries(totalSeats)) {
    if (seats >= 100) {
      majority = party;
      if (seats >= 133) {
        supermajority = true;
      }
    }
  }

  return {
    totalSeats,
    oevkResults,
    oevkSeats,
    listSeats,
    fragmentVotes,
    majority,
    supermajority,
  };
}
