/**
 * Töredékszavazat-számítás a magyar választási rendszerben.
 *
 * Szabályok:
 * - Vesztes jelöltek ÖSSZES szavazata → töredékszavazat
 *   (csak ha a párt átlépte a küszöböt és van országos listája)
 * - Győztes jelöltnél: győztes_szavazat - második_szavazat - 1 → töredékszavazat
 * - Független jelöltek szavazatai NEM számítanak töredékszavazatnak
 */

export interface OevkCandidateResult {
  party_id: string;
  votes: number;
  is_independent: boolean;
}

/**
 * Kiszámítja egy OEVK töredékszavazatait.
 *
 * @param candidates - Az OEVK jelöltjeinek eredményei, csökkenő szavazatszám szerint rendezve
 * @param eligibleParties - Küszöböt átlépő, listával rendelkező pártok halmaza
 * @returns Párt → töredékszavazat leképezés
 */
export function calculateFragmentVotes(
  candidates: OevkCandidateResult[],
  eligibleParties: Set<string>
): Map<string, number> {
  const fragments = new Map<string, number>();

  if (candidates.length === 0) return fragments;

  // Szavazatszám szerint csökkenő sorrendben
  const sorted = [...candidates].sort((a, b) => b.votes - a.votes);
  const winner = sorted[0];
  const runnerUp = sorted.length > 1 ? sorted[1] : null;

  for (const candidate of sorted) {
    // Független jelöltek szavazatai nem számítanak
    if (candidate.is_independent) continue;

    // Csak küszöböt átlépő, listás pártok kapnak töredékszavazatot
    if (!eligibleParties.has(candidate.party_id)) continue;

    if (candidate === winner) {
      // Győztes töredékszavazata: győztes - második - 1
      if (runnerUp) {
        const winnerFragment = winner.votes - runnerUp.votes - 1;
        if (winnerFragment > 0) {
          fragments.set(candidate.party_id, winnerFragment);
        }
      }
      // Ha nincs második helyezett, nincs győztes töredékszavazat
    } else {
      // Vesztes jelölt összes szavazata
      const current = fragments.get(candidate.party_id) || 0;
      fragments.set(candidate.party_id, current + candidate.votes);
    }
  }

  return fragments;
}

/**
 * Összesíti az összes OEVK töredékszavazatait.
 *
 * @param allOevkFragments - OEVK-nkénti töredékszavazatok
 * @returns Országos összesített töredékszavazat pártonként
 */
export function aggregateFragmentVotes(
  allOevkFragments: Map<string, number>[]
): Map<string, number> {
  const total = new Map<string, number>();

  for (const oevkFragments of allOevkFragments) {
    for (const [party, votes] of oevkFragments) {
      total.set(party, (total.get(party) || 0) + votes);
    }
  }

  return total;
}
