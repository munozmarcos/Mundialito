-- Security hardening: every application table in public must have RLS enabled.
-- Server/API code uses the service role and bypasses RLS; public clients should not
-- be able to read/write operational logs, push subscriptions, or admin data directly.

alter table if exists public.profiles enable row level security;
alter table if exists public.matches enable row level security;
alter table if exists public.predictions enable row level security;
alter table if exists public.podium_predictions enable row level security;
alter table if exists public.podium_settings enable row level security;
alter table if exists public.notification_logs enable row level security;
alter table if exists public.payment_attempts enable row level security;
alter table if exists public.news_items enable row level security;
alter table if exists public.job_runs enable row level security;
alter table if exists public.hidden_automatic_notifications enable row level security;
alter table if exists public.push_subscriptions enable row level security;
alter table if exists public.web_push_logs enable row level security;

drop policy if exists "push subscriptions read own" on public.push_subscriptions;
create policy "push subscriptions read own" on public.push_subscriptions
for select using (auth.uid() = user_id);

drop policy if exists "push subscriptions insert own" on public.push_subscriptions;
create policy "push subscriptions insert own" on public.push_subscriptions
for insert with check (auth.uid() = user_id);

drop policy if exists "push subscriptions update own" on public.push_subscriptions;
create policy "push subscriptions update own" on public.push_subscriptions
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "push subscriptions delete own" on public.push_subscriptions;
create policy "push subscriptions delete own" on public.push_subscriptions
for delete using (auth.uid() = user_id);
