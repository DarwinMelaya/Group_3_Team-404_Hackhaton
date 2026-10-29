-- SMART-ANI / Agri — Safe Read-Only Live Database Verification Query (Phase 2B Task 2)
-- Purpose: Run this query in the Supabase SQL Editor for project "Agri" to verify
-- whether the Phase 2A migration (20261029000001_smart_link_foundation.sql) has been applied.
-- This script is 100% READ-ONLY (SELECT only; no DDL or DML).

with expected_tables as (
  select unnest(array[
    'profiles',
    'harvest_listings',
    'processor_requirements',
    'pooled_batches',
    'batch_contributions',
    'reservations'
  ]) as table_name
),
table_check as (
  select
    e.table_name,
    (c.relname is not null) as exists_in_public,
    coalesce(c.relrowsecurity, false) as rls_enabled
  from expected_tables e
  left join pg_class c
    on c.relname = e.table_name
   and c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
),
rpc_check as (
  select
    p.proname as function_name,
    p.prosecdef as is_security_definer
  from pg_proc p
  where (p.pronamespace = 'public'::regnamespace and p.proname = 'review_harvest_listing')
     or (p.pronamespace = to_regnamespace('smart_link_private') and p.proname = 'current_role')
),
status_constraint_check as (
  select
    con.conname as constraint_name,
    pg_get_constraintdef(con.oid) as constraint_definition
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relnamespace = 'public'::regnamespace
    and rel.relname = 'harvest_listings'
    and con.contype = 'c'
)
select
  (select json_agg(t) from table_check t) as tables_and_rls,
  (select json_agg(r) from rpc_check r) as security_functions_and_rpc,
  (select json_agg(s) from status_constraint_check s) as harvest_listing_constraints,
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'harvest_listings',
        'processor_requirements',
        'pooled_batches',
        'batch_contributions',
        'reservations'
      )
  ) as total_rls_policies_found;

