import { getDb } from '../db/database';
import { ActualMP, MpChangeEvent, MpChangeRow, MpMandateRow, MpRoster } from '../types/election';

/**
 * Tényleges képviselői névsor összeállítása a mandátum- és változássorokból.
 *
 * Tiszta függvény (DB nélkül tesztelhető). Az "eredeti" névsor a jogerős
 * eredmény mandátumosai (akiket nem későbbi határozat juttatott be); az
 * "aktuális" névsor azok, akiknek a mandátumát nem szüntette meg határozat.
 * Az OEVK győzteseket választókerület, a listásokat listasorszám szerint
 * rendezzük, hogy a patkó ülésrendje stabil maradjon.
 */
export function buildMpRoster(
  year: number,
  mandates: MpMandateRow[],
  changes: MpChangeRow[],
  oevkNames: Record<string, string> = {},
): MpRoster {
  const toMp = (m: MpMandateRow): ActualMP => ({
    name: m.name,
    party_id: m.party_id,
    source: m.mandate_type,
    ...(m.oevk_id ? { oevk_id: m.oevk_id, oevk_name: oevkNames[m.oevk_id] || m.oevk_id } : {}),
    ...(m.list_position != null ? { list_position: m.list_position } : {}),
    ...(m.granted_by_change_id ? { granted_by: m.granted_by_change_id } : {}),
    ...(m.ended_by_change_id ? { ended_by: m.ended_by_change_id, end_date: m.end_date ?? undefined } : {}),
  });

  const order = (a: MpMandateRow, b: MpMandateRow) => {
    if (a.mandate_type !== b.mandate_type) return a.mandate_type === 'oevk' ? -1 : 1;
    if (a.mandate_type === 'oevk') return (a.oevk_id || '').localeCompare(b.oevk_id || '');
    return (a.list_position ?? 0) - (b.list_position ?? 0);
  };
  const sorted = [...mandates].sort(order);

  const current = sorted.filter(m => !m.ended_by_change_id).map(toMp);
  const original = sorted.filter(m => !m.granted_by_change_id).map(toMp);

  const events: MpChangeEvent[] = [...changes]
    .sort((a, b) => a.decision_date.localeCompare(b.decision_date) || a.id.localeCompare(b.id))
    .map(c => ({
      id: c.id,
      decision_ref: c.decision_ref,
      decision_date: c.decision_date,
      party_id: c.party_id,
      reason: c.reason,
      note: c.note,
      sources: JSON.parse(c.sources_json) as string[],
      outgoing: sorted.filter(m => m.ended_by_change_id === c.id).map(toMp),
      incoming: sorted.filter(m => m.granted_by_change_id === c.id).map(toMp),
    }));

  const seatsByParty: Record<string, number> = {};
  for (const mp of current) seatsByParty[mp.party_id] = (seatsByParty[mp.party_id] || 0) + 1;

  return { year, current, original, changes: events, seatsByParty };
}

/**
 * Tényleges névsor az adatbázisból. null, ha az évre nincs mandátumadat
 * (vagy a régebbi adatbázisban még nincs mp_mandates tábla).
 */
export function getMpRoster(year: number): MpRoster | null {
  const db = getDb();
  const hasTable = db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'mp_mandates'`
  ).get();
  if (!hasTable) return null;

  const mandates = db.prepare(`
    SELECT party_id, name, mandate_type, oevk_id, list_position,
           granted_by_change_id, ended_by_change_id, end_date
    FROM mp_mandates WHERE election_year = ?
  `).all(year) as MpMandateRow[];
  if (mandates.length === 0) return null;

  const changes = db.prepare(`
    SELECT id, decision_ref, decision_date, party_id, reason, note, sources_json
    FROM mp_changes WHERE election_year = ?
  `).all(year) as MpChangeRow[];

  const defs = db.prepare(`
    SELECT oevk_id, display_name FROM oevk_definitions
    WHERE valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)
  `).all(year, year) as Array<{ oevk_id: string; display_name: string }>;
  const oevkNames = Object.fromEntries(defs.map(d => [d.oevk_id, d.display_name]));

  return buildMpRoster(year, mandates, changes, oevkNames);
}
