create table if not exists hidden_automatic_notifications (
  id text primary key,
  hidden_at timestamptz not null default now()
);

alter table hidden_automatic_notifications enable row level security;
