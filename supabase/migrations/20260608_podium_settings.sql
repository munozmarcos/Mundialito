create table if not exists podium_settings (
  id boolean primary key default true check (id),
  status text not null default 'open' check (status in ('open', 'closed', 'locked')),
  updated_at timestamptz not null default now()
);

insert into podium_settings (id, status)
values (true, 'open')
on conflict (id) do nothing;

drop trigger if exists podium_settings_touch_updated_at on podium_settings;
create trigger podium_settings_touch_updated_at
before update on podium_settings
for each row execute function touch_updated_at();
