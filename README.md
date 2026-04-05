# 🇭🇺 Magyar Választási Modellező 2026

> 🗳️ Interaktív webalkalmazás a 2026-os magyar országgyűlési választás modellezéséhez

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📋 Tartalomjegyzék / Table of Contents

- [🇭🇺 Magyar](#-magyar)
- [🇬🇧 English](#-english)

---

# 🇭🇺 Magyar

## 🎯 Mi ez?

A **Magyar Választási Modellező** egy teljes körű, interaktív dashboard a 2026-os magyar országgyűlési választás eredményeinek szimulálásához. A program valódi történeti adatokra épül (2014–2022), és lehetővé teszi a mandátumelosztás modellezését különböző forgatókönyvek alapján.

### ✨ Főbb funkciók

- 🏛️ **Parlamenti patkó** — 199 mandátum félkör diagramja D3.js-sel, animált átmenetekkel
- 🗺️ **Interaktív térkép** — 106 OEVK valódi GeoJSON poligonokkal, zoom/pan, Budapest nagyítás
- 📊 **Szimuláció motor** — D'Hondt módszer, töredékszavazat-számítás, uniform swing modell
- 🔄 **Egyedi swing mód** — OEVK szintű automatikus swing a listás arányok alapján
- 👤 **Valódi jelöltek** — 651 regisztrált 2026-os jelölt a vtr.valasztas.hu-ról
- 📋 **Listás mandátumok** — kattintható pártlisták, OEVK győztesek automatikus kiszűrése
- 📈 **Közvélemény-kutatások** — 300+ kutatás trendje az angol Wikipediáról
- 📜 **Történeti adatok** — 2014, 2018, 2022 választási eredmények
- 🔍 **OEVK részletes panel** — jelölt nevek, történeti eredmények, 2026 projekció

## 🏗️ Technológia

| Réteg | Technológia |
|-------|-------------|
| 🖥️ Frontend | React 18 + TypeScript + Vite |
| 🎨 Stílus | Tailwind CSS (sötét téma) |
| 📊 Vizualizáció | D3.js (patkó), Recharts (trendek), SVG (térkép) |
| ⚙️ Backend | Express.js + TypeScript |
| 🗄️ Adatbázis | SQLite (better-sqlite3) |
| 📦 Monorepo | npm workspaces |
| 🐍 Adatimport | Python (requests, BeautifulSoup, openpyxl) |

## 📐 A magyar választási rendszer

A program a 2014 óta érvényes választási rendszert modellezi:

- **199 mandátum** összesen
  - **106 egyéni választókerület (OEVK)** — relatív többség, egyfordulós
  - **93 országos listás mandátum** — D'Hondt módszer, 5% küszöb
- **Töredékszavazatok**: vesztes jelöltek összes szavazata + győztes többlet → listás szavazatokhoz adódik
- **2026-os változás**: Budapest 18→16 OEVK, Pest 12→14 OEVK (összesen 39 OEVK érintett)

## 🚀 Telepítés

### Előfeltételek

- 📦 Node.js 18+
- 🐍 Python 3.10+ (adatimporthoz)
- 📀 Git

### 1. Klónozás és függőségek

```bash
git clone https://github.com/ZoliQua/Magyar-Valasztas-Modellezo.git
cd Magyar-Valasztas-Modellezo
npm install
```

### 2. Adatbázis inicializálás

```bash
npx tsx backend/src/db/init.ts
```

### 3. Valódi adatok importálása 🐍

```bash
cd scripts
pip install -r requirements.txt

# 2026-os OEVK definíciók (106 OEVK + 3207 település)
python import_oevk_mapping.py

# Választási eredmények (2022 VTR JSON API + 2018 + 2014 XLSX)
python import_elections.py

# 2026-os jelöltek (651 regisztrált jelölt)
python import_candidates_2026.py

# Országos listajelöltek (452 jelölt, 6 lista)
python import_list_candidates.py

# OEVK térkép GeoJSON (106 poligon)
python download_geojson.py

# Közvélemény-kutatások (300+ kutatás az EN Wikipediáról)
python import_polls.py

cd ..
```

### 4. Indítás

```bash
npm run dev
```

- 🖥️ Frontend: http://localhost:5173
- ⚙️ Backend: http://localhost:3001

## 📁 Projekt struktúra

```
├── 📂 backend/                 # Express + TypeScript szerver
│   ├── src/
│   │   ├── db/                 # SQLite séma, seed, init
│   │   ├── routes/             # API endpointok
│   │   ├── services/           # D'Hondt, töredékszavazat, szimuláció
│   │   └── types/              # TypeScript típusok
│   └── data/                   # valasztas.db (generált)
├── 📂 frontend/                # React + Vite + Tailwind
│   └── src/
│       ├── components/
│       │   ├── simulation/     # Csúszkák, beállítások
│       │   ├── results/        # Patkó, összesítő, OEVK tábla, lista panel
│       │   ├── map/            # Interaktív Magyarország térkép
│       │   ├── historical/     # Történeti összehasonlítás
│       │   ├── polls/          # Közvélemény-kutatások
│       │   └── layout/         # Header, Sidebar
│       ├── hooks/              # useSimulation, usePolls
│       ├── services/           # API kliens
│       └── data/               # hungary-oevk.json (GeoJSON)
├── 📂 scripts/                 # Python adatimport scriptek
│   ├── common.py               # Közös: DB kapcsolat, párt normalizálás
│   ├── import_elections.py     # valasztas.hu VTR API + master ZIP
│   ├── import_oevk_mapping.py  # 2026-os OEVK települési leképezés
│   ├── import_candidates_2026.py # 2026-os egyéni jelöltek
│   ├── import_list_candidates.py # Országos listajelöltek
│   ├── download_geojson.py     # OEVK határok GeoJSON konvertálás
│   └── import_polls.py         # Közvélemény-kutatások (EN Wikipedia)
├── 📄 CLAUDE.md                # AI fejlesztési útmutató
├── 📄 PLAN-ELECTON-MODEL.md    # Eredeti projektterv
└── 📄 LICENSE                  # MIT
```

## 🔌 API endpointok

| Módszer | Útvonal | Leírás |
|---------|---------|--------|
| GET | `/api/parties` | Pártok listája |
| GET | `/api/parties/:id/list-candidates` | Országos lista jelöltjei (OEVK győztesek szűrve) |
| GET | `/api/elections` | Választási évek |
| GET | `/api/elections/:year/national-shares` | Országos listás arányok |
| GET | `/api/elections/:year/oevk` | OEVK eredmények |
| POST | `/api/simulate` | Szimuláció futtatása |
| GET | `/api/oevk/definitions` | 106 OEVK definíció |
| GET | `/api/oevk/:id/history` | OEVK történeti + jelölt adatok |
| GET | `/api/polls` | Közvélemény-kutatások |
| POST | `/api/polls/import` | CSV import |
| GET | `/api/polls/trend` | Trend idősor |
| POST | `/api/simulations` | Szimuláció mentése |
| GET | `/api/simulations` | Mentett szimulációk |

## 📊 Adatforrások

| Forrás | Adat | Formátum |
|--------|------|----------|
| 🏛️ [vtr.valasztas.hu/ogy2022](https://vtr.valasztas.hu/ogy2022/) | 2022 OEVK + listás eredmények | JSON API |
| 🏛️ [vtr.valasztas.hu/ogy2026](https://vtr.valasztas.hu/ogy2026/) | 2026 jelöltek (651 fő) | JSON API |
| 🏛️ [vtr.valasztas.hu/stat](https://vtr.valasztas.hu/stat) | 2026 OEVK definíciók + települések | JSON API |
| 🏛️ [static.valasztas.hu](https://static.valasztas.hu/dyn/oevk_data/oevk.json) | OEVK határok (poligonok) | JSON |
| 📦 [static.valasztas.hu](https://static.valasztas.hu/dyn/letoltesek/valasztasi_eredmenyek_1990-2024.zip) | 2014 listás eredmények | ZIP → XLSX |
| 📰 [EN Wikipedia](https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Hungarian_parliamentary_election) | Közvélemény-kutatások (300+) | HTML scraping |

## ⚠️ Figyelmeztetés

> Ez egy **modellező eszköz**, nem előrejelzés. A uniform swing modell feltételezi, hogy az országos változás minden körzetben egyformán érvényesül, ami a valóságban nem igaz. Az OEVK-szintű eredmények becslések, különösen a 2026-ra átrajzolt körzetekben. A közvélemény-kutatások mintavételi hibával terheltek.

## 🧪 Tesztek

```bash
npm run test                # Backend tesztek (D'Hondt + töredékszavazat)
npm run build               # Teljes build (backend + frontend)
```

---

# 🇬🇧 English

## 🎯 What is this?

The **Hungarian Election Modeler** is a comprehensive interactive dashboard for simulating the results of the 2026 Hungarian parliamentary election. Built on real historical data (2014–2022), it enables seat allocation modeling under various scenarios.

### ✨ Key Features

- 🏛️ **Parliament hemicycle** — 199 seats in a semicircle chart with D3.js animations
- 🗺️ **Interactive map** — 106 constituencies with real GeoJSON polygons, zoom/pan, Budapest zoom
- 📊 **Simulation engine** — D'Hondt method, fragment vote calculation, uniform swing model
- 🔄 **Auto-swing mode** — automatic per-constituency swing derived from national list shares
- 👤 **Real candidates** — 651 registered 2026 candidates from vtr.valasztas.hu
- 📋 **List mandates** — clickable party lists, OEVK winners automatically filtered out
- 📈 **Opinion polls** — 300+ polls trending from English Wikipedia
- 📜 **Historical data** — 2014, 2018, 2022 election results
- 🔍 **Constituency detail panel** — candidate names, historical results, 2026 projection

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| 🖥️ Frontend | React 18 + TypeScript + Vite |
| 🎨 Styling | Tailwind CSS (dark theme) |
| 📊 Visualization | D3.js (hemicycle), Recharts (trends), SVG (map) |
| ⚙️ Backend | Express.js + TypeScript |
| 🗄️ Database | SQLite (better-sqlite3) |
| 📦 Monorepo | npm workspaces |
| 🐍 Data import | Python (requests, BeautifulSoup, openpyxl) |

## 📐 The Hungarian Electoral System

The program models the electoral system in effect since 2014:

- **199 seats** total
  - **106 single-member constituencies (OEVK)** — simple plurality, single round
  - **93 national list seats** — D'Hondt method, 5% threshold
- **Fragment votes**: losing candidates' total votes + winner's surplus → added to party list votes
- **2026 changes**: Budapest 18→16 OEVKs, Pest County 12→14 OEVKs (39 OEVKs redrawn total)

## 🚀 Installation

### Prerequisites

- 📦 Node.js 18+
- 🐍 Python 3.10+ (for data import)
- 📀 Git

### 1. Clone and install

```bash
git clone https://github.com/ZoliQua/Magyar-Valasztas-Modellezo.git
cd Magyar-Valasztas-Modellezo
npm install
```

### 2. Initialize database

```bash
npx tsx backend/src/db/init.ts
```

### 3. Import real data 🐍

```bash
cd scripts
pip install -r requirements.txt

python import_oevk_mapping.py       # 2026 OEVK definitions (106 + 3207 settlements)
python import_elections.py           # Election results (2022 VTR + 2018 + 2014)
python import_candidates_2026.py     # 2026 candidates (651 registered)
python import_list_candidates.py     # National list candidates (452 across 6 lists)
python download_geojson.py           # OEVK boundary GeoJSON (106 polygons)
python import_polls.py               # Opinion polls (300+ from EN Wikipedia)

cd ..
```

### 4. Run

```bash
npm run dev
```

- 🖥️ Frontend: http://localhost:5173
- ⚙️ Backend: http://localhost:3001

## 📊 Data Sources

| Source | Data | Format |
|--------|------|----------|
| 🏛️ [vtr.valasztas.hu/ogy2022](https://vtr.valasztas.hu/ogy2022/) | 2022 OEVK + list results | JSON API |
| 🏛️ [vtr.valasztas.hu/ogy2026](https://vtr.valasztas.hu/ogy2026/) | 2026 candidates (651) | JSON API |
| 🏛️ [vtr.valasztas.hu/stat](https://vtr.valasztas.hu/stat) | 2026 OEVK definitions + settlements | JSON API |
| 🏛️ [static.valasztas.hu](https://static.valasztas.hu/dyn/oevk_data/oevk.json) | OEVK boundaries (polygons) | JSON |
| 📦 [static.valasztas.hu](https://static.valasztas.hu/dyn/letoltesek/valasztasi_eredmenyek_1990-2024.zip) | 2014 list results | ZIP → XLSX |
| 📰 [EN Wikipedia](https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Hungarian_parliamentary_election) | Opinion polls (300+) | HTML scraping |

## ⚠️ Disclaimer

> This is a **modeling tool**, not a forecast. The uniform swing model assumes national changes apply uniformly across all constituencies, which is not true in practice. Constituency-level results are estimates, especially in the 39 redrawn constituencies for 2026. Opinion polls are subject to sampling error.

## 🧪 Tests

```bash
npm run test                # Backend tests (D'Hondt + fragment votes)
npm run build               # Full build (backend + frontend)
```

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Created with ❤️ by **Zoltan Dul**

</div>
