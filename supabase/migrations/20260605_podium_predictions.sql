create table if not exists podium_predictions (
  user_id uuid primary key references profiles(id) on delete cascade,
  champion_team text,
  runner_up_team text,
  third_place_team text,
  champion_points integer not null default 0,
  runner_up_points integer not null default 0,
  third_place_points integer not null default 0,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists podium_predictions_touch_updated_at on podium_predictions;
create trigger podium_predictions_touch_updated_at
before update on podium_predictions
for each row execute function touch_updated_at();

alter table podium_predictions enable row level security;

drop policy if exists "podium predictions read own" on podium_predictions;
create policy "podium predictions read own" on podium_predictions
for select using (auth.uid() = user_id);

drop policy if exists "podium predictions insert own" on podium_predictions;
create policy "podium predictions insert own" on podium_predictions
for insert with check (auth.uid() = user_id);

drop policy if exists "podium predictions update own" on podium_predictions;
create policy "podium predictions update own" on podium_predictions
for update using (auth.uid() = user_id);

drop function if exists ranking();

create function ranking()
returns table(user_id uuid, display_name text, total_points bigint, exact_hits bigint, trend_hits bigint, podium_points bigint)
language sql stable as $$
  with match_points as (
    select
      pr.user_id,
      coalesce(sum(pr.points), 0)::bigint as points,
      coalesce(sum(case when pr.exact_hit then 1 else 0 end), 0)::bigint as exact_hits,
      coalesce(sum(case when pr.trend_hit then 1 else 0 end), 0)::bigint as trend_hits
    from predictions pr
    group by pr.user_id
  ),
  podium_points as (
    select
      pp.user_id,
      coalesce(pp.points, 0)::bigint as points
    from podium_predictions pp
  )
  select
    p.id,
    p.display_name,
    (coalesce(mp.points, 0) + coalesce(pp.points, 0))::bigint as total_points,
    coalesce(mp.exact_hits, 0)::bigint as exact_hits,
    coalesce(mp.trend_hits, 0)::bigint as trend_hits,
    coalesce(pp.points, 0)::bigint as podium_points
  from profiles p
  left join match_points mp on mp.user_id = p.id
  left join podium_points pp on pp.user_id = p.id
  group by p.id, p.display_name, mp.points, mp.exact_hits, mp.trend_hits, pp.points
  order by total_points desc, exact_hits desc, trend_hits desc, p.display_name asc;
$$;
