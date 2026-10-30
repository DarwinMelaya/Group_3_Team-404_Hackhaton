-- SMART-ANI / Agri — Phase B Migration Step 1: Extend Role Enum with 'market'
-- Status: PREPARED LOCALLY FOR REVIEW. NOT YET EXECUTED AGAINST LIVE SUPABASE DATABASE.
--
-- Why this is a separate migration file:
-- PostgreSQL requires new enum values added via ALTER TYPE ... ADD VALUE to be committed
-- before they are referenced in table constraints, DML updates, functions, or RLS policies.
-- Running this file first (or as a separate migration step) prevents PG error 55P04:
-- "unsafe use of new value 'market' of enum type smart_link_role".

alter type public.smart_link_role add value if not exists 'market';

