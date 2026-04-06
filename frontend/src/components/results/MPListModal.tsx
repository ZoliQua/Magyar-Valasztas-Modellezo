import { useState } from 'react';
import type { PredictedMP } from '../../types/election';

interface MPListModalProps {
  mps: PredictedMP[];
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
  title: string;
  filterParty?: string;
  onClose: () => void;
}

export default function MPListModal({ mps, partyColors, partyNames, title, filterParty, onClose }: MPListModalProps) {
  const [search, setSearch] = useState('');

  const filtered = mps
    .filter(mp => !filterParty || mp.party_id === filterParty)
    .filter(mp => !search || mp.name.toLowerCase().includes(search.toLowerCase()) ||
                  (partyNames[mp.party_id] || '').toLowerCase().includes(search.toLowerCase()));

  const oevkCount = filtered.filter(m => m.source === 'oevk').length;
  const listaCount = filtered.filter(m => m.source === 'lista').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="p-5 border-b border-gray-800 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {filtered.length} képviselő ({oevkCount} egyéni + {listaCount} listás)
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl px-2">✕</button>
        </div>

        <div className="px-5 py-3 border-b border-gray-800">
          <input
            type="text"
            placeholder="Keresés név vagy párt szerint..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-gray-400 font-medium w-8">#</th>
                <th className="px-2 py-2 text-left text-gray-400 font-medium">Név</th>
                <th className="px-2 py-2 text-left text-gray-400 font-medium">Párt</th>
                <th className="px-2 py-2 text-left text-gray-400 font-medium">Forrás</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((mp, i) => (
                <tr key={`${mp.party_id}-${mp.name}-${i}`} className="border-t border-gray-800/30 hover:bg-gray-800/40">
                  <td className="px-4 py-2 font-data text-gray-500">{i + 1}</td>
                  <td className="px-2 py-2 text-white">{mp.name}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: partyColors[mp.party_id] || '#999' }} />
                      <span className="text-gray-300">{partyNames[mp.party_id] || mp.party_id}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {mp.source === 'oevk' ? (
                      <span className="text-blue-400">{mp.oevk_name || mp.oevk_id}</span>
                    ) : (
                      <span className="text-purple-400">
                        Lista #{mp.list_position}
                        {mp.original_list_position && mp.original_list_position !== mp.list_position && (
                          <span className="text-gray-600"> (ered. #{mp.original_list_position})</span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
