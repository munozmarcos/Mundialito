-- Security hardening for Supabase advisors.
-- Keep function name resolution stable and prevent direct RPC calls to the
-- auth trigger helper. Triggers and service-role server code continue working.

alter function public.touch_updated_at() set search_path = public, pg_temp;
alter function public.pending_predictions_for_user(uuid) set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.users_missing_prediction(uuid) set search_path = public, pg_temp;
alter function public.ranking() set search_path = public, pg_temp;

revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.handle_new_user() from public;
