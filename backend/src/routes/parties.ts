import { Router } from 'express';
import { getDb } from '../db/database';

export const partiesRouter = Router();

// GET /api/parties — Pártok listája
partiesRouter.get('/', (_req, res) => {
  const db = getDb();
  const parties = db.prepare('SELECT * FROM parties ORDER BY sort_order').all();
  res.json(parties);
});

// GET /api/parties/:id/list-candidates — Országos lista jelöltjei sorszám szerint
// ?wonOevks=01_01,01_02,... → OEVK győzteseket kiszűri a listáról
partiesRouter.get('/:id/list-candidates', (req, res) => {
  const db = getDb();
  const partyId = req.params.id;
  const wonOevksParam = req.query.wonOevks as string | undefined;

  // Összes listajelölt
  const allCandidates = db.prepare(`
    SELECT position, candidate_name, list_name, list_type
    FROM list_candidates
    WHERE party_id = ?
    ORDER BY position ASC
  `).all(partyId) as Array<{
    position: number;
    candidate_name: string;
    list_name: string;
    list_type: string;
  }>;

  if (!wonOevksParam) {
    res.json(allCandidates);
    return;
  }

  // OEVK győztesek nevei: akik megnyerték az egyéni mandátumukat
  const wonOevks = wonOevksParam.split(',').filter(Boolean);
  if (wonOevks.length === 0) {
    res.json(allCandidates);
    return;
  }

  // 2026-os OEVK jelöltek keresése a megnyert körzetekben
  const placeholders = wonOevks.map(() => '?').join(',');
  const oevkWinnerNames = db.prepare(`
    SELECT candidate_name FROM oevk_results
    WHERE election_year = 2026 AND party_id = ? AND oevk_id IN (${placeholders})
  `).all(partyId, ...wonOevks) as Array<{ candidate_name: string }>;

  const winnerNameSet = new Set(
    oevkWinnerNames.map(w => w.candidate_name.toUpperCase().trim())
  );

  // Lista szűrése: OEVK győztesek kiesnek
  const filtered = allCandidates.filter(
    c => !winnerNameSet.has(c.candidate_name.toUpperCase().trim())
  );

  // Jelezzük melyik jelölteket szűrtük ki
  const result = filtered.map((c, i) => ({
    ...c,
    effective_position: i + 1,
  }));

  res.json(result);
});
