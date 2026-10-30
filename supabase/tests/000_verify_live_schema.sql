-- SMART-ANI / Agri - Safe Read-Only Live Database Preflight
-- Run this FIRST in the Supabase SQL Editor for project "Agri".
--
-- This script performs SELECT-only catalog inspection. It does not install,
-- alter, delete, or seed anything. Migration status below is intentionally
-- reported two ways:
--   1. schema_signature_status: what is demonstrably installed in the database;
--   2. migration_ledger_rows_xml: matching Supabase CLI ledger rows, when the
--      supabase_migrations.schema_migrations table exists.
-- A SQL file existing in Git is never treated as proof that it ran live.

with
expected_tables(table_name, migration_version) as (
  values
    ('profiles', '20261029000001'),
    ('harvest_listings', '20261029000001'),
    ('processor_requirements', '20261029000001'),
    ('pooled_batches', '20261029000001'),
    ('batch_contributions', '20261029000001'),
    ('reservations', '20261029000001'),
    ('market_demands', '20261030000004'),
    ('supply_allocations', '20261030000004'),
    ('delivery_records', '20261030000004'),
    ('audit_logs', '20261030000004'),
    ('legacy_role_migration_quarantine', '20261030000004')
),
table_check as (
  select
    e.table_name,
    e.migration_version,
    (c.oid is not null) as exists_in_public,
    coalesce(c.relrowsecurity, false) as rls_enabled
  from expected_tables e
  left join pg_catalog.pg_class c
    on c.relname = e.table_name
   and c.relnamespace = pg_catalog.to_regnamespace('public')
   and c.relkind in ('r', 'p')
),
enum_values_check as (
  select coalesce(
    jsonb_agg(e.enumlabel order by e.enumsortorder),
    '[]'::jsonb
  ) as smart_link_role_values
  from pg_catalog.pg_type t
  join pg_catalog.pg_enum e on e.enumtypid = t.oid
  where t.typnamespace = pg_catalog.to_regnamespace('public')
    and t.typname = 'smart_link_role'
),
trigger_check as (
  select
    t.tgname as trigger_name,
    t.tgenabled <> 'D' as enabled,
    pn.nspname as function_schema,
    p.proname as function_name,
    p.prosecdef as is_security_definer,
    p.proconfig as function_settings
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_proc p on p.oid = t.tgfoid
  join pg_catalog.pg_namespace pn on pn.oid = p.pronamespace
  where n.nspname = 'auth'
    and c.relname = 'users'
    and t.tgname = 'trg_on_auth_user_created'
    and not t.tgisinternal
),
expected_rpc(schema_name, function_name) as (
  values
    ('public', 'review_harvest_listing'),
    ('public', 'register_account_profile'),
    ('public', 'admin_verify_market_account'),
    ('public', 'admin_resolve_legacy_account'),
    ('public', 'allocate_harvest_to_demand'),
    ('public', 'respond_to_supply_allocation'),
    ('public', 'mark_allocation_in_delivery'),
    ('public', 'confirm_allocation_delivery'),
    ('public', 'cancel_or_resolve_supply_allocation'),
    ('smart_link_private', 'current_role'),
    ('smart_link_private', 'is_verified_market'),
    ('smart_link_private', 'recompute_inventory_and_demand')
),
rpc_check as (
  select
    e.schema_name,
    e.function_name,
    count(p.oid) > 0 as exists_in_db,
    coalesce(bool_and(p.prosecdef), false) as all_overloads_security_definer,
    coalesce(bool_and(not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')), false)
      as all_overloads_block_anon_execute,
    coalesce(jsonb_agg(distinct p.proconfig) filter (where p.oid is not null), '[]'::jsonb)
      as function_settings
  from expected_rpc e
  left join pg_catalog.pg_namespace n on n.nspname = e.schema_name
  left join pg_catalog.pg_proc p
    on p.pronamespace = n.oid
   and p.proname = e.function_name
  group by e.schema_name, e.function_name
),
expected_phase_b_columns(table_name, column_name) as (
  values
    ('profiles', 'account_status'),
    ('profiles', 'market_type'),
    ('profiles', 'market_verification_status'),
    ('harvest_listings', 'earmarked_kg'),
    ('harvest_listings', 'reserved_kg'),
    ('harvest_listings', 'allocated_kg'),
    ('harvest_listings', 'delivered_kg'),
    ('harvest_listings', 'remaining_kg'),
    ('harvest_listings', 'conversion_rate_kg'),
    ('market_demands', 'remaining_demand_kg'),
    ('market_demands', 'buying_type'),
    ('market_demands', 'unit_price_php'),
    ('market_demands', 'total_price_php'),
    ('supply_allocations', 'outstanding_quantity_kg'),
    ('supply_allocations', 'buying_type'),
    ('supply_allocations', 'total_agreed_price'),
    ('supply_allocations', 'deducted_inventory_quantity')
),
phase_b_column_check as (
  select
    e.table_name,
    e.column_name,
    (a.attnum is not null and not a.attisdropped) as exists_in_db
  from expected_phase_b_columns e
  left join pg_catalog.pg_class c
    on c.relname = e.table_name
   and c.relnamespace = pg_catalog.to_regnamespace('public')
  left join pg_catalog.pg_attribute a
    on a.attrelid = c.oid
   and a.attname = e.column_name
   and a.attnum > 0
),
constraint_check as (
  select
    rel.relname as table_name,
    con.conname as constraint_name,
    pg_catalog.pg_get_constraintdef(con.oid) as constraint_definition
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class rel on rel.oid = con.conrelid
  where rel.relnamespace = pg_catalog.to_regnamespace('public')
    and rel.relname in ('profiles', 'harvest_listings', 'market_demands', 'supply_allocations')
    and con.contype = 'c'
),
signature_status as (
  select jsonb_build_array(
    jsonb_build_object(
      'version', '20261029000001',
      'name', 'smart_link_foundation',
      'status', case
        when pg_catalog.to_regtype('public.smart_link_role') is not null
         and not exists (
           select 1 from table_check
            where migration_version = '20261029000001' and not exists_in_public
         )
         and exists (
           select 1 from rpc_check
            where schema_name = 'public' and function_name = 'review_harvest_listing' and exists_in_db
         )
        then 'APPLIED_SCHEMA_SIGNATURE'
        else 'NOT_APPLIED_OR_INCOMPLETE'
      end
    ),
    jsonb_build_object(
      'version', '20261029000002',
      'name', 'auto_create_farmer_profile',
      'status', case
        when exists (
          select 1 from trigger_check
           where enabled
             and function_schema = 'smart_link_private'
             and function_name = 'handle_new_auth_user'
             and is_security_definer
        )
        then 'APPLIED_SCHEMA_SIGNATURE'
        else 'NOT_APPLIED_OR_INCOMPLETE'
      end
    ),
    jsonb_build_object(
      'version', '20261030000003',
      'name', 'add_market_role_enum',
      'status', case
        when exists (
          select 1
            from pg_catalog.pg_type t
            join pg_catalog.pg_enum e on e.enumtypid = t.oid
           where t.typnamespace = pg_catalog.to_regnamespace('public')
             and t.typname = 'smart_link_role'
             and e.enumlabel = 'market'
        )
        then 'APPLIED_SCHEMA_SIGNATURE'
        else 'NOT_APPLIED_OR_INCOMPLETE'
      end
    ),
    jsonb_build_object(
      'version', '20261030000004',
      'name', 'demand_driven_farmer_market_admin',
      'status', case
        when not exists (
          select 1 from table_check
           where migration_version = '20261030000004'
             and (not exists_in_public or not rls_enabled)
        )
         and not exists (select 1 from phase_b_column_check where not exists_in_db)
         and not exists (
           select 1 from rpc_check
            where (schema_name, function_name) in (
              ('public', 'register_account_profile'),
              ('public', 'admin_verify_market_account'),
              ('public', 'allocate_harvest_to_demand'),
              ('public', 'respond_to_supply_allocation'),
              ('public', 'confirm_allocation_delivery'),
              ('smart_link_private', 'is_verified_market'),
              ('smart_link_private', 'recompute_inventory_and_demand')
            )
              and (not exists_in_db or not all_overloads_security_definer)
         )
        then 'APPLIED_SCHEMA_SIGNATURE'
        else 'NOT_APPLIED_OR_INCOMPLETE'
      end
    ),
    jsonb_build_object(
      'version', '20261030000005',
      'name', 'per_kilo_and_bulk_buying',
      'status', case
        when exists (
          select 1 from phase_b_column_check
           where column_name in ('buying_type', 'conversion_rate_kg', 'deducted_inventory_quantity')
             and not exists_in_db
        ) then 'NOT_APPLIED_OR_INCOMPLETE'
        else 'APPLIED_SCHEMA_SIGNATURE'
      end
    )
  ) as result
),
policy_summary as (
  select
    count(*) as relevant_policy_count,
    jsonb_agg(
      jsonb_build_object(
        'table', tablename,
        'policy', policyname,
        'command', cmd,
        'roles', roles
      ) order by tablename, policyname
    ) as policies
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in (
      'profiles',
      'harvest_listings',
      'market_demands',
      'supply_allocations',
      'delivery_records',
      'audit_logs',
      'legacy_role_migration_quarantine'
    )
)
select
  (select result from signature_status) as schema_signature_status,
  case
    when pg_catalog.to_regclass('supabase_migrations.schema_migrations') is null then
      'LEDGER_TABLE_NOT_FOUND (schema signatures above remain authoritative for this preflight)'
    else pg_catalog.query_to_xml(
      $query$
        select version
          from supabase_migrations.schema_migrations
         where version in ('20261029000001', '20261029000002', '20261030000003', '20261030000004', '20261030000005')
         order by version
      $query$,
      true,
      false,
      ''
    )::text
  end as migration_ledger_rows_xml,
  (select smart_link_role_values from enum_values_check) as role_enum_values,
  (select jsonb_agg(t order by t.migration_version, t.table_name) from table_check t)
    as tables_and_rls,
  (select jsonb_agg(t) from trigger_check t) as signup_trigger,
  (select jsonb_agg(r order by r.schema_name, r.function_name) from rpc_check r)
    as security_functions_and_rpc,
  (select jsonb_agg(c order by c.table_name, c.column_name) from phase_b_column_check c)
    as phase_b_columns,
  (select jsonb_agg(c order by c.table_name, c.constraint_name) from constraint_check c)
    as table_check_constraints,
  (select relevant_policy_count from policy_summary) as relevant_rls_policy_count,
  (select policies from policy_summary) as relevant_rls_policies,
  case
    when pg_catalog.to_regclass('public.profiles') is null then
      'PROFILES_TABLE_NOT_FOUND'
    when exists (select 1 from phase_b_column_check where not exists_in_db) then
      pg_catalog.query_to_xml(
        $query$
          select
            count(*) filter (where role::text = 'admin') as admin_profile_count_pre_phase_b,
            count(*) filter (where role::text in ('coordinator', 'processor')) as legacy_role_profile_count
          from public.profiles
        $query$,
        true,
        false,
        ''
      )::text
    else pg_catalog.query_to_xml(
      $query$
        select
          count(*) filter (where role::text = 'admin' and account_status = 'active') as active_admin_count,
          count(*) filter (where role::text = 'market' and market_verification_status = 'verified') as verified_market_count,
          count(*) filter (where role::text in ('coordinator', 'processor')) as legacy_role_profile_count,
          count(*) filter (where account_status = 'deactivated_pending_admin_review') as quarantined_profile_count
        from public.profiles
      $query$,
      true,
      false,
      ''
    )::text
  end as live_role_counts_xml,
  case
    when pg_catalog.to_regclass('public.profiles') is null then
      'PROFILES_TABLE_NOT_FOUND'
    else pg_catalog.query_to_xml(
      $query$
        select count(*) as authenticated_users_missing_profile
          from auth.users u
          left join public.profiles p on p.id = u.id
         where p.id is null
      $query$,
      true,
      false,
      ''
    )::text
  end as auth_profile_gap_xml;
