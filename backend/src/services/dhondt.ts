/**
 * D'Hondt módszer implementáció a magyar választási rendszerhez.
 *
 * A D'Hondt (Jefferson) módszer a leggyakrabban használt arányos
 * mandátumelosztási módszer. Minden körben a legnagyobb hányadosú
 * párt kap egy mandátumot: szavazat / (eddigi_mandátumok + 1).
 */

/**
 * D'Hondt mandátumelosztás.
 *
 * @param votes - Párt → szavazatszám leképezés
 * @param seats - Elosztandó mandátumok száma
 * @param threshold - Parlamenti küszöb (0.05 = 5%)
 * @returns Párt → mandátumszám leképezés
 */
export function dhondt(
  votes: Map<string, number>,
  seats: number,
  threshold: number
): Map<string, number> {
  // 1. Összszavazat és küszöb alatti pártok kiszűrése
  const totalVotes = Array.from(votes.values()).reduce((a, b) => a + b, 0);
  const eligible = new Map<string, number>();

  for (const [party, count] of votes) {
    if (totalVotes > 0 && count / totalVotes >= threshold) {
      eligible.set(party, count);
    }
  }

  // 2. Mandátumelosztás
  const result = new Map<string, number>();
  for (const party of eligible.keys()) {
    result.set(party, 0);
  }

  if (eligible.size === 0) return result;

  for (let i = 0; i < seats; i++) {
    let maxQuotient = -1;
    let maxParty = '';

    for (const [party, count] of eligible) {
      const currentSeats = result.get(party) || 0;
      const quotient = count / (currentSeats + 1);

      if (quotient > maxQuotient) {
        maxQuotient = quotient;
        maxParty = party;
      }
    }

    if (maxParty) {
      result.set(maxParty, (result.get(maxParty) || 0) + 1);
    }
  }

  return result;
}

/**
 * Küszöb meghatározása szövetségek alapján.
 *
 * Magyar szabály:
 * - 1 párt: 5%
 * - 2 párt közös lista: 10%
 * - 3+ párt közös lista: 15%
 *
 * @param partyCount - Közös listán szereplő pártok száma
 * @returns Küszöb (0.05, 0.10, vagy 0.15)
 */
export function getThreshold(partyCount: number): number {
  if (partyCount <= 1) return 0.05;
  if (partyCount === 2) return 0.10;
  return 0.15;
}
