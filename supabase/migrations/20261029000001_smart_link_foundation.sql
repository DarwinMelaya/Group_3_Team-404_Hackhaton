-- SMART-ANI / Agri — Phase 2A Final Hardened Foundation Migration
-- Status: PREPARED LOCALLY. NOT YET EXECUTED AGAINST LIVE SUPABASE DATABASE.
--
-- Scope:
-- 1. Six core tables: profiles, harvest_listings, processor_requirements,
--    pooled_batches, batch_contributions, reservations.
-- 2. Strict Marinduque domain enums (roles, crops, municipalities, storage).
-- 3. Coordinator Verification Workflow on harvest_listings:
--    draft -> pending_verification -> available (Verified/Published) or rejected -> closed.
-- 4. Private security schema (smart_link_private) with hardened SECURITY DEFINER
--    functions and empty search_path, plus public.review_harvest_listing RPC.
-- 5. Row Level Security (RLS) + column-level privilege grants.
-- 6. Concurrency-safe quantity, lifecycle, and role-integrity triggers.
--
-- Phase 2 Pooling & Allocation Rules:
-- - Same-municipality, same-crop, same-storage-condition pooling is enforced by
--   composite foreign keys between harvest_listings, pooled_batches, and
--   batch_contributions.
-- - Conservative 1-to-1 listing contribution rule: a harvest listing may belong
--   to at most one batch (batch_contributions.harvest_listing_id is UNIQUE),
--   contributing up to its available quantity_kg.

begin;

-- ============================================================================
-- 1. PRIVATE SCHEMA & ENUMS
-- ============================================================================

create schema if not exists smart_link_private;
revoke all on schema smart_link_private from public;
grant usage on schema smart_link_private to authenticated;

create type public.smart_link_role as enum (
  'farmer',
  'processor',
  'coordinator',
  'admin'
);

create type public.smart_link_crop as enum (
  'Banana',
  'Arrowroot (uraro)',
  'Cassava',
  'Camote',
  'Coconut',
  'Vegetables'
);

create type public.smart_link_municipality as enum (
  'Boac',
  'Mogpog',
  'Santa Cruz',
  'Torrijos',
  'Buenavista',
  'Gasan'
);

create type public.smart_link_storage as enum (
  'Shaded and ventilated',
  'Ambient / open air',
  'Refrigerated',
  'Other / unknown'
);

-- ============================================================================
-- 2. TABLES & CONSTRAINTS
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  municipality public.smart_link_municipality not null,
  role public.smart_link_role not null default 'farmer',
  created_at timestamptz not null default now()
);

create table public.harvest_listings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles(id) on delete restrict,
  crop public.smart_link_crop not null,
  quantity_kg numeric(12,3) not null check (quantity_kg > 0 and quantity_kg <= 1000000),
  asking_price_php_per_kg numeric(12,2) not null check (asking_price_php_per_kg >= 0 and asking_price_php_per_kg <= 1000000),
  harvest_date date not null check (harvest_date <= (created_at at time zone 'Asia/Manila')::date),
  municipality public.smart_link_municipality not null,
  barangay text not null check (char_length(btrim(barangay)) between 1 and 100),
  storage_condition public.smart_link_storage not null,
  outreach_priority text not null default 'Standard' check (outreach_priority in ('Standard', 'Priority')),
  status text not null default 'pending_verification'
    check (status in ('draft', 'pending_verification', 'available', 'rejected', 'closed')),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_notes text not null default '' check (char_length(review_notes) <= 1000),
  created_at timestamptz not null default now(),
  unique (id, crop, municipality, storage_condition),
  check (
    (status in ('draft', 'pending_verification') and reviewed_by is null and reviewed_at is null)
    or (status in ('available', 'rejected') and reviewed_by is not null and reviewed_at is not null)
    or (status = 'closed')
  )
);
comment on column public.harvest_listings.outreach_priority is
  'Farmer-selected outreach preference. Not expiration or food-safety advice.';
comment on column public.harvest_listings.status is
  'Lifecycle: draft -> pending_verification -> available (coordinator verified/published) or rejected -> closed.';

create table public.processor_requirements (
  id uuid primary key default gen_random_uuid(),
  processor_id uuid not null references public.profiles(id) on delete restrict,
  crop public.smart_link_crop not null,
  quantity_kg numeric(12,3) not null check (quantity_kg > 0 and quantity_kg <= 1000000),
  municipality public.smart_link_municipality not null,
  required_by date not null check (required_by >= (created_at at time zone 'Asia/Manila')::date),
  quality_notes text not null default '' check (char_length(quality_notes) <= 2000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  unique (id, crop)
);

create table public.pooled_batches (
  id uuid primary key default gen_random_uuid(),
  coordinator_id uuid not null references public.profiles(id) on delete restrict,
  crop public.smart_link_crop not null,
  municipality public.smart_link_municipality not null,
  storage_condition public.smart_link_storage not null,
  target_quantity_kg numeric(12,3) not null check (target_quantity_kg > 0 and target_quantity_kg <= 1000000),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default now(),
  unique (id, crop, municipality, storage_condition),
  unique (id, crop)
);

create table public.batch_contributions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  harvest_listing_id uuid not null unique,
  crop public.smart_link_crop not null,
  municipality public.smart_link_municipality not null,
  storage_condition public.smart_link_storage not null,
  quantity_kg numeric(12,3) not null check (quantity_kg > 0 and quantity_kg <= 1000000),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (batch_id, crop, municipality, storage_condition)
    references public.pooled_batches(id, crop, municipality, storage_condition) on delete restrict,
  foreign key (harvest_listing_id, crop, municipality, storage_condition)
    references public.harvest_listings(id, crop, municipality, storage_condition) on delete restrict
);
comment on table public.batch_contributions is
  'Phase 2 rule: one listing belongs to at most one same-municipality, same-crop, same-storage batch.';

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  processor_requirement_id uuid not null,
  crop public.smart_link_crop not null,
  quantity_kg numeric(12,3) not null check (quantity_kg > 0 and quantity_kg <= 1000000),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'completed', 'cancelled')),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  foreign key (batch_id, crop) references public.pooled_batches(id, crop) on delete restrict,
  foreign key (processor_requirement_id, crop) references public.processor_requirements(id, crop) on delete restrict
);

-- ============================================================================
-- 3. SECURITY-DEFINER HELPER, TRIGGERS & COORDINATOR REVIEW RPC
-- ============================================================================

-- Read only the caller's role from public.profiles. Never trust user-editable JWT metadata.
create function smart_link_private.current_role()
returns public.smart_link_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;
revoke all on function smart_link_private.current_role() from public, anon;
grant execute on function smart_link_private.current_role() to authenticated;

-- Validate harvest listing owner role, Manila harvest_date, coordinator verification transitions, and pool locks.
create function smart_link_private.enforce_harvest_listing_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_role public.smart_link_role;
  v_caller_uid uuid;
  v_caller_role public.smart_link_role;
  v_reviewer_role public.smart_link_role;
  v_contributed_qty numeric(12,3);
begin
  select role into v_owner_role
    from public.profiles
   where id = new.farmer_id;

  if v_owner_role is distinct from 'farmer'::public.smart_link_role then
    raise exception 'Harvest listings must be owned by a farmer profile.';
  end if;

  v_caller_uid := (select auth.uid());
  v_caller_role := smart_link_private.current_role();

  if tg_op = 'INSERT' then
    if new.harvest_date > (now() at time zone 'Asia/Manila')::date then
      raise exception 'Harvest date cannot be in the future (Asia/Manila).';
    end if;

    -- Farmers and authenticated clients can only create 'draft' or 'pending_verification' listings
    if v_caller_uid is not null and new.status not in ('draft', 'pending_verification') then
      raise exception 'Newly created harvest listings must have status draft or pending_verification.';
    end if;

    if new.status in ('draft', 'pending_verification') then
      if new.reviewed_by is not null or new.reviewed_at is not null or new.review_notes <> '' then
        raise exception 'Unreviewed harvest listings cannot have verification metadata set.';
      end if;
    elsif new.status in ('available', 'rejected') then
      if new.reviewed_by is null or new.reviewed_at is null then
        raise exception 'Verified or rejected harvest listings require reviewed_by and reviewed_at.';
      end if;
      select role into v_reviewer_role from public.profiles where id = new.reviewed_by;
      if v_reviewer_role is null or v_reviewer_role not in ('coordinator'::public.smart_link_role, 'admin'::public.smart_link_role) then
        raise exception 'Reviewer must be a coordinator or admin profile.';
      end if;
    end if;

    return new;
  end if;

  -- UPDATE protections: core identity and location fields are always immutable
  if new.id <> old.id
     or new.farmer_id <> old.farmer_id
     or new.crop <> old.crop
     or new.harvest_date <> old.harvest_date
     or new.municipality <> old.municipality
     or new.barangay <> old.barangay
     or new.created_at <> old.created_at then
    raise exception 'Immutable harvest listing attributes cannot be modified.';
  end if;

  if old.status = 'closed' and new.status <> 'closed' then
    raise exception 'Closed harvest listings cannot be reopened.';
  end if;

  select quantity_kg into v_contributed_qty
    from public.batch_contributions
   where harvest_listing_id = old.id;

  if v_contributed_qty is not null then
    if new.quantity_kg < v_contributed_qty then
      raise exception 'Listing quantity (%) cannot be reduced below pooled contribution (%).',
        new.quantity_kg, v_contributed_qty;
    end if;
    if new.asking_price_php_per_kg <> old.asking_price_php_per_kg then
      raise exception 'Asking price cannot be modified while listing is committed to a batch.';
    end if;
    if new.storage_condition <> old.storage_condition then
      raise exception 'Storage condition cannot be modified while listing is committed to a batch.';
    end if;
    if new.status <> 'available' then
      raise exception 'Pooled harvest listings must remain available while committed to a batch.';
    end if;
  end if;

  -- Distinguish Farmer self-updates from Coordinator/Admin review updates
  if v_caller_uid is not null and v_caller_role = 'farmer'::public.smart_link_role then
    if v_caller_uid <> old.farmer_id then
      raise exception 'Farmers can only update their own harvest listings.';
    end if;

    -- Farmers can NEVER approve/publish a listing into 'available' or mark it 'rejected'
    if old.status <> 'available' and new.status = 'available' then
      raise exception 'Farmers cannot approve or publish their own harvest listings; coordinator verification is required.';
    end if;

    if new.status = 'rejected' then
      raise exception 'Farmers cannot set or retain status rejected on update; save as draft, resubmit as pending_verification, or close.';
    end if;

    -- Allowed farmer transitions:
    -- draft -> draft | pending_verification | closed
    -- pending_verification -> pending_verification | draft | closed
    -- rejected -> pending_verification | draft | closed
    -- available -> available | closed (or pending_verification if unpooled and re-verifying)
    if old.status = 'available' and new.status not in ('available', 'closed', 'pending_verification') then
      raise exception 'Verified harvest listings can only remain available, be resubmitted for verification, or be closed.';
    end if;

    -- When a listing is already verified ('available') and stays 'available', lock quantity and storage_condition
    if old.status = 'available' and new.status = 'available' then
      if new.quantity_kg <> old.quantity_kg or new.storage_condition <> old.storage_condition then
        raise exception 'Changing quantity or storage on a verified listing requires resubmitting to pending_verification.';
      end if;
      if new.reviewed_by is distinct from old.reviewed_by
         or new.reviewed_at is distinct from old.reviewed_at
         or new.review_notes is distinct from old.review_notes then
        raise exception 'Farmers cannot modify coordinator verification metadata.';
      end if;
    end if;

    -- When a listing is in draft or pending_verification, or being resubmitted from rejected/available to draft/pending_verification:
    if new.status in ('draft', 'pending_verification') then
      if old.status in ('rejected', 'available') then
        -- Automatically clear previous review metadata upon farmer resubmission/re-drafting
        new.reviewed_by := null;
        new.reviewed_at := null;
        new.review_notes := '';
      else
        if new.reviewed_by is not null or new.reviewed_at is not null or new.review_notes <> '' then
          raise exception 'Farmers cannot set coordinator verification metadata.';
        end if;
      end if;
    end if;

    if new.status = 'closed' then
      if new.reviewed_by is distinct from old.reviewed_by
         or new.reviewed_at is distinct from old.reviewed_at
         or new.review_notes is distinct from old.review_notes then
        raise exception 'Farmers cannot modify coordinator verification metadata when closing a listing.';
      end if;
    end if;

  elsif v_caller_uid is not null and v_caller_role in ('coordinator'::public.smart_link_role, 'admin'::public.smart_link_role) then
    -- Coordinator / Admin verification transition rules
    if old.status <> 'pending_verification' or new.status not in ('available', 'rejected') then
      raise exception 'Coordinators can only transition pending_verification listings to available or rejected.';
    end if;

    if new.quantity_kg <> old.quantity_kg
       or new.asking_price_php_per_kg <> old.asking_price_php_per_kg
       or new.storage_condition <> old.storage_condition
       or new.outreach_priority <> old.outreach_priority then
      raise exception 'Coordinator review cannot modify farmer listing quantity, price, storage, or outreach priority.';
    end if;

    if new.reviewed_by is distinct from v_caller_uid or new.reviewed_at is null then
      raise exception 'Coordinator review must record the authenticated reviewer ID and timestamp.';
    end if;

  elsif v_caller_uid is not null then
    raise exception 'Role % is not authorized to update harvest listings.', v_caller_role;
  end if;

  return new;
end;
$$;
revoke all on function smart_link_private.enforce_harvest_listing_lifecycle() from public, anon, authenticated;

create trigger trg_enforce_harvest_listing_lifecycle
before insert or update on public.harvest_listings
for each row execute function smart_link_private.enforce_harvest_listing_lifecycle();

-- Authorized Coordinator / Admin RPC to verify ('available') or reject ('rejected') a pending harvest listing.
create function public.review_harvest_listing(
  p_listing_id uuid,
  p_decision text,
  p_review_notes text default ''
)
returns public.harvest_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_uid uuid;
  v_caller_role public.smart_link_role;
  v_current_status text;
  v_clean_notes text;
  v_result public.harvest_listings;
begin
  v_caller_uid := (select auth.uid());
  if v_caller_uid is null then
    raise exception 'Authentication required to review harvest listings.';
  end if;

  v_caller_role := smart_link_private.current_role();
  if v_caller_role is null or v_caller_role not in ('coordinator'::public.smart_link_role, 'admin'::public.smart_link_role) then
    raise exception 'Unauthorized: only a coordinator or admin may approve or reject harvest listings.';
  end if;

  if p_decision is null or p_decision not in ('available', 'rejected') then
    raise exception 'Invalid review decision (%): must be available (verified/published) or rejected.', p_decision;
  end if;

  v_clean_notes := coalesce(btrim(p_review_notes), '');
  if char_length(v_clean_notes) > 1000 then
    raise exception 'Review notes cannot exceed 1000 characters.';
  end if;

  select status into v_current_status
    from public.harvest_listings
   where id = p_listing_id
     for update;

  if not found then
    raise exception 'Harvest listing (%) not found.', p_listing_id;
  end if;

  if v_current_status <> 'pending_verification' then
    raise exception 'Harvest listing (%) cannot be reviewed because its current status is % (expected pending_verification).',
      p_listing_id, v_current_status;
  end if;

  update public.harvest_listings
     set status = p_decision,
         reviewed_by = v_caller_uid,
         reviewed_at = now(),
         review_notes = v_clean_notes
   where id = p_listing_id
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.review_harvest_listing(uuid, text, text) from public, anon;
grant execute on function public.review_harvest_listing(uuid, text, text) to authenticated;

-- Validate processor requirement owner role, creation-time Manila date, and reserved quantity floor.
create function smart_link_private.enforce_processor_requirement_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_role public.smart_link_role;
  v_reserved_qty numeric(12,3);
begin
  select role into v_owner_role
    from public.profiles
   where id = new.processor_id;

  if v_owner_role is distinct from 'processor'::public.smart_link_role then
    raise exception 'Processor requirements must be owned by a processor profile.';
  end if;

  if tg_op = 'INSERT' then
    if new.required_by < (now() at time zone 'Asia/Manila')::date then
      raise exception 'Processor requirement required_by date cannot be in the past (Asia/Manila).';
    end if;
    return new;
  end if;

  -- UPDATE protections (allow closing or editing notes even after required_by passes)
  if new.id <> old.id
     or new.processor_id <> old.processor_id
     or new.crop <> old.crop
     or new.municipality <> old.municipality
     or new.required_by <> old.required_by
     or new.created_at <> old.created_at then
    raise exception 'Immutable processor requirement attributes cannot be modified.';
  end if;

  select coalesce(sum(quantity_kg), 0) into v_reserved_qty
    from public.reservations
   where processor_requirement_id = old.id
     and status <> 'cancelled';

  if new.quantity_kg < v_reserved_qty then
    raise exception 'Requirement quantity (%) cannot be reduced below active reserved quantity (%).',
      new.quantity_kg, v_reserved_qty;
  end if;

  return new;
end;
$$;
revoke all on function smart_link_private.enforce_processor_requirement_lifecycle() from public, anon, authenticated;

create trigger trg_enforce_processor_requirement_lifecycle
before insert or update on public.processor_requirements
for each row execute function smart_link_private.enforce_processor_requirement_lifecycle();

-- Validate pooled batch owner role and target quantity floor.
create function smart_link_private.enforce_pooled_batch_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_role public.smart_link_role;
  v_pooled_qty numeric(12,3);
begin
  select role into v_owner_role
    from public.profiles
   where id = new.coordinator_id;

  if v_owner_role is null or v_owner_role not in ('coordinator'::public.smart_link_role, 'admin'::public.smart_link_role) then
    raise exception 'Pooled batches must be owned by a coordinator or admin profile.';
  end if;

  if tg_op = 'UPDATE' then
    if new.id <> old.id
        or new.coordinator_id <> old.coordinator_id
        or new.crop <> old.crop
        or new.municipality <> old.municipality
        or new.storage_condition <> old.storage_condition
        or new.created_at <> old.created_at then
      raise exception 'Immutable pooled batch attributes cannot be modified.';
    end if;

    select coalesce(sum(quantity_kg), 0) into v_pooled_qty
      from public.batch_contributions
     where batch_id = old.id;

    if new.target_quantity_kg < v_pooled_qty then
      raise exception 'Batch target quantity (%) cannot be reduced below current pooled supply (%).',
        new.target_quantity_kg, v_pooled_qty;
    end if;
  end if;

  return new;
end;
$$;
revoke all on function smart_link_private.enforce_pooled_batch_lifecycle() from public, anon, authenticated;

create trigger trg_enforce_pooled_batch_lifecycle
before insert or update on public.pooled_batches
for each row execute function smart_link_private.enforce_pooled_batch_lifecycle();

-- Concurrency-safe quantity validation for batch_contributions (INSERT, UPDATE, DELETE).
create function smart_link_private.enforce_batch_contribution_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_target numeric(12,3);
  v_batch_status text;
  v_listing_qty numeric(12,3);
  v_listing_status text;
  v_other_pooled numeric(12,3);
  v_new_pooled numeric(12,3);
  v_reserved_batch numeric(12,3);
begin
  if tg_op = 'DELETE' then
    perform 1 from public.pooled_batches where id = old.batch_id for update;

    select coalesce(sum(quantity_kg), 0) into v_other_pooled
      from public.batch_contributions
     where batch_id = old.batch_id
       and id <> old.id;

    select coalesce(sum(quantity_kg), 0) into v_reserved_batch
      from public.reservations
     where batch_id = old.batch_id
       and status <> 'cancelled';

    if v_other_pooled < v_reserved_batch then
      raise exception 'Cannot remove contribution: remaining pooled supply (%) would fall below active reservations (%).',
        v_other_pooled, v_reserved_batch;
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.id <> old.id
       or new.batch_id <> old.batch_id
       or new.harvest_listing_id <> old.harvest_listing_id
       or new.crop <> old.crop
       or new.municipality <> old.municipality
       or new.storage_condition <> old.storage_condition
       or new.created_at <> old.created_at then
      raise exception 'Contribution batch, listing, and crop/location/storage attributes cannot be reassigned.';
    end if;
  end if;

  -- Lock parent batch and listing in fixed order (pooled_batches -> harvest_listings)
  select target_quantity_kg, status
    into v_batch_target, v_batch_status
    from public.pooled_batches
   where id = new.batch_id
     for update;

  select quantity_kg, status
    into v_listing_qty, v_listing_status
    from public.harvest_listings
   where id = new.harvest_listing_id
     for update;

  if tg_op = 'INSERT' then
    if v_batch_status not in ('draft', 'open') then
      raise exception 'Contributions can only be added to draft or open batches.';
    end if;
    if v_listing_status <> 'available' then
      raise exception 'Harvest listing must be coordinator-verified (available) before pooling.';
    end if;
  end if;

  if new.quantity_kg > v_listing_qty then
    raise exception 'Contribution quantity (%) exceeds harvest listing available quantity (%).',
      new.quantity_kg, v_listing_qty;
  end if;

  select coalesce(sum(quantity_kg), 0) into v_other_pooled
    from public.batch_contributions
   where batch_id = new.batch_id
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_new_pooled := v_other_pooled + new.quantity_kg;

  if v_new_pooled > v_batch_target then
    raise exception 'Total pooled quantity (%) would exceed batch target quantity (%).',
      v_new_pooled, v_batch_target;
  end if;

  select coalesce(sum(quantity_kg), 0) into v_reserved_batch
    from public.reservations
   where batch_id = new.batch_id
     and status <> 'cancelled';

  if v_new_pooled < v_reserved_batch then
    raise exception 'Pooled supply (%) cannot be reduced below active batch reservations (%).',
      v_new_pooled, v_reserved_batch;
  end if;

  return new;
end;
$$;
revoke all on function smart_link_private.enforce_batch_contribution_integrity() from public, anon, authenticated;

create trigger trg_enforce_batch_contribution_integrity
before insert or update or delete on public.batch_contributions
for each row execute function smart_link_private.enforce_batch_contribution_integrity();

-- Concurrency-safe quantity and status validation for reservations.
create function smart_link_private.enforce_reservation_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_status text;
  v_req_qty numeric(12,3);
  v_req_status text;
  v_req_required_by date;
  v_pooled_qty numeric(12,3);
  v_other_batch_res numeric(12,3);
  v_other_req_res numeric(12,3);
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id
       or new.batch_id <> old.batch_id
       or new.processor_requirement_id <> old.processor_requirement_id
       or new.crop <> old.crop
       or new.idempotency_key <> old.idempotency_key
       or new.created_at <> old.created_at then
      raise exception 'Immutable reservation attributes cannot be modified.';
    end if;

    if old.status = 'cancelled' and new.status <> 'cancelled' then
      raise exception 'Cancelled reservations cannot be reactivated; create a new reservation.';
    end if;
  end if;

  if new.status = 'cancelled' then
    return new;
  end if;

  -- Lock parent batch and processor requirement in deterministic order to serialize concurrent attempts
  select status into v_batch_status
    from public.pooled_batches
   where id = new.batch_id
     for update;

  select quantity_kg, status, required_by
    into v_req_qty, v_req_status, v_req_required_by
    from public.processor_requirements
   where id = new.processor_requirement_id
     for update;

  if tg_op = 'INSERT' then
    if v_batch_status <> 'open' then
      raise exception 'Reservations can only be created against open pooled batches.';
    end if;
    if v_req_status <> 'open' then
      raise exception 'Reservations can only be created for open processor requirements.';
    end if;
    if v_req_required_by < (now() at time zone 'Asia/Manila')::date then
      raise exception 'Cannot create reservation for an expired processor requirement (required_by: %).',
        v_req_required_by;
    end if;
  end if;

  select coalesce(sum(quantity_kg), 0) into v_pooled_qty
    from public.batch_contributions
   where batch_id = new.batch_id;

  select coalesce(sum(quantity_kg), 0) into v_other_batch_res
    from public.reservations
   where batch_id = new.batch_id
     and status <> 'cancelled'
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if (v_other_batch_res + new.quantity_kg) > v_pooled_qty then
    raise exception 'Reservation quantity (%) exceeds available pooled harvest quantity (remaining: %).',
      new.quantity_kg, (v_pooled_qty - v_other_batch_res);
  end if;

  select coalesce(sum(quantity_kg), 0) into v_other_req_res
    from public.reservations
   where processor_requirement_id = new.processor_requirement_id
     and status <> 'cancelled'
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if (v_other_req_res + new.quantity_kg) > v_req_qty then
    raise exception 'Reservation quantity (%) exceeds processor requirement quantity (remaining: %).',
      new.quantity_kg, (v_req_qty - v_other_req_res);
  end if;

  return new;
end;
$$;
revoke all on function smart_link_private.enforce_reservation_integrity() from public, anon, authenticated;

create trigger trg_enforce_reservation_integrity
before insert or update on public.reservations
for each row execute function smart_link_private.enforce_reservation_integrity();

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

create index harvest_listings_farmer_idx on public.harvest_listings(farmer_id);
create index harvest_listings_exchange_idx on public.harvest_listings(status, crop, municipality);
create index processor_requirements_owner_idx on public.processor_requirements(processor_id);
create index pooled_batches_coordinator_idx on public.pooled_batches(coordinator_id);
create index batch_contributions_batch_idx on public.batch_contributions(batch_id);
create index reservations_batch_idx on public.reservations(batch_id);
create index reservations_requirement_idx on public.reservations(processor_requirement_id);
-- Prevent duplicate active reservations for the same (batch_id, processor_requirement_id) pair
create unique index reservations_active_pair_idx
  on public.reservations(batch_id, processor_requirement_id)
  where status <> 'cancelled';

-- ============================================================================
-- 5. ROW LEVEL SECURITY & PRIVILEGE GRANTS
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.harvest_listings enable row level security;
alter table public.processor_requirements enable row level security;
alter table public.pooled_batches enable row level security;
alter table public.batch_contributions enable row level security;
alter table public.reservations enable row level security;

-- Revoke permissive defaults. No anonymous access; no client deletes.
revoke all on public.profiles, public.harvest_listings, public.processor_requirements,
  public.pooled_batches, public.batch_contributions, public.reservations from anon, authenticated;

grant select on public.profiles, public.harvest_listings, public.processor_requirements,
  public.pooled_batches, public.batch_contributions, public.reservations to authenticated;

-- Profiles: role column is never insertable/updatable by authenticated clients
grant insert (id, display_name, municipality) on public.profiles to authenticated;
grant update (display_name, municipality) on public.profiles to authenticated;

-- Harvest listings:
-- Farmers can insert listings (default status = 'pending_verification', or 'draft').
-- Farmers can update quantity_kg, asking_price_php_per_kg, storage_condition, outreach_priority, and status
-- under strict trigger-enforced transition rules. Verification columns (reviewed_by, reviewed_at, review_notes)
-- are NEVER directly insertable or updatable by authenticated clients.
grant insert (farmer_id, crop, quantity_kg, asking_price_php_per_kg, harvest_date,
  municipality, barangay, storage_condition, outreach_priority, status) on public.harvest_listings to authenticated;
grant update (quantity_kg, asking_price_php_per_kg, storage_condition, outreach_priority, status)
  on public.harvest_listings to authenticated;

-- Processor requirements: processors can create open requirements and update quality notes or close them
grant insert (processor_id, crop, quantity_kg, municipality, required_by, quality_notes)
  on public.processor_requirements to authenticated;
grant update (quality_notes, status) on public.processor_requirements to authenticated;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- PROFILES
create policy profiles_read on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select smart_link_private.current_role()) in ('coordinator', 'admin')
);

create policy profiles_create_self on public.profiles for insert to authenticated
with check (
  id = (select auth.uid())
  and role = 'farmer'
);

-- Strengthened with defense-in-depth role lock in WITH CHECK
create policy profiles_edit_self on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and role = (select smart_link_private.current_role())
);

-- HARVEST LISTINGS
-- Farmers only see their own listings; processors see ONLY verified/published ('available') listings;
-- coordinators/admins see all listings (including 'pending_verification' and 'rejected').
create policy harvests_read on public.harvest_listings for select to authenticated
using (
  farmer_id = (select auth.uid())
  or (select smart_link_private.current_role()) in ('coordinator', 'admin')
  or (status = 'available' and (select smart_link_private.current_role()) = 'processor')
);

-- Farmers can only create 'draft' or 'pending_verification' listings (never 'available' directly)
create policy harvests_create_self on public.harvest_listings for insert to authenticated
with check (
  farmer_id = (select auth.uid())
  and (select smart_link_private.current_role()) = 'farmer'
  and status in ('draft', 'pending_verification')
);

-- Farmers can edit own listings and submit/resubmit to 'pending_verification', save as 'draft', or 'closed'.
-- Direct transition from non-available to 'available' is blocked by trg_enforce_harvest_listing_lifecycle.
create policy harvests_edit_self on public.harvest_listings for update to authenticated
using (
  farmer_id = (select auth.uid())
  and (select smart_link_private.current_role()) = 'farmer'
  and status in ('draft', 'pending_verification', 'rejected', 'available')
)
with check (
  farmer_id = (select auth.uid())
  and (select smart_link_private.current_role()) = 'farmer'
  and status in ('draft', 'pending_verification', 'available', 'closed')
);

-- PROCESSOR REQUIREMENTS
create policy requirements_read on public.processor_requirements for select to authenticated
using (
  processor_id = (select auth.uid())
  or (select smart_link_private.current_role()) in ('coordinator', 'admin')
  or (status = 'open' and (select smart_link_private.current_role()) in ('farmer', 'processor'))
);

create policy requirements_create_self on public.processor_requirements for insert to authenticated
with check (
  processor_id = (select auth.uid())
  and (select smart_link_private.current_role()) = 'processor'
  and status = 'open'
);

create policy requirements_edit_self on public.processor_requirements for update to authenticated
using (
  processor_id = (select auth.uid())
  and (select smart_link_private.current_role()) = 'processor'
  and status = 'open'
)
with check (
  processor_id = (select auth.uid())
  and (select smart_link_private.current_role()) = 'processor'
  and status in ('open', 'closed')
);

-- POOLED BATCHES, CONTRIBUTIONS, RESERVATIONS (Read-only for clients; writes require privileged server ops)
create policy batches_read on public.pooled_batches for select to authenticated
using (
  (select smart_link_private.current_role()) in ('coordinator', 'admin')
  or (status = 'open' and (select smart_link_private.current_role()) in ('farmer', 'processor'))
);

create policy contributions_read on public.batch_contributions for select to authenticated
using (
  (select smart_link_private.current_role()) in ('coordinator', 'admin')
  or exists (
    select 1
      from public.harvest_listings h
     where h.id = harvest_listing_id
       and h.farmer_id = (select auth.uid())
  )
);

create policy reservations_read on public.reservations for select to authenticated
using (
  (select smart_link_private.current_role()) in ('coordinator', 'admin')
  or exists (
    select 1
      from public.processor_requirements r
     where r.id = processor_requirement_id
       and r.processor_id = (select auth.uid())
  )
  or exists (
    select 1
      from public.batch_contributions c
      join public.harvest_listings h on h.id = c.harvest_listing_id
     where c.batch_id = reservations.batch_id
       and h.farmer_id = (select auth.uid())
  )
);

commit;
