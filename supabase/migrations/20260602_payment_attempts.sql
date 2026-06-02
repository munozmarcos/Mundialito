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

drop trigger if exists payment_attempts_touch_updated_at on payment_attempts;
create trigger payment_attempts_touch_updated_at
before update on payment_attempts
for each row execute function touch_updated_at();

alter table payment_attempts enable row level security;

drop policy if exists "payment attempts read own" on payment_attempts;
create policy "payment attempts read own" on payment_attempts
for select using (auth.uid() = user_id);
