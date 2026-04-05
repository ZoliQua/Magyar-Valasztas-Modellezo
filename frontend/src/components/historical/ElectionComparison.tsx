import { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Party, Election } from '../../types/election';

interface ElectionComparisonProps {
  parties: Party[];
}

interface ListResultRow {
  election_year: number;
  party_id: string;
  party_name: string;
  party_color: string;
  votes: number;
  vote_share_pct: number;
}

export default function ElectionComparison({ parties }: ElectionComparisonProps) {
  const [elections, setElections] = useState<Election[]>([]);
  const [listResults, setListResults] = useState<Record<number, ListResultRow[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/elections')
      .then(r => r.json())
      .then(async (elecs: Election[]) => {
        setElections(elecs);
        const results: Record<number, ListResultRow[]> = {};
        for (const e of elecs) {
          try {
            const r = await fetch(`/api/elections/${e.year}/list`);
            results[e.year] = await r.json();
          } catch {
            // skip
          }
        }
        setListResults(results);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const partyColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of parties) map[p.id] = p.color;
    return map;
  }, [parties]);

  // Összehasonlító chart adat
  const chartData = useMemo(() => {
    return elections
      .filter(e => listResults[e.year]?.length > 0)
      .map(e => {
        const row: Record<string, unknown> = { year: e.year.toString() };
        for (const r of listResults[e.year]) {
          row[r.party_id] = r.vote_share_pct;
        }
        return row;
      })
      .sort((a, b) => (a.year as string).localeCompare(b.year as string));
  }, [elections, listResults]);

  const activePartyIds = useMemo(() => {
    const seen = new Set<string>();
    for (const results of Object.values(listResults)) {
      for (const r of results) {
        if (r.vote_share_pct > 2) seen.add(r.party_id);
      }
    }
    return Array.from(seen);
  }, [listResults]);

  if (loading) {
    return <div className="text-center text-gray-500 py-12">Betöltés...</div>;
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 text-center text-gray-500">
        <p>Nincs történeti listás eredmény az adatbázisban.</p>
        <p className="text-sm mt-1">A valasztas.hu adatok importálása után itt jelenik meg az összehasonlítás.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-400 mb-4">
        Országos listás eredmények összehasonlítása
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" stroke="#6b7280" />
          <YAxis stroke="#6b7280" unit="%" domain={[0, 60]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
          />
          <Legend />
          {activePartyIds.map(id => {
            const party = parties.find(p => p.id === id);
            return (
              <Bar
                key={id}
                dataKey={id}
                name={party?.short_name || id}
                fill={partyColors[id] || '#999'}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
