import { useEffect, useState } from 'react';
import type { MpRoster, SimulationResult } from '../../types/election';
import { api } from '../../services/api';
import HemicycleChart from './HemicycleChart';
import SeatSummary from './SeatSummary';
import MajorityIndicator from './MajorityIndicator';
import MpChangesTimeline from './MpChangesTimeline';
import MPListModal from './MPListModal';

interface ActualResultOverlayProps {
  year: number;
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
}

/**
 * Tényleges (hivatalos) választási eredmény overlay.
 *
 * A szimulációtól vizuálisan és felirattal EGYÉRTELMŰEN elkülönítve jeleníti meg
 * a valós, jogerős eredményt (NVI / valasztas.hu), valamint az aktuális
 * képviselői névsort és az azóta történt NVB-személycseréket. Ugyanazokat az
 * eredménykomponenseket használja, mint a szimuláció, hogy összevethető legyen.
 *
 * Kezeli a betöltés / hiba / nincs adat / részleges adat (névsor nélkül) állapotokat.
 */
export default function ActualResultOverlay({ year, partyColors, partyNames }: ActualResultOverlayProps) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [roster, setRoster] = useState<MpRoster | null>(null);
  const [rosterError, setRosterError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listParty, setListParty] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRosterError(false);
    Promise.allSettled([api.getActualResult(year), api.getMps(year)]).then(([res, mps]) => {
      if (cancelled) return;
      if (res.status === 'fulfilled') setResult(res.value);
      else setError(`Nincs elérhető tényleges eredmény (${year}).`);
      if (mps.status === 'fulfilled') setRoster(mps.value);
      else setRosterError(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [year]);

  // A névsor csak akkor kerül a patkóra, ha frakciólétszáma egyezik a jogerős eredménnyel
  const rosterMatches = !!(result && roster && Object.entries(result.totalSeats)
    .every(([p, n]) => (roster.seatsByParty[p] || 0) === n));

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
              title="Országgyűlés — aktuális képviselők"
              chartId="actual"
              seats={result.totalSeats}
              partyColors={partyColors}
              partyNames={partyNames}
              majority={result.majority}
              supermajority={result.supermajority}
              mps={rosterMatches ? roster!.current : undefined}
              markChanged={rosterMatches}
              onShowAllMPs={rosterMatches ? () => setListParty(null) : undefined}
              onPartyClick={rosterMatches ? (id) => setListParty(id) : undefined}
            />
            <SeatSummary
              seats={result.totalSeats}
              partyColors={partyColors}
              partyNames={partyNames}
              onPartyClick={rosterMatches ? (id) => setListParty(id) : undefined}
            />
          </div>

          {rosterError && (
            <div className="text-amber-200/70 text-xs bg-amber-900/20 border border-amber-800/40 rounded p-2">
              A képviselői névsor nem érhető el — a mandátumszámok a jogerős eredményből származnak.
            </div>
          )}
          {roster && !rosterMatches && (
            <div className="text-red-300 text-xs bg-red-900/20 border border-red-800/40 rounded p-2">
              Adateltérés: a képviselői névsor frakciólétszáma nem egyezik a jogerős eredménnyel,
              ezért a névsor nem jelenik meg. Futtasd újra a scripts/import_mps_2026.py importot.
            </div>
          )}

          {roster && rosterMatches && (
            <MpChangesTimeline changes={roster.changes} partyColors={partyColors} partyNames={partyNames} />
          )}

          <p className="text-xs text-amber-200/50">
            Forrás: Nemzeti Választási Iroda (valasztas.hu) — jogerős eredmény; a későbbi
            személycserék a Nemzeti Választási Bizottság határozatai. Ez a tényleges
            eredmény, nem a modell projekciója.
          </p>
        </>
      )}

      {listParty !== undefined && roster && (
        <MPListModal
          mps={roster.current}
          partyColors={partyColors}
          partyNames={partyNames}
          title={listParty
            ? `${partyNames[listParty] || listParty} — aktuális képviselők`
            : `Országgyűlés ${year}–${year + 4} — aktuális névsor`}
          filterParty={listParty || undefined}
          onClose={() => setListParty(undefined)}
        />
      )}
    </section>
  );
}
