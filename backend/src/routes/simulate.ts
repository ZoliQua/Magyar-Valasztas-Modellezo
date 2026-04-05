import { Router } from 'express';
import { SimulationInput } from '../types/election';
import { runSimulation } from '../services/simulation';

export const simulateRouter = Router();

// POST /api/simulate — Szimuláció futtatása
simulateRouter.post('/', (req, res) => {
  const input = req.body as SimulationInput;

  // Validáció
  if (!input.listShares || typeof input.listShares !== 'object') {
    res.status(400).json({ error: 'Hiányzó listShares mező' });
    return;
  }
  if (!input.baseYear || typeof input.baseYear !== 'number') {
    res.status(400).json({ error: 'Hiányzó vagy érvénytelen baseYear' });
    return;
  }
  if (!input.turnoutPct || input.turnoutPct < 0 || input.turnoutPct > 100) {
    res.status(400).json({ error: 'turnoutPct 0 és 100 között kell legyen' });
    return;
  }

  try {
    const result = runSimulation(input);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ error: `Szimuláció hiba: ${message}` });
  }
});
