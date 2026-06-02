import type { Match } from "@/lib/types";

export const demoMatches: Match[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    home_team: "Mexico",
    away_team: "Sudafrica",
    home_country_code: "mx",
    away_country_code: "za",
    kickoff_at: "2026-06-11T16:00:00-05:00",
    stadium: "Estadio Azteca",
    stage: "GROUP",
    group_name: "A",
    status: "open",
    locked: false,
    home_goals: null,
    away_goals: null
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    home_team: "Canada",
    away_team: "Clasificado",
    home_country_code: "ca",
    away_country_code: null,
    kickoff_at: "2026-06-12T18:00:00-04:00",
    stadium: "BMO Field",
    stage: "GROUP",
    group_name: "B",
    status: "open",
    locked: false,
    home_goals: null,
    away_goals: null
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    home_team: "Estados Unidos",
    away_team: "Clasificado",
    home_country_code: "us",
    away_country_code: null,
    kickoff_at: "2026-06-12T20:00:00-07:00",
    stadium: "SoFi Stadium",
    stage: "GROUP",
    group_name: "D",
    status: "open",
    locked: false,
    home_goals: null,
    away_goals: null
  }
];

export const demoRanking = [
  {
    user_id: "demo-1",
    display_name: "Marcos",
    total_points: 4,
    exact_hits: 1,
    trend_hits: 2
  },
  {
    user_id: "demo-2",
    display_name: "Juan",
    total_points: 2,
    exact_hits: 0,
    trend_hits: 2
  },
  {
    user_id: "demo-3",
    display_name: "Nico",
    total_points: 1,
    exact_hits: 0,
    trend_hits: 1
  }
];
