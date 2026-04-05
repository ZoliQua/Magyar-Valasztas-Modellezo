import { useEffect, useState } from 'react';
import type { OevkSimResult } from '../../types/election';

interface CandidateResult {
  election_year: number;
  party_id: string;
  candidate_name: string;
  votes: number;
  vote_share_pct: number;
  is_winner: number;
  party_name: string;
  party_color: string;
}

interface ListResultRow {
  election_year: number;
  party_id: string;
  votes: number;
  vote_share_pct: number;
  party_name: string;
  party_color: string;
}

interface HistoryData {
  egyeni: Record<string, CandidateResult[]>;
  listas: Record<string, ListResultRow[]>;
}

interface OevkDetailPanelProps {
  oevkId: string;
  displayName: string;
  county: string;
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
  simulationResult?: OevkSimResult;
  onClose: () => void;
}

function ResultBar({ rank, name, subtext, color, pct, votes, highlight, badge }: {
  rank: number; name: string; subtext: string; color: string;
  pct: number; votes?: number; highlight: boolean; badge?: string;
}) {
  return (
    <div className={`relative rounded-lg overflow-hidden border ${highlight ? 'border-yellow-500/30 bg-gray-800/80' : 'border-gray-800 bg-gray-800/40'}`}>
      <div className="absolute inset-y-0 left-0 opacity-20" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      <div className="relative px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${highlight ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40' : 'bg-gray-700 text-gray-400'}`}>
            {rank}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-white font-medium text-sm">{name}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5 ml-[18px]">
              {subtext}
              {highlight && <span className="ml-2 text-yellow-400 font-medium">Győztes</span>}
              {badge && <span className="ml-2 text-purple-400 font-medium">{badge}</span>}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          <div className="font-data text-white font-medium">{pct.toFixed(1)}%</div>
          {votes !== undefined && votes > 0 && (
            <div className="font-data text-xs text-gray-500">{votes.toLocaleString('hu-HU')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OevkDetailPanel({
  oevkId, displayName, county, partyColors, partyNames, simulationResult, onClose,
}: OevkDetailPanelProps) {
  const [history, setHistory] = useState<HistoryData>({ egyeni: {}, listas: {} });
  const [loading, setLoading] = useState(true);
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [mode, setMode] = useState<'egyeni' | 'listas'>('egyeni');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/oevk/${oevkId}/history`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: HistoryData) => {
        // Validálás: ha az API régi formátumban válaszol (sima obj, nem {egyeni, listas})
        if (data && !data.egyeni && !data.listas) {
          // Régi formátum: kulcsok az évek → kezeljük egyéniként
          setHistory({ egyeni: data as unknown as Record<string, CandidateResult[]>, listas: {} });
        } else {
          setHistory(data || { egyeni: {}, listas: {} });
        }
        setActiveYear('2026');
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [oevkId]);

  const egyeniMap = history.egyeni || {};
  const listasMap = history.listas || {};
  const egyeniYears = Object.keys(egyeniMap).sort((a, b) => +b - +a);
  const listasYears = Object.keys(listasMap).sort((a, b) => +b - +a);
  const allYears = [...new Set([...egyeniYears, ...listasYears])].sort((a, b) => +b - +a);

  // 2026 jelöltek (votes=0, regisztrált de még nincs eredmény)
  const candidates2026 = egyeniMap['2026'] || [];

  // Aktuális nézet adatai
  const egyeniData = egyeniMap[activeYear] || [];
  const listasData = listasMap[activeYear] || [];
  const isProjection = activeYear === '2026';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Fejléc */}
        <div className="p-5 border-b border-gray-800 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{displayName}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{county} — {oevkId}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl px-2">✕</button>
        </div>

        {/* Év tab-ok */}
        <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveYear('2026')}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${activeYear === '2026' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            2026
          </button>
          {allYears.filter(y => y !== '2026').map(year => (
            <button key={year} onClick={() => setActiveYear(year)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${activeYear === year ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {year}
            </button>
          ))}

          {/* Egyéni / Listás váltó */}
          {!isProjection && (
            <div className="ml-auto flex bg-gray-800 rounded overflow-hidden border border-gray-700">
              <button
                onClick={() => setMode('egyeni')}
                className={`px-3 py-1 text-xs transition-colors ${mode === 'egyeni' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Egyéni
              </button>
              <button
                onClick={() => setMode('listas')}
                className={`px-3 py-1 text-xs transition-colors ${mode === 'listas' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Listás
              </button>
            </div>
          )}
        </div>

        {/* Tartalom */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Betöltés...</div>
          ) : error ? (
            <div className="text-center text-red-400 py-8">Hiba: {error}</div>
          ) : isProjection ? (
            /* ==================== 2026 nézet ==================== */
            <div className="space-y-5">

              {/* Szimuláció projekció */}
              {simulationResult && (
                <div>
                  <div className="mb-3 p-3 bg-purple-900/20 border border-purple-800/30 rounded-lg">
                    <div className="text-xs text-purple-300 mb-1">Szimulációs projekció (uniform swing modell)</div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: partyColors[simulationResult.winner_party] || '#999' }} />
                      <span className="text-white font-medium">
                        Győztes: {partyNames[simulationResult.winner_party] || simulationResult.winner_party}
                      </span>
                      <span className="font-data text-sm text-gray-400 ml-auto">
                        margin: {simulationResult.margin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Becsült eredmény</h4>
                  <div className="space-y-1.5">
                    {simulationResult.results.map((r, i) => {
                      // Jelölt neve keresése a 2026-os regisztrációkból
                      const candidate = candidates2026.find(c => c.party_id === r.party_id);
                      const candidateName = candidate?.candidate_name;
                      return (
                        <ResultBar
                          key={r.party_id}
                          rank={i + 1}
                          name={candidateName || partyNames[r.party_id] || r.party_id}
                          subtext={candidateName ? (partyNames[r.party_id] || r.party_id) : 'Projekció'}
                          color={partyColors[r.party_id] || '#666'}
                          pct={r.vote_share_pct}
                          votes={r.votes}
                          highlight={i === 0}
                          badge="Projekció"
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2026-os regisztrált jelöltek */}
              {candidates2026.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 mt-4">
                    Regisztrált jelöltek ({candidates2026.length} fő)
                  </h4>
                  <div className="space-y-1">
                    {candidates2026.map((c, i) => (
                      <div key={`${c.party_id}-${c.candidate_name}-${i}`}
                        className="flex items-center gap-3 px-3 py-2 bg-gray-800/40 rounded border border-gray-800">
                        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: c.party_color || partyColors[c.party_id] || '#666' }} />
                        <div className="flex-1">
                          <span className="text-sm text-white">{c.candidate_name || 'N/A'}</span>
                          <span className="text-xs text-gray-500 ml-2">{c.party_name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-600 mt-3">
                A projekció a 2022. évi egyéni eredményekre alkalmazott uniform swing modell alapján készül. Nem valós előrejelzés.
              </div>
            </div>
          ) : mode === 'egyeni' ? (
            /* ==================== Egyéni eredmények ==================== */
            egyeniData.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Nincs egyéni eredmény {activeYear}-ból.</div>
            ) : (
              <div className="space-y-2">
                {egyeniData.map((c, i) => (
                  <ResultBar
                    key={`${c.party_id}-${c.candidate_name}-${i}`}
                    rank={i + 1}
                    name={c.candidate_name || 'Ismeretlen jelölt'}
                    subtext={c.party_name}
                    color={c.party_color || '#666'}
                    pct={c.vote_share_pct}
                    votes={c.votes}
                    highlight={!!c.is_winner}
                  />
                ))}
              </div>
            )
          ) : (
            /* ==================== Listás eredmények ==================== */
            listasData.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Nincs OEVK-szintű listás eredmény {activeYear}-ból.
                <p className="text-xs mt-1">A listás eredmények csak szavazóköri adatokból aggregálhatók.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {listasData.map((r, i) => (
                  <ResultBar
                    key={`${r.party_id}-${i}`}
                    rank={i + 1}
                    name={r.party_name}
                    subtext="Listás szavazat"
                    color={r.party_color || '#666'}
                    pct={r.vote_share_pct}
                    votes={r.votes}
                    highlight={i === 0}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* Lábléc */}
        {!isProjection && (
          <div className="px-5 py-3 border-t border-gray-800 flex justify-between text-sm">
            <span className="text-gray-500">
              {mode === 'egyeni' ? `${egyeniData.length} jelölt` : `${listasData.length} párt`}
            </span>
            <span className="font-data text-gray-400">
              {mode === 'egyeni'
                ? `Összesen: ${egyeniData.reduce((s, c) => s + c.votes, 0).toLocaleString('hu-HU')} szavazat`
                : `Összesen: ${listasData.reduce((s, r) => s + r.votes, 0).toLocaleString('hu-HU')} szavazat`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
