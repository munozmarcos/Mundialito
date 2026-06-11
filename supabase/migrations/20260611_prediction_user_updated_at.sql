alter table predictions add column if not exists user_updated_at timestamptz not null default now();

update predictions
set user_updated_at = updated_at;
