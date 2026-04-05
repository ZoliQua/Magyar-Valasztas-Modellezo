interface MajorityIndicatorProps {
  majority: string | null;
  supermajority: boolean;
  partyNames: Record<string, string>;
  partyColors: Record<string, string>;
  totalSeats: Record<string, number>;
}

export default function MajorityIndicator({
  majority,
  supermajority,
  partyNames,
  partyColors,
  totalSeats,
}: MajorityIndicatorProps) {
  if (!majority) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-center">
        <div className="text-gray-500 text-lg">Nincs többség</div>
        <div className="text-gray-600 text-sm mt-1">
          Egyik párt sem éri el a 100 mandátumot
        </div>
      </div>
    );
  }

  const majoritySeats = totalSeats[majority] || 0;
  const color = partyColors[majority] || '#fff';

  return (
    <div
      className="rounded-lg p-4 border text-center"
      style={{ borderColor: color + '40', backgroundColor: color + '10' }}
    >
      <div className="text-sm text-gray-400 mb-1">
        {supermajority ? 'Kétharmados többség' : 'Egyszerű többség'}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {partyNames[majority] || majority}
      </div>
      <div className="font-data text-3xl font-bold text-white mt-1">
        {majoritySeats}
        <span className="text-gray-500 text-lg"> / 199</span>
      </div>
      {supermajority && (
        <div className="mt-2 text-yellow-400 text-sm font-medium">
          Kétharmad ({majoritySeats} ≥ 133)
        </div>
      )}
      {!supermajority && majoritySeats >= 100 && (
        <div className="mt-2 text-gray-400 text-sm">
          Többség ({majoritySeats} ≥ 100), kétharmadhoz {133 - majoritySeats} mandátum hiányzik
        </div>
      )}
    </div>
  );
}
