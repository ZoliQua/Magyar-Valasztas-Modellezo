import type { OevkSimResult } from '../../types/election';

interface OevkTooltipProps {
  county: string;
  data: {
    dominantParty: string;
    avgMargin: number;
    oevks: OevkSimResult[];
  };
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
  x: number;
  y: number;
}

export default function OevkTooltip({ county, data, partyColors, partyNames, x, y }: OevkTooltipProps) {
  // OEVK győztesek összesítése
  const winnerCounts: Record<string, number> = {};
  for (const oevk of data.oevks) {
    winnerCounts[oevk.winner_party] = (winnerCounts[oevk.winner_party] || 0) + 1;
  }

  return (
    <div
      className="absolute z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 pointer-events-none min-w-[180px]"
      style={{ left: x, top: y }}
    >
      <div className="font-medium text-white text-sm mb-2">{county}</div>
      <div className="text-xs text-gray-400 mb-2">{data.oevks.length} OEVK</div>

      <div className="space-y-1.5">
        {Object.entries(winnerCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([party, count]) => (
            <div key={party} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-sm"
                  style={{ backgroundColor: partyColors[party] || '#999' }}
                />
                <span className="text-xs text-gray-300">{partyNames[party] || party}</span>
              </div>
              <span className="font-data text-xs text-white">{count}</span>
            </div>
          ))}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-500">
        Átl. margin: {data.avgMargin.toFixed(1)}%
      </div>
    </div>
  );
}
