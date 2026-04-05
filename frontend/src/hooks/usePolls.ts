import { useState, useCallback } from 'react';

interface PollRow {
  poll_date: string;
  institute: string;
  party_id: string;
  support_pct: number;
}

interface PollEntry {
  id: number;
  poll_date: string;
  institute: string;
  basis: string;
  party_id: string;
  support_pct: number;
  sample_size: number | null;
  margin_of_error: number | null;
}

export function usePolls() {
  const [polls, setPolls] = useState<PollEntry[]>([]);
  const [trendData, setTrendData] = useState<PollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPolls = useCallback(async (params?: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      const res = await fetch(`/api/polls${query}`);
      if (!res.ok) throw new Error('Kutatások betöltése sikertelen');
      const data = await res.json();
      setPolls(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrend = useCallback(async (basis = 'biztos_partvalaszto') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/polls/trend?basis=${basis}`);
      if (!res.ok) throw new Error('Trend adatok betöltése sikertelen');
      const data = await res.json();
      setTrendData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba');
    } finally {
      setLoading(false);
    }
  }, []);

  const importPolls = useCallback(async (csvText: string) => {
    setLoading(true);
    setError(null);
    try {
      // CSV parsing
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) throw new Error('A CSV-nek legalább 2 sort kell tartalmaznia');

      const headers = lines[0].split(',').map(h => h.trim());
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, unknown> = {};
        for (let j = 0; j < headers.length; j++) {
          const val = values[j];
          // Számszerű értékek detektálása (párt oszlopok)
          if (!['date', 'institute', 'basis', 'source_url'].includes(headers[j])) {
            row[headers[j]] = parseFloat(val) || 0;
          } else {
            row[headers[j]] = val;
          }
        }
        rows.push(row);
      }

      const res = await fetch('/api/polls/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });

      if (!res.ok) throw new Error('Import sikertelen');
      const result = await res.json();
      return result as { imported: number; errors: string[] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import hiba';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { polls, trendData, loading, error, fetchPolls, fetchTrend, importPolls };
}
