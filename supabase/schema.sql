create extension if not exists "uuid-ossp";

create type user_role as enum ('admin', 'participant');
create type match_stage as enum ('GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL');
create type match_status as enum ('open', 'locked', 'closed');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  auth_email text not null unique,
  display_name text not null,
  phone text,
  paid boolean not null default false,
  role user_role not null default 'participant',
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_display_name_unique_ci on profiles (lower(trim(display_name)));

create table if not exists matches (
  id uuid primary key default uuid_generate_v4(),
  home_team text not null,
  away_team text not null,
  home_country_code text,
  away_country_code text,
  kickoff_at timestamptz not null,
  stadium text,
  stage match_stage not null,
  group_name text,
  provider_match_id text unique,
  status match_status not null default 'open',
  locked boolean not null default false,
  home_goals integer,
  away_goals integer,
  penalty_winner text,
  created_at timestamptz not null default now()
);

create table if not exists predictions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  home_goals integer not null check (home_goals >= 0),
  away_goals integer not null check (away_goals >= 0),
  penalty_winner text,
  points integer not null default 0,
  trend_hit boolean not null default false,
  exact_hit boolean not null default false,
  score_details text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create table if not exists notification_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  match_id uuid references matches(id) on delete cascade,
  kind text not null,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists payment_attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null default 'mercadopago',
  amount integer not null default 15000,
  status text not null default 'started',
  preference_id text,
  payment_id text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists predictions_touch_updated_at on predictions;
create trigger predictions_touch_updated_at
before update on predictions
for each row execute function touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, auth_email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function ranking()
returns table(user_id uuid, display_name text, total_points bigint, exact_hits bigint, trend_hits bigint)
language sql stable as $$
  select
    p.id,
    p.display_name,
    coalesce(sum(pr.points), 0)::bigint as total_points,
    coalesce(sum(case when pr.exact_hit then 1 else 0 end), 0)::bigint as exact_hits,
    coalesce(sum(case when pr.trend_hit then 1 else 0 end), 0)::bigint as trend_hits
  from profiles p
  left join predictions pr on pr.user_id = p.id
  group by p.id, p.display_name
  order by total_points desc, exact_hits desc, trend_hits desc, p.display_name asc;
$$;

create or replace function users_missing_prediction(p_match_id uuid)
returns table(user_id uuid, auth_email text, display_name text)
language sql stable as $$
  select p.id, p.auth_email, p.display_name
  from profiles p
  where p.role = 'participant'
    and not exists (
      select 1 from predictions pr
      where pr.user_id = p.id and pr.match_id = p_match_id
    );
$$;

create or replace function pending_predictions_for_user(p_user_id uuid)
returns table(match_id uuid, home_team text, away_team text, kickoff_at timestamptz)
language sql stable as $$
  select m.id, m.home_team, m.away_team, m.kickoff_at
  from matches m
  where m.home_goals is null
    and m.locked = false
    and not exists (
      select 1 from predictions pr
      where pr.user_id = p_user_id and pr.match_id = m.id
    )
  order by m.kickoff_at asc;
$$;

alter table profiles enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;
alter table notification_logs enable row level security;
alter table payment_attempts enable row level security;
alter table news_items enable row level security;

drop policy if exists "profiles read own" on profiles;
create policy "profiles read own" on profiles
for select using (auth.uid() = id);

drop policy if exists "profiles update own" on profiles;
create policy "profiles update own" on profiles
for update using (auth.uid() = id);

drop policy if exists "matches readable" on matches;
create policy "matches readable" on matches
for select using (true);

drop policy if exists "news items readable" on news_items;
create policy "news items readable" on news_items
for select using (published = true);

drop policy if exists "predictions read own" on predictions;
create policy "predictions read own" on predictions
for select using (auth.uid() = user_id);

drop policy if exists "predictions insert own" on predictions;
create policy "predictions insert own" on predictions
for insert with check (auth.uid() = user_id);

drop policy if exists "predictions update own before lock" on predictions;
create policy "predictions update own before lock" on predictions
for update using (
  auth.uid() = user_id
  and exists (
    select 1 from matches m
    where m.id = predictions.match_id
      and m.locked = false
      and m.kickoff_at > now() + interval '15 minutes'
  )
);

drop policy if exists "payment attempts read own" on payment_attempts;
create policy "payment attempts read own" on payment_attempts
for select using (auth.uid() = user_id);
