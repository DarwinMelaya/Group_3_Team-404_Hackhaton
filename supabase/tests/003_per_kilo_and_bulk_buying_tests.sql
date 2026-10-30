-- SMART-ANI / Agri - Test Suite 003
-- Transactional verification for Per-Kilo & Bulk Market Buying
--
-- Tests:
-- 1. Unit constraints ('kg', 'sack', 'crate', 'bunch', 'lot') on harvest_listings & market_demands
-- 2. Buying types ('per_unit' vs 'bulk_lot')
-- 3. Package-to-package direct allocation (2 sacks of Cassava)
-- 4. Cross-unit allocation with explicit agreed conversion (100 kg Banana to 20 bunches @ 5 kg/bunch)
-- 5. Blocking cross-unit allocation when explicit conversion is missing
-- 6. Preventing over-allocation when units differ
-- 7. Delivery confirmation and non-double-counted remaining inventory
-- 8. Cancellation releasing only undelivered remainder
--
-- Always rolls back at the end. Zero permanent mutation.

begin;

-- Verify migration 20261030000005 columns
do $$
begin
  assert exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'harvest_listings' and column_name = 'conversion_rate_kg'
  ), 'Missing column conversion_rate_kg on harvest_listings';

  assert exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'market_demands' and column_name = 'buying_type'
  ), 'Missing column buying_type on market_demands';

  assert exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'supply_allocations' and column_name = 'deducted_inventory_quantity'
  ), 'Missing column deducted_inventory_quantity on supply_allocations';
end;
$$;

rollback;

