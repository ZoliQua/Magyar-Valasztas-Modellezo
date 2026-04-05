import { Router } from 'express';
import { getDb } from '../db/database';

export const electionsRouter = Router();

// GET /api/elections — Választási évek listája
electionsRouter.get('/', (_req, res) => {
  const db = getDb();
  const elections = db.prepare('SELECT * FROM elections ORDER BY year DESC').all();
  res.json(elections);
});

// GET /api/elections/:year/oevk — OEVK eredmények
electionsRouter.get('/:year/oevk', (req, res) => {
  const db = getDb();
  const year = parseInt(req.params.year, 10);
  if (isNaN(year)) {
    res.status(400).json({ error: 'Érvénytelen évszám' });
    return;
  }

  const results = db.prepare(`
    SELECT r.*, p.short_name as party_name, p.color as party_color
    FROM oevk_results r
    JOIN parties p ON r.party_id = p.id
    WHERE r.election_year = ?
    ORDER BY r.oevk_id, r.votes DESC
  `).all(year);

  res.json(results);
});

// GET /api/elections/:year/list — Listás eredmények
electionsRouter.get('/:year/list', (req, res) => {
  const db = getDb();
  const year = parseInt(req.params.year, 10);
  if (isNaN(year)) {
    res.status(400).json({ error: 'Érvénytelen évszám' });
    return;
  }

  const results = db.prepare(`
    SELECT r.*, p.short_name as party_name, p.color as party_color
    FROM list_results r
    JOIN parties p ON r.party_id = p.id
    WHERE r.election_year = ?
    ORDER BY r.votes DESC
  `).all(year);

  res.json(results);
});

// GET /api/elections/:year/oevk/:id — Egy OEVK részletes eredménye
electionsRouter.get('/:year/oevk/:id', (req, res) => {
  const db = getDb();
  const year = parseInt(req.params.year, 10);
  const oevkId = req.params.id;

  if (isNaN(year)) {
    res.status(400).json({ error: 'Érvénytelen évszám' });
    return;
  }

  const oevkResults = db.prepare(`
    SELECT r.*, p.short_name as party_name, p.color as party_color
    FROM oevk_results r
    JOIN parties p ON r.party_id = p.id
    WHERE r.election_year = ? AND (r.oevk_id = ? OR r.oevk_id_2026 = ?)
    ORDER BY r.votes DESC
  `).all(year, oevkId, oevkId);

  const listResults = db.prepare(`
    SELECT r.*, p.short_name as party_name, p.color as party_color
    FROM list_results r
    JOIN parties p ON r.party_id = p.id
    WHERE r.election_year = ? AND r.oevk_id = ?
    ORDER BY r.votes DESC
  `).all(year, oevkId);

  res.json({ oevk: oevkResults, list: listResults });
});

// GET /api/elections/compare — Évek összehasonlítása
electionsRouter.get('/compare', (req, res) => {
  const db = getDb();
  const years = (req.query.years as string || '').split(',').map(Number).filter(y => !isNaN(y));

  if (years.length === 0) {
    res.status(400).json({ error: 'Adj meg legalább egy évszámot (years=2014,2018,2022)' });
    return;
  }

  const placeholders = years.map(() => '?').join(',');
  const results = db.prepare(`
    SELECT r.*, p.short_name as party_name, p.color as party_color
    FROM oevk_results r
    JOIN parties p ON r.party_id = p.id
    WHERE r.election_year IN (${placeholders})
    ORDER BY r.election_year, r.oevk_id_2026, r.votes DESC
  `).all(...years);

  res.json(results);
});

// GET /api/elections/:year/national-shares — Országos listás/egyéni arányok
electionsRouter.get('/:year/national-shares', (req, res) => {
  const db = getDb();
  const year = parseInt(req.params.year, 10);
  if (isNaN(year)) {
    res.status(400).json({ error: 'Érvénytelen évszám' });
    return;
  }

  let rows = db.prepare(`
    SELECT party_id, SUM(votes) as total_votes
    FROM list_results WHERE election_year = ? AND level = 'national'
    GROUP BY party_id ORDER BY total_votes DESC
  `).all(year) as Array<{ party_id: string; total_votes: number }>;

  if (rows.length === 0) {
    rows = db.prepare(`
      SELECT party_id, SUM(votes) as total_votes
      FROM oevk_results WHERE election_year = ?
      GROUP BY party_id ORDER BY total_votes DESC
    `).all(year) as Array<{ party_id: string; total_votes: number }>;
  }

  const total = rows.reduce((s, r) => s + r.total_votes, 0);
  const shares: Record<string, number> = {};
  for (const r of rows) {
    const pct = total > 0 ? Math.round(r.total_votes / total * 1000) / 10 : 0;
    const partyId = r.party_id === 'egyseges_ellenzek' ? 'tisza' : r.party_id;
    shares[partyId] = (shares[partyId] || 0) + pct;
  }

  res.json(shares);
});
