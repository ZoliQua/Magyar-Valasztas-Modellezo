import { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Party } from '../../types/election';

interface PollTrackerProps {
  parties: Party[];
}

interface TrendRow {
  poll_date: string;
  institute: string;
  party_id: string;
  support_pct: number;
}

export default function PollTracker({ parties }: PollTrackerProps) {
  const [trendData, setTrendData] = useState<TrendRow[]>([]);
  const [basis, setBasis] = useState('biztos_partvalaszto');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/polls/trend?basis=${basis}`)
      .then(r => r.json())
      .then(setTrendData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [basis]);

  // Adat átalakítása Recharts formátumra
  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    for (const row of trendData) {
      if (!dateMap.has(row.poll_date)) dateMap.set(row.poll_date, {});
      const entry = dateMap.get(row.poll_date)!;
      // Átlagolás ha több intézet is mér azonos napon
      if (entry[row.party_id]) {
        entry[row.party_id] = (entry[row.party_id] + row.support_pct) / 2;
      } else {
        entry[row.party_id] = row.support_pct;
      }
    }

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }));
  }, [trendData]);

  const partyColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of parties) map[p.id] = p.color;
    return map;
  }, [parties]);

  const activeParties = useMemo(() => {
    const seen = new Set(trendData.map(r => r.party_id));
    return parties.filter(p => seen.has(p.id));
  }, [trendData, parties]);

  if (trendData.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 text-center text-gray-500">
        <p>Nincs közvélemény-kutatási adat.</p>
        <p className="text-sm mt-1">Importálj CSV fájlt a kutatási adatok megjelenítéséhez.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">Közvélemény-kutatások trendje</h3>
        <select
          value={basis}
          onChange={e => setBasis(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300"
        >
          <option value="biztos_partvalaszto">Biztos pártválasztó</option>
          <option value="partvalaszto">Pártválasztó</option>
          <option value="teljes_nepesseg">Teljes népesség</option>
        </select>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-gray-500">Betöltés...</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              fontSize={11}
              tickFormatter={(d: string) => d.substring(5)}
            />
            <YAxis stroke="#6b7280" fontSize={11} domain={[0, 60]} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Legend />
            {activeParties.map(party => (
              <Line
                key={party.id}
                type="monotone"
                dataKey={party.id}
                name={party.short_name}
                stroke={partyColors[party.id]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
