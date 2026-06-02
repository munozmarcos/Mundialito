alter table public.profiles rename column email to auth_email;

alter table public.email_logs rename to notification_logs;

alter table public.notification_logs rename constraint email_logs_pkey to notification_logs_pkey;
alter table public.notification_logs rename constraint email_logs_user_id_fkey to notification_logs_user_id_fkey;
alter table public.notification_logs rename constraint email_logs_match_id_fkey to notification_logs_match_id_fkey;
alter table public.notification_logs rename constraint email_logs_dedupe_key_key to notification_logs_dedupe_key_key;

drop function if exists public.users_missing_prediction(uuid);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, auth_email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.users_missing_prediction(p_match_id uuid)
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

alter table public.notification_logs enable row level security;
