import { useState, useCallback } from 'react';
import type { OevkSimResult, PredictedMP } from '../../types/election';

interface ListCandidate {
  position: number;
  effective_position?: number;
  candidate_name: string;
  list_name: string;
  list_type: string;
}

interface ListDetailPanelProps {
  listSeats: Record<string, number>;
  fragmentVotes: Record<string, number>;
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
  oevkResults?: OevkSimResult[];
  mps?: PredictedMP[];
}

export default function ListDetailPanel({
  listSeats, fragmentVotes, partyColors, partyNames, oevkResults, mps,
}: ListDetailPanelProps) {
  const [expandedParty, setExpandedParty] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ListCandidate[]>([]);
  const [removedCount, setRemovedCount] = useState(0);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [showOevkWinners, setShowOevkWinners] = useState(false);

  const parties = Object.keys(listSeats)
    .filter(p => listSeats[p] > 0 || (fragmentVotes[p] || 0) > 0)
    .sort((a, b) => (listSeats[b] || 0) - (listSeats[a] || 0));

  const totalListSeats = Object.values(listSeats).reduce((a, b) => a + b, 0);

  const toggleParty = useCallback(async (partyId: string) => {
    if (expandedParty === partyId) {
      setExpandedParty(null);
      return;
    }
    setExpandedParty(partyId);
    setLoadingCandidates(true);
    setShowOevkWinners(false);
    try {
      const wonOevks = (oevkResults || []).filter(r => r.winner_party === partyId).map(r => r.oevk_id);
      const url = wonOevks.length > 0
        ? `/api/parties/${partyId}/list-candidates?wonOevks=${wonOevks.join(',')}`
        : `/api/parties/${partyId}/list-candidates`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data: ListCandidate[] = await res.json();
      if (wonOevks.length > 0) {
        const unfilteredRes = await fetch(`/api/parties/${partyId}/list-candidates`);
        const unfiltered: ListCandidate[] = await unfilteredRes.json();
        setRemovedCount(unfiltered.length - data.length);
      } else {
        setRemovedCount(0);
      }
      setCandidates(data);
    } catch {
      setCandidates([]);
      setRemovedCount(0);
    } finally {
      setLoadingCandidates(false);
    }
  }, [expandedParty, oevkResults]);

  // OEVK bejutottak az adott párthoz
  const getOevkMPs = (partyId: string): PredictedMP[] => {
    if (!mps) return [];
    return mps.filter(mp => mp.party_id === partyId && mp.source === 'oevk');
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-sm font-medium text-gray-400">
          Listás mandátumok részletezése ({totalListSeats} / 93)
          <span className="text-gray-600 ml-2">— kattints egy pártra</span>
        </h3>
      </div>
      <div className="p-4 space-y-1">
        {parties.map(party => {
          const seats = listSeats[party] || 0;
          const isExpanded = expandedParty === party;
          const color = partyColors[party] || '#999';
          const oevkMPs = getOevkMPs(party);

          return (
            <div key={party}>
              <button
                onClick={() => toggleParty(party)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left ${
                  isExpanded ? 'bg-gray-800' : 'hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-sm text-gray-200 font-medium">{partyNames[party] || party}</span>
                  <span className="text-xs text-gray-500">{isExpanded ? '▾' : '▸'}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="font-data text-sm text-white font-medium">{seats}</span>
                    <span className="text-xs text-gray-500 ml-1">mandátum</span>
                  </div>
                  <div className="text-right w-16">
                    <span className="font-data text-xs text-gray-500">
                      {((fragmentVotes[party] || 0) / 1000).toFixed(0)}k tör.
                    </span>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="ml-6 mt-1 mb-3 border-l-2 pl-3" style={{ borderColor: color + '60' }}>
                  {loadingCandidates ? (
                    <div className="text-xs text-gray-500 py-2">Betöltés...</div>
                  ) : candidates.length === 0 ? (
                    <div className="text-xs text-gray-500 py-2">Nincs listás jelölt adat.</div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-gray-500">
                          {candidates[0]?.list_name}
                          {removedCount > 0 && (
                            <span className="text-yellow-500/70">
                              {' '}— {removedCount} jelölt OEVK-t nyert
                            </span>
                          )}
                        </div>
                        {oevkMPs.length > 0 && (
                          <button
                            onClick={() => setShowOevkWinners(v => !v)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${
                              showOevkWinners
                                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            {showOevkWinners ? '✓ ' : ''}OEVK bejutottak ({oevkMPs.length})
                          </button>
                        )}
                      </div>

                      <div className="space-y-0.5 max-h-80 overflow-y-auto">
                        {/* OEVK bejutottak ha toggle be van kapcsolva */}
                        {showOevkWinners && oevkMPs
                          .sort((a, b) => (a.oevk_id || '').localeCompare(b.oevk_id || ''))
                          .map((mp, i) => (
                            <div key={`oevk-${i}`} className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-blue-900/20 text-blue-200">
                              <span className="font-data w-6 text-right text-blue-400 flex-shrink-0">E</span>
                              <span className="font-medium flex-1">{mp.name}</span>
                              <span className="text-blue-400/70 flex-shrink-0">{mp.oevk_name}</span>
                            </div>
                          ))
                        }

                        {/* Listás bejutók */}
                        {candidates.slice(0, Math.max(seats + 5, 15)).map((c, i) => {
                          const isIn = i < seats;
                          const effectivePos = c.effective_position || (i + 1);
                          return (
                            <div
                              key={`list-${c.position}-${c.candidate_name}`}
                              className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                                isIn ? 'bg-gray-800/80 text-white' : 'text-gray-500'
                              }`}
                            >
                              <span className={`font-data w-14 text-right flex-shrink-0 ${isIn ? 'text-yellow-400' : 'text-gray-600'}`}>
                                {effectivePos}. ({c.position}.)
                              </span>
                              <span className={`flex-1 ${isIn ? 'font-medium' : ''}`}>
                                {c.candidate_name}
                              </span>
                              {isIn && i === seats - 1 && (
                                <span className="text-yellow-500/70 flex-shrink-0">← utolsó bejutó</span>
                              )}
                              {!isIn && i === seats && (
                                <span className="text-red-400/60 flex-shrink-0">← első kieső</span>
                              )}
                            </div>
                          );
                        })}
                        {candidates.length > Math.max(seats + 5, 15) && (
                          <div className="text-xs text-gray-600 px-2 py-1">
                            + {candidates.length - Math.max(seats + 5, 15)} további jelölt
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
