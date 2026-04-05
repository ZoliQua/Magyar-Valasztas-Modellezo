import { useCallback, useMemo, useState } from 'react';
import { useSimulation } from '../../hooks/useSimulation';
import ListShareInputs from './ListShareInputs';
import SwingSliders from './SwingSliders';
import TurnoutSlider from './TurnoutSlider';
import HemicycleChart from '../results/HemicycleChart';
import SeatSummary from '../results/SeatSummary';
import MajorityIndicator from '../results/MajorityIndicator';
import OevkResultsTable from '../results/OevkResultsTable';
import HungaryMap from '../map/HungaryMap';
import ListDetailPanel from '../results/ListDetailPanel';
import OevkDetailPanel from '../results/OevkDetailPanel';

interface SelectedOevk {
  oevk_id: string;
  display_name: string;
  county: string;
}

export default function SimulationPanel() {
  const {
    input,
    result,
    parties,
    loading,
    error,
    activePreset,
    runSimulation,
    updateListShare,
    updateSwing,
    updateTurnout,
    setSwingMode,
    loadPreset,
  } = useSimulation();

  const [selectedOevk, setSelectedOevk] = useState<SelectedOevk | null>(null);

  const partyColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of parties) map[p.id] = p.color;
    return map;
  }, [parties]);

  const partyNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of parties) map[p.id] = p.short_name;
    return map;
  }, [parties]);

  const handleRun = useCallback(() => {
    runSimulation();
  }, [runSimulation]);

  const handleOevkClick = useCallback((oevkId: string, displayName: string, county: string) => {
    setSelectedOevk({ oevk_id: oevkId, display_name: displayName, county });
  }, []);

  const swingMode = input.swingMode || 'national';

  return (
    <div className="flex gap-6 h-full">
      {/* Bal oldali panel: beállítások */}
      <aside className="w-72 flex-shrink-0 space-y-5 overflow-y-auto pb-6">
        <ListShareInputs
          parties={parties}
          shares={input.listShares}
          onShareChange={updateListShare}
          activePreset={activePreset}
          onLoadPreset={loadPreset}
        />

        {/* Mód váltó: Csak országos / Egyedi swing */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            OEVK számítási mód
          </h4>
          <div className="flex bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            <button
              onClick={() => setSwingMode('national')}
              className={`flex-1 px-2 py-2 text-xs transition-colors ${
                swingMode === 'national'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              Csak országos
            </button>
            <button
              onClick={() => setSwingMode('auto_swing')}
              className={`flex-1 px-2 py-2 text-xs transition-colors ${
                swingMode === 'auto_swing'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              Egyedi swing
            </button>
          </div>
          <p className="text-xs text-gray-600">
            {swingMode === 'auto_swing'
              ? 'Minden OEVK-ban: 2022 bázis + listás arány különbség = swing'
              : 'OEVK-kban nincs újraszámolás, csak országos listán'}
          </p>
        </div>

        {/* Uniform swing csúszkák — csak "Csak országos" módban */}
        {swingMode === 'national' && (
          <SwingSliders
            parties={parties}
            swings={input.uniformSwing}
            onSwingChange={updateSwing}
          />
        )}

        <TurnoutSlider
          value={input.turnoutPct}
          onChange={updateTurnout}
        />

        <button
          onClick={handleRun}
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Számítás...' : 'Szimuláció futtatása'}
        </button>

        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-2">
            {error}
          </div>
        )}
      </aside>

      {/* Jobb oldali panel: eredmények */}
      <div className="flex-1 space-y-6 overflow-y-auto pb-6">
        {result ? (
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

            <HungaryMap
              oevkResults={result.oevkResults}
              partyColors={partyColors}
              partyNames={partyNames}
              onOevkClick={handleOevkClick}
            />

            <ListDetailPanel
              listSeats={result.listSeats}
              fragmentVotes={result.fragmentVotes}
              partyColors={partyColors}
              partyNames={partyNames}
              oevkResults={result.oevkResults}
            />

            <OevkResultsTable
              results={result.oevkResults}
              partyColors={partyColors}
              partyNames={partyNames}
              onOevkClick={handleOevkClick}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center"><p className="text-lg">Betöltés...</p></div>
          </div>
        )}

        <div className="text-xs text-gray-600 bg-gray-900/50 rounded p-3 border border-gray-800/50">
          Ez egy modellező eszköz, nem előrejelzés. A uniform swing modell feltételezi,
          hogy az országos változás minden körzetben egyformán érvényesül, ami a valóságban
          nem igaz. Az OEVK-szintű eredmények becslések.
        </div>
      </div>

      {selectedOevk && (
        <OevkDetailPanel
          oevkId={selectedOevk.oevk_id}
          displayName={selectedOevk.display_name}
          county={selectedOevk.county}
          partyColors={partyColors}
          partyNames={partyNames}
          simulationResult={result?.oevkResults.find(r => r.oevk_id === selectedOevk.oevk_id)}
          onClose={() => setSelectedOevk(null)}
        />
      )}
    </div>
  );
}
