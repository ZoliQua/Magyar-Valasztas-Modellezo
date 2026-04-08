import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import SimulationPanel from './components/simulation/SimulationPanel';
import ElectionComparison from './components/historical/ElectionComparison';
import TrendChart from './components/historical/TrendChart';
import PollTracker from './components/polls/PollTracker';
import PollImporter from './components/polls/PollImporter';
import type { Party } from './types/election';
import { api } from './services/api';

function HistoricalPage({ parties }: { parties: Party[] }) {
  return (
    <div className="space-y-6 overflow-y-auto h-full pb-6">
      <h2 className="text-xl font-semibold">Történeti adatok</h2>
      <TrendChart />
      <ElectionComparison parties={parties} />
    </div>
  );
}

function PollsPage({ parties }: { parties: Party[] }) {
  return (
    <div className="space-y-6 overflow-y-auto h-full pb-6">
      <h2 className="text-xl font-semibold">Közvélemény-kutatások</h2>
      <PollTracker parties={parties} />
      <PollImporter />
    </div>
  );
}

function App() {
  const [parties, setParties] = useState<Party[]>([]);
  // PDF export callback a SimulationPanel-ből — funkcionális setState az async állapotkezeléshez
  const [exportHandler, setExportHandler] = useState<(() => Promise<void>) | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);

  useEffect(() => {
    api.getParties().then(setParties).catch(() => {});
  }, []);

  // Callback amit a SimulationPanel hívhat az export fn regisztrálására
  // Functional setState-et használunk, hogy a fn-t ne hívjuk meg updater-ként
  const registerExportHandler = useCallback((fn: (() => Promise<void>) | null) => {
    setExportHandler(() => fn);
  }, []);

  const handleExportClick = useCallback(async () => {
    if (!exportHandler) return;
    setPdfExporting(true);
    try {
      await exportHandler();
    } catch (err) {
      console.error('PDF export hiba:', err);
      alert('PDF export sikertelen: ' + (err instanceof Error ? err.message : 'ismeretlen hiba'));
    } finally {
      setPdfExporting(false);
    }
  }, [exportHandler]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <Header
          onExportPdf={handleExportClick}
          pdfExporting={pdfExporting}
          canExportPdf={exportHandler !== null}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 p-6 overflow-hidden">
            <Routes>
              <Route path="/" element={<SimulationPanel onRegisterExport={registerExportHandler} />} />
              <Route path="/torteneti" element={<HistoricalPage parties={parties} />} />
              <Route path="/kutatasok" element={<PollsPage parties={parties} />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
