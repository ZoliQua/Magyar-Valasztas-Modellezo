interface SeatSummaryProps {
  seats: Record<string, number>;
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
  onPartyClick?: (partyId: string) => void;
}

export default function SeatSummary({ seats, partyColors, partyNames, onPartyClick }: SeatSummaryProps) {
  const total = Object.values(seats).reduce((a, b) => a + b, 0) || 199;
  const sorted = Object.entries(seats)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Mandátumok</h3>

      <div className="flex h-6 rounded overflow-hidden mb-4">
        {sorted.map(([party, count]) => (
          <div
            key={party}
            style={{ width: `${(count / total) * 100}%`, backgroundColor: partyColors[party] || '#999' }}
            className="transition-all duration-500"
            title={`${partyNames[party] || party}: ${count}`}
          />
        ))}
      </div>

      <div className="space-y-2">
        {sorted.map(([party, count]) => (
          <button
            key={party}
            onClick={() => onPartyClick?.(party)}
            className="w-full flex items-center justify-between hover:bg-gray-800/50 rounded px-1 py-0.5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: partyColors[party] || '#999' }} />
              <span className="text-sm text-gray-300">{partyNames[party] || party}</span>
            </div>
            <span className="font-data text-sm font-medium text-white">{count}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between">
        <span className="text-sm text-gray-500">Összesen</span>
        <span className="font-data text-sm font-medium text-gray-300">{total}</span>
      </div>

      {onPartyClick && (
        <p className="text-xs text-gray-600 mt-2 text-center">Kattints egy pártra a képviselők listájáért</p>
      )}
    </div>
  );
}
