import { Router } from 'express';
import { getDb } from '../db/database';

export const oevkRouter = Router();

// GET /api/oevk/definitions — 2026-os OEVK lista
oevkRouter.get('/definitions', (_req, res) => {
  const db = getDb();
  const definitions = db.prepare(`
    SELECT * FROM oevk_definitions
    WHERE valid_to IS NULL OR valid_to >= 2026
    ORDER BY county, oevk_number
  `).all();

  res.json(definitions);
});

// GET /api/oevk/:id/history — Egy OEVK történeti eredményei + 2026 jelöltek
oevkRouter.get('/:id/history', (req, res) => {
  const db = getDb();
  const oevkId = req.params.id;

  // Egyéni eredmények (OEVK jelöltek)
  const oevkResults = db.prepare(`
    SELECT r.election_year, r.party_id, r.candidate_name, r.votes, r.vote_share_pct, r.is_winner,
           p.short_name as party_name, p.color as party_color
    FROM oevk_results r
    JOIN parties p ON r.party_id = p.id
    WHERE r.oevk_id_2026 = ?
    ORDER BY r.election_year DESC, r.votes DESC
  `).all(oevkId);

  // Listás eredmények OEVK szinten (settlement_results-ból aggregálva, ha van)
  // Egyébként a list_results tábla oevk_id mezőjéből
  const listResults = db.prepare(`
    SELECT r.election_year, r.party_id, r.votes, r.vote_share_pct,
           p.short_name as party_name, p.color as party_color
    FROM list_results r
    JOIN parties p ON r.party_id = p.id
    WHERE r.oevk_id = ?
    ORDER BY r.election_year DESC, r.votes DESC
  `).all(oevkId);

  // Csoportosítás évek szerint
  const egyeni: Record<number, typeof oevkResults> = {};
  for (const row of oevkResults as Array<{ election_year: number }>) {
    if (!egyeni[row.election_year]) egyeni[row.election_year] = [];
    egyeni[row.election_year].push(row);
  }

  const listas: Record<number, typeof listResults> = {};
  for (const row of listResults as Array<{ election_year: number }>) {
    if (!listas[row.election_year]) listas[row.election_year] = [];
    listas[row.election_year].push(row);
  }

  res.json({ egyeni, listas });
});
