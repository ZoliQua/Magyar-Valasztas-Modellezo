/**
 * Demo OEVK adatok generálása a 2022-es választás becsült eredményei alapján.
 *
 * Ez NEM valódi adat — a valódi adatok a valasztas.hu-ról importálandók.
 * A demo adatok a szimulációs motor teszteléséhez szükségesek.
 */

import { getDb, initDb, closeDb } from './database';

// Magyar vármegyék és OEVK-k
const COUNTIES: Array<{ county: string; oevkCount: number }> = [
  { county: 'Budapest', oevkCount: 16 },
  { county: 'Pest', oevkCount: 14 },
  { county: 'Baranya', oevkCount: 5 },
  { county: 'Bács-Kiskun', oevkCount: 6 },
  { county: 'Békés', oevkCount: 3 },
  { county: 'Borsod-Abaúj-Zemplén', oevkCount: 7 },
  { county: 'Csongrád-Csanád', oevkCount: 4 },
  { county: 'Fejér', oevkCount: 4 },
  { county: 'Győr-Moson-Sopron', oevkCount: 6 },
  { county: 'Hajdú-Bihar', oevkCount: 6 },
  { county: 'Heves', oevkCount: 4 },
  { county: 'Jász-Nagykun-Szolnok', oevkCount: 4 },
  { county: 'Komárom-Esztergom', oevkCount: 3 },
  { county: 'Nógrád', oevkCount: 2 },
  { county: 'Somogy', oevkCount: 4 },
  { county: 'Szabolcs-Szatmár-Bereg', oevkCount: 6 },
  { county: 'Tolna', oevkCount: 2 },
  { county: 'Vas', oevkCount: 3 },
  { county: 'Veszprém', oevkCount: 3 },
  { county: 'Zala', oevkCount: 4 },
];

// 2022-es becsült országos arányok (egyéni szavazatok %-ban)
// Fidesz: ~54%, Egységes ellenzék: ~35%, Mi Hazánk: ~6%, egyéb: ~5%
// 2026-ra átnevezve: Fidesz-KDNP, Tisza (mint fő ellenzéki erő)
const BASE_SHARES = {
  fidesz_kdnp: 52,
  egyseges_ellenzek: 35,
  mi_hazank: 7,
  other: 6,
};

function generateCountyId(county: string): string {
  return county
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function randomVariation(base: number, maxDelta: number): number {
  return base + (Math.random() * 2 - 1) * maxDelta;
}

export function seedDemoOevk(): void {
  const db = getDb();

  // Ellenőrzés: ne duplikáljunk
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM oevk_definitions').get() as { cnt: number };
  if (existing.cnt > 0) {
    console.log('OEVK definíciók már léteznek, kihagyjuk a demo seed-et.');
    return;
  }

  const insertDef = db.prepare(`
    INSERT INTO oevk_definitions (oevk_id, valid_from, valid_to, county, oevk_number, display_name)
    VALUES (?, 2026, NULL, ?, ?, ?)
  `);

  const insertResult = db.prepare(`
    INSERT INTO oevk_results (election_year, oevk_id, oevk_id_2026, party_id, votes, vote_share_pct, is_winner)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const { county, oevkCount } of COUNTIES) {
      const countyId = generateCountyId(county);

      for (let i = 1; i <= oevkCount; i++) {
        const oevkId = `${countyId}_${String(i).padStart(2, '0')}`;
        const displayName = `${county} ${String(i).padStart(2, '0')}. OEVK`;

        // OEVK definíció
        insertDef.run(oevkId, county, i, displayName);

        // Budapest és nagyvárosok: ellenzék erősebb
        const isBudapest = county === 'Budapest';
        const isPest = county === 'Pest';

        let fidesz = randomVariation(
          isBudapest ? 38 : isPest ? 48 : BASE_SHARES.fidesz_kdnp,
          isBudapest ? 8 : 6
        );
        let ellenzek = randomVariation(
          isBudapest ? 48 : isPest ? 38 : BASE_SHARES.egyseges_ellenzek,
          isBudapest ? 8 : 6
        );
        let miHazank = randomVariation(BASE_SHARES.mi_hazank, 3);
        let egyeb = randomVariation(BASE_SHARES.other, 2);

        // Clamp és normalizálás
        fidesz = Math.max(15, fidesz);
        ellenzek = Math.max(15, ellenzek);
        miHazank = Math.max(1, miHazank);
        egyeb = Math.max(0.5, egyeb);

        const total = fidesz + ellenzek + miHazank + egyeb;
        fidesz = (fidesz / total) * 100;
        ellenzek = (ellenzek / total) * 100;
        miHazank = (miHazank / total) * 100;
        egyeb = (egyeb / total) * 100;

        const totalVoters = Math.round(40000 + Math.random() * 20000);

        const parties = [
          { id: 'fidesz_kdnp', pct: fidesz },
          { id: 'egyseges_ellenzek', pct: ellenzek },
          { id: 'mi_hazank', pct: miHazank },
          { id: 'other', pct: egyeb },
        ].sort((a, b) => b.pct - a.pct);

        for (let j = 0; j < parties.length; j++) {
          const p = parties[j];
          const votes = Math.round(totalVoters * p.pct / 100);
          const isWinner = j === 0 ? 1 : 0;

          insertResult.run(
            2022,
            oevkId,
            oevkId,
            p.id,
            votes,
            Math.round(p.pct * 100) / 100,
            isWinner
          );
        }
      }
    }
  });

  transaction();

  const totalOevk = COUNTIES.reduce((sum, c) => sum + c.oevkCount, 0);
  console.log(`${totalOevk} demo OEVK létrehozva 2022-es becsült adatokkal.`);
}

// Ha közvetlenül futtatjuk
if (require.main === module) {
  initDb();
  seedDemoOevk();
  closeDb();
}
