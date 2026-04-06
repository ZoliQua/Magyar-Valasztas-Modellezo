import { useState, useCallback, useEffect } from 'react';
import type { Party, SimulationInput, SimulationResult, MPPrediction } from '../types/election';
import { api } from '../services/api';

const DEFAULT_INPUT: SimulationInput = {
  listShares: {
    fidesz_kdnp: 40,
    tisza: 45,
    mi_hazank: 7,
    dk: 3,
    mkkp: 2,
    other: 3,
  },
  uniformSwing: {},
  oevkOverrides: {},
  baseYear: 2022,
  turnoutPct: 70,
  swingMode: 'auto_swing',
};

export function useSimulation() {
  const [input, setInput] = useState<SimulationInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [mpPrediction, setMpPrediction] = useState<MPPrediction | null>(null);

  useEffect(() => {
    api.getParties().then(p => {
      setParties(p);
      // Szimuláció és MP predikció egymástól függetlenül
      api.simulate(DEFAULT_INPUT).then(setResult).catch(() => {});
      api.simulateMPs(DEFAULT_INPUT).then(setMpPrediction).catch(() => {});
    }).catch(() => {});
  }, []);

  const runSimulation = useCallback(async (newInput?: SimulationInput) => {
    const simInput = newInput || input;
    setLoading(true);
    setError(null);
    try {
      const res = await api.simulate(simInput);
      setResult(res);
      if (newInput) setInput(newInput);
      // MP predikció háttérben — nem blokkolja a fő szimulációt
      api.simulateMPs(simInput).then(setMpPrediction).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Szimuláció hiba');
    } finally {
      setLoading(false);
    }
  }, [input]);

  /** Listás %-ok beállítása 100%-os constrainttel: az "other" kompenzál */
  const updateListShareConstrained = useCallback((partyId: string, value: number) => {
    setInput(prev => {
      const newShares = { ...prev.listShares };
      const oldValue = newShares[partyId] || 0;
      const diff = value - oldValue;

      if (partyId === 'other') {
        // Egyéb nem állítható közvetlenül — csak csökkentéssel nő
        return prev;
      }

      const otherCurrent = newShares['other'] || 0;

      // Növelés: csak ha az Egyéb-ből el tudjuk venni
      if (diff > 0 && otherCurrent < diff) {
        // Csak annyit növelünk amennyit az Egyéb-ből el lehet venni
        const maxIncrease = otherCurrent;
        newShares[partyId] = oldValue + maxIncrease;
        newShares['other'] = 0;
      } else {
        newShares[partyId] = value;
        newShares['other'] = Math.max(0, otherCurrent - diff);
      }

      return { ...prev, listShares: newShares };
    });
    setActivePreset(null); // Preset deaktiválás
  }, []);

  const updateSwing = useCallback((partyId: string, value: number) => {
    setInput(prev => ({
      ...prev,
      uniformSwing: { ...prev.uniformSwing, [partyId]: value },
    }));
  }, []);

  const updateTurnout = useCallback((value: number) => {
    setInput(prev => ({ ...prev, turnoutPct: value }));
  }, []);

  const setSwingMode = useCallback((mode: 'national' | 'auto_swing') => {
    setInput(prev => ({ ...prev, swingMode: mode }));
  }, []);

  /** Preset betöltése: 2022 vagy 2018 országos arányok */
  const loadPreset = useCallback(async (year: number) => {
    try {
      const res = await fetch(`/api/elections/${year}/national-shares`);
      if (!res.ok) throw new Error('Preset betöltése sikertelen');
      const shares: Record<string, number> = await res.json();

      // Összesítés: a kis pártokat "other"-be
      const mainParties = ['fidesz_kdnp', 'tisza', 'mi_hazank', 'dk', 'mkkp'];
      const listShares: Record<string, number> = {};
      let otherTotal = 0;

      for (const [party, pct] of Object.entries(shares)) {
        if (mainParties.includes(party)) {
          listShares[party] = Math.round(pct * 10) / 10;
        } else {
          otherTotal += pct;
        }
      }
      // Ha valamelyik fő párt hiányzik, 0-t adunk
      for (const p of mainParties) {
        if (!(p in listShares)) listShares[p] = 0;
      }
      listShares['other'] = Math.round(otherTotal * 10) / 10;

      // Normalizálás 100%-ra
      const total = Object.values(listShares).reduce((a, b) => a + b, 0);
      if (Math.abs(total - 100) > 0.5) {
        const factor = 100 / total;
        for (const key of Object.keys(listShares)) {
          listShares[key] = Math.round(listShares[key] * factor * 10) / 10;
        }
      }

      setInput(prev => ({ ...prev, listShares }));
      setActivePreset(year);
    } catch {
      // Silently fail
    }
  }, []);

  return {
    input,
    setInput,
    result,
    mpPrediction,
    parties,
    loading,
    error,
    activePreset,
    runSimulation,
    updateListShare: updateListShareConstrained,
    updateSwing,
    updateTurnout,
    setSwingMode,
    loadPreset,
  };
}
