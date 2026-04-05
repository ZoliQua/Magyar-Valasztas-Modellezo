import type { OevkSimResult } from '../../types/election';

interface OevkResultsTableProps {
  results: OevkSimResult[];
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
  onOevkClick?: (oevkId: string, displayName: string, county: string) => void;
}

export default function OevkResultsTable({ results, partyColors, partyNames, onOevkClick }: OevkResultsTableProps) {
  if (results.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-center text-gray-500">
        Nincs OEVK eredmény. Futtasd a szimulációt.
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-sm font-medium text-gray-400">
          OEVK eredmények (106 körzet) — kattints egy sorra a jelöltek megtekintéséhez
        </h3>
      </div>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">OEVK</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Vármegye</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Győztes</th>
              <th className="px-3 py-2 text-right text-gray-400 font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {results.map(oevk => (
              <tr
                key={oevk.oevk_id}
                className="border-t border-gray-800/50 hover:bg-gray-800/50 cursor-pointer transition-colors"
                onClick={() => onOevkClick?.(oevk.oevk_id, oevk.display_name, oevk.county)}
              >
                <td className="px-3 py-2 text-gray-300">{oevk.display_name}</td>
                <td className="px-3 py-2 text-gray-500">{oevk.county}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: partyColors[oevk.winner_party] || '#999' }}
                    />
                    <span className="text-gray-300">
                      {partyNames[oevk.winner_party] || oevk.winner_party}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-data">
                  <span className={
                    oevk.margin < 5 ? 'text-red-400' :
                    oevk.margin < 15 ? 'text-yellow-400' :
                    'text-green-400'
                  }>
                    {oevk.margin.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
