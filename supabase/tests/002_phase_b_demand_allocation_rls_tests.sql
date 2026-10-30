-- SMART-ANI / Agri — Phase B Transactional Security, RLS, Accounting & Concurrency Test Suite
-- Status: PREPARED LOCALLY FOR REVIEW. NOT YET EXECUTED AGAINST LIVE SUPABASE DATABASE.
--
-- How to use (ONLY AFTER Phase B migrations 20261030000003 & 20261030000004 are applied to Agri):
-- 1. Open Supabase SQL Editor for project "Agri".
-- 2. Paste and run this entire script.
-- 3. Everything runs inside BEGIN ... ROLLBACK, so no test users or test rows
--    are permanently saved. If any check fails, the script raises an exception.

begin;

do $$
declare
  v_admin         uuid := 'a0000000-0000-4000-8000-000000000001';
  v_farmer_a      uuid := 'f0000000-0000-4000-8000-000000000001';
  v_farmer_b      uuid := 'f0000000-0000-4000-8000-000000000002';
  v_farmer_c      uuid := 'f0000000-0000-4000-8000-000000000003';
  v_farmer_d      uuid := 'f0000000-0000-4000-8000-000000000004';
  v_market_1      uuid := 'b0000000-0000-4000-8000-000000000001';
  v_market_2      uuid := 'b0000000-0000-4000-8000-000000000002';
  v_market_3      uuid := 'b0000000-0000-4000-8000-000000000003';
  v_legacy_coord  uuid := 'c0000000-0000-4000-8000-000000000001';

  v_prof          public.profiles;
  v_listing_a     uuid;
  v_listing_b     uuid;
  v_listing_c     uuid;
  v_listing_d     uuid;
  v_listing_row   public.harvest_listings;

  v_demand_m1     uuid;
  v_demand_m2     uuid;
  v_demand_m3     uuid;
  v_demand_agg    uuid;
  v_demand_row    public.market_demands;

  v_alloc_1       public.supply_allocations;
  v_alloc_2       public.supply_allocations;
  v_alloc_3       public.supply_allocations;
  v_alloc_b       public.supply_allocations;
  v_alloc_c       public.supply_allocations;
  v_alloc_d       public.supply_allocations;
  v_retry_alloc   public.supply_allocations;

  v_alloc_key_1   uuid := 'e0000000-0000-4000-8000-000000000001';
  v_delivery_key_1 uuid := 'e0000000-0000-4000-8000-000000000002';

  v_audit_count   integer;
  v_visible_count integer;
  v_today         date := (now() at time zone 'Asia/Manila')::date;
begin
  -- Remove auth trigger temporarily during synthetic auth.users seeding so we can test explicit RPCs & triggers
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values
    (v_admin,        'admin@smartani.test',        '{}'::jsonb, 'authenticated', 'authenticated'),
    (v_farmer_a,     'farmer.a@smartani.test',     '{"role":"admin"}'::jsonb, 'authenticated', 'authenticated'),
    (v_farmer_b,     'farmer.b@smartani.test',     '{}'::jsonb, 'authenticated', 'authenticated'),
    (v_farmer_c,     'farmer.c@smartani.test',     '{}'::jsonb, 'authenticated', 'authenticated'),
    (v_farmer_d,     'farmer.d@smartani.test',     '{}'::jsonb, 'authenticated', 'authenticated'),
    (v_market_1,     'market.1@smartani.test',     '{"account_type":"market","market_type":"public_market"}'::jsonb, 'authenticated', 'authenticated'),
    (v_market_2,     'market.2@smartani.test',     '{"account_type":"market","market_type":"cooperative"}'::jsonb, 'authenticated', 'authenticated'),
    (v_market_3,     'market.3@smartani.test',     '{"account_type":"market","market_type":"food_processor"}'::jsonb, 'authenticated', 'authenticated'),
    (v_legacy_coord, 'legacy.coord@smartani.test', '{}'::jsonb, 'authenticated', 'authenticated');

  -- Delete any auto-created profile rows for our test UUIDs so we can test registration & quarantine cleanly
  delete from public.profiles
   where id in (v_admin, v_farmer_a, v_farmer_b, v_farmer_c, v_farmer_d, v_market_1, v_market_2, v_market_3, v_legacy_coord);

  -- Seed Admin and a Quarantined Legacy Coordinator
  insert into public.profiles (
    id, display_name, municipality, role, account_status, market_verification_status
  ) values (
    v_admin, 'Marinduque Provincial Admin', 'Boac', 'admin', 'active', 'not_applicable'
  );

  insert into public.profiles (
    id, display_name, municipality, role, account_status, market_verification_status, legacy_role, legacy_migrated_at
  ) values (
    v_legacy_coord, 'Former Barangay Coordinator', 'Boac', 'coordinator', 'deactivated_pending_admin_review', 'not_applicable', 'coordinator', now()
  );
  insert into public.legacy_role_migration_quarantine (
    profile_id, previous_role, new_role, migration_disposition
  ) values (
    v_legacy_coord, 'coordinator', 'coordinator', 'quarantined_deactivated_pending_admin_review'
  );

  -- ==========================================================================
  -- TEST 1: NEW MARKET ACCOUNT SECURITY & SELF-ESCALATION BLOCKING
  -- ==========================================================================
  set local role authenticated;

  -- 1A: User attempts to register self as 'admin' via register_account_profile -> MUST FAIL
  perform set_config('request.jwt.claim.sub', v_market_1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_1, 'role', 'authenticated')::text, true);
  begin
    perform public.register_account_profile('admin', 'Attacker Admin', 'Boac', null, '');
    raise exception using errcode = 'SA001', message = 'TEST FAILED: User self-registered as admin.';
  exception
    when raise_exception then
      if sqlstate = 'SA001' then raise; end if;
  end;

  -- 1B: Market 1 registers as a Market -> MUST default to pending_verification
  v_prof := public.register_account_profile(
    'market',
    'Boac Public Market Stall 12',
    'Boac',
    'public_market',
    'Boac Public Market Vendors Assoc'
  );
  if v_prof.role <> 'market' or v_prof.market_verification_status <> 'pending_verification' then
    raise exception 'TEST FAILED: Newly registered Market did not default to pending_verification.';
  end if;

  -- 1C: Unverified Market 1 attempts to create an active market demand -> MUST FAIL
  begin
    insert into public.market_demands (
      market_id, crop, required_quantity_kg, preferred_quality_grade,
      offered_price_php_per_kg, municipality, barangay, required_by, accept_partial
    ) values (
      v_market_1, 'Banana', 100, 'Grade A', 28, 'Boac', 'Murallon', v_today + 5, true
    );
    raise exception using errcode = 'SA001', message = 'TEST FAILED: Unverified Market 1 created an active market demand.';
  exception
    when insufficient_privilege or check_violation or raise_exception then
      if sqlstate = 'SA001' then raise; end if;
  end;

  -- 1D: Unverified Market 1 attempts to verify itself via admin_verify_market_account -> MUST FAIL
  begin
    perform public.admin_verify_market_account(v_market_1, 'verified', 'Self-verify attempt');
    raise exception using errcode = 'SA001', message = 'TEST FAILED: Market 1 verified itself without Admin role.';
  exception
    when raise_exception then
      if sqlstate = 'SA001' then raise; end if;
  end;

  -- Register Market 2 (Cooperative) and Market 3 (Food Processor)
  perform set_config('request.jwt.claim.sub', v_market_2::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_2, 'role', 'authenticated')::text, true);
  perform public.register_account_profile('market', 'Mogpog Agri Coop', 'Mogpog', 'cooperative', 'Mogpog Agri Coop');

  perform set_config('request.jwt.claim.sub', v_market_3::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_3, 'role', 'authenticated')::text, true);
  perform public.register_account_profile('market', 'Santa Cruz Banana Chips Processor', 'Santa Cruz', 'food_processor', 'SC Food Processing');

  -- 1E: Admin verifies Market 1, Market 2, and Market 3
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform public.admin_verify_market_account(v_market_1, 'verified', 'Business permit verified by Provincial Admin.');
  perform public.admin_verify_market_account(v_market_2, 'verified', 'CDA registration verified.');
  perform public.admin_verify_market_account(v_market_3, 'verified', 'DTI/FDA processor registration verified.');

  -- ==========================================================================
  -- TEST 2: SAFE LEGACY COORDINATOR QUARANTINE (ZERO SILENT ESCALATION / CONVERSION)
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', v_legacy_coord::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_legacy_coord, 'role', 'authenticated')::text, true);

  if (select smart_link_private.current_role()) is not null then
    raise exception 'TEST FAILED: Quarantined legacy coordinator resolved to an active role (%).',
      (select smart_link_private.current_role());
  end if;

  -- Legacy coordinator cannot review harvest listings or post farmer harvests
  begin
    insert into public.harvest_listings (
      farmer_id, crop, quantity_kg, asking_price_php_per_kg,
      harvest_date, municipality, barangay, storage_condition
    ) values (
      v_legacy_coord, 'Banana', 50, 25, v_today, 'Boac', 'Santol', 'Shaded and ventilated'
    );
    raise exception using errcode = 'SA001', message = 'TEST FAILED: Quarantined legacy coordinator acted as an active farmer.';
  exception
    when insufficient_privilege or check_violation or raise_exception then
      if sqlstate = 'SA001' then raise; end if;
  end;

  -- Admin explicitly resolves legacy coordinator to farmer with mandatory audit notes
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_prof := public.admin_resolve_legacy_account(
    v_legacy_coord,
    'farmer',
    null,
    'Confirmed smallholder grower in Boac; assigned to farmer role after manual review.'
  );
  if v_prof.role <> 'farmer' or v_prof.account_status <> 'active' then
    raise exception 'TEST FAILED: Admin resolution of legacy coordinator did not activate farmer profile.';
  end if;

  -- ==========================================================================
  -- TEST 3: FARMER SPLIT ALLOCATION ACROSS MULTIPLE MARKETS (100 kg -> 40 + 35 + 25)
  -- ==========================================================================
  -- Register Farmers A, B, C, D
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);
  perform public.register_account_profile('farmer', 'Farmer A (Boac)', 'Boac');

  perform set_config('request.jwt.claim.sub', v_farmer_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_b, 'role', 'authenticated')::text, true);
  perform public.register_account_profile('farmer', 'Farmer B (Mogpog)', 'Mogpog');

  perform set_config('request.jwt.claim.sub', v_farmer_c::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_c, 'role', 'authenticated')::text, true);
  perform public.register_account_profile('farmer', 'Farmer C (Gasan)', 'Gasan');

  perform set_config('request.jwt.claim.sub', v_farmer_d::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_d, 'role', 'authenticated')::text, true);
  perform public.register_account_profile('farmer', 'Farmer D (Torrijos)', 'Torrijos');

  -- Markets 1, 2, 3 post demands:
  -- Market 1 needs 40 kg Banana
  perform set_config('request.jwt.claim.sub', v_market_1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_1, 'role', 'authenticated')::text, true);
  insert into public.market_demands (
    market_id, crop, required_quantity_kg, preferred_quality_grade,
    offered_price_php_per_kg, municipality, barangay, required_by, accept_partial
  ) values (
    v_market_1, 'Banana', 40, 'Grade A', 28, 'Boac', 'Murallon', v_today + 4, true
  ) returning id into v_demand_m1;

  -- Market 2 needs 35 kg Banana
  perform set_config('request.jwt.claim.sub', v_market_2::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_2, 'role', 'authenticated')::text, true);
  insert into public.market_demands (
    market_id, crop, required_quantity_kg, preferred_quality_grade,
    offered_price_php_per_kg, municipality, barangay, required_by, accept_partial
  ) values (
    v_market_2, 'Banana', 35, 'Grade A', 27, 'Mogpog', 'Anapog', v_today + 5, true
  ) returning id into v_demand_m2;

  -- Market 3 needs 25 kg Banana
  perform set_config('request.jwt.claim.sub', v_market_3::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_3, 'role', 'authenticated')::text, true);
  insert into public.market_demands (
    market_id, crop, required_quantity_kg, preferred_quality_grade,
    offered_price_php_per_kg, municipality, barangay, required_by, accept_partial
  ) values (
    v_market_3, 'Banana', 25, 'Any', 26, 'Santa Cruz', 'Buyabod', v_today + 6, true
  ) returning id into v_demand_m3;

  -- Farmer A posts 100 kg Banana harvest -> Admin verifies it
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);
  insert into public.harvest_listings (
    farmer_id, crop, quantity_kg, unit, quality_grade, asking_price_php_per_kg,
    harvest_date, municipality, barangay, storage_condition, outreach_priority
  ) values (
    v_farmer_a, 'Banana', 100, 'kg', 'Grade A', 25,
    v_today, 'Boac', 'Santol', 'Shaded and ventilated', 'Priority'
  ) returning id into v_listing_a;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform public.review_harvest_listing(v_listing_a, 'available', 'Verified 100 kg Grade A Banana.');

  -- Farmer A allocates 40 kg to Market 1
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);
  v_alloc_1 := public.allocate_harvest_to_demand(
    v_listing_a, v_demand_m1, 40, 28, 'First batch 40 kg', v_alloc_key_1
  );

  -- Exact idempotent retry returns the original allocation and does not double-earmark inventory.
  v_retry_alloc := public.allocate_harvest_to_demand(
    v_listing_a, v_demand_m1, 40, 28, 'First batch 40 kg', v_alloc_key_1
  );
  if v_retry_alloc.id <> v_alloc_1.id then
    raise exception 'TEST FAILED: Exact allocation retry did not return the original allocation.';
  end if;

  -- A different authenticated Farmer must never receive another Farmer's record by reusing the key.
  perform set_config('request.jwt.claim.sub', v_farmer_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_b, 'role', 'authenticated')::text, true);
  begin
    perform public.allocate_harvest_to_demand(
      v_listing_a, v_demand_m1, 40, 28, 'Cross-user key replay', v_alloc_key_1
    );
    raise exception using errcode = 'SA001', message = 'TEST FAILED: Cross-user allocation idempotency replay exposed another Farmer record.';
  exception
    when raise_exception then
      if sqlstate = 'SA001' then raise; end if;
  end;

  -- Market 1 accepts the 40 kg offer -> status becomes 'reserved'
  perform set_config('request.jwt.claim.sub', v_market_1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_1, 'role', 'authenticated')::text, true);
  v_alloc_1 := public.respond_to_supply_allocation(v_alloc_1.id, 'reserved', 'Accepted 40 kg');

  -- Check Farmer A's available-to-allocate inventory is now 60 kg (reserved_kg = 40, remaining_kg = 60)
  select * into v_listing_row from public.harvest_listings where id = v_listing_a;
  if v_listing_row.reserved_kg <> 40 or v_listing_row.allocated_kg <> 40 or v_listing_row.remaining_kg <> 60 then
    raise exception 'TEST FAILED: Expected 60 kg remaining after 40 kg reservation, got % kg.', v_listing_row.remaining_kg;
  end if;

  -- Farmer A allocates 35 kg to Market 2 and 25 kg to Market 3
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);
  v_alloc_2 := public.allocate_harvest_to_demand(v_listing_a, v_demand_m2, 35, 27, 'Second split 35 kg');
  v_alloc_3 := public.allocate_harvest_to_demand(v_listing_a, v_demand_m3, 25, 26, 'Third split 25 kg');

  -- Cross-user RLS: Farmer B sees none of Farmer A's allocations; Market 1 sees
  -- only the offer addressed to Market 1, never Market 2/3 records.
  perform set_config('request.jwt.claim.sub', v_farmer_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_b, 'role', 'authenticated')::text, true);
  select count(*) into v_visible_count
    from public.supply_allocations
   where id in (v_alloc_1.id, v_alloc_2.id, v_alloc_3.id);
  if v_visible_count <> 0 then
    raise exception 'TEST FAILED: Farmer B could read % of Farmer A''s allocation records.', v_visible_count;
  end if;

  perform set_config('request.jwt.claim.sub', v_market_1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_1, 'role', 'authenticated')::text, true);
  select count(*) into v_visible_count
    from public.supply_allocations
   where id in (v_alloc_1.id, v_alloc_2.id, v_alloc_3.id);
  if v_visible_count <> 1 then
    raise exception 'TEST FAILED: Market 1 should see exactly its own allocation, saw % records.', v_visible_count;
  end if;

  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);

  -- Check Farmer A now has 0 kg remaining (40 reserved + 60 earmarked = 100 allocated, 0 remaining)
  select * into v_listing_row from public.harvest_listings where id = v_listing_a;
  if v_listing_row.earmarked_kg <> 60 or v_listing_row.reserved_kg <> 40 or v_listing_row.allocated_kg <> 100 or v_listing_row.remaining_kg <> 0 then
    raise exception 'TEST FAILED: Expected 0 kg remaining after 40+35+25 split allocation, got % kg.', v_listing_row.remaining_kg;
  end if;

  -- Attempting to allocate even 1 kg more from Farmer A's 100 kg listing MUST FAIL
  begin
    perform public.allocate_harvest_to_demand(v_listing_a, v_demand_m3, 1, 26, 'Over-allocation attempt');
    raise exception using errcode = 'SA001', message = 'TEST FAILED: Over-allocation beyond 100 kg harvest succeeded.';
  exception
    when raise_exception then
      if sqlstate = 'SA001' then raise; end if;
  end;

  -- ==========================================================================
  -- TEST 4: DELIVERY CONFIRMATION, PARTIAL DELIVERY & CANCELLATION RESTORATION
  -- ==========================================================================
  -- Market 2 accepts 35 kg ('reserved'), Market 3 rejects 25 kg ('rejected' -> restores 25 kg to Farmer A!)
  perform set_config('request.jwt.claim.sub', v_market_2::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_2, 'role', 'authenticated')::text, true);
  v_alloc_2 := public.respond_to_supply_allocation(v_alloc_2.id, 'reserved', 'Accepted 35 kg');

  perform set_config('request.jwt.claim.sub', v_market_3::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_3, 'role', 'authenticated')::text, true);
  v_alloc_3 := public.respond_to_supply_allocation(v_alloc_3.id, 'rejected', 'Cold storage full today');

  -- Verify rejection of 25 kg restored Farmer A's remaining_kg back to 25 kg!
  select * into v_listing_row from public.harvest_listings where id = v_listing_a;
  if v_listing_row.allocated_kg <> 75 or v_listing_row.remaining_kg <> 25 then
    raise exception 'TEST FAILED: Rejecting 25 kg offer did not restore remaining_kg to 25 (got %).', v_listing_row.remaining_kg;
  end if;

  -- Farmer A marks 40 kg allocation to Market 1 as 'in_delivery'
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);
  v_alloc_1 := public.mark_allocation_in_delivery(v_alloc_1.id, 'Tricycle dispatch #04');

  -- Market 1 confirms PARTIAL delivery of 25 kg out of 40 kg (p_finalize_short_delivery = false)
  perform set_config('request.jwt.claim.sub', v_market_1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_1, 'role', 'authenticated')::text, true);
  v_alloc_1 := public.confirm_allocation_delivery(
    v_alloc_1.id,
    25,
    false,
    'Grade A',
    'Received first crate of 25 kg; 15 kg remaining.',
    v_delivery_key_1
  );

  -- Exact delivery retry returns the current allocation without recording a second delivery.
  v_retry_alloc := public.confirm_allocation_delivery(
    v_alloc_1.id,
    25,
    false,
    'Grade A',
    'Received first crate of 25 kg; 15 kg remaining.',
    v_delivery_key_1
  );
  if v_retry_alloc.id <> v_alloc_1.id or v_retry_alloc.delivered_quantity_kg <> 25 then
    raise exception 'TEST FAILED: Exact delivery retry was not idempotent.';
  end if;

  -- A different Market cannot replay Market 1's delivery key and receive its allocation row.
  perform set_config('request.jwt.claim.sub', v_market_2::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_2, 'role', 'authenticated')::text, true);
  begin
    perform public.confirm_allocation_delivery(
      v_alloc_1.id, 25, false, 'Grade A', 'Cross-market key replay', v_delivery_key_1
    );
    raise exception using errcode = 'SA001', message = 'TEST FAILED: Cross-market delivery idempotency replay exposed another Market record.';
  exception
    when raise_exception then
      if sqlstate = 'SA001' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', v_market_1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_1, 'role', 'authenticated')::text, true);

  if v_alloc_1.status <> 'partially_delivered' or v_alloc_1.delivered_quantity_kg <> 25 or v_alloc_1.outstanding_quantity_kg <> 15 then
    raise exception 'TEST FAILED: Partial delivery of 25/40 kg did not set status=partially_delivered and outstanding=15 kg.';
  end if;

  -- Verify NO DOUBLE COUNTING on Farmer A's listing:
  -- Total = 100 kg | Reserved = 15 kg (Market 1) + 35 kg (Market 2) = 50 kg | Delivered = 25 kg | Remaining = 25 kg!
  select * into v_listing_row from public.harvest_listings where id = v_listing_a;
  if v_listing_row.reserved_kg <> 50 or v_listing_row.allocated_kg <> 50 or v_listing_row.delivered_kg <> 25 or v_listing_row.remaining_kg <> 25 then
    raise exception 'TEST FAILED: Double-counting detected on harvest_listings! reserved=%, delivered=%, remaining=%',
      v_listing_row.reserved_kg, v_listing_row.delivered_kg, v_listing_row.remaining_kg;
  end if;

  -- Verify NO DOUBLE COUNTING on Market 1's demand:
  -- Required = 40 kg | Reserved = 15 kg | Fulfilled = 25 kg | Remaining demand = 0 kg!
  select * into v_demand_row from public.market_demands where id = v_demand_m1;
  if v_demand_row.reserved_quantity_kg <> 15 or v_demand_row.fulfilled_quantity_kg <> 25 or v_demand_row.remaining_demand_kg <> 0 then
    raise exception 'TEST FAILED: Double-counting detected on market_demands! reserved=%, fulfilled=%, remaining=%',
      v_demand_row.reserved_quantity_kg, v_demand_row.fulfilled_quantity_kg, v_demand_row.remaining_demand_kg;
  end if;

  -- Now test Admin dispute cancellation of the partially delivered allocation (25 kg delivered, 15 kg undelivered):
  -- MUST preserve the 25 kg delivered and release ONLY the 15 kg undelivered remainder!
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_alloc_1 := public.cancel_or_resolve_supply_allocation(
    v_alloc_1.id,
    'Second tricycle had flat tire; releasing remaining 15 kg while preserving 25 kg delivered.'
  );

  if v_alloc_1.status <> 'cancelled' or v_alloc_1.delivered_quantity_kg <> 25 or v_alloc_1.released_quantity_kg <> 15 or v_alloc_1.outstanding_quantity_kg <> 0 then
    raise exception 'TEST FAILED: Cancelling partially delivered allocation did not preserve 25 kg delivered and release 15 kg.';
  end if;

  -- Farmer A's remaining_kg must increase by +15 kg (from 25 kg -> 40 kg), while delivered_kg stays 25 kg and reserved_kg is 35 kg (Market 2)
  select * into v_listing_row from public.harvest_listings where id = v_listing_a;
  if v_listing_row.allocated_kg <> 35 or v_listing_row.delivered_kg <> 25 or v_listing_row.remaining_kg <> 40 then
    raise exception 'TEST FAILED: Partial cancellation did not restore exact 15 kg to Farmer A (remaining=%).', v_listing_row.remaining_kg;
  end if;

  -- Market 1's remaining_demand_kg must increase by +15 kg (from 0 kg -> 15 kg), while fulfilled_quantity_kg stays 25 kg
  select * into v_demand_row from public.market_demands where id = v_demand_m1;
  if v_demand_row.reserved_quantity_kg <> 0 or v_demand_row.fulfilled_quantity_kg <> 25 or v_demand_row.remaining_demand_kg <> 15 then
    raise exception 'TEST FAILED: Partial cancellation did not restore exact 15 kg to Market 1 demand (remaining=%).', v_demand_row.remaining_demand_kg;
  end if;

  -- ==========================================================================
  -- TEST 5: MULTI-FARMER COMPETING OFFERS TO ONE MARKET DEMAND (40 + 35 + 25 = 100 kg)
  --         AND ATOMIC OVER-RESERVATION PREVENTION AT ACCEPTANCE TIME
  -- ==========================================================================
  -- Market 1 posts a new 100 kg Banana demand
  perform set_config('request.jwt.claim.sub', v_market_1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_1, 'role', 'authenticated')::text, true);
  insert into public.market_demands (
    market_id, crop, required_quantity_kg, preferred_quality_grade,
    offered_price_php_per_kg, municipality, barangay, required_by, accept_partial
  ) values (
    v_market_1, 'Banana', 100, 'Grade A', 29, 'Boac', 'Murallon', v_today + 7, true
  ) returning id into v_demand_agg;

  -- Farmers B (35 kg), C (25 kg), and D (30 kg) post Banana harvests and Admin approves them
  perform set_config('request.jwt.claim.sub', v_farmer_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_b, 'role', 'authenticated')::text, true);
  insert into public.harvest_listings (
    farmer_id, crop, quantity_kg, asking_price_php_per_kg, harvest_date, municipality, barangay, storage_condition
  ) values (v_farmer_b, 'Banana', 35, 25, v_today, 'Mogpog', 'Anapog', 'Shaded and ventilated')
  returning id into v_listing_b;

  perform set_config('request.jwt.claim.sub', v_farmer_c::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_c, 'role', 'authenticated')::text, true);
  insert into public.harvest_listings (
    farmer_id, crop, quantity_kg, asking_price_php_per_kg, harvest_date, municipality, barangay, storage_condition
  ) values (v_farmer_c, 'Banana', 25, 25, v_today, 'Gasan', 'Tiguion', 'Shaded and ventilated')
  returning id into v_listing_c;

  perform set_config('request.jwt.claim.sub', v_farmer_d::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_d, 'role', 'authenticated')::text, true);
  insert into public.harvest_listings (
    farmer_id, crop, quantity_kg, asking_price_php_per_kg, harvest_date, municipality, barangay, storage_condition
  ) values (v_farmer_d, 'Banana', 30, 25, v_today, 'Torrijos', 'Poblacion', 'Shaded and ventilated')
  returning id into v_listing_d;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform public.review_harvest_listing(v_listing_b, 'available', 'Approved 35 kg');
  perform public.review_harvest_listing(v_listing_c, 'available', 'Approved 25 kg');
  perform public.review_harvest_listing(v_listing_d, 'available', 'Approved 30 kg');

  -- All 4 Farmers (A=40 kg, B=35 kg, C=25 kg, D=30 kg) submit offers to Market 1's 100 kg demand while it is open!
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);
  v_alloc_1 := public.allocate_harvest_to_demand(v_listing_a, v_demand_agg, 40, 29, 'Farmer A 40 kg');

  perform set_config('request.jwt.claim.sub', v_farmer_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_b, 'role', 'authenticated')::text, true);
  v_alloc_b := public.allocate_harvest_to_demand(v_listing_b, v_demand_agg, 35, 29, 'Farmer B 35 kg');

  perform set_config('request.jwt.claim.sub', v_farmer_c::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_c, 'role', 'authenticated')::text, true);
  v_alloc_c := public.allocate_harvest_to_demand(v_listing_c, v_demand_agg, 25, 29, 'Farmer C 25 kg');

  perform set_config('request.jwt.claim.sub', v_farmer_d::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_d, 'role', 'authenticated')::text, true);
  v_alloc_d := public.allocate_harvest_to_demand(v_listing_d, v_demand_agg, 30, 29, 'Farmer D 30 kg competing offer');

  -- Market 1 accepts Farmer A (40 kg), Farmer B (35 kg), and Farmer C (25 kg) -> total 100 kg reserved
  perform set_config('request.jwt.claim.sub', v_market_1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_market_1, 'role', 'authenticated')::text, true);
  perform public.respond_to_supply_allocation(v_alloc_1.id, 'reserved', 'Accept A 40 kg');
  perform public.respond_to_supply_allocation(v_alloc_b.id, 'reserved', 'Accept B 35 kg');
  perform public.respond_to_supply_allocation(v_alloc_c.id, 'reserved', 'Accept C 25 kg');

  select * into v_demand_row from public.market_demands where id = v_demand_agg;
  if v_demand_row.reserved_quantity_kg <> 100 or v_demand_row.remaining_demand_kg <> 0 then
    raise exception 'TEST FAILED: Multi-farmer 40+35+25 reservation did not equal 100 kg reserved and 0 kg remaining.';
  end if;

  -- Market 1 now attempts to ALSO accept Farmer D's 30 kg competing offer -> MUST FAIL atomically!
  begin
    perform public.respond_to_supply_allocation(v_alloc_d.id, 'reserved', 'Over-accept attempt');
    raise exception using errcode = 'SA001', message = 'TEST FAILED: Market 1 accepted competing offer exceeding 100 kg demand!';
  exception
    when raise_exception then
      if sqlstate = 'SA001' then raise; end if;
  end;

  -- ==========================================================================
  -- TEST 6: ADMIN CANNOT SILENTLY ALTER QUANTITIES & AUDIT LOGS ARE RECORDED
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  begin
    update public.harvest_listings set quantity_kg = 999 where id = v_listing_a;
    raise exception using errcode = 'SA001', message = 'TEST FAILED: Admin silently altered harvest listing quantity_kg.';
  exception
    when insufficient_privilege or raise_exception then
      if sqlstate = 'SA001' then raise; end if;
  end;

  begin
    execute 'update public.supply_allocations set allocated_quantity_kg = 10 where id = $1' using v_alloc_1.id;
    raise exception 'TEST FAILED: Admin silently altered supply_allocations quantity.';
  exception
    when insufficient_privilege then null;
  end;

  select count(*) into v_audit_count from public.audit_logs;
  if v_audit_count < 15 then
    raise exception 'TEST FAILED: Expected comprehensive audit_logs entries, found only %.', v_audit_count;
  end if;

  reset role;
  raise notice 'ALL PHASE B 3-ROLE SECURITY, ACCOUNTING, LEGACY QUARANTINE & CONCURRENCY TESTS PASSED.';
end;
$$;

rollback;

