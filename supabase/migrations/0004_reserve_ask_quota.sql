-- ISSUE 03: atomic AI quota reservation for /api/ask. Serializes count+insert per user with an
-- advisory xact lock so concurrent asks cannot all read the same count and overspend the cap.
-- Applied via Supabase MCP on 2026-08-29.
create or replace function public.reserve_ask_quota(p_user uuid, p_cap integer, p_window_seconds integer)
returns boolean language plpgsql set search_path = public as $$
declare used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select count(*) into used from ask_log
    where user_id = p_user and created_at >= now() - make_interval(secs => p_window_seconds);
  if used >= p_cap then return false; end if;
  insert into ask_log(user_id) values (p_user);
  return true;
end; $$;
