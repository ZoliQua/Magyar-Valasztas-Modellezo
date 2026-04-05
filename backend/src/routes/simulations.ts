import { Router } from 'express';
import { getDb } from '../db/database';

export const simulationsRouter = Router();

// GET /api/simulations — Mentett szimulációk
simulationsRouter.get('/', (_req, res) => {
  const db = getDb();
  const simulations = db.prepare(
    'SELECT id, name, created_at, description FROM simulations ORDER BY created_at DESC'
  ).all();
  res.json(simulations);
});

// POST /api/simulations — Szimuláció mentése
simulationsRouter.post('/', (req, res) => {
  const db = getDb();
  const { name, description, config } = req.body as {
    name: string;
    description?: string;
    config: unknown;
  };

  if (!name || !config) {
    res.status(400).json({ error: 'Hiányzó name vagy config mező' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO simulations (name, description, config_json) VALUES (?, ?, ?)'
  ).run(name, description ?? null, JSON.stringify(config));

  res.json({ id: result.lastInsertRowid });
});

// GET /api/simulations/:id — Egy szimuláció betöltése
simulationsRouter.get('/:id', (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Érvénytelen azonosító' });
    return;
  }

  const simulation = db.prepare('SELECT * FROM simulations WHERE id = ?').get(id);

  if (!simulation) {
    res.status(404).json({ error: 'Szimuláció nem található' });
    return;
  }

  res.json(simulation);
});
