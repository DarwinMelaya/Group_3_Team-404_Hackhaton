-- SMART-ANI / Agri — Optional Additive Trigger for Automatic Farmer Profile Creation (Phase 2B Task 4)
-- Status: PREPARED LOCALLY FOR REVIEW. NOT YET EXECUTED AGAINST LIVE SUPABASE DATABASE.
--
-- Purpose:
-- Automatically creates a row in public.profiles with role = 'farmer' whenever a new user
-- registers in auth.users (even if email confirmation is enabled and the user has no active
-- session at sign-up time).
--
-- Security guarantees:
-- 1. ALWAYS assigns role = 'farmer'::public.smart_link_role. Never reads or trusts
--    raw_user_meta_data->>'role' or raw_app_meta_data->>'role'.
-- 2. Safely validates raw_user_meta_data->>'municipality' against public.smart_link_municipality,
--    falling back to 'Boac' if omitted or invalid.
-- 3. Uses SECURITY DEFINER with SET search_path = ''.

begin;

create or replace function smart_link_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_raw_municipality text;
  v_municipality public.smart_link_municipality := 'Boac'::public.smart_link_municipality;
begin
  v_display_name := btrim(coalesce(
    new.raw_user_meta_data->>'display_name',
    split_part(coalesce(new.email, 'Farmer'), '@', 1),
    'Marinduque Farmer'
  ));

  if char_length(v_display_name) = 0 then
    v_display_name := 'Marinduque Farmer';
  elsif char_length(v_display_name) > 100 then
    v_display_name := left(v_display_name, 100);
  end if;

  v_raw_municipality := btrim(coalesce(new.raw_user_meta_data->>'municipality', ''));
  if v_raw_municipality in ('Boac', 'Mogpog', 'Santa Cruz', 'Torrijos', 'Buenavista', 'Gasan') then
    v_municipality := v_raw_municipality::public.smart_link_municipality;
  end if;

  insert into public.profiles (id, display_name, municipality, role)
  values (new.id, v_display_name, v_municipality, 'farmer'::public.smart_link_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function smart_link_private.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function smart_link_private.handle_new_auth_user();

commit;

