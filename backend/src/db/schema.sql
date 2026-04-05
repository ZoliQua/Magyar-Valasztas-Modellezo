-- Magyar Választási Modellező — SQLite séma

-- Pártok (rugalmas, nem beégetett)
CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  short_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  color TEXT NOT NULL,
  text_color TEXT NOT NULL DEFAULT '#FFFFFF',
  sort_order INTEGER DEFAULT 0
);

-- Választási évek
CREATE TABLE IF NOT EXISTS elections (
  year INTEGER PRIMARY KEY,
  system TEXT NOT NULL CHECK (system IN ('old', 'new')),
  total_seats INTEGER NOT NULL,
  oevk_seats INTEGER NOT NULL,
  list_seats INTEGER NOT NULL,
  turnout_pct REAL,
  notes TEXT
);

-- OEVK definíciók (2014-es és 2026-os beosztás is)
CREATE TABLE IF NOT EXISTS oevk_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  oevk_id TEXT NOT NULL,
  valid_from INTEGER NOT NULL,
  valid_to INTEGER,
  county TEXT NOT NULL,
  oevk_number INTEGER NOT NULL,
  seat_city TEXT,
  display_name TEXT NOT NULL
);

-- Település → OEVK leképezés (2026-os beosztáshoz)
CREATE TABLE IF NOT EXISTS settlement_oevk_mapping (
  settlement_id TEXT NOT NULL,
  settlement_name TEXT NOT NULL,
  county TEXT NOT NULL,
  oevk_id_2014 TEXT,
  oevk_id_2026 TEXT,
  split_ratio REAL DEFAULT 1.0,
  PRIMARY KEY (settlement_id, oevk_id_2026)
);

-- Egyéni (OEVK) választási eredmények — 2014, 2018, 2022
CREATE TABLE IF NOT EXISTS oevk_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  election_year INTEGER NOT NULL,
  oevk_id TEXT NOT NULL,
  oevk_id_2026 TEXT,
  party_id TEXT NOT NULL,
  candidate_name TEXT,
  votes INTEGER NOT NULL,
  vote_share_pct REAL,
  is_winner INTEGER DEFAULT 0,
  FOREIGN KEY (election_year) REFERENCES elections(year),
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

-- Listás eredmények — 2006-tól (országos és megyei)
CREATE TABLE IF NOT EXISTS list_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  election_year INTEGER NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('national', 'county')),
  county TEXT,
  oevk_id TEXT,
  party_id TEXT NOT NULL,
  votes INTEGER NOT NULL,
  vote_share_pct REAL,
  FOREIGN KEY (election_year) REFERENCES elections(year),
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

-- Közvélemény-kutatások
CREATE TABLE IF NOT EXISTS polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_date TEXT NOT NULL,
  institute TEXT NOT NULL,
  basis TEXT NOT NULL CHECK (basis IN ('teljes_nepesseg', 'partvalaszto', 'biztos_partvalaszto')),
  party_id TEXT NOT NULL,
  support_pct REAL NOT NULL,
  sample_size INTEGER,
  margin_of_error REAL,
  source_url TEXT,
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

-- Szimulációk (mentés/betöltés)
CREATE TABLE IF NOT EXISTS simulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  description TEXT,
  config_json TEXT NOT NULL
);

-- Települési szintű eredmények (újraaggregáláshoz)
CREATE TABLE IF NOT EXISTS settlement_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  election_year INTEGER NOT NULL,
  settlement_id TEXT NOT NULL,
  settlement_name TEXT NOT NULL,
  county TEXT NOT NULL,
  result_type TEXT NOT NULL CHECK (result_type IN ('egyeni', 'listas')),
  party_id TEXT NOT NULL,
  votes INTEGER NOT NULL,
  FOREIGN KEY (election_year) REFERENCES elections(year),
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

-- Indexek
CREATE INDEX IF NOT EXISTS idx_oevk_results_year ON oevk_results(election_year);
CREATE INDEX IF NOT EXISTS idx_oevk_results_oevk ON oevk_results(oevk_id_2026);
CREATE INDEX IF NOT EXISTS idx_list_results_year ON list_results(election_year);
CREATE INDEX IF NOT EXISTS idx_polls_date ON polls(poll_date);
CREATE INDEX IF NOT EXISTS idx_settlement_results ON settlement_results(election_year, settlement_id);
