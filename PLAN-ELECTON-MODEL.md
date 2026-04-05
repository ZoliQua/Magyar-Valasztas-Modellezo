# Magyar Választási Modellező — Claude Code Projektterv

## 1. Projekt áttekintés

**Cél:** Interaktív webalkalmazás a 2026-os magyar országgyűlési választás kimenetelének modellezésére, történeti adatok és közvélemény-kutatások alapján.

**Tech stack:**
- Program neve: Magyar Választási Modellező
- Git repo: https://github.com/ZoliQua/Magyar-Valasztas-Modellezo
- Frontend: React + TypeScript + Vite
- Backend: Express.js + TypeScript
- Adatbázis: SQLite (better-sqlite3)
- Vizualizáció: D3.js (patkó + térkép), Recharts (trendek)
- CSS: Tailwind CSS
- Monorepo: npm workspaces

**Nyelv:** Teljes magyar UI (gombok, feliratok, menük, hibaüzenetek)

---

## 2. A magyar választási rendszer matematikája

### 2.1 Alapstruktúra (2014 óta)
- **199 mandátum** összesen
- **106 egyéni választókerület (OEVK)** — relatív többségi, egyfordulós
- **93 országos listás mandátum** — arányos, D'Hondt módszer
- **5% parlamenti küszöb** (2 párt közös lista: 10%, 3+: 15%)
- Kétharmad: 133 mandátum, egyszerű többség: 100

### 2.2 Töredékszavazat-számítás
```
Minden OEVK-ban:
  - A vesztes jelöltek ÖSSZES szavazata → töredékszavazat (ha pártjuk átlépte a küszöböt)
  - A győztes jelölt szavazataiból: (győztes_szavazat - második_helyezett_szavazat - 1) → töredékszavazat
  - Független jelöltek szavazatai NEM számítanak töredékszavazatnak

Listás mandátumelosztás bemenete:
  listás_szavazat[párt] + töredékszavazat[párt] = összesített_szavazat[párt]
```

### 2.3 D'Hondt módszer implementáció
```typescript
function dhondt(votes: Map<string, number>, seats: number, threshold: number): Map<string, number> {
  // 1. Küszöb alatti pártok kiszűrése
  const totalVotes = Array.from(votes.values()).reduce((a, b) => a + b, 0);
  const eligible = new Map<string, number>();
  for (const [party, count] of votes) {
    if (count / totalVotes >= threshold) {
      eligible.set(party, count);
    }
  }

  // 2. D'Hondt mátrix: szavazat/1, szavazat/2, ..., szavazat/seats
  const result = new Map<string, number>();
  for (const party of eligible.keys()) result.set(party, 0);

  for (let i = 0; i < seats; i++) {
    let maxQuotient = -1;
    let maxParty = '';
    for (const [party, count] of eligible) {
      const quotient = count / ((result.get(party) || 0) + 1);
      if (quotient > maxQuotient) {
        maxQuotient = quotient;
        maxParty = party;
      }
    }
    result.set(maxParty, (result.get(maxParty) || 0) + 1);
  }

  return result;
}
```

### 2.4 Kedvezményes nemzetiségi kvóta
```
kedvezmenyes_kvota = floor(osszes_ervenyes_szavazat / 93 / 4)
Ha nemzetiségi lista szavazatai > kedvezményes_kvóta → 1 mandátum
A maradék (93 - kedvezményes_mandátumok) megy a D'Hondt-ba
```
**Egyszerűsítés a modellben:** Mivel nemzetiségi mandátum ritkán valósul meg (eddig nem volt rá példa), a modell ezt opcionálisként kezeli.

### 2.5 2026-os változás
Budapest: 18 → 16 OEVK
Pest vármegye: 12 → 14 OEVK
Fejér, Csongrád-Csanád: belső átrajzolás
Összesen 39 OEVK érintett a módosításban.

---

## 3. Adatforrások és adatstruktúra

### 3.1 Történeti választási adatok

| Év | Forrás | Szint | Megjegyzés |
|---|---|---|---|
| 2006 | valasztas.hu | Országos + megyei listás | Régi rendszer (386 mandátum, kétfordulós) — csak listás trendekhez |
| 2010 | valasztas.hu | Országos + megyei listás | Régi rendszer — csak listás trendekhez |
| 2014 | valasztas.hu | Települési + OEVK | Új rendszer, 106 OEVK — települési adatokból 2026-os OEVK-kra aggregálható |
| 2018 | valasztas.hu | Települési + OEVK | 106 OEVK — települési adatokból 2026-os OEVK-kra aggregálható |
| 2022 | valasztas.hu | Települési + OEVK | 106 OEVK — települési adatokból 2026-os OEVK-kra aggregálható |

**Letöltési linkek:**
- https://www.valasztas.hu/ogy2022 → letölthető adatok (xlsx, txt)
- https://www.valasztas.hu/ogy2018
- https://www.valasztas.hu/ogy2014
- https://www.valasztas.hu/ogy2010
- https://www.valasztas.hu/ogy2006
- https://vtr.valasztas.hu/stat?tab=letoltesek → 2026-os OEVK-definíciók

### 3.2 Települési → OEVK újraaggregálás logikája

A 2014/2018/2022-es választásokon a települési szintű eredmények elérhetők. A 2026-os OEVK-definíció megadja, hogy melyik település melyik új OEVK-ba tartozik. Algoritmus:

```
1. Letölteni a 2026-os OEVK beosztást (település → OEVK leképezés)
2. Letölteni a 2014/2018/2022 települési szintű eredményeket
3. Minden településhez hozzárendelni a 2026-os OEVK-t
4. Összegezni a szavazatokat az új OEVK-k szerint
5. Problémás esetek:
   - Budapest kerületei: egyes kerületek több OEVK-ba tartoznak
     → szavazóköri szintű adat kellhet, vagy arányos becslés
   - Nagyvárosok több OEVK-ban: hasonló probléma
```

**Fontos:** Ahol egy település/kerület több OEVK-ba is tartozik, ott a szavazóköri szintű adatokat kell használni (ezek is elérhetők a valasztas.hu-ról), vagy népességarányos becslést alkalmazni.

### 3.3 Közvélemény-kutatások

**CSV import formátum:**
```csv
date,institute,basis,fidesz_kdnp,tisza,mi_hazank,dk,mkkp,other,sample_size,margin_of_error
2026-03-20,Medián,biztos_partvalaszto,35,58,4,1,2,0,1000,3.1
2026-03-25,Závecz,biztos_partvalaszto,38,51,5,3,3,0,1000,3.1
2026-03-25,Nézőpont,biztos_szavazo,45,40,8,3,4,0,1000,3.16
```

**Intézetek:** Medián, Závecz Research, Nézőpont Intézet, IDEA Intézet, Publicus, Republikon, 21 Kutatóközpont, Magyar Társadalomkutató, Policy Solutions

**Bázisok (basis):**
- `teljes_nepesseg` — teljes szavazókorú népesség
- `partvalaszto` — pártot választani tudók
- `biztos_partvalaszto` — választani tudó biztos szavazók (ez a legközelebb a valós eredményhez)

---

## 4. SQLite adatbázis séma

```sql
-- Pártok (rugalmas, nem beégetett)
CREATE TABLE parties (
  id TEXT PRIMARY KEY,           -- pl. 'fidesz_kdnp', 'tisza', 'mi_hazank'
  short_name TEXT NOT NULL,      -- pl. 'Fidesz', 'Tisza', 'MH'
  full_name TEXT NOT NULL,       -- pl. 'Fidesz-KDNP', 'Tisza Párt', 'Mi Hazánk Mozgalom'
  color TEXT NOT NULL,           -- pl. '#FD8204' (narancs), '#00A3E0' (kék)
  sort_order INTEGER DEFAULT 0   -- megjelenítési sorrend
);

-- Választási évek
CREATE TABLE elections (
  year INTEGER PRIMARY KEY,
  system TEXT NOT NULL,          -- 'old' (2006, 2010) vagy 'new' (2014+)
  total_seats INTEGER NOT NULL,
  oevk_seats INTEGER NOT NULL,
  list_seats INTEGER NOT NULL,
  turnout_pct REAL,
  notes TEXT
);

-- OEVK definíciók (2014-es és 2026-os beosztás is)
CREATE TABLE oevk_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  oevk_id TEXT NOT NULL,           -- pl. 'budapest_01', 'pest_03'
  valid_from INTEGER NOT NULL,     -- 2014 vagy 2026
  valid_to INTEGER,                -- null = jelenleg érvényes
  county TEXT NOT NULL,            -- 'Budapest', 'Pest', 'Vas', stb.
  oevk_number INTEGER NOT NULL,    -- 1, 2, 3...
  seat_city TEXT,                  -- székhely
  display_name TEXT NOT NULL       -- pl. 'Budapest 01. OEVK'
);

-- Település → OEVK leképezés (2026-os beosztáshoz)
CREATE TABLE settlement_oevk_mapping (
  settlement_id TEXT NOT NULL,
  settlement_name TEXT NOT NULL,
  county TEXT NOT NULL,
  oevk_id_2014 TEXT,              -- melyik OEVK-ba tartozott 2014-2022
  oevk_id_2026 TEXT,              -- melyik OEVK-ba tartozik 2026-tól
  -- Ha egy település/kerület kettévan osztva OEVK-k között:
  split_ratio REAL DEFAULT 1.0,    -- hányad része tartozik ide (1.0 = egész)
  PRIMARY KEY (settlement_id, oevk_id_2026)
);

-- Egyéni (OEVK) választási eredmények — 2014, 2018, 2022
CREATE TABLE oevk_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  election_year INTEGER NOT NULL,
  oevk_id TEXT NOT NULL,           -- az adott évi OEVK azonosító
  oevk_id_2026 TEXT,               -- átszámított 2026-os OEVK (települési aggregálásból)
  party_id TEXT NOT NULL,
  candidate_name TEXT,
  votes INTEGER NOT NULL,
  vote_share_pct REAL,             -- százalék
  is_winner BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (election_year) REFERENCES elections(year),
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

-- Listás eredmények — 2006-tól (országos és megyei)
CREATE TABLE list_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  election_year INTEGER NOT NULL,
  level TEXT NOT NULL,             -- 'national' vagy 'county'
  county TEXT,                     -- NULL ha national
  oevk_id TEXT,                   -- OEVK-szintű listás eredmény (2014+, ha elérhető)
  party_id TEXT NOT NULL,
  votes INTEGER NOT NULL,
  vote_share_pct REAL,
  FOREIGN KEY (election_year) REFERENCES elections(year),
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

-- Közvélemény-kutatások
CREATE TABLE polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_date DATE NOT NULL,
  institute TEXT NOT NULL,
  basis TEXT NOT NULL,             -- 'teljes_nepesseg', 'partvalaszto', 'biztos_partvalaszto'
  party_id TEXT NOT NULL,
  support_pct REAL NOT NULL,
  sample_size INTEGER,
  margin_of_error REAL,
  source_url TEXT,
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

-- Szimulációk (mentés/betöltés)
CREATE TABLE simulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  -- A teljes szimuláció állapota JSON-ként
  config_json TEXT NOT NULL        -- { swings, overrides, pollBasis, ... }
);

-- Települési szintű eredmények (a nagy tábla az újraaggregáláshoz)
CREATE TABLE settlement_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  election_year INTEGER NOT NULL,
  settlement_id TEXT NOT NULL,
  settlement_name TEXT NOT NULL,
  county TEXT NOT NULL,
  result_type TEXT NOT NULL,       -- 'egyeni' vagy 'listas'
  party_id TEXT NOT NULL,
  votes INTEGER NOT NULL,
  FOREIGN KEY (election_year) REFERENCES elections(year),
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

-- Indexek
CREATE INDEX idx_oevk_results_year ON oevk_results(election_year);
CREATE INDEX idx_oevk_results_oevk ON oevk_results(oevk_id_2026);
CREATE INDEX idx_list_results_year ON list_results(election_year);
CREATE INDEX idx_polls_date ON polls(poll_date);
CREATE INDEX idx_settlement_results ON settlement_results(election_year, settlement_id);
```

---

## 5. Backend API (Express + TypeScript)

### 5.1 Endpointok

```
GET  /api/elections                      — Választási évek listája
GET  /api/elections/:year/oevk           — OEVK eredmények (2026-os OEVK-kra átszámolva)
GET  /api/elections/:year/list           — Listás eredmények
GET  /api/elections/:year/oevk/:id       — Egy OEVK részletes eredménye (egyéni + listás)
GET  /api/elections/compare              — Évek összehasonlítása OEVK szinten

GET  /api/polls                          — Közvélemény-kutatások (szűrhető: intézet, dátum, bázis)
POST /api/polls/import                   — CSV import
GET  /api/polls/trend                    — Trend adatok (idősor)

POST /api/simulate                       — Szimuláció futtatása
  Body: {
    listShares: { fidesz_kdnp: 40, tisza: 48, mi_hazank: 6, ... },
    uniformSwing: { fidesz_kdnp: -5, tisza: +8, ... },  // országos swing %
    oevkOverrides: {                                      // egyedi OEVK felülírások
      "budapest_01": { tisza: +5 },
      "borsod_03": { fidesz_kdnp: +3, tisza: -8 }
    },
    baseYear: 2022,                                       // melyik évhez képest swing
    turnoutPct: 70                                        // részvételi arány
  }
  Response: {
    totalSeats: { fidesz_kdnp: 82, tisza: 105, mi_hazank: 12 },
    oevkResults: [...],              // 106 OEVK egyenkénti eredménye
    listSeats: { ... },              // D'Hondt listás mandátumok
    fragmentVotes: { ... },          // Töredékszavazatok párt szerint
    majority: 'tisza',               // ki alakít kormányt
    supermajority: false,            // van-e 2/3
    oevkSwingDetails: [...]          // OEVK-nkénti swing részletek
  }

GET  /api/simulations                    — Mentett szimulációk
POST /api/simulations                    — Szimuláció mentése
GET  /api/simulations/:id                — Egy szimuláció betöltése

GET  /api/oevk/definitions               — 2026-os OEVK lista + GeoJSON
GET  /api/oevk/:id/history               — Egy OEVK történeti eredményei (2014-2022, átszámolva)
```

### 5.2 Szimuláció motor logika

```typescript
interface SimulationInput {
  listShares: Record<string, number>;      // Listás támogatottság %
  uniformSwing: Record<string, number>;    // Országos swing %
  oevkOverrides: Record<string, Record<string, number>>; // OEVK felülírások
  baseYear: number;                         // Bázisév (2014/2018/2022)
  turnoutPct: number;                       // Részvételi arány
}

function simulate(input: SimulationInput): SimulationResult {
  // 1. OEVK eredmények kiszámítása
  for (const oevk of allOevks) {
    const baseResults = getBaseResults(oevk, input.baseYear); // 2026-os OEVK-ra átszámolt
    
    for (const party of parties) {
      let swing = input.uniformSwing[party] || 0;
      
      // Egyedi OEVK felülírás hozzáadása
      if (input.oevkOverrides[oevk.id]?.[party]) {
        swing += input.oevkOverrides[oevk.id][party];
      }
      
      // Új becsült százalék = régi + swing
      // Alsó korlát 0%, felső korlát 100%
      newShare[party] = clamp(baseResults[party].votePct + swing, 0, 100);
    }
    
    // Normalizálás 100%-ra
    normalize(newShare);
    
    // Győztes meghatározása (relatív többség)
    oevkWinner = maxBy(newShare, pct);
  }

  // 2. Töredékszavazatok kiszámítása
  for (const oevk of allOevks) {
    const winner = oevkResults[oevk].winner;
    const second = oevkResults[oevk].second;
    
    for (const party of eligibleParties) {
      if (party === winner.party) {
        // Győztes töredéke = győztes szavazat - második szavazat - 1
        fragments[party] += winner.votes - second.votes - 1;
      } else {
        // Vesztes összes szavazata
        fragments[party] += oevkResults[oevk][party].votes;
      }
    }
  }

  // 3. Listás mandátumok D'Hondt módszerrel
  const listVotes = {};
  for (const party of parties) {
    // Listás szavazat + töredékszavazat
    listVotes[party] = calculateListVotes(input.listShares[party], input.turnoutPct) 
                       + (fragments[party] || 0);
  }
  const listSeats = dhondt(listVotes, 93, 0.05);

  // 4. Összesítés
  totalSeats = oevkSeats + listSeats;
  
  return { totalSeats, oevkResults, listSeats, fragments, ... };
}
```

---

## 6. Frontend komponensek

### 6.1 Alkalmazás struktúra

```
src/
├── App.tsx                    — Fő layout: sidebar + fő terület
├── components/
│   ├── layout/
│   │   ├── Header.tsx         — Fejléc: "Választási Modellező 2026"
│   │   ├── Sidebar.tsx        — Navigáció: Modellezés | Történeti | Kutatások
│   │   └── Footer.tsx
│   │
│   ├── simulation/
│   │   ├── SimulationPanel.tsx     — Fő modellező panel
│   │   ├── SwingSliders.tsx        — Országos swing csúszkák (pártonként)
│   │   ├── ListShareInputs.tsx     — Listás % beviteli mezők
│   │   ├── OevkOverridePanel.tsx   — Egyedi OEVK felülírások kezelése
│   │   ├── TurnoutSlider.tsx       — Részvételi arány csúszka
│   │   └── ScenarioManager.tsx     — Szcenárió mentés/betöltés
│   │
│   ├── results/
│   │   ├── HemicycleChart.tsx      — Parlamenti patkó (D3.js SVG)
│   │   ├── SeatSummary.tsx         — Mandátum összesítő (szám + sáv)
│   │   ├── MajorityIndicator.tsx   — Többség/kétharmad jelző
│   │   ├── OevkResultsTable.tsx    — OEVK részletes táblázat
│   │   └── ListDetailPanel.tsx     — Listás mandátum részletezés
│   │
│   ├── map/
│   │   ├── HungaryMap.tsx          — Interaktív SVG/GeoJSON térkép
│   │   ├── OevkTooltip.tsx         — Tooltip OEVK-ra hover-nél
│   │   └── MapLegend.tsx           — Jelmagyarázat
│   │
│   ├── historical/
│   │   ├── ElectionComparison.tsx  — Évek összehasonlítása
│   │   ├── OevkHistory.tsx         — Egy OEVK történeti eredményei
│   │   ├── SwingAnalysis.tsx       — Egyéni vs. listás eltérés kimutatás
│   │   └── TrendChart.tsx          — Országos trendek 2006-2022
│   │
│   ├── polls/
│   │   ├── PollTracker.tsx         — Közvélemény-kutatások trend grafikon
│   │   ├── PollTable.tsx           — Kutatások táblázat
│   │   ├── PollImporter.tsx        — CSV import felület
│   │   └── PollComparison.tsx      — Intézetek összehasonlítása
│   │
│   └── shared/
│       ├── PartyBadge.tsx          — Párt színes badge
│       ├── PercentageBar.tsx       — Százalékos sáv
│       └── DataTable.tsx           — Általános adattáblázat
│
├── services/
│   └── api.ts                      — Backend API hívások
│
├── hooks/
│   ├── useSimulation.ts            — Szimuláció állapotkezelés
│   └── usePolls.ts                 — Közvélemény-kutatás adatok
│
├── types/
│   └── election.ts                 — TypeScript típusok
│
├── data/
│   └── hungary-oevk.geojson        — OEVK határok GeoJSON
│
└── utils/
    ├── colors.ts                   — Pártszínek
    └── format.ts                   — Szám/százalék formázás
```

### 6.2 Parlamenti patkó (HemicycleChart)

A patkó SVG-ben, D3.js-sel rajzolva. 199 szék félkör alakban:

```
Elrendezés:
- Félkör (180°), belső sugár ~120px, külső ~280px
- 6-8 sor koncentrikus ívben
- Minden szék egy kis kör (r=6-8px)
- Pártszínek: Fidesz narancs (#FD8204), Tisza kék (#00A3E0), Mi Hazánk zöld (#4A7C3F), DK kék (#1B4D8E), MKKP barna, stb.
- Bal oldalon ellenzék, jobb oldalon kormánypárt (konvenció)
- Animált átmenet szimuláció változáskor
- Középen nagy szám: "105 — Tisza Párt" vagy "Nincs többség"
- Szaggatott vonal a 100-as (többség) és 133-as (kétharmad) határnál
```

### 6.3 Interaktív térkép (HungaryMap)

```
- GeoJSON alapú SVG térkép (106 OEVK polygon)
- Színezés: győztes párt színe, intenzitás a margin-hoz kötve
  - Szoros (<5%): halvány szín
  - Közepes (5-15%): normál szín
  - Biztos (>15%): erős/sötét szín
- Hover: tooltip az OEVK nevével, eredményével, swing-jével
- Kattintás: OEVK részletes panel megnyitása (történeti adatok, felülírás lehetőség)
- Budapest kinagyítható (inset map)

GeoJSON forrás: A 2026-os OEVK határok nem publikus GeoJSON-ként, 
de a vtr.valasztas.hu-ról letölthető shapefile-ból vagy 
a korábbi közösségi projektekből (pl. GitHub) előállítható.
Alternatíva: egyszerűsített SVG térkép kézi rajzolással.
```

### 6.4 Egyéni vs. Listás eltérés kimutatás

```
Minden OEVK-nál kimutatás:
- Egyéni eredmény (jelölt szavazat %)
- Listás eredmény (párt szavazat %) — ugyanabban az OEVK-ban
- Eltérés = egyéni% - listás%
  - Pozitív: a jelölt személyesen erősebb a pártjánál ("személyes szavazat")
  - Negatív: a párt erősebb a jelöltnél

Megjelenítés:
- Táblázat: OEVK | Párt | Egyéni% | Listás% | Eltérés
- Szűrő: párt, megye, csak nagy eltérések (>3%)
- Grafikon: scatter plot (x = listás%, y = egyéni%, minden pont egy OEVK)
```

---

## 7. Pártszínek és alapadatok

```typescript
const PARTIES = {
  fidesz_kdnp: {
    shortName: 'Fidesz',
    fullName: 'Fidesz-KDNP',
    color: '#FD8204',       // narancs
    textColor: '#FFFFFF'
  },
  tisza: {
    shortName: 'Tisza',
    fullName: 'Tisza Párt',
    color: '#00A3E0',       // kék
    textColor: '#FFFFFF'
  },
  mi_hazank: {
    shortName: 'Mi Hazánk',
    fullName: 'Mi Hazánk Mozgalom',
    color: '#4A7C3F',       // zöld
    textColor: '#FFFFFF'
  },
  dk: {
    shortName: 'DK',
    fullName: 'Demokratikus Koalíció',
    color: '#1B4D8E',       // sötétkék
    textColor: '#FFFFFF'
  },
  mkkp: {
    shortName: 'MKKP',
    fullName: 'Magyar Kétfarkú Kutya Párt',
    color: '#8B6914',       // barna/arany
    textColor: '#FFFFFF'
  },
  // Történeti pártok (2006-2022):
  mszp: {
    shortName: 'MSZP',
    fullName: 'Magyar Szocialista Párt',
    color: '#CE2029',       // piros
    textColor: '#FFFFFF'
  },
  jobbik: {
    shortName: 'Jobbik',
    fullName: 'Jobbik Magyarországért Mozgalom',
    color: '#000000',       // fekete
    textColor: '#FFFFFF'
  },
  lmp: {
    shortName: 'LMP',
    fullName: 'Lehet Más a Politika',
    color: '#83B431',       // zöld
    textColor: '#FFFFFF'
  },
  egyseges_ellenzek: {
    shortName: 'Egység',
    fullName: 'Egységben Magyarországért',
    color: '#4169E1',       // kék
    textColor: '#FFFFFF'
  },
  other: {
    shortName: 'Egyéb',
    fullName: 'Egyéb pártok és függetlenek',
    color: '#999999',
    textColor: '#FFFFFF'
  }
};
```

---

## 8. UI Design irányelvek

**Esztétika:** Adatvizualizáció-központú, sötét téma (dark mode), magyar nemzeti színekre utaló akcentusok. Hasonló hangulatvilág mint a FiveThirtyEight vagy a The Economist választási oldalai, de magyar kontextusban.

**Tipográfia:**
- Címek: Source Serif 4 vagy Playfair Display (editorial stílus)
- Szöveg: Source Sans 3 vagy DM Sans
- Számok/adatok: JetBrains Mono vagy Fira Code (monospace)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Választási Modellező 2026         [Mentés] [Betölt] │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ Beállítá │    ┌──────────────┐  ┌────────────────┐  │
│ sok      │    │  PARLAMENTI  │  │  MAGYARORSZÁG   │  │
│          │    │   PATKÓ      │  │    TÉRKÉP       │  │
│ Listás%: │    │   199 szék   │  │   106 OEVK      │  │
│ [====]   │    │              │  │                 │  │
│          │    └──────────────┘  └────────────────┘  │
│ Swing:   │                                          │
│ [====]   │  ┌──────────────────────────────────────┐ │
│          │  │  OEVK EREDMÉNYEK TÁBLÁZAT            │ │
│ OEVK     │  │  + egyéni/listás eltérés             │ │
│ felülírás│  │                                      │ │
│ [+]      │  └──────────────────────────────────────┘ │
│          │                                          │
│ Részvétel│  ┌──────────────────────────────────────┐ │
│ [====]   │  │  KÖZVÉLEMÉNY-KUTATÁSOK TREND         │ │
│          │  └──────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────┘
```

---

## 9. Fejlesztési fázisok (Claude Code utasítások)

### Fázis 1: Projekt inicializálás és adatbázis
```
Hozd létre a monorepo struktúrát:
- /backend: Express + TypeScript + better-sqlite3
- /frontend: Vite + React + TypeScript + Tailwind CSS

Backend:
1. Telepítsd: express, better-sqlite3, cors, @types/... 
2. Hozd létre az SQLite sémát (schema.sql a fenti definíció alapján)
3. Seed data: töltsd fel a parties táblát az alapértelmezett pártokkal
4. Implementáld a D'Hondt algoritmust (services/dhondt.ts)
5. Implementáld a töredékszavazat-számítást (services/fragments.ts)
6. Alapvető REST API: GET /api/elections, GET /api/parties

Tesztek: A D'Hondt motort teszteld a Wikipédia magyar választási rendszer
cikk példájával (19 mandátumos egyszerűsített modell).
```

### Fázis 2: Szimuláció motor
```
1. Implementáld a szimuláció motort (services/simulation.ts)
   - Uniform swing modell
   - OEVK felülírások kezelése
   - Normalizálás, korlátkezelés
2. POST /api/simulate endpoint
3. Szimuláció mentés/betöltés (simulations tábla)

Teszteld demo adatokkal:
- Hozz létre 106 minta OEVK-t 2022-es becsült eredményekkel
- Futtass szimulációt: "Tisza +10% uniform swing" → ellenőrizd logikát
```

### Fázis 3: Frontend alap + Parlamenti patkó
```
1. Vite projekt, Tailwind konfiguráció, magyar UI alap
2. Layout: Header + Sidebar + Main content area
3. HemicycleChart komponens D3.js-sel:
   - 199 szék félkörben, 7 sor
   - Pártszínek, animált átmenet
   - Többségi/kétharmados jelölő vonalak
   - Központi mandátumszám kijelző
4. SeatSummary: sávdiagram a mandátumokról
5. SwingSliders: Recharts csúszkák
6. Kössük össze: csúszka mozgatás → API hívás → patkó frissül
```

### Fázis 4: Térkép
```
1. GeoJSON vagy egyszerűsített SVG térkép a 106 OEVK-val
   - Ha nincs pontos GeoJSON, készíts egy egyszerűsített SVG-t
     megyei kontúrokkal és OEVK sorszámokkal
2. Színezés a szimuláció eredménye alapján
3. Hover tooltip: OEVK név, párt%, margin
4. Kattintás: részletes panel + felülírás lehetőség
5. Budapest inset (nagyított)
```

### Fázis 5: Történeti adatok és közvélemény-kutatások
```
1. CSV import felület közvélemény-kutatásokhoz
2. PollTracker: idősor grafikon (Recharts) — minden intézet külön vonal
3. ElectionComparison: 2014/2018/2022 összehasonlítás
4. SwingAnalysis: egyéni vs. listás eltérés kimutatás
   - Scatter plot + táblázat
   - Szűrők: párt, megye, eltérés nagysága
5. OevkHistory: egy kiválasztott OEVK összes eredménye 2014-2022
```

### Fázis 6: Finomítás és adatbetöltés
```
1. Valós történeti adatok importálása (ha CSV/XLSX elérhetők)
2. Települési → 2026 OEVK újraaggregálás script
3. Több szimuláció összehasonlítás (A/B)
4. Export: PNG/SVG a patkóból, CSV az eredményekből
5. Reszponzív design (mobil nézet)
```

---

## 10. Adatbetöltés stratégia

Mivel a valasztas.hu fájlok XLSX formátumban érhetők el, és a letöltés nem automatizálható egyszerűen (nincs nyílt API), a javasolt stratégia:

1. **Kézi letöltés:** A fejlesztő (Zoli) letölti az XLSX fájlokat a valasztas.hu-ról
2. **Import script:** Python vagy TypeScript script, amely beolvassa az XLSX-eket és feltölti az SQLite-ba
3. **Seed data:** A legfontosabb adatok (2022 OEVK eredmények, 2026 OEVK definíciók) beépíthetők mint seed data
4. **Közvélemény-kutatások:** CSV import a felületen keresztül

Alternatíva: A valasztas2026.com és partpreferencia.hu oldalak már feldolgozott adatokat tartalmaznak, amelyeket referencia-forrásként lehetne használni.

---

## 11. Ismert korlátok és disclaimer

A programba építendő figyelmeztetés:
> "Ez egy modellező eszköz, nem előrejelzés. A uniform swing modell feltételezi, 
> hogy az országos változás minden körzetben egyformán érvényesül, ami a valóságban 
> nem igaz. Az OEVK-szintű eredmények becslések, különösen a 2026-ra átrajzolt 
> körzetekben. A közvélemény-kutatások mintavételi hibával terheltek."
```
