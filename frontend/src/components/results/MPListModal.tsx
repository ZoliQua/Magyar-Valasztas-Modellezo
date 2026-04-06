import { useState, useMemo } from 'react';
import type { PredictedMP } from '../../types/election';

interface MPListModalProps {
  mps: PredictedMP[];
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
  title: string;
  filterParty?: string;
  onClose: () => void;
}

type SortKey = 'index' | 'name' | 'party' | 'source';
type SortDir = 'asc' | 'desc';

function SortHeader({ label, sortKey, currentKey, currentDir, onSort, className }: {
  label: string; sortKey: SortKey; currentKey: SortKey; currentDir: SortDir;
  onSort: (key: SortKey) => void; className?: string;
}) {
  const isActive = currentKey === sortKey;
  return (
    <th
      className={`px-2 py-2 text-left font-medium cursor-pointer select-none hover:text-gray-200 transition-colors ${
        isActive ? 'text-blue-400' : 'text-gray-400'
      } ${className || ''}`}
      onClick={() => onSort(sortKey)}
    >
      {label} {isActive ? (currentDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );
}

export default function MPListModal({ mps, partyColors, partyNames, title, filterParty, onClose }: MPListModalProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('index');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let list = mps.filter(mp => !filterParty || mp.party_id === filterParty);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(mp =>
        mp.name.toLowerCase().includes(q) ||
        (partyNames[mp.party_id] || '').toLowerCase().includes(q) ||
        (mp.oevk_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [mps, filterParty, search, partyNames]);

  const sorted = useMemo(() => {
    // Eredeti index megőrzése a rendezéshez
    const indexed = filtered.map((mp, i) => ({ mp, origIdx: i }));

    const getSourceStr = (mp: PredictedMP) =>
      mp.source === 'oevk' ? (mp.oevk_name || mp.oevk_id || '') : `Lista #${mp.list_position || 0}`;

    indexed.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'index': cmp = a.origIdx - b.origIdx; break;
        case 'name': cmp = a.mp.name.localeCompare(b.mp.name, 'hu'); break;
        case 'party': cmp = (partyNames[a.mp.party_id] || '').localeCompare(partyNames[b.mp.party_id] || '', 'hu'); break;
        case 'source': cmp = getSourceStr(a.mp).localeCompare(getSourceStr(b.mp), 'hu'); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return indexed;
  }, [filtered, sortKey, sortDir, partyNames]);

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
            placeholder="Keresés név, párt vagy OEVK szerint..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 sticky top-0">
              <tr>
                <SortHeader label="#" sortKey="index" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="w-10 px-4" />
                <SortHeader label="Név" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Párt" sortKey="party" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Forrás" sortKey="source" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ mp, origIdx }) => (
                <tr key={`${mp.party_id}-${mp.name}-${origIdx}`} className="border-t border-gray-800/30 hover:bg-gray-800/40">
                  <td className="px-4 py-2 font-data text-gray-500">{origIdx + 1}</td>
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
