import { describe, it, expect } from 'vitest';
import { buildMpRoster } from '../mps';
import type { MpChangeRow, MpMandateRow } from '../../types/election';

const base = { granted_by_change_id: null, ended_by_change_id: null, end_date: null };

const mandates: MpMandateRow[] = [
  { ...base, party_id: 'a', name: 'LISTÁS EGY', mandate_type: 'lista', oevk_id: null, list_position: 1,
    ended_by_change_id: 'nvb-1', end_date: '2026-05-01' },
  { ...base, party_id: 'a', name: 'EGYÉNI', mandate_type: 'oevk', oevk_id: '01_01', list_position: null },
  { ...base, party_id: 'b', name: 'LISTÁS KETTŐ', mandate_type: 'lista', oevk_id: null, list_position: 2 },
  { ...base, party_id: 'a', name: 'BELÉPŐ', mandate_type: 'lista', oevk_id: null, list_position: 9,
    granted_by_change_id: 'nvb-1' },
];

const changes: MpChangeRow[] = [
  { id: 'nvb-1', decision_ref: 'NVB 1/2026', decision_date: '2026-05-01', party_id: 'a',
    reason: 'lemondás', note: null, sources_json: '["https://example.hu/1"]' },
];

describe('Képviselői névsor (buildMpRoster)', () => {
  const roster = buildMpRoster(2026, mandates, changes, { '01_01': 'Budapest 1.' });

  it('az aktuális névsorból kimarad a távozó, bekerül a belépő', () => {
    const names = roster.current.map(m => m.name);
    expect(names).toEqual(['EGYÉNI', 'LISTÁS KETTŐ', 'BELÉPŐ']);
  });

  it('az eredeti névsor a jogerős mandátumosokat tartalmazza', () => {
    expect(roster.original.map(m => m.name)).toEqual(['EGYÉNI', 'LISTÁS EGY', 'LISTÁS KETTŐ']);
  });

  it('személycsere esetén a frakciólétszám nem változik', () => {
    expect(roster.seatsByParty).toEqual({ a: 2, b: 1 });
  });

  it('a változás eseményhez hozzárendeli a kilépőt és a belépőt', () => {
    expect(roster.changes).toHaveLength(1);
    const ev = roster.changes[0];
    expect(ev.outgoing.map(m => m.name)).toEqual(['LISTÁS EGY']);
    expect(ev.outgoing[0].end_date).toBe('2026-05-01');
    expect(ev.incoming.map(m => m.name)).toEqual(['BELÉPŐ']);
    expect(ev.incoming[0].granted_by).toBe('nvb-1');
    expect(ev.sources).toEqual(['https://example.hu/1']);
  });

  it('az OEVK nevét a definíciókból veszi', () => {
    expect(roster.current[0]).toMatchObject({ source: 'oevk', oevk_id: '01_01', oevk_name: 'Budapest 1.' });
  });
});
