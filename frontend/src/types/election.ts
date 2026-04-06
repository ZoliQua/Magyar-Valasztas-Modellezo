export interface Party {
  id: string;
  short_name: string;
  full_name: string;
  color: string;
  text_color: string;
  sort_order: number;
}

export interface Election {
  year: number;
  system: 'old' | 'new';
  total_seats: number;
  oevk_seats: number;
  list_seats: number;
  turnout_pct: number | null;
  notes: string | null;
}

export interface SimulationInput {
  listShares: Record<string, number>;
  uniformSwing: Record<string, number>;
  oevkOverrides: Record<string, Record<string, number>>;
  baseYear: number;
  turnoutPct: number;
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

export interface PredictedMP {
  name: string;
  party_id: string;
  source: 'oevk' | 'lista';
  oevk_id?: string;
  oevk_name?: string;
  list_position?: number;
  original_list_position?: number;
}

export interface MPPrediction {
  mps: PredictedMP[];
  totalSeats: Record<string, number>;
  oevkSeats: Record<string, number>;
  listSeats: Record<string, number>;
}
