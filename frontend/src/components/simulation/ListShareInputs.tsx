import type { Party } from '../../types/election';

interface ListShareInputsProps {
  parties: Party[];
  shares: Record<string, number>;
  onShareChange: (partyId: string, value: number) => void;
  activePreset: number | null;
  onLoadPreset: (year: number) => void;
}

export default function ListShareInputs({
  parties, shares, onShareChange, activePreset, onLoadPreset,
}: ListShareInputsProps) {
  const mainParties = parties.filter(p =>
    ['fidesz_kdnp', 'tisza', 'mi_hazank', 'dk', 'mkkp', 'other'].includes(p.id)
  );
  const total = Object.values(shares).reduce((a, b) => a + b, 0);
  const isValid = Math.abs(total - 100) < 0.5;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Listás támogatottság (%)
        </h4>
        <span className={`font-data text-xs ${isValid ? 'text-green-400' : 'text-red-400'}`}>
          {total.toFixed(1)}%
        </span>
      </div>

      {/* Preset gombok */}
      <div className="flex gap-2">
        <button
          onClick={() => onLoadPreset(2022)}
          className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
            activePreset === 2022
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
          }`}
        >
          2022 eredmény
        </button>
        <button
          onClick={() => onLoadPreset(2018)}
          className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
            activePreset === 2018
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
          }`}
        >
          2018 eredmény
        </button>
      </div>

      {mainParties.map(party => {
        const value = shares[party.id] || 0;
        const isOther = party.id === 'other';
        return (
          <div key={party.id} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: party.color }}
            />
            <span className="text-sm text-gray-300 w-20 flex-shrink-0">
              {party.short_name}
            </span>
            <input
              type="range"
              min="0"
              max="60"
              step="0.5"
              value={value}
              onChange={e => onShareChange(party.id, parseFloat(e.target.value))}
              disabled={isOther}
              className={`flex-1 h-1.5 rounded-lg appearance-none cursor-pointer ${
                isOther ? 'bg-gray-800 opacity-50' : 'bg-gray-700'
              }`}
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={value}
              onChange={e => onShareChange(party.id, parseFloat(e.target.value) || 0)}
              disabled={isOther}
              className={`w-14 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-sm font-data text-right text-white ${
                isOther ? 'opacity-50' : ''
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}
