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
