-- SMART-ANI / Agri — Phase B Proposal: Demand-Driven Farmer, Market & Admin Architecture
-- Synchronized with:
--   1. supabase/migrations/20261030000003_add_market_role_enum.sql
--   2. supabase/migrations/20261030000004_demand_driven_farmer_market_admin.sql
-- Status: PREPARED LOCALLY FOR REVIEW. NOT YET EXECUTED AGAINST LIVE SUPABASE DATABASE.
--
-- Step 1 (Run and commit first so 'market' enum value is committed before use):
alter type public.smart_link_role add value if not exists 'market';

-- Step 2: Run supabase/migrations/20261030000004_demand_driven_farmer_market_admin.sql
-- (See canonical migration file for full DDL, legacy role quarantine, accounting triggers, RLS, and RPCs.)

