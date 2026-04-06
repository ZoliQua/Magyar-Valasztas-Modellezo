import { useState, useCallback } from 'react';
import type { OevkSimResult, PredictedMP } from '../../types/election';

interface ListCandidate {
  position: number;
  effective_position?: number;
  candidate_name: string;
  list_name: string;
  list_type: string;
  runs_in_oevk?: number;
}

interface ListDetailPanelProps {
  listSeats: Record<string, number>;
  fragmentVotes: Record<string, number>;
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
  oevkResults?: OevkSimResult[];
  mps?: PredictedMP[];
}

// Merged entry: lista jelölt vagy OEVK győztes
interface MergedEntry {
  type: 'lista' | 'oevk';
  name: string;
  listPos?: number;         // eredeti lista sorszám
  effectivePos?: number;    // effektív bejutási sorszám
  oevkName?: string;
  isIn: boolean;            // bejut-e
}

export default function ListDetailPanel({
  listSeats, fragmentVotes, partyColors, partyNames, oevkResults, mps,
}: ListDetailPanelProps) {
  const [expandedParty, setExpandedParty] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ListCandidate[]>([]);
  const [unfilteredCandidates, setUnfilteredCandidates] = useState<ListCandidate[]>([]);
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

      // Szűrt lista (OEVK győztesek nélkül)
      const filteredUrl = wonOevks.length > 0
        ? `/api/parties/${partyId}/list-candidates?wonOevks=${wonOevks.join(',')}`
        : `/api/parties/${partyId}/list-candidates`;
      const [filteredRes, unfilteredRes] = await Promise.all([
        fetch(filteredUrl).then(r => r.json()),
        fetch(`/api/parties/${partyId}/list-candidates`).then(r => r.json()),
      ]);
      setCandidates(filteredRes);
      setUnfilteredCandidates(unfilteredRes);
    } catch {
      setCandidates([]);
      setUnfilteredCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }, [expandedParty, oevkResults]);

  // OEVK bejutottak az adott párthoz
  const getOevkMPs = (partyId: string): PredictedMP[] => {
    if (!mps) return [];
    return mps.filter(mp => mp.party_id === partyId && mp.source === 'oevk');
  };

  // Merged lista: OEVK győztesek + listás bejutók, lista sorszám szerint rendezve
  const buildMergedList = (partyId: string): MergedEntry[] => {
    const seats = listSeats[partyId] || 0;
    const oevkMPsList = getOevkMPs(partyId);
    const oevkWinnerNames = new Set(oevkMPsList.map(m => m.name.toUpperCase().trim()));

    // Teljes lista (szűretlen) — lista sorszám szerint
    const merged: MergedEntry[] = [];
    let listaInCount = 0;

    for (const c of unfilteredCandidates) {
      const isOevkWinner = oevkWinnerNames.has(c.candidate_name.toUpperCase().trim());

      if (isOevkWinner) {
        // OEVK-t nyert → OEVK mandátumot kap, listáról kiesik
        const oevkMp = oevkMPsList.find(m => m.name.toUpperCase().trim() === c.candidate_name.toUpperCase().trim());
        merged.push({
          type: 'oevk',
          name: c.candidate_name,
          listPos: c.position,
          oevkName: oevkMp?.oevk_name || oevkMp?.oevk_id,
          isIn: true, // OEVK-ból bejut
        });
      } else {
        // Listáról jut be (ha van elég mandátum)
        listaInCount++;
        merged.push({
          type: 'lista',
          name: c.candidate_name,
          listPos: c.position,
          effectivePos: listaInCount,
          isIn: listaInCount <= seats,
        });
      }
    }
    return merged;
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
                          {oevkMPs.length > 0 && (
                            <span className="text-yellow-500/70">
                              {' '}— {oevkMPs.length} jelölt OEVK-t nyert
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
                            {showOevkWinners ? '✓ ' : ''}OEVK bejutottak
                          </button>
                        )}
                      </div>

                      <div className="space-y-0.5 max-h-96 overflow-y-auto">
                        {showOevkWinners ? (
                          // === MERGED NÉZET: teljes lista sorrend, OEVK győztesek beillesztve ===
                          buildMergedList(party).slice(0, Math.max(seats + oevkMPs.length + 5, 20)).map((entry, i) => (
                            <div
                              key={`merged-${i}`}
                              className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                                entry.type === 'oevk'
                                  ? 'bg-blue-900/20 text-blue-200'
                                  : entry.isIn ? 'bg-gray-800/80 text-white' : 'text-gray-500'
                              }`}
                            >
                              <span className={`font-data w-8 text-right flex-shrink-0 ${
                                entry.type === 'oevk' ? 'text-blue-400' :
                                entry.isIn ? 'text-yellow-400' : 'text-gray-600'
                              }`}>
                                {entry.listPos}.
                              </span>
                              <span className={`flex-1 ${entry.isIn ? 'font-medium' : ''}`}>
                                {entry.name}
                              </span>
                              <span className="flex-shrink-0 text-xs">
                                {entry.type === 'oevk' ? (
                                  <span className="text-blue-400/70">OEVK: {entry.oevkName}</span>
                                ) : entry.isIn ? (
                                  <span className="text-purple-400/70">Lista #{entry.effectivePos}</span>
                                ) : null}
                              </span>
                            </div>
                          ))
                        ) : (
                          // === CSAK LISTÁS NÉZET: OEVK győztesek kiszűrve ===
                          candidates.slice(0, Math.max(seats + 5, 15)).map((c, i) => {
                            const isIn = i < seats;
                            const effectivePos = c.effective_position || (i + 1);
                            return (
                              <div
                                key={`list-${c.position}-${i}`}
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
                          })
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
