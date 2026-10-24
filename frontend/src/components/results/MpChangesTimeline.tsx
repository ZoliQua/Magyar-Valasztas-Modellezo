import { useState } from 'react';
import type { MpChangeEvent, PredictedMP } from '../../types/election';

interface MpChangesTimelineProps {
  changes: MpChangeEvent[];
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
}

const COLLAPSED_LIMIT = 6;

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
}

function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function PersonChips({ people, kind, expanded }: { people: PredictedMP[]; kind: 'out' | 'in'; expanded: boolean }) {
  const shown = expanded ? people : people.slice(0, COLLAPSED_LIMIT);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(p => (
        <span
          key={p.name}
          title={p.list_position ? `Lista #${p.list_position}${p.end_date ? ` — távozott: ${formatDate(p.end_date)}` : ''}` : undefined}
          className={`text-[11px] px-1.5 py-0.5 rounded border ${
            kind === 'out'
              ? 'border-red-900/60 bg-red-950/30 text-red-300/80 line-through decoration-red-400/50'
              : 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300'
          }`}
        >
          {p.name}
        </span>
      ))}
      {!expanded && people.length > COLLAPSED_LIMIT && (
        <span className="text-[11px] px-1.5 py-0.5 text-gray-500">+{people.length - COLLAPSED_LIMIT} további</span>
      )}
    </div>
  );
}

/**
 * A jogerős eredmény óta történt képviselői személycserék idővonala.
 * Tényleges adat (NVB-határozatok), nem a modell része.
 */
export default function MpChangesTimeline({ changes, partyColors, partyNames }: MpChangesTimelineProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (changes.length === 0) {
    return (
      <div className="text-sm text-gray-500 bg-gray-900 rounded-lg p-4 border border-gray-800">
        A jogerős eredmény óta nem volt képviselői változás.
      </div>
    );
  }

  const swaps = changes.reduce((n, c) => n + c.incoming.length, 0);

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-medium text-gray-300">Képviselői változások a választás óta</h3>
        <span className="text-xs text-gray-500">
          {changes.length} NVB-döntés · {swaps} személycsere · a frakcióarány nem változott
        </span>
      </div>

      <ol className="relative border-l border-gray-700 ml-1.5 space-y-4">
        {changes.map(c => {
          const isOpen = !!expanded[c.id];
          const collapsible = Math.max(c.outgoing.length, c.incoming.length) > COLLAPSED_LIMIT;
          return (
            <li key={c.id} className="ml-4">
              <span
                className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-gray-900"
                style={{ backgroundColor: partyColors[c.party_id] || '#999' }}
              />
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <time className="font-data text-gray-400" dateTime={c.decision_date}>{formatDate(c.decision_date)}</time>
                <span className="font-medium text-gray-200">{c.decision_ref}</span>
                <span className="text-gray-500">{partyNames[c.party_id] || c.party_id}</span>
              </div>
              {c.reason && <p className="text-xs text-gray-400 mt-0.5">{c.reason}</p>}

              <div className="mt-1.5 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-1.5 md:gap-2 items-start">
                <PersonChips people={c.outgoing} kind="out" expanded={isOpen} />
                <span className="text-gray-600 text-xs hidden md:block pt-0.5">→</span>
                <PersonChips people={c.incoming} kind="in" expanded={isOpen} />
              </div>

              {c.note && <p className="text-[11px] text-gray-500 mt-1 italic">{c.note}</p>}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                {collapsible && (
                  <button
                    type="button"
                    onClick={() => setExpanded(e => ({ ...e, [c.id]: !isOpen }))}
                    className="text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    {isOpen ? 'Kevesebb' : 'Összes név'}
                  </button>
                )}
                {c.sources.map(url => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-gray-500 hover:text-gray-300 underline decoration-dotted">
                    {sourceLabel(url)}
                  </a>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-[11px] text-gray-600 mt-3">
        Forrás: a Nemzeti Választási Bizottság határozatai. Ahol egy határozat több mandátumot
        ad ki, a kilépők és belépők párosítását nem jelöljük.
      </p>
    </div>
  );
}
