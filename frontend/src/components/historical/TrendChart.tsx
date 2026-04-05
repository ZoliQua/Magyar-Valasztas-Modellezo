import { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Election } from '../../types/election';

export default function TrendChart() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/elections')
      .then(r => r.json())
      .then((data: Election[]) => {
        setElections(data.sort((a, b) => a.year - b.year));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const chartData = useMemo(() => {
    return elections.map(e => ({
      year: e.year.toString(),
      turnout: e.turnout_pct,
      system: e.system === 'old' ? 'Régi (386)' : 'Új (199)',
    }));
  }, [elections]);

  if (loading) {
    return <div className="text-center text-gray-500 py-8">Betöltés...</div>;
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Részvételi arány 2006-2022</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" stroke="#6b7280" />
          <YAxis stroke="#6b7280" unit="%" domain={[50, 80]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
          />
          <Legend />
          <Bar dataKey="turnout" name="Részvétel %" fill="#6366f1" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
