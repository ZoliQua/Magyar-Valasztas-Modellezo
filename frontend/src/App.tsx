import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    api.getParties().then(setParties).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 p-6 overflow-hidden">
            <Routes>
              <Route path="/" element={<SimulationPanel />} />
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
