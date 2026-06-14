import { getDb } from '../db/database';
import { SimulationResult, OevkSimResult } from '../types/election';
import { dhondt } from './dhondt';
import { calculateFragmentVotes, aggregateFragmentVotes, OevkCandidateResult } from './fragments';

/**
 * Tényleges (hivatalos) választási eredmény kiszámítása a tárolt adatokból.
 *
 * Ez NEM szimuláció: a valós, eltárolt OEVK- és listás szavazatokból
 * számolja a mandátumokat, ugyanazokkal a determinisztikus függvényekkel
 * (D'Hondt, töredékszavazat), mint a szimulációs motor — így a kimenet
 * formátuma azonos (SimulationResult), és a frontend ugyanazokkal a
 * komponensekkel jeleníti meg.
 *
 * Lépések (a magyar választási rendszer szabályai szerint):
 *  1. OEVK győztesek: relatív többség (a tárolt is_winner, ill. legtöbb szavazat)
 *  2. Töredékszavazat: vesztesek szavazatai + győztes többlet — a VALÓS OEVK
 *     eredményekből (csak küszöböt átlépő, listát állító pártoknak)
 *  3. Listás mandátumok: listás szavazat + töredék → D'Hondt (93 hely, 5% küszöb)
 *  4. Összesítés: OEVK + listás mandátum
 *
 * @param year - választási év (pl. 2026)
 * @returns SimulationResult, vagy null ha nincs teljes eredményadat az évre
 */
export function computeActualResult(year: number): SimulationResult | null {
  const db = getDb();

  // Van-e valós OEVK eredmény (szavazatszámmal) erre az évre?
  const hasResults = db.prepare(
    `SELECT COUNT(*) AS n FROM oevk_results WHERE election_year = ? AND votes > 0`
  ).get(year) as { n: number };
  if (!hasResults || hasResults.n === 0) return null;

  // OEVK eredmények (2026-os körzetbeosztás szerint)
  const oevkRows = db.prepare(`
    SELECT oevk_id_2026, oevk_id, party_id, candidate_name, votes, vote_share_pct, is_winner
    FROM oevk_results
    WHERE election_year = ?
    ORDER BY oevk_id_2026, votes DESC
  `).all(year) as Array<{
    oevk_id_2026: string | null;
    oevk_id: string;
    party_id: string;
    candidate_name: string | null;
    votes: number;
    vote_share_pct: number | null;
    is_winner: number;
  }>;

  // OEVK definíciók (megjelenítési névhez)
  const oevkDefs = db.prepare(`
    SELECT oevk_id, county, display_name
    FROM oevk_definitions
    WHERE valid_to IS NULL OR valid_to >= ?
    ORDER BY county, oevk_number
  `).all(year) as Array<{ oevk_id: string; county: string; display_name: string }>;
  const defMap = new Map(oevkDefs.map(d => [d.oevk_id, d]));

  // Országos listás szavazatok
  const listRows = db.prepare(`
    SELECT party_id, SUM(votes) AS votes
    FROM list_results
    WHERE election_year = ? AND level = 'national'
    GROUP BY party_id
  `).all(year) as Array<{ party_id: string; votes: number }>;

  const listVotesByParty = new Map<string, number>();
  for (const r of listRows) {
    listVotesByParty.set(r.party_id, (listVotesByParty.get(r.party_id) || 0) + r.votes);
  }
  const totalListVotes = Array.from(listVotesByParty.values()).reduce((a, b) => a + b, 0);

  // Küszöböt átlépő, listát állító pártok (töredékszavazatra jogosultak).
  // 'other' (kis pártok + függetlenek gyűjtője) sosem jogosult.
  const eligibleParties = new Set<string>();
  for (const [party, votes] of listVotesByParty) {
    if (party === 'other') continue;
    if (totalListVotes > 0 && votes / totalListVotes >= 0.05) {
      eligibleParties.add(party);
    }
  }

  // Csoportosítás OEVK-nként
  const byOevk = new Map<string, typeof oevkRows>();
  for (const row of oevkRows) {
    const id = row.oevk_id_2026 || row.oevk_id;
    if (!byOevk.has(id)) byOevk.set(id, []);
    byOevk.get(id)!.push(row);
  }

  const oevkResults: OevkSimResult[] = [];
  const oevkSeats: Record<string, number> = {};
  const allFragments: Map<string, number>[] = [];

  for (const [oevkId, rows] of byOevk) {
    const sorted = [...rows].sort((a, b) => b.votes - a.votes);
    const def = defMap.get(oevkId);

    const results = sorted.map(r => ({
      party_id: r.party_id,
      vote_share_pct: r.vote_share_pct || 0,
      votes: r.votes,
    }));

    // Győztes: a tárolt is_winner, vagy a legtöbb szavazatot kapott
    const winnerRow = sorted.find(r => r.is_winner === 1) || sorted[0];
    const winnerParty = winnerRow ? winnerRow.party_id : '';
    const margin = sorted.length >= 2
      ? (sorted[0].vote_share_pct || 0) - (sorted[1].vote_share_pct || 0)
      : (sorted[0]?.vote_share_pct || 0);

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

    // Töredékszavazat a valós OEVK eredményből.
    // Független = 'other' párt (a kis pártok/függetlenek gyűjtője) — úgyis kizárt,
    // mert nem szerepel az eligibleParties halmazban.
    const candidates: OevkCandidateResult[] = sorted.map(r => ({
      party_id: r.party_id,
      votes: r.votes,
      is_independent: r.party_id === 'other',
    }));
    allFragments.push(calculateFragmentVotes(candidates, eligibleParties));
  }

  // Összesített töredékszavazat
  const totalFragments = aggregateFragmentVotes(allFragments);
  const fragmentVotes: Record<string, number> = {};
  for (const [party, votes] of totalFragments) {
    fragmentVotes[party] = votes;
  }

  // Listás mandátumok: listás szavazat + töredék → D'Hondt
  const dhondtVotes = new Map<string, number>();
  for (const [party, votes] of listVotesByParty) {
    if (party === 'other') continue;
    dhondtVotes.set(party, votes + (fragmentVotes[party] || 0));
  }

  const listSeatAllocation = dhondt(dhondtVotes, 93, 0.05);
  const listSeats: Record<string, number> = {};
  for (const [party, seats] of listSeatAllocation) {
    listSeats[party] = seats;
  }

  // Összesítés
  const totalSeats: Record<string, number> = {};
  const allParties = new Set([...Object.keys(oevkSeats), ...Object.keys(listSeats)]);
  for (const party of allParties) {
    totalSeats[party] = (oevkSeats[party] || 0) + (listSeats[party] || 0);
  }

  let majority: string | null = null;
  let supermajority = false;
  for (const [party, seats] of Object.entries(totalSeats)) {
    if (seats >= 100) {
      majority = party;
      if (seats >= 133) supermajority = true;
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
