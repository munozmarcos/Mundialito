create table if not exists job_runs (
  id uuid primary key default gen_random_uuid(),
  job_path text not null,
  trigger_type text not null check (trigger_type in ('manual', 'automatic')),
  ok boolean not null,
  status_code integer,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists job_runs_job_path_created_at_idx
on job_runs (job_path, created_at desc);

alter table job_runs enable row level security;
