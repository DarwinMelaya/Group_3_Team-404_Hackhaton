-- SMART-ANI / Agri — Phase 2A Final Database Security, RLS & Coordinator Verification Test Script
-- Status: PREPARED LOCALLY. NOT YET EXECUTED AGAINST LIVE SUPABASE DATABASE.
--
-- How to use (ONLY AFTER the migration is approved and applied to Agri):
-- 1. Open Supabase SQL Editor for project "Agri".
-- 2. Paste and run this entire script.
-- 3. Everything runs inside BEGIN ... ROLLBACK, so no test users or test rows
--    are permanently saved. If any check fails, the script raises an exception.

begin;

do $$
declare
  v_farmer_a uuid := '11111111-1111-4111-8111-111111111111';
  v_farmer_b uuid := '22222222-2222-4222-8222-222222222222';
  v_processor uuid := '33333333-3333-4333-8333-333333333333';
  v_coordinator uuid := '44444444-4444-4444-8444-444444444444';

  v_listing_draft uuid;
  v_listing_submitted uuid;
  v_reviewed_row public.harvest_listings;
  v_req_open uuid;
  v_req_expiring uuid;
  v_batch_open uuid;
  v_contrib_id uuid;
  v_res_id uuid;
  v_count integer;
  v_status text;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  -- Seed temporary auth.users rows for the 4 roles (rolled back at end)
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values
    (v_farmer_a, 'farmer.a@smartani.test', '{"role":"admin"}'::jsonb, 'authenticated', 'authenticated'),
    (v_farmer_b, 'farmer.b@smartani.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    (v_processor, 'processor@smartani.test', '{"role":"coordinator"}'::jsonb, 'authenticated', 'authenticated'),
    (v_coordinator, 'coordinator@smartani.test', '{}'::jsonb, 'authenticated', 'authenticated');

  -- Privileged setup of profiles for processor and coordinator; farmer profiles created via RLS below
  insert into public.profiles (id, display_name, municipality, role)
  values
    (v_processor, 'Test Processor', 'Boac', 'processor'),
    (v_coordinator, 'Test Coordinator', 'Boac', 'coordinator');

  -- ==========================================================================
  -- TEST 1: UNAUTHORIZED ROLE ESCALATION & UNTRUSTED METADATA IMMUNITY
  -- ==========================================================================
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_farmer_a,
    'role', 'authenticated',
    'user_metadata', json_build_object('role', 'admin')
  )::text, true);

  -- Farmer A creates own profile (default role must be 'farmer' despite user_metadata.role = 'admin')
  insert into public.profiles (id, display_name, municipality)
  values (v_farmer_a, 'Farmer Alpha', 'Boac');

  if (select smart_link_private.current_role()) <> 'farmer' then
    raise exception 'TEST FAILED: Untrusted JWT metadata escalated Farmer A role.';
  end if;

  -- Attempt direct UPDATE of own role (must fail via column privilege)
  begin
    execute 'update public.profiles set role = ''admin'' where id = $1' using v_farmer_a;
    raise exception 'TEST FAILED: Farmer A was able to update own role column.';
  exception
    when insufficient_privilege then null;
  end;

  -- Farmer B signs up
  perform set_config('request.jwt.claim.sub', v_farmer_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_b, 'role', 'authenticated')::text, true);
  insert into public.profiles (id, display_name, municipality)
  values (v_farmer_b, 'Farmer Bravo', 'Boac');

  -- ==========================================================================
  -- TEST 2: HARVEST CREATION, DEFAULT PENDING_VERIFICATION & BLOCKED DIRECT PUBLISH
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);

  -- 2A: Farmer A creates a 'draft' listing
  insert into public.harvest_listings (
    farmer_id, crop, quantity_kg, asking_price_php_per_kg,
    harvest_date, municipality, barangay, storage_condition, outreach_priority, status
  ) values (
    v_farmer_a, 'Banana', 200, 25,
    v_today, 'Boac', 'Santol', 'Shaded and ventilated', 'Priority', 'draft'
  ) returning id into v_listing_draft;

  -- 2B: Farmer A submits a harvest listing without specifying status -> default MUST be 'pending_verification'
  insert into public.harvest_listings (
    farmer_id, crop, quantity_kg, asking_price_php_per_kg,
    harvest_date, municipality, barangay, storage_condition, outreach_priority
  ) values (
    v_farmer_a, 'Banana', 300, 24,
    v_today, 'Boac', 'Murallon', 'Shaded and ventilated', 'Standard'
  ) returning id, status into v_listing_submitted, v_status;

  if v_status <> 'pending_verification' then
    raise exception 'TEST FAILED: Default harvest listing status was %, expected pending_verification.', v_status;
  end if;

  -- 2C: Farmer A attempts to INSERT directly as 'available' -> MUST FAIL
  begin
    insert into public.harvest_listings (
      farmer_id, crop, quantity_kg, asking_price_php_per_kg,
      harvest_date, municipality, barangay, storage_condition, status
    ) values (
      v_farmer_a, 'Cassava', 150, 20,
      v_today, 'Boac', 'Santol', 'Shaded and ventilated', 'available'
    );
    raise exception 'TEST FAILED: Farmer A directly inserted an available (verified) listing.';
  exception
    when insufficient_privilege or check_violation or raise_exception then null;
  end;

  -- 2D: Farmer A attempts to UPDATE own listing directly to 'available' -> MUST FAIL
  begin
    update public.harvest_listings set status = 'available' where id = v_listing_submitted;
    raise exception 'TEST FAILED: Farmer A directly approved own pending_verification listing.';
  exception
    when insufficient_privilege or check_violation or raise_exception then null;
  end;

  -- 2E: Farmer A attempts to modify verification metadata directly -> MUST FAIL via column privilege
  begin
    execute 'update public.harvest_listings set review_notes = ''Self-approved'' where id = $1' using v_listing_submitted;
    raise exception 'TEST FAILED: Farmer A updated review_notes directly.';
  exception
    when insufficient_privilege then null;
  end;

  -- ==========================================================================
  -- TEST 3: FARMER OWNERSHIP ISOLATION & PRIVACY
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', v_farmer_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_b, 'role', 'authenticated')::text, true);

  -- Farmer B must NOT see Farmer A's private listings
  select count(*) into v_count from public.harvest_listings where farmer_id = v_farmer_a;
  if v_count <> 0 then
    raise exception 'TEST FAILED: Farmer B was able to read Farmer A listings.';
  end if;

  -- Farmer B must NOT be able to update Farmer A's listing
  update public.harvest_listings set asking_price_php_per_kg = 99 where id = v_listing_submitted;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'TEST FAILED: Farmer B modified Farmer A listing.';
  end if;

  -- Farmer B must NOT be able to insert a listing impersonating Farmer A
  begin
    insert into public.harvest_listings (
      farmer_id, crop, quantity_kg, asking_price_php_per_kg,
      harvest_date, municipality, barangay, storage_condition
    ) values (
      v_farmer_a, 'Cassava', 100, 18, v_today, 'Boac', 'Malusak', 'Shaded and ventilated'
    );
    raise exception 'TEST FAILED: Farmer B inserted a listing for Farmer A.';
  exception
    when insufficient_privilege or check_violation then null;
  end;

  -- ==========================================================================
  -- TEST 4: PROCESSOR VISIBILITY & UNAUTHORIZED REVIEW RPC BLOCKING
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', v_processor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_processor, 'role', 'authenticated')::text, true);

  -- Processor must NOT see 'draft' or 'pending_verification' listings before coordinator approval
  select count(*) into v_count from public.harvest_listings where id in (v_listing_draft, v_listing_submitted);
  if v_count <> 0 then
    raise exception 'TEST FAILED: Processor was able to read unverified (draft/pending_verification) listings.';
  end if;

  -- Processor cannot read Farmer A's profile
  select count(*) into v_count from public.profiles where id = v_farmer_a;
  if v_count <> 0 then
    raise exception 'TEST FAILED: Processor read Farmer A profile.';
  end if;

  -- Processor attempting to call review_harvest_listing RPC must fail
  begin
    perform public.review_harvest_listing(v_listing_submitted, 'available', 'Processor spoofing coordinator');
    raise exception 'TEST FAILED: Processor was able to call review_harvest_listing.';
  exception
    when raise_exception then null;
  end;

  -- Farmer A attempting to call review_harvest_listing RPC on own listing must also fail
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);
  begin
    perform public.review_harvest_listing(v_listing_submitted, 'available', 'Farmer self-approving via RPC');
    raise exception 'TEST FAILED: Farmer A was able to approve own listing via review_harvest_listing RPC.';
  exception
    when raise_exception then null;
  end;

  -- ==========================================================================
  -- TEST 5: COORDINATOR VERIFICATION, REJECTION, RESUBMISSION & METADATA AUDIT
  -- ==========================================================================
  -- 5A: Coordinator approves v_listing_submitted ('pending_verification' -> 'available')
  perform set_config('request.jwt.claim.sub', v_coordinator::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_coordinator, 'role', 'authenticated')::text, true);

  v_reviewed_row := public.review_harvest_listing(
    v_listing_submitted,
    'available',
    'Verified 300 kg Saba harvest at Brgy. Murallon.'
  );

  if v_reviewed_row.status <> 'available'
     or v_reviewed_row.reviewed_by <> v_coordinator
     or v_reviewed_row.reviewed_at is null
     or v_reviewed_row.review_notes <> 'Verified 300 kg Saba harvest at Brgy. Murallon.'
     or v_reviewed_row.quantity_kg <> 300
     or v_reviewed_row.asking_price_php_per_kg <> 24 then
    raise exception 'TEST FAILED: Coordinator verification metadata or listing fields were not recorded accurately.';
  end if;

  -- 5B: Coordinator cannot review a 'draft' listing (must be 'pending_verification')
  begin
    perform public.review_harvest_listing(v_listing_draft, 'available', 'Should fail on draft');
    raise exception 'TEST FAILED: Coordinator reviewed a draft listing that was not submitted.';
  exception
    when raise_exception then null;
  end;

  -- 5C: Farmer A submits v_listing_draft ('draft' -> 'pending_verification')
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);
  update public.harvest_listings set status = 'pending_verification' where id = v_listing_draft;

  -- 5D: Coordinator rejects v_listing_draft ('pending_verification' -> 'rejected')
  perform set_config('request.jwt.claim.sub', v_coordinator::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_coordinator, 'role', 'authenticated')::text, true);
  v_reviewed_row := public.review_harvest_listing(
    v_listing_draft,
    'rejected',
    'Please re-weigh crates excluding pallet tare weight.'
  );

  if v_reviewed_row.status <> 'rejected' or v_reviewed_row.reviewed_by <> v_coordinator then
    raise exception 'TEST FAILED: Coordinator rejection did not set rejected status and reviewer ID.';
  end if;

  -- 5E: Processor sees the approved listing (v_listing_submitted), but NOT the rejected listing (v_listing_draft)
  perform set_config('request.jwt.claim.sub', v_processor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_processor, 'role', 'authenticated')::text, true);
  select count(*) into v_count from public.harvest_listings where id = v_listing_submitted;
  if v_count <> 1 then
    raise exception 'TEST FAILED: Processor could not see coordinator-verified listing.';
  end if;
  select count(*) into v_count from public.harvest_listings where id = v_listing_draft;
  if v_count <> 0 then
    raise exception 'TEST FAILED: Processor was able to see rejected listing.';
  end if;

  -- 5F: Farmer A corrects quantity on rejected listing and resubmits ('rejected' -> 'pending_verification')
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);
  update public.harvest_listings
     set quantity_kg = 185,
         asking_price_php_per_kg = 24,
         status = 'pending_verification'
   where id = v_listing_draft
  returning * into v_reviewed_row;

  if v_reviewed_row.status <> 'pending_verification'
     or v_reviewed_row.reviewed_by is not null
     or v_reviewed_row.reviewed_at is not null
     or v_reviewed_row.review_notes <> '' then
    raise exception 'TEST FAILED: Resubmitting a rejected listing did not reset verification metadata.';
  end if;

  -- 5G: Coordinator approves the resubmitted listing ('pending_verification' -> 'available')
  perform set_config('request.jwt.claim.sub', v_coordinator::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_coordinator, 'role', 'authenticated')::text, true);
  v_reviewed_row := public.review_harvest_listing(
    v_listing_draft,
    'available',
    'Re-weighed net 185 kg verified.'
  );

  -- Processor now sees both verified listings
  perform set_config('request.jwt.claim.sub', v_processor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_processor, 'role', 'authenticated')::text, true);
  select count(*) into v_count from public.harvest_listings where id in (v_listing_draft, v_listing_submitted);
  if v_count <> 2 then
    raise exception 'TEST FAILED: Resubmitted and approved listing did not become visible to processor.';
  end if;

  -- ==========================================================================
  -- TEST 6: INVALID DATES & QUANTITIES (CREATION VS ONGOING EXPIRATION)
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);
  begin
    insert into public.harvest_listings (
      farmer_id, crop, quantity_kg, asking_price_php_per_kg,
      harvest_date, municipality, barangay, storage_condition
    ) values (
      v_farmer_a, 'Banana', 100, 20, v_today + 1, 'Boac', 'Santol', 'Shaded and ventilated'
    );
    raise exception 'TEST FAILED: Future harvest_date was accepted.';
  exception
    when check_violation or raise_exception then null;
  end;

  perform set_config('request.jwt.claim.sub', v_processor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_processor, 'role', 'authenticated')::text, true);
  begin
    insert into public.processor_requirements (
      processor_id, crop, quantity_kg, municipality, required_by, quality_notes
    ) values (
      v_processor, 'Banana', 500, 'Boac', v_today - 1, 'Past requirement should fail'
    );
    raise exception 'TEST FAILED: Past required_by date was accepted on INSERT.';
  exception
    when check_violation or raise_exception then null;
  end;

  insert into public.processor_requirements (
    processor_id, crop, quantity_kg, municipality, required_by, quality_notes
  ) values (
    v_processor, 'Banana', 400, 'Boac', v_today + 7, 'Saba for chips'
  ) returning id into v_req_open;

  -- ==========================================================================
  -- TEST 7: QUANTITY OVER-ALLOCATION, POOL LOCKS & DUPLICATE RESERVATIONS
  -- ==========================================================================
  reset role;

  insert into public.pooled_batches (
    coordinator_id, crop, municipality, storage_condition, target_quantity_kg, status
  ) values (
    v_coordinator, 'Banana', 'Boac', 'Shaded and ventilated', 500, 'open'
  ) returning id into v_batch_open;

  -- Over-contribution (> 300 kg available in v_listing_submitted) must fail
  begin
    insert into public.batch_contributions (
      batch_id, harvest_listing_id, crop, municipality, storage_condition, quantity_kg, consented_at
    ) values (
      v_batch_open, v_listing_submitted, 'Banana', 'Boac', 'Shaded and ventilated', 350, now()
    );
    raise exception 'TEST FAILED: Contribution exceeding listing quantity was accepted.';
  exception
    when raise_exception then null;
  end;

  -- Valid contribution of 300 kg from coordinator-verified v_listing_submitted
  insert into public.batch_contributions (
    batch_id, harvest_listing_id, crop, municipality, storage_condition, quantity_kg, consented_at
  ) values (
    v_batch_open, v_listing_submitted, 'Banana', 'Boac', 'Shaded and ventilated', 300, now()
  ) returning id into v_contrib_id;

  -- Farmer A cannot revert a pooled listing back to 'draft' or 'pending_verification' or change its price
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_farmer_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_farmer_a, 'role', 'authenticated')::text, true);
  begin
    update public.harvest_listings set status = 'draft' where id = v_listing_submitted;
    raise exception 'TEST FAILED: Pooled listing was reverted to draft.';
  exception
    when raise_exception then null;
  end;
  reset role;

  -- Over-reservation (> 300 kg pooled in v_batch_open) must fail
  begin
    insert into public.reservations (
      batch_id, processor_requirement_id, crop, quantity_kg, status, idempotency_key
    ) values (
      v_batch_open, v_req_open, 'Banana', 310, 'requested', gen_random_uuid()
    );
    raise exception 'TEST FAILED: Reservation exceeding pooled batch supply was accepted.';
  exception
    when raise_exception then null;
  end;

  -- Valid reservation of 250 kg
  insert into public.reservations (
    batch_id, processor_requirement_id, crop, quantity_kg, status, idempotency_key
  ) values (
    v_batch_open, v_req_open, 'Banana', 250, 'confirmed', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) returning id into v_res_id;

  -- Duplicate active reservation for the same (batch_id, processor_requirement_id) must fail
  begin
    insert into public.reservations (
      batch_id, processor_requirement_id, crop, quantity_kg, status, idempotency_key
    ) values (
      v_batch_open, v_req_open, 'Banana', 20, 'requested', gen_random_uuid()
    );
    raise exception 'TEST FAILED: Duplicate active reservation for same batch and requirement was accepted.';
  exception
    when unique_violation then null;
  end;

  -- Reducing batch contribution below active reservation (250 kg) must fail
  begin
    update public.batch_contributions set quantity_kg = 200 where id = v_contrib_id;
    raise exception 'TEST FAILED: Contribution reduced below active reservation quantity.';
  exception
    when raise_exception then null;
  end;

  -- Deleting batch contribution while active reservation depends on it must fail
  begin
    delete from public.batch_contributions where id = v_contrib_id;
    raise exception 'TEST FAILED: Contribution deleted while backing an active reservation.';
  exception
    when raise_exception then null;
  end;

  -- Simulate an old requirement whose required_by date has already passed:
  insert into public.processor_requirements (
    processor_id, crop, quantity_kg, municipality, required_by, quality_notes, created_at
  ) values (
    v_processor, 'Banana', 100, 'Boac', v_today - 2, 'Historical request', now() - interval '5 days'
  ) returning id into v_req_expiring;

  begin
    insert into public.reservations (
      batch_id, processor_requirement_id, crop, quantity_kg, status, idempotency_key
    ) values (
      v_batch_open, v_req_expiring, 'Banana', 30, 'requested', gen_random_uuid()
    );
    raise exception 'TEST FAILED: Reservation against expired processor requirement was accepted.';
  exception
    when raise_exception then null;
  end;

  -- Processor can still close the expired requirement without constraint failure
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_processor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_processor, 'role', 'authenticated')::text, true);
  update public.processor_requirements set status = 'closed' where id = v_req_expiring;
  reset role;

  raise notice 'ALL PHASE 2A SQL SECURITY, RLS & COORDINATOR VERIFICATION CHECKS PASSED IN TRANSACTION.';
end;
$$;

rollback;
