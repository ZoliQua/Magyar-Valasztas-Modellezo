import { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Party } from '../../types/election';

interface PollTrackerProps {
  parties: Party[];
}

interface TrendRow {
  poll_date: string;
  institute: string;
  affiliation: string | null;
  party_id: string;
  support_pct: number;
}

interface InstituteRow {
  institute: string;
  affiliation: string | null;
  poll_count: number;
}

type Affiliation = 'all' | 'kormanyparti' | 'fuggetlen';

function formatHuDate(d: string): string {
  // YYYY-MM-DD → YYYY.MM.DD
  return d.replace(/-/g, '.');
}

export default function PollTracker({ parties }: PollTrackerProps) {
  const [trendData, setTrendData] = useState<TrendRow[]>([]);
  const [institutes, setInstitutes] = useState<InstituteRow[]>([]);
  const [basis, setBasis] = useState('biztos_partvalaszto');
  const [affiliation, setAffiliation] = useState<Affiliation>('all');
  const [selectedInstitute, setSelectedInstitute] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Intézetek betöltése egyszer
  useEffect(() => {
    fetch('/api/polls/institutes')
      .then(r => r.json())
      .then(setInstitutes)
      .catch(() => {});
  }, []);

  // Trend adatok betöltése a szűrőkkel
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ basis });
    if (affiliation !== 'all') params.set('affiliation', affiliation);
    if (selectedInstitute !== 'all') params.set('institute', selectedInstitute);

    fetch(`/api/polls/trend?${params}`)
      .then(r => r.json())
      .then(setTrendData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [basis, affiliation, selectedInstitute]);

  // Recharts data: dátum + intézet csoportosítás
  // Egy "kutatási esemény" = (dátum, intézet) párosítás
  const chartData = useMemo(() => {
    const eventMap = new Map<string, Record<string, unknown>>();
    for (const row of trendData) {
      const key = `${row.poll_date}__${row.institute}`;
      if (!eventMap.has(key)) {
        eventMap.set(key, {
          dateKey: row.poll_date,
          institute: row.institute,
          affiliation: row.affiliation,
        });
      }
      const entry = eventMap.get(key)!;
      entry[row.party_id] = row.support_pct;
    }

    return Array.from(eventMap.values())
      .sort((a, b) => (a.dateKey as string).localeCompare(b.dateKey as string));
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

  // Intézetek listája az affiliáció szűrő alapján
  const filteredInstitutes = useMemo(() => {
    if (affiliation === 'all') return institutes;
    return institutes.filter(i => i.affiliation === affiliation);
  }, [institutes, affiliation]);

  // Custom tooltip — intézet név megjelenítésével
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: Record<string, unknown> }> }) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;
    const date = data.dateKey as string;
    const institute = data.institute as string;
    const aff = data.affiliation as string | null;
    const affLabel = aff === 'kormanyparti' ? 'Kormánypárti' : aff === 'fuggetlen' ? 'Független' : '';

    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 text-xs">
        <div className="text-white font-medium mb-0.5">{formatHuDate(date)}</div>
        <div className="text-gray-300 mb-1">
          {institute}
          {affLabel && (
            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
              aff === 'kormanyparti' ? 'bg-orange-900/40 text-orange-300' : 'bg-blue-900/40 text-blue-300'
            }`}>{affLabel}</span>
          )}
        </div>
        <div className="space-y-0.5 mt-1.5 pt-1.5 border-t border-gray-700">
          {parties.map(p => {
            const v = data[p.id] as number | undefined;
            if (v === undefined) return null;
            return (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: partyColors[p.id] }} />
                  <span className="text-gray-300">{p.short_name}</span>
                </div>
                <span className="font-data text-white">{v.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
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

      {/* Affiliáció csoport választó */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => { setAffiliation('all'); setSelectedInstitute('all'); }}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            affiliation === 'all'
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Mind ({institutes.reduce((s, i) => s + i.poll_count, 0)})
        </button>
        <button
          onClick={() => { setAffiliation('fuggetlen'); setSelectedInstitute('all'); }}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            affiliation === 'fuggetlen'
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Független ({institutes.filter(i => i.affiliation === 'fuggetlen').reduce((s, i) => s + i.poll_count, 0)})
        </button>
        <button
          onClick={() => { setAffiliation('kormanyparti'); setSelectedInstitute('all'); }}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            affiliation === 'kormanyparti'
              ? 'bg-orange-600 border-orange-500 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Kormánypárti ({institutes.filter(i => i.affiliation === 'kormanyparti').reduce((s, i) => s + i.poll_count, 0)})
        </button>

        <select
          value={selectedInstitute}
          onChange={e => setSelectedInstitute(e.target.value)}
          className="ml-auto bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 min-w-[180px]"
        >
          <option value="all">Minden intézet ({filteredInstitutes.length})</option>
          {filteredInstitutes.map(i => (
            <option key={i.institute} value={i.institute}>
              {i.institute} ({i.poll_count})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="h-72 flex items-center justify-center text-gray-500">Betöltés...</div>
      ) : trendData.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-gray-500">
          Nincs adat a kiválasztott szűrőkkel.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="dateKey"
              stroke="#6b7280"
              fontSize={11}
              tickFormatter={(d: string) => d.substring(2, 7).replace('-', '.')}
              minTickGap={40}
            />
            <YAxis stroke="#6b7280" fontSize={11} domain={[0, 80]} unit="%" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {activeParties.map(party => (
              <Line
                key={party.id}
                type="monotone"
                dataKey={party.id}
                name={party.short_name}
                stroke={partyColors[party.id]}
                strokeWidth={1.8}
                dot={{ r: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="mt-2 text-xs text-gray-600">
        {trendData.length > 0 && (
          <>
            {chartData.length} kutatás {selectedInstitute !== 'all' ? `(${selectedInstitute})` : ''}
            {affiliation !== 'all' && ` — ${affiliation === 'kormanyparti' ? 'Kormánypárti' : 'Független'}`}
          </>
        )}
      </div>
    </div>
  );
}
