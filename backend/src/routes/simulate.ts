import { Router } from 'express';
import { SimulationInput } from '../types/election';
import { runSimulation } from '../services/simulation';
import { getDb } from '../db/database';

export const simulateRouter = Router();

// POST /api/simulate — Szimuláció futtatása
simulateRouter.post('/', (req, res) => {
  const input = req.body as SimulationInput;

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

// POST /api/simulate/mps — 199 képviselő predikció
simulateRouter.post('/mps', (req, res) => {
  const input = req.body as SimulationInput;

  try {
    const result = runSimulation(input);
    const db = getDb();

    const mps: Array<{
      name: string;
      party_id: string;
      source: 'oevk' | 'lista';
      oevk_id?: string;
      oevk_name?: string;
      list_position?: number;
      original_list_position?: number;
    }> = [];

    // 1. OEVK győztesek (106 OEVK)
    const oevkWinnerNames: Record<string, Set<string>> = {}; // party → winner names

    for (const oevk of result.oevkResults) {
      const winner = oevk.winner_party;
      if (!winner) continue;

      // 2026-os jelölt neve keresése
      const candidate = db.prepare(`
        SELECT candidate_name FROM oevk_results
        WHERE election_year = 2026 AND oevk_id = ? AND party_id = ?
        LIMIT 1
      `).get(oevk.oevk_id, winner) as { candidate_name: string } | undefined;

      const name = candidate?.candidate_name || `${oevk.display_name} győztes`;

      mps.push({
        name,
        party_id: winner,
        source: 'oevk',
        oevk_id: oevk.oevk_id,
        oevk_name: oevk.display_name,
      });

      if (!oevkWinnerNames[winner]) oevkWinnerNames[winner] = new Set();
      oevkWinnerNames[winner].add(name.toUpperCase().trim());
    }

    // 2. Listás mandátumosok (93 lista)
    for (const [partyId, seats] of Object.entries(result.listSeats)) {
      if (seats <= 0) continue;

      // Megnyert OEVK-k
      const wonOevks = result.oevkResults
        .filter(r => r.winner_party === partyId)
        .map(r => r.oevk_id);

      // Lista jelöltek lekérése (OEVK győztesek kiszűrve)
      let listCandidates: Array<{ position: number; candidate_name: string }>;

      if (wonOevks.length > 0) {
        const placeholders = wonOevks.map(() => '?').join(',');
        const winnerNamesRows = db.prepare(`
          SELECT candidate_name FROM oevk_results
          WHERE election_year = 2026 AND party_id = ? AND oevk_id IN (${placeholders})
        `).all(partyId, ...wonOevks) as Array<{ candidate_name: string }>;

        const winnerSet = new Set(winnerNamesRows.map(w => w.candidate_name.toUpperCase().trim()));

        const allList = db.prepare(`
          SELECT position, candidate_name FROM list_candidates
          WHERE party_id = ? ORDER BY position ASC
        `).all(partyId) as Array<{ position: number; candidate_name: string }>;

        listCandidates = allList.filter(c => !winnerSet.has(c.candidate_name.toUpperCase().trim()));
      } else {
        listCandidates = db.prepare(`
          SELECT position, candidate_name FROM list_candidates
          WHERE party_id = ? ORDER BY position ASC
        `).all(partyId) as Array<{ position: number; candidate_name: string }>;
      }

      for (let i = 0; i < seats && i < listCandidates.length; i++) {
        mps.push({
          name: listCandidates[i].candidate_name,
          party_id: partyId,
          source: 'lista',
          list_position: i + 1,
          original_list_position: listCandidates[i].position,
        });
      }

      // Ha nincs elég listajelölt
      for (let i = listCandidates.length; i < seats; i++) {
        mps.push({
          name: `${partyId} lista #${i + 1}`,
          party_id: partyId,
          source: 'lista',
          list_position: i + 1,
        });
      }
    }

    res.json({
      mps,
      totalSeats: result.totalSeats,
      oevkSeats: result.oevkSeats,
      listSeats: result.listSeats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ error: `MP predikció hiba: ${message}` });
  }
});
