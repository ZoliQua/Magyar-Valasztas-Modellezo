import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

interface MajorityIndicatorProps {
  majority: string | null;
  supermajority: boolean;
  partyNames: Record<string, string>;
  partyColors: Record<string, string>;
  totalSeats: Record<string, number>;
}

const TOTAL = 199;
const SIMPLE = 100;
const TWO_THIRDS = 133;

/** 199 helyes sáv a legnagyobb párt mandátumaival és a 100 / 133 küszöbbel. */
function MajorityBar({ seats, color }: { seats: number; color: string }) {
  const pct = (n: number) => `${(n / TOTAL) * 100}%`;
  return (
    <div className="relative h-2.5 mt-3 rounded-full bg-gray-800 overflow-visible" aria-hidden="true">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
        style={{ width: pct(Math.min(seats, TOTAL)), backgroundColor: color }}
      />
      {[[SIMPLE, '100'], [TWO_THIRDS, '⅔']].map(([n, label]) => (
        <div key={label} className="absolute -top-1 -bottom-1" style={{ left: pct(n as number) }}>
          <div className="w-px h-full bg-gray-400/70" />
          <div className="absolute top-full mt-0.5 -translate-x-1/2 text-[10px] text-gray-500">{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function MajorityIndicator({
  majority,
  supermajority,
  partyNames,
  partyColors,
  totalSeats,
}: MajorityIndicatorProps) {
  const leader = Object.entries(totalSeats).sort((a, b) => b[1] - a[1])[0];
  const majoritySeats = majority ? totalSeats[majority] || 0 : 0;
  const shown = useAnimatedNumber(majoritySeats);

  if (!majority) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 pb-6 border border-gray-800 text-center">
        <div className="text-gray-500 text-lg">Nincs többség</div>
        <div className="text-gray-600 text-sm mt-1">
          Egyik párt sem éri el a 100 mandátumot
          {leader && ` — legnagyobb: ${partyNames[leader[0]] || leader[0]} (${leader[1]})`}
        </div>
        {leader && <MajorityBar seats={leader[1]} color={partyColors[leader[0]] || '#999'} />}
      </div>
    );
  }

  const color = partyColors[majority] || '#fff';

  return (
    <div
      className="rounded-lg p-4 pb-6 border text-center transition-colors duration-500"
      style={{ borderColor: color + '40', backgroundColor: color + '10' }}
    >
      <div className="text-sm text-gray-400 mb-1">
        {supermajority ? 'Kétharmados többség' : 'Egyszerű többség'}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {partyNames[majority] || majority}
      </div>
      <div className="font-data text-3xl font-bold text-white mt-1">
        {shown}
        <span className="text-gray-500 text-lg"> / {TOTAL}</span>
      </div>
      {supermajority && (
        <div className="mt-2 text-yellow-400 text-sm font-medium">
          Kétharmad ({majoritySeats} ≥ {TWO_THIRDS})
        </div>
      )}
      {!supermajority && majoritySeats >= SIMPLE && (
        <div className="mt-2 text-gray-400 text-sm">
          Többség ({majoritySeats} ≥ {SIMPLE}), kétharmadhoz {TWO_THIRDS - majoritySeats} mandátum hiányzik
        </div>
      )}
      <MajorityBar seats={majoritySeats} color={color} />
    </div>
  );
}
