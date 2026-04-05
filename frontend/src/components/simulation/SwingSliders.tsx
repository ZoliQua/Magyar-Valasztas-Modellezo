import type { Party } from '../../types/election';

interface SwingSlidersProps {
  parties: Party[];
  swings: Record<string, number>;
  onSwingChange: (partyId: string, value: number) => void;
}

export default function SwingSliders({ parties, swings, onSwingChange }: SwingSlidersProps) {
  const mainParties = parties.filter(p => !['other', 'mszp', 'jobbik', 'lmp', 'egyseges_ellenzek'].includes(p.id));

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        Országos swing (%)
      </h4>
      {mainParties.map(party => {
        const value = swings[party.id] || 0;
        return (
          <div key={party.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: party.color }}
                />
                <span className="text-sm text-gray-300">{party.short_name}</span>
              </div>
              <span className="font-data text-xs text-gray-400">
                {value > 0 ? '+' : ''}{value.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="30"
              step="0.5"
              value={value}
              onChange={e => onSwingChange(party.id, parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #374151 0%, ${party.color} 50%, #374151 100%)`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
