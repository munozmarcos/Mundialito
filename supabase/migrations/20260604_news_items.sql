create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table news_items enable row level security;

drop policy if exists "news items readable" on news_items;
create policy "news items readable" on news_items
for select using (published = true);
