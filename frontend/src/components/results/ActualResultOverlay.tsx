import { useEffect, useState } from 'react';
import type { SimulationResult } from '../../types/election';
import { api } from '../../services/api';
import HemicycleChart from './HemicycleChart';
import SeatSummary from './SeatSummary';
import MajorityIndicator from './MajorityIndicator';

interface ActualResultOverlayProps {
  year: number;
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
}

/**
 * Tényleges (hivatalos) választási eredmény overlay.
 *
 * A szimulációtól vizuálisan és felirattal EGYÉRTELMŰEN elkülönítve jeleníti meg
 * a valós, jogerős eredményt (NVI / valasztas.hu). Ugyanazokat az eredmény-
 * komponenseket használja, mint a szimuláció, hogy a két nézet összevethető legyen.
 *
 * Kezeli a betöltés / hiba / nincs adat állapotokat.
 */
export default function ActualResultOverlay({ year, partyColors, partyNames }: ActualResultOverlayProps) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getActualResult(year)
      .then(r => { if (!cancelled) setResult(r); })
      .catch(() => { if (!cancelled) setError(`Nincs elérhető tényleges eredmény (${year}).`); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year]);

  return (
    <section className="rounded-xl border-2 border-amber-500/60 bg-amber-950/10 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold px-2.5 py-1 border border-amber-500/40">
          TÉNYLEGES EREDMÉNY
        </span>
        <h3 className="text-sm font-semibold text-amber-200">
          {year}. évi országgyűlési választás — hivatalos, jogerős (NVI / valasztas.hu)
        </h3>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32 text-amber-200/60 text-sm">
          Tényleges eredmény betöltése…
        </div>
      )}

      {!loading && error && (
        <div className="text-amber-200/70 text-sm bg-amber-900/20 border border-amber-800/40 rounded p-3">
          {error}
        </div>
      )}

      {!loading && !error && result && (
        <>
          <MajorityIndicator
            majority={result.majority}
            supermajority={result.supermajority}
            partyNames={partyNames}
            partyColors={partyColors}
            totalSeats={result.totalSeats}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HemicycleChart
              seats={result.totalSeats}
              partyColors={partyColors}
              partyNames={partyNames}
              majority={result.majority}
              supermajority={result.supermajority}
            />
            <SeatSummary
              seats={result.totalSeats}
              partyColors={partyColors}
              partyNames={partyNames}
            />
          </div>

          <p className="text-xs text-amber-200/50">
            Forrás: Nemzeti Választási Iroda (valasztas.hu) — jogerős eredmény. Ez a tényleges
            eredmény, nem a modell projekciója.
          </p>
        </>
      )}
    </section>
  );
}
