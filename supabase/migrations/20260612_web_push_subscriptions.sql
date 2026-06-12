create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists push_subscriptions_touch_updated_at on push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on push_subscriptions
for each row execute function touch_updated_at();

create table if not exists web_push_logs (
  id text primary key,
  created_at timestamptz not null default now()
);
