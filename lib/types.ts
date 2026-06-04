export type Role = "admin" | "participant";

export type MatchStage =
  | "GROUP"
  | "R32"
  | "R16"
  | "QF"
  | "SF"
  | "THIRD_PLACE"
  | "FINAL";

export type MatchStatus = "open" | "locked" | "closed" | "closing_soon" | "playing";

export type Profile = {
  id: string;
  auth_email: string;
  display_name: string;
  role: Role;
  phone?: string | null;
  paid?: boolean | null;
};

export type Match = {
  id: string;
  home_team: string;
  away_team: string;
  home_country_code?: string | null;
  away_country_code?: string | null;
  kickoff_at: string;
  stadium?: string | null;
  stage: MatchStage;
  group_name?: string | null;
  provider_match_id?: string | null;
  status: MatchStatus;
  locked: boolean;
  home_goals?: number | null;
  away_goals?: number | null;
  penalty_winner?: string | null;
};

export type Prediction = {
  id: string;
  user_id: string;
  match_id: string;
  home_goals: number;
  away_goals: number;
  penalty_winner?: string | null;
  points: number;
  trend_hit: boolean;
  exact_hit: boolean;
};
