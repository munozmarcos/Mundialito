alter table public.matches
  add column if not exists home_penalty_goals integer,
  add column if not exists away_penalty_goals integer;

