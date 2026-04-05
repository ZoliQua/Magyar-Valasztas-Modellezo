import { Router } from 'express';
import { getDb } from '../db/database';

export const pollsRouter = Router();

// GET /api/polls — Közvélemény-kutatások
pollsRouter.get('/', (req, res) => {
  const db = getDb();
  let query = 'SELECT * FROM polls WHERE 1=1';
  const params: unknown[] = [];

  if (req.query.institute) {
    query += ' AND institute = ?';
    params.push(req.query.institute);
  }
  if (req.query.basis) {
    query += ' AND basis = ?';
    params.push(req.query.basis);
  }
  if (req.query.from) {
    query += ' AND poll_date >= ?';
    params.push(req.query.from);
  }
  if (req.query.to) {
    query += ' AND poll_date <= ?';
    params.push(req.query.to);
  }

  query += ' ORDER BY poll_date DESC, institute';
  const polls = db.prepare(query).all(...params);
  res.json(polls);
});

// GET /api/polls/trend — Trend adatok (idősor)
pollsRouter.get('/trend', (req, res) => {
  const db = getDb();
  const basis = req.query.basis || 'biztos_partvalaszto';

  const polls = db.prepare(`
    SELECT poll_date, institute, party_id, support_pct
    FROM polls
    WHERE basis = ?
    ORDER BY poll_date ASC, party_id
  `).all(basis);

  res.json(polls);
});

// POST /api/polls/import — CSV import
pollsRouter.post('/import', (req, res) => {
  const db = getDb();
  const { rows } = req.body as { rows: Array<{
    date: string;
    institute: string;
    basis: string;
    sample_size?: number;
    margin_of_error?: number;
    source_url?: string;
    [partyId: string]: unknown;
  }> };

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'Hiányzó vagy üres rows mező' });
    return;
  }

  const validBases = ['teljes_nepesseg', 'partvalaszto', 'biztos_partvalaszto'];
  const knownFields = ['date', 'institute', 'basis', 'sample_size', 'margin_of_error', 'source_url'];

  const insert = db.prepare(`
    INSERT INTO polls (poll_date, institute, basis, party_id, support_pct, sample_size, margin_of_error, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  const errors: string[] = [];

  const transaction = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (!row.date || !row.institute || !row.basis) {
        errors.push(`Sor ${i + 1}: hiányzó date, institute vagy basis`);
        continue;
      }

      if (!validBases.includes(row.basis)) {
        errors.push(`Sor ${i + 1}: érvénytelen basis: ${row.basis}`);
        continue;
      }

      // Party columns: anything not in knownFields
      for (const [key, value] of Object.entries(row)) {
        if (knownFields.includes(key)) continue;
        if (typeof value !== 'number') continue;

        insert.run(
          row.date,
          row.institute,
          row.basis,
          key,
          value,
          row.sample_size ?? null,
          row.margin_of_error ?? null,
          row.source_url ?? null
        );
        imported++;
      }
    }
  });

  transaction();

  res.json({ imported, errors });
});
