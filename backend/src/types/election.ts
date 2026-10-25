// Párt
export interface Party {
  id: string;
  short_name: string;
  full_name: string;
  color: string;
  text_color: string;
  sort_order: number;
}

// Választási év
export interface Election {
  year: number;
  system: 'old' | 'new';
  total_seats: number;
  oevk_seats: number;
  list_seats: number;
  turnout_pct: number | null;
  notes: string | null;
}

// OEVK definíció
export interface OevkDefinition {
  id: number;
  oevk_id: string;
  valid_from: number;
  valid_to: number | null;
  county: string;
  oevk_number: number;
  seat_city: string | null;
  display_name: string;
}

// OEVK eredmény
export interface OevkResult {
  id: number;
  election_year: number;
  oevk_id: string;
  oevk_id_2026: string | null;
  party_id: string;
  candidate_name: string | null;
  votes: number;
  vote_share_pct: number | null;
  is_winner: boolean;
}

// Listás eredmény
export interface ListResult {
  id: number;
  election_year: number;
  level: 'national' | 'county';
  county: string | null;
  oevk_id: string | null;
  party_id: string;
  votes: number;
  vote_share_pct: number | null;
}

// Közvélemény-kutatás
export interface Poll {
  id: number;
  poll_date: string;
  institute: string;
  basis: 'teljes_nepesseg' | 'partvalaszto' | 'biztos_partvalaszto';
  party_id: string;
  support_pct: number;
  sample_size: number | null;
  margin_of_error: number | null;
  source_url: string | null;
}

// Szimuláció
export interface SimulationInput {
  listShares: Record<string, number>;
  uniformSwing: Record<string, number>;
  oevkOverrides: Record<string, Record<string, number>>;
  baseYear: number;
  turnoutPct: number;
  /** "national" = csak listás, "auto_swing" = OEVK szintű swing a listás arányokból */
  swingMode?: 'national' | 'auto_swing';
}

export interface OevkSimResult {
  oevk_id: string;
  display_name: string;
  county: string;
  winner_party: string;
  results: Array<{
    party_id: string;
    vote_share_pct: number;
    votes: number;
  }>;
  margin: number;
}

export interface SimulationResult {
  totalSeats: Record<string, number>;
  oevkResults: OevkSimResult[];
  oevkSeats: Record<string, number>;
  listSeats: Record<string, number>;
  fragmentVotes: Record<string, number>;
  majority: string | null;
  supermajority: boolean;
}

export interface SavedSimulation {
  id: number;
  name: string;
  created_at: string;
  description: string | null;
  config_json: string;
}

// Képviselői mandátum (tényleges, nem projekció) — mp_mandates sor
export interface MpMandateRow {
  party_id: string;
  name: string;
  mandate_type: 'oevk' | 'lista';
  oevk_id: string | null;
  list_position: number | null;
  granted_by_change_id: string | null;
  ended_by_change_id: string | null;
  end_date: string | null;
}

// NVB-határozattal kiadott mandátumváltozás — mp_changes sor
export interface MpChangeRow {
  id: string;
  decision_ref: string;
  decision_date: string;
  party_id: string;
  reason: string | null;
  note: string | null;
  sources_json: string;
}

// Egy képviselő a megjelenítéshez (a frontend PredictedMP-vel kompatibilis)
export interface ActualMP {
  name: string;
  party_id: string;
  source: 'oevk' | 'lista';
  oevk_id?: string;
  oevk_name?: string;
  list_position?: number;
  /** Ha későbbi NVB-határozattal lépett be: a határozat azonosítója */
  granted_by?: string;
  granted_by_ref?: string;
  /** Ha már nem képviselő: a távozást rögzítő határozat azonosítója és dátuma */
  ended_by?: string;
  ended_by_ref?: string;
  end_date?: string;
}

export interface MpChangeEvent {
  id: string;
  decision_ref: string;
  decision_date: string;
  party_id: string;
  reason: string | null;
  note: string | null;
  sources: string[];
  outgoing: ActualMP[];
  incoming: ActualMP[];
}

export interface MpRoster {
  year: number;
  /** Aktuális 199 képviselő */
  current: ActualMP[];
  /** A jogerős eredmény szerinti eredeti mandátumosok */
  original: ActualMP[];
  /** Személycserék időrendben */
  changes: MpChangeEvent[];
  /** Aktuális frakciólétszám pártonként */
  seatsByParty: Record<string, number>;
}
