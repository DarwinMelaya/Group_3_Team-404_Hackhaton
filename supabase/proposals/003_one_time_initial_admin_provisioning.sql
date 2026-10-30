-- SMART-ANI / Agri - One-Time Initial Admin Provisioning (PRIVILEGED, MUTATING)
--
-- DO NOT add this file to the automatic migration chain.
-- DO NOT expose it through PostgREST, an Edge Function, or a public signup route.
--
-- Use only when the read-only preflight proves active_admin_count = 0:
--   1. Create and email-confirm one normal Farmer account through Supabase Auth.
--   2. Copy that user's UUID from Authentication > Users.
--   3. Review this script, replace NULL below with that UUID, and run it once in
--      the Agri SQL Editor using a privileged project-owner session.
--   4. Re-run tests/000_verify_live_schema.sql and confirm active_admin_count = 1.
--
-- The transaction refuses to run if another active Admin already exists, if the
-- target is not an existing active Farmer profile, or if the target is a legacy
-- quarantined account. No password, service-role key, or secret is required here.

begin;

do $$
declare
  -- REQUIRED: replace NULL with a quoted UUID, for example:
  -- v_admin_user_id uuid := '00000000-0000-0000-0000-000000000000';
  v_admin_user_id uuid := null;
  v_target public.profiles;
begin
  if v_admin_user_id is null then
    raise exception 'STOP: set v_admin_user_id to the reviewed, email-confirmed Auth user UUID.';
  end if;

  if exists (
    select 1
      from public.profiles
     where role = 'admin'::public.smart_link_role
       and account_status = 'active'
       and id <> v_admin_user_id
  ) then
    raise exception 'STOP: an active Admin already exists. Use normal Admin governance; do not bootstrap another.';
  end if;

  if not exists (
    select 1
      from auth.users
     where id = v_admin_user_id
       and email_confirmed_at is not null
  ) then
    raise exception 'STOP: target Auth user does not exist or its email is not confirmed.';
  end if;

  select *
    into v_target
    from public.profiles
   where id = v_admin_user_id
   for update;

  if not found then
    raise exception 'STOP: target Auth user has no public.profiles row. Repair signup/profile creation first.';
  end if;

  if v_target.role = 'admin'::public.smart_link_role
     and v_target.account_status = 'active' then
    raise exception 'STOP: target is already an active Admin; no change was made.';
  end if;

  if v_target.role <> 'farmer'::public.smart_link_role
     or v_target.account_status <> 'active'
     or v_target.legacy_role is not null then
    raise exception 'STOP: bootstrap target must be a reviewed active, non-legacy Farmer profile.';
  end if;

  update public.profiles
     set role = 'admin'::public.smart_link_role,
         market_type = null,
         organization_name = '',
         market_verification_status = 'not_applicable',
         verified_by = null,
         verified_at = null,
         verification_notes = 'One-time initial Admin bootstrap approved in the privileged Agri SQL Editor.'
   where id = v_admin_user_id;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  ) values (
    null,
    'system_bootstrap',
    'INITIAL_ADMIN_PROVISIONED',
    'profile',
    v_admin_user_id,
    'One-time initial Admin bootstrap executed by a privileged project owner.',
    jsonb_build_object(
      'previous_role', v_target.role,
      'new_role', 'admin',
      'procedure', 'proposals/003_one_time_initial_admin_provisioning.sql'
    )
  );
end;
$$;

commit;
