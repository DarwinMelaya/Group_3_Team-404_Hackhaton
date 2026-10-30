-- SMART-ANI / Agri — Phase B Migration Step 2: Demand-Driven Farmer, Market & Admin Architecture
-- Status: PREPARED LOCALLY FOR REVIEW. NOT YET EXECUTED AGAINST LIVE SUPABASE DATABASE.
-- Prerequisite: Run 20261030000003_add_market_role_enum.sql first so 'market' is committed in public.smart_link_role.
--
-- Scope & Security Guarantees:
-- 1. Active 3-Role Governance ('farmer', 'market', 'admin'):
--    - Newly registered Market accounts ALWAYS default to market_verification_status = 'pending_verification'.
--    - Only an active Admin can verify a Market via public.admin_verify_market_account().
--    - Unverified Markets CANNOT create public demands or accept farmer supply offers.
--    - Users can NEVER self-assign 'admin', 'coordinator', or 'processor' roles.
-- 2. Safe Legacy Role Migration (Zero Silent Escalation / Zero Silent Farmer Conversion):
--    - Former 'coordinator' accounts are NOT promoted to Admin and NOT silently converted to active Farmers.
--      They are placed into account_status = 'deactivated_pending_admin_review', recorded in
--      public.legacy_role_migration_quarantine, and blocked from all active role permissions until
--      explicitly reviewed by an Admin via public.admin_resolve_legacy_account().
--    - Former 'processor' accounts are migrated to role = 'market' with market_type = 'food_processor',
--      legacy_role = 'processor', and market_verification_status = 'pending_verification'.
--    - Historical processor_requirements rows are preserved and non-destructively copied into public.market_demands.
-- 3. Non-Double-Counted Inventory & Demand Accounting:
--    - Farmer Harvest Listing:
--        earmarked_kg  = sum(allocated_quantity_kg - delivered_quantity_kg - released_quantity_kg) for ('proposed','pending_acceptance')
--        reserved_kg   = sum(allocated_quantity_kg - delivered_quantity_kg - released_quantity_kg) for ('reserved','in_delivery','partially_delivered')
--        allocated_kg  = earmarked_kg + reserved_kg (total outstanding undelivered committed quantity)
--        delivered_kg  = sum(delivered_quantity_kg) across all allocations
--        remaining_kg  = quantity_kg - allocated_kg - delivered_kg (GENERATED ALWAYS)
--        Constraint: allocated_kg + delivered_kg <= quantity_kg
--    - Market Demand Listing:
--        reserved_quantity_kg  = sum(allocated_quantity_kg - delivered_quantity_kg - released_quantity_kg) for ('reserved','in_delivery','partially_delivered')
--        fulfilled_quantity_kg = sum(delivered_quantity_kg) across all allocations
--        remaining_demand_kg   = required_quantity_kg - reserved_quantity_kg - fulfilled_quantity_kg (GENERATED ALWAYS)
--        Constraint: reserved_quantity_kg + fulfilled_quantity_kg <= required_quantity_kg
-- 4. Atomic Concurrency & Row Locking:
--    - All quantity-mutating RPCs acquire SELECT ... FOR UPDATE locks in deterministic hierarchy:
--      profiles -> harvest_listings -> market_demands -> supply_allocations.
--    - Multiple farmers may offer to the same market demand; market demand capacity is atomically
--      revalidated at offer acceptance time to prevent over-reservation under race conditions.
-- 5. Immutable Audit Trail:
--    - Admin cannot silently alter transaction quantities; all privileged actions require an explicit reason
--      and write to public.audit_logs.

begin;

-- ============================================================================
-- 1. PROFILE EXTENSIONS, MARKET VERIFICATION & SAFE LEGACY ROLE QUARANTINE
-- ============================================================================

alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists market_type text,
  add column if not exists organization_name text not null default '',
  add column if not exists market_verification_status text not null default 'not_applicable',
  add column if not exists verified_by uuid references public.profiles(id) on delete restrict,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_notes text not null default '',
  add column if not exists legacy_role text,
  add column if not exists legacy_migrated_at timestamptz;

create table if not exists public.legacy_role_migration_quarantine (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  previous_role text not null check (previous_role in ('coordinator', 'processor')),
  new_role public.smart_link_role not null,
  migration_disposition text not null check (
    migration_disposition in (
      'quarantined_deactivated_pending_admin_review',
      'mapped_to_market_pending_verification',
      'admin_reviewed_and_resolved'
    )
  ),
  mig_notes text not null default '',
  migrated_at timestamptz not null default now(),
  resolved_by uuid references public.profiles(id) on delete restrict,
  resolved_at timestamptz,
  resolution_notes text not null default ''
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete restrict,
  actor_role text not null,
  action text not null check (char_length(btrim(action)) between 1 and 120),
  entity_type text not null check (
    entity_type in (
      'profile',
      'harvest_listing',
      'market_demand',
      'supply_allocation',
      'delivery_record',
      'legacy_migration'
    )
  ),
  entity_id uuid not null,
  reason text not null default '' check (char_length(reason) <= 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Safely migrate any existing 'processor' accounts -> 'market' (pending_verification)
-- and quarantine any existing 'coordinator' accounts -> deactivated_pending_admin_review
-- WITHOUT promoting to Admin and WITHOUT silently turning them into active Farmers.
do $$
declare
  rec record;
begin
  -- 1. Migrate legacy 'processor' profiles to 'market' (food_processor, pending_verification)
  for rec in
    select id, display_name, municipality
      from public.profiles
     where role = 'processor'::public.smart_link_role
     for update
  loop
    update public.profiles
       set role = 'market'::public.smart_link_role,
           account_status = 'active',
           market_type = coalesce(market_type, 'food_processor'),
           organization_name = case
             when btrim(organization_name) = '' then display_name
             else organization_name
           end,
           market_verification_status = 'pending_verification',
           legacy_role = 'processor',
           legacy_migrated_at = now(),
           verification_notes = 'Migrated from legacy processor role; requires Admin verification before posting new demands or accepting offers.'
     where id = rec.id;

    insert into public.legacy_role_migration_quarantine (
      profile_id, previous_role, new_role, migration_disposition, mig_notes
    ) values (
      rec.id,
      'processor',
      'market'::public.smart_link_role,
      'mapped_to_market_pending_verification',
      'Former processor mapped to Market (food_processor) with pending_verification status.'
    )
    on conflict (profile_id) do nothing;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id, reason, metadata
    ) values (
      null,
      'system_migration',
      'LEGACY_PROCESSOR_MAPPED_TO_MARKET',
      'profile',
      rec.id,
      'Mapped legacy processor account to Market role with pending_verification status.',
      jsonb_build_object('previous_role', 'processor', 'new_role', 'market', 'market_verification_status', 'pending_verification')
    );
  end loop;

  -- 2. Quarantine legacy 'coordinator' profiles:
  --    Do NOT promote to admin; do NOT silently turn into active farmer.
  --    Deactivate account_status so they have zero active permissions until Admin review.
  for rec in
    select id, display_name, municipality
      from public.profiles
     where role = 'coordinator'::public.smart_link_role
       and account_status <> 'deactivated_pending_admin_review'
     for update
  loop
    update public.profiles
       set account_status = 'deactivated_pending_admin_review',
           market_verification_status = 'not_applicable',
           legacy_role = 'coordinator',
           legacy_migrated_at = now(),
           verification_notes = 'Legacy coordinator account deactivated during 3-role revision. Requires explicit Admin review and role assignment.'
     where id = rec.id;

    insert into public.legacy_role_migration_quarantine (
      profile_id, previous_role, new_role, migration_disposition, mig_notes
    ) values (
      rec.id,
      'coordinator',
      'coordinator'::public.smart_link_role,
      'quarantined_deactivated_pending_admin_review',
      'Former coordinator deactivated pending explicit Admin review; not promoted to Admin and not silently converted to active Farmer.'
    )
    on conflict (profile_id) do nothing;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id, reason, metadata
    ) values (
      null,
      'system_migration',
      'LEGACY_COORDINATOR_QUARANTINED',
      'profile',
      rec.id,
      'Quarantined legacy coordinator account (deactivated_pending_admin_review) to prevent silent role conversion or escalation.',
      jsonb_build_object('previous_role', 'coordinator', 'account_status', 'deactivated_pending_admin_review')
    );
  end loop;
end;
$$;

-- Add strict CHECK constraints on public.profiles (drop first if re-running)
alter table public.profiles
  drop constraint if exists profiles_active_three_role_check,
  drop constraint if exists profiles_account_status_check,
  drop constraint if exists profiles_market_attributes_check,
  drop constraint if exists profiles_verification_notes_check;

alter table public.profiles
  add constraint profiles_account_status_check check (
    account_status in ('active', 'deactivated_pending_admin_review', 'suspended')
  ),
  add constraint profiles_active_three_role_check check (
    -- Active accounts may ONLY have one of the 3 official roles: farmer, market, admin.
    -- Legacy 'coordinator' enum value may only exist on deactivated quarantine rows.
    -- Legacy 'processor' enum value is completely disallowed on profiles.
    (role in ('farmer'::public.smart_link_role, 'market'::public.smart_link_role, 'admin'::public.smart_link_role))
    or (
      role = 'coordinator'::public.smart_link_role
      and account_status = 'deactivated_pending_admin_review'
      and legacy_role = 'coordinator'
    )
  ),
  add constraint profiles_market_attributes_check check (
    (
      role = 'market'::public.smart_link_role
      and market_type in ('public_market', 'retail_buyer', 'cooperative', 'food_processor', 'institutional_buyer')
      and market_verification_status in ('pending_verification', 'verified', 'rejected', 'suspended')
      and char_length(btrim(organization_name)) <= 120
      and (
        (market_verification_status = 'pending_verification' and verified_by is null and verified_at is null)
        or (market_verification_status in ('verified', 'rejected', 'suspended'))
      )
    )
    or (
      role <> 'market'::public.smart_link_role
      and market_type is null
      and market_verification_status = 'not_applicable'
    )
  ),
  add constraint profiles_verification_notes_check check (
    char_length(verification_notes) <= 1000
  );

-- ============================================================================
-- 2. FARMER HARVEST INVENTORY EXTENSIONS (NON-DOUBLE-COUNTED ACCOUNTING)
-- ============================================================================

alter table public.harvest_listings
  add column if not exists unit text not null default 'kg',
  add column if not exists quality_grade text not null default 'Grade A',
  add column if not exists photo_url text not null default '',
  add column if not exists earmarked_kg numeric(12,3) not null default 0,
  add column if not exists reserved_kg numeric(12,3) not null default 0,
  add column if not exists allocated_kg numeric(12,3) not null default 0,
  add column if not exists delivered_kg numeric(12,3) not null default 0,
  add column if not exists remaining_kg numeric(12,3)
    generated always as (quantity_kg - allocated_kg - delivered_kg) stored;

alter table public.harvest_listings
  drop constraint if exists harvest_listings_unit_grade_photo_check,
  drop constraint if exists harvest_listings_inventory_accounting_check;

alter table public.harvest_listings
  add constraint harvest_listings_unit_grade_photo_check check (
    unit = 'kg'
    and quality_grade in ('Grade A', 'Grade B', 'Standard / Mixed')
    and char_length(photo_url) <= 500
  ),
  add constraint harvest_listings_inventory_accounting_check check (
    earmarked_kg >= 0
    and reserved_kg >= 0
    and allocated_kg >= 0
    and delivered_kg >= 0
    and allocated_kg = (earmarked_kg + reserved_kg)
    and (allocated_kg + delivered_kg) <= quantity_kg
  );

comment on column public.harvest_listings.earmarked_kg is
  'Undelivered quantity in proposed/pending_acceptance offers. Prevents farmer over-offering before Market acceptance.';
comment on column public.harvest_listings.reserved_kg is
  'Undelivered quantity in accepted/reserved/in_delivery/partially_delivered allocations.';
comment on column public.harvest_listings.allocated_kg is
  'Total outstanding undelivered committed quantity (earmarked_kg + reserved_kg). Never includes delivered_kg.';
comment on column public.harvest_listings.delivered_kg is
  'Cumulative quantity confirmed received by Markets. Shifted out of reserved_kg/allocated_kg upon delivery confirmation.';
comment on column public.harvest_listings.remaining_kg is
  'Exact available-to-allocate inventory: quantity_kg - allocated_kg - delivered_kg.';

-- ============================================================================
-- 3. MARKET DEMAND LISTINGS, SUPPLY ALLOCATIONS & DELIVERY RECORDS
-- ============================================================================

create table if not exists public.market_demands (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.profiles(id) on delete restrict,
  crop public.smart_link_crop not null,
  required_quantity_kg numeric(12,3) not null check (required_quantity_kg > 0 and required_quantity_kg <= 1000000),
  reserved_quantity_kg numeric(12,3) not null default 0 check (reserved_quantity_kg >= 0),
  fulfilled_quantity_kg numeric(12,3) not null default 0 check (fulfilled_quantity_kg >= 0),
  remaining_demand_kg numeric(12,3)
    generated always as (required_quantity_kg - reserved_quantity_kg - fulfilled_quantity_kg) stored,
  unit text not null default 'kg' check (unit = 'kg'),
  preferred_quality_grade text not null default 'Any'
    check (preferred_quality_grade in ('Any', 'Grade A', 'Grade B', 'Standard / Mixed')),
  offered_price_php_per_kg numeric(12,2) not null
    check (offered_price_php_per_kg >= 0 and offered_price_php_per_kg <= 1000000),
  municipality public.smart_link_municipality not null,
  barangay text not null default '' check (char_length(btrim(barangay)) <= 100),
  delivery_location_text text not null default '' check (char_length(delivery_location_text) <= 300),
  required_by date not null check (required_by >= (created_at at time zone 'Asia/Manila')::date),
  accept_partial boolean not null default true,
  quality_notes text not null default '' check (char_length(quality_notes) <= 2000),
  status text not null default 'open'
    check (status in ('open', 'partially_fulfilled', 'fulfilled', 'cancelled', 'closed')),
  legacy_processor_requirement_id uuid unique references public.processor_requirements(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, crop),
  constraint market_demands_capacity_accounting_check check (
    (reserved_quantity_kg + fulfilled_quantity_kg) <= required_quantity_kg
  )
);

-- Copy any historical processor_requirements into market_demands non-destructively
insert into public.market_demands (
  market_id,
  crop,
  required_quantity_kg,
  reserved_quantity_kg,
  fulfilled_quantity_kg,
  unit,
  preferred_quality_grade,
  offered_price_php_per_kg,
  municipality,
  required_by,
  accept_partial,
  quality_notes,
  status,
  legacy_processor_requirement_id,
  created_at
)
select
  pr.processor_id,
  pr.crop,
  pr.quantity_kg,
  0,
  0,
  'kg',
  'Any',
  0,
  pr.municipality,
  pr.required_by,
  true,
  pr.quality_notes,
  case when pr.status = 'open' then 'closed' else pr.status end,
  pr.id,
  pr.created_at
from public.processor_requirements pr
on conflict (legacy_processor_requirement_id) do nothing;

create table if not exists public.supply_allocations (
  id uuid primary key default gen_random_uuid(),
  harvest_listing_id uuid not null references public.harvest_listings(id) on delete restrict,
  market_demand_id uuid not null references public.market_demands(id) on delete restrict,
  farmer_id uuid not null references public.profiles(id) on delete restrict,
  market_id uuid not null references public.profiles(id) on delete restrict,
  crop public.smart_link_crop not null,
  allocated_quantity_kg numeric(12,3) not null check (allocated_quantity_kg > 0 and allocated_quantity_kg <= 1000000),
  delivered_quantity_kg numeric(12,3) not null default 0 check (delivered_quantity_kg >= 0),
  released_quantity_kg numeric(12,3) not null default 0 check (released_quantity_kg >= 0),
  outstanding_quantity_kg numeric(12,3)
    generated always as (allocated_quantity_kg - delivered_quantity_kg - released_quantity_kg) stored,
  agreed_price_php_per_kg numeric(12,2) not null check (agreed_price_php_per_kg >= 0 and agreed_price_php_per_kg <= 1000000),
  status text not null default 'pending_acceptance'
    check (
      status in (
        'proposed',
        'pending_acceptance',
        'reserved',
        'in_delivery',
        'partially_delivered',
        'delivered',
        'rejected',
        'cancelled'
      )
    ),
  offer_notes text not null default '' check (char_length(offer_notes) <= 1000),
  response_notes text not null default '' check (char_length(response_notes) <= 1000),
  idempotency_key uuid not null default gen_random_uuid() unique,
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint supply_allocations_quantity_balance_check check (
    (delivered_quantity_kg + released_quantity_kg) <= allocated_quantity_kg
    and (
      -- Active states have 0 released quantity and positive outstanding undelivered quantity
      (status in ('proposed', 'pending_acceptance', 'reserved', 'in_delivery')
        and delivered_quantity_kg = 0
        and released_quantity_kg = 0
        and (allocated_quantity_kg - delivered_quantity_kg - released_quantity_kg) > 0)
      or
      (status = 'partially_delivered'
        and delivered_quantity_kg > 0
        and delivered_quantity_kg < allocated_quantity_kg
        and released_quantity_kg = 0
        and (allocated_quantity_kg - delivered_quantity_kg - released_quantity_kg) > 0)
      or
      -- Terminal states ALWAYS have 0 outstanding committed quantity (all undelivered quantity is either delivered or released)
      (status = 'delivered'
        and delivered_quantity_kg > 0
        and (delivered_quantity_kg + released_quantity_kg) = allocated_quantity_kg)
      or
      (status = 'rejected'
        and delivered_quantity_kg = 0
        and released_quantity_kg = allocated_quantity_kg)
      or
      (status = 'cancelled'
        and (delivered_quantity_kg + released_quantity_kg) = allocated_quantity_kg)
    )
  )
);

create table if not exists public.delivery_records (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.supply_allocations(id) on delete restrict,
  harvest_listing_id uuid not null references public.harvest_listings(id) on delete restrict,
  market_demand_id uuid not null references public.market_demands(id) on delete restrict,
  confirmed_by uuid not null references public.profiles(id) on delete restrict,
  confirmed_by_role text not null check (confirmed_by_role in ('market', 'admin')),
  received_quantity_kg numeric(12,3) not null check (received_quantity_kg > 0 and received_quantity_kg <= 1000000),
  released_remainder_kg numeric(12,3) not null default 0 check (released_remainder_kg >= 0),
  quality_grade_received text not null default 'Grade A'
    check (quality_grade_received in ('Grade A', 'Grade B', 'Standard / Mixed')),
  delivery_notes text not null default '' check (char_length(delivery_notes) <= 1000),
  idempotency_key uuid not null default gen_random_uuid() unique,
  confirmed_at timestamptz not null default now()
);

-- ============================================================================
-- 4. INDEXES FOR FAST FILTERING & CONCURRENCY SAFETY
-- ============================================================================

create index if not exists profiles_role_verification_idx
  on public.profiles(role, account_status, market_verification_status);

create index if not exists market_demands_matching_idx
  on public.market_demands(status, crop, municipality, required_by, offered_price_php_per_kg);

create index if not exists market_demands_owner_idx
  on public.market_demands(market_id);

create index if not exists supply_allocations_listing_idx
  on public.supply_allocations(harvest_listing_id, status);

create index if not exists supply_allocations_demand_idx
  on public.supply_allocations(market_demand_id, status);

create index if not exists supply_allocations_farmer_idx
  on public.supply_allocations(farmer_id, status);

create index if not exists supply_allocations_market_idx
  on public.supply_allocations(market_id, status);

-- Prevent duplicate active allocations between the exact same (harvest_listing_id, market_demand_id)
create unique index if not exists supply_allocations_active_pair_idx
  on public.supply_allocations(harvest_listing_id, market_demand_id)
  where status in ('proposed', 'pending_acceptance', 'reserved', 'in_delivery', 'partially_delivered');

create index if not exists delivery_records_allocation_idx
  on public.delivery_records(allocation_id);

create index if not exists audit_logs_entity_idx
  on public.audit_logs(entity_type, entity_id, created_at desc);

-- ============================================================================
-- 5. PRIVATE SECURITY HELPERS & ACCOUNTING RECOMPUTATION ENGINE
-- ============================================================================

-- Update smart_link_private.current_role() so ONLY active accounts in ('farmer', 'market', 'admin')
-- resolve to an active role. Quarantined legacy coordinators or suspended accounts return NULL.
create or replace function smart_link_private.current_role()
returns public.smart_link_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
    from public.profiles p
   where p.id = (select auth.uid())
     and p.account_status = 'active'
     and p.role in (
       'farmer'::public.smart_link_role,
       'market'::public.smart_link_role,
       'admin'::public.smart_link_role
     );
$$;
revoke all on function smart_link_private.current_role() from public, anon;
grant execute on function smart_link_private.current_role() to authenticated;

-- Helper: true ONLY if the authenticated caller is an active, Admin-verified Market account.
create or replace function smart_link_private.is_verified_market()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = (select auth.uid())
       and p.account_status = 'active'
       and p.role = 'market'::public.smart_link_role
       and p.market_verification_status = 'verified'
  );
$$;
revoke all on function smart_link_private.is_verified_market() from public, anon;
grant execute on function smart_link_private.is_verified_market() to authenticated;

-- Internal accounting synchronizer: recomputes harvest_listings and market_demands totals
-- from public.supply_allocations while parent rows are locked FOR UPDATE.
create or replace function smart_link_private.recompute_inventory_and_demand(
  p_harvest_listing_id uuid,
  p_market_demand_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_earmarked numeric(12,3) := 0;
  v_reserved_listing numeric(12,3) := 0;
  v_delivered_listing numeric(12,3) := 0;
  v_listing_qty numeric(12,3);
  v_listing_status text;

  v_reserved_demand numeric(12,3) := 0;
  v_fulfilled_demand numeric(12,3) := 0;
  v_required_demand numeric(12,3);
  v_demand_status text;
  v_next_demand_status text;
begin
  if p_harvest_listing_id is not null then
    select quantity_kg, status
      into v_listing_qty, v_listing_status
      from public.harvest_listings
     where id = p_harvest_listing_id
       for update;

    select
      coalesce(sum(
        case
          when status in ('proposed', 'pending_acceptance')
          then (allocated_quantity_kg - delivered_quantity_kg - released_quantity_kg)
          else 0
        end
      ), 0),
      coalesce(sum(
        case
          when status in ('reserved', 'in_delivery', 'partially_delivered')
          then (allocated_quantity_kg - delivered_quantity_kg - released_quantity_kg)
          else 0
        end
      ), 0),
      coalesce(sum(delivered_quantity_kg), 0)
    into v_earmarked, v_reserved_listing, v_delivered_listing
    from public.supply_allocations
    where harvest_listing_id = p_harvest_listing_id;

    if (v_earmarked + v_reserved_listing + v_delivered_listing) > v_listing_qty then
      raise exception 'Inventory accounting violation: total committed + delivered (%) exceeds harvest listing quantity (%).',
        (v_earmarked + v_reserved_listing + v_delivered_listing), v_listing_qty;
    end if;

    update public.harvest_listings
       set earmarked_kg = v_earmarked,
           reserved_kg = v_reserved_listing,
           allocated_kg = (v_earmarked + v_reserved_listing),
           delivered_kg = v_delivered_listing,
           status = case
             when v_delivered_listing = v_listing_qty and (v_earmarked + v_reserved_listing) = 0 then 'closed'
             else status
           end
     where id = p_harvest_listing_id;
  end if;

  if p_market_demand_id is not null then
    select required_quantity_kg, status
      into v_required_demand, v_demand_status
      from public.market_demands
     where id = p_market_demand_id
       for update;

    select
      coalesce(sum(
        case
          when status in ('reserved', 'in_delivery', 'partially_delivered')
          then (allocated_quantity_kg - delivered_quantity_kg - released_quantity_kg)
          else 0
        end
      ), 0),
      coalesce(sum(delivered_quantity_kg), 0)
    into v_reserved_demand, v_fulfilled_demand
    from public.supply_allocations
    where market_demand_id = p_market_demand_id;

    if (v_reserved_demand + v_fulfilled_demand) > v_required_demand then
      raise exception 'Market demand capacity violation: reserved (%) + fulfilled (%) exceeds required demand (%).',
        v_reserved_demand, v_fulfilled_demand, v_required_demand;
    end if;

    v_next_demand_status := v_demand_status;
    if v_demand_status not in ('cancelled', 'closed') then
      if v_fulfilled_demand >= v_required_demand then
        v_next_demand_status := 'fulfilled';
      elsif v_fulfilled_demand > 0 or v_reserved_demand > 0 then
        v_next_demand_status := 'partially_fulfilled';
      else
        v_next_demand_status := 'open';
      end if;
    end if;

    update public.market_demands
       set reserved_quantity_kg = v_reserved_demand,
           fulfilled_quantity_kg = v_fulfilled_demand,
           status = v_next_demand_status,
           updated_at = now()
     where id = p_market_demand_id;
  end if;
end;
$$;
revoke all on function smart_link_private.recompute_inventory_and_demand(uuid, uuid) from public, anon, authenticated;

-- ============================================================================
-- 6. UPDATED TRIGGERS FOR PROFILES, HARVEST LISTINGS & MARKET DEMANDS
-- ============================================================================

-- Safe auth.users registration trigger:
-- Supports Farmer registration (default) and Market registration (strictly forced to pending_verification).
-- NEVER trusts 'admin', 'coordinator', or 'processor' from raw_user_meta_data.
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
  v_requested_role text;
  v_raw_market_type text;
  v_market_type text := null;
  v_org_name text := '';
  v_assigned_role public.smart_link_role := 'farmer'::public.smart_link_role;
  v_verification_status text := 'not_applicable';
begin
  v_display_name := btrim(coalesce(
    new.raw_user_meta_data->>'display_name',
    split_part(coalesce(new.email, 'Farmer'), '@', 1),
    'Marinduque User'
  ));
  if char_length(v_display_name) = 0 then
    v_display_name := 'Marinduque User';
  elsif char_length(v_display_name) > 100 then
    v_display_name := left(v_display_name, 100);
  end if;

  v_raw_municipality := btrim(coalesce(new.raw_user_meta_data->>'municipality', ''));
  if v_raw_municipality in ('Boac', 'Mogpog', 'Santa Cruz', 'Torrijos', 'Buenavista', 'Gasan') then
    v_municipality := v_raw_municipality::public.smart_link_municipality;
  end if;

  -- Check if user explicitly registered as a Market buyer; NEVER allow 'admin' or any other role!
  v_requested_role := lower(btrim(coalesce(new.raw_user_meta_data->>'account_type', '')));
  if v_requested_role = 'market' then
    v_assigned_role := 'market'::public.smart_link_role;
    v_verification_status := 'pending_verification';
    v_raw_market_type := lower(btrim(coalesce(new.raw_user_meta_data->>'market_type', '')));
    if v_raw_market_type in ('public_market', 'retail_buyer', 'cooperative', 'food_processor', 'institutional_buyer') then
      v_market_type := v_raw_market_type;
    else
      v_market_type := 'public_market';
    end if;
    v_org_name := left(btrim(coalesce(new.raw_user_meta_data->>'organization_name', v_display_name)), 120);
  end if;

  insert into public.profiles (
    id,
    display_name,
    municipality,
    role,
    account_status,
    market_type,
    organization_name,
    market_verification_status
  ) values (
    new.id,
    v_display_name,
    v_municipality,
    v_assigned_role,
    'active',
    v_market_type,
    v_org_name,
    v_verification_status
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
revoke all on function smart_link_private.handle_new_auth_user() from public, anon, authenticated;

-- Update harvest_listings lifecycle trigger to enforce 3-role governance ('farmer' and 'admin' only)
-- and prevent reducing quantity_kg below (allocated_kg + delivered_kg).
create or replace function smart_link_private.enforce_harvest_listing_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_role public.smart_link_role;
  v_owner_status text;
  v_caller_uid uuid;
  v_caller_role public.smart_link_role;
  v_reviewer_role public.smart_link_role;
  v_contributed_qty numeric(12,3);
  v_active_allocations integer;
begin
  select role, account_status
    into v_owner_role, v_owner_status
    from public.profiles
   where id = new.farmer_id;

  if v_owner_role is distinct from 'farmer'::public.smart_link_role or v_owner_status <> 'active' then
    raise exception 'Harvest listings must be owned by an active farmer profile.';
  end if;

  v_caller_uid := (select auth.uid());
  v_caller_role := smart_link_private.current_role();

  if tg_op = 'INSERT' then
    if new.harvest_date > (now() at time zone 'Asia/Manila')::date then
      raise exception 'Harvest date cannot be in the future (Asia/Manila).';
    end if;

    if v_caller_uid is not null and new.status not in ('draft', 'pending_verification') then
      raise exception 'Newly created harvest listings must have status draft or pending_verification.';
    end if;

    if new.earmarked_kg <> 0 or new.reserved_kg <> 0 or new.allocated_kg <> 0 or new.delivered_kg <> 0 then
      raise exception 'Newly created harvest listings must start with 0 allocated and 0 delivered quantity.';
    end if;

    if new.status in ('draft', 'pending_verification') then
      if new.reviewed_by is not null or new.reviewed_at is not null or new.review_notes <> '' then
        raise exception 'Unreviewed harvest listings cannot have verification metadata set.';
      end if;
    elsif new.status in ('available', 'rejected') then
      if new.reviewed_by is null or new.reviewed_at is null then
        raise exception 'Verified or rejected harvest listings require reviewed_by and reviewed_at.';
      end if;
      select role into v_reviewer_role from public.profiles where id = new.reviewed_by and account_status = 'active';
      if v_reviewer_role is distinct from 'admin'::public.smart_link_role then
        raise exception 'Reviewer must be an active admin profile.';
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

  -- Cannot reduce total quantity_kg below (allocated_kg + delivered_kg)
  if new.quantity_kg < (new.allocated_kg + new.delivered_kg) then
    raise exception 'Listing quantity (%) cannot be reduced below committed + delivered quantity (%).',
      new.quantity_kg, (new.allocated_kg + new.delivered_kg);
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

  -- Distinguish Farmer self-updates from Admin review updates
  if v_caller_uid is not null and v_caller_role = 'farmer'::public.smart_link_role then
    if v_caller_uid <> old.farmer_id then
      raise exception 'Farmers can only update their own harvest listings.';
    end if;

    -- Farmers cannot directly modify accounting columns
    if new.earmarked_kg <> old.earmarked_kg
       or new.reserved_kg <> old.reserved_kg
       or new.allocated_kg <> old.allocated_kg
       or new.delivered_kg <> old.delivered_kg then
      raise exception 'Inventory allocation and delivery totals are managed exclusively by atomic system RPCs.';
    end if;

    if old.status <> 'available' and new.status = 'available' then
      raise exception 'Farmers cannot approve or publish their own harvest listings; Admin verification is required.';
    end if;

    if new.status = 'rejected' then
      raise exception 'Farmers cannot set or retain status rejected on update; save as draft, resubmit as pending_verification, or close.';
    end if;

    if old.status = 'available' and new.status not in ('available', 'closed', 'pending_verification') then
      raise exception 'Verified harvest listings can only remain available, be resubmitted for verification, or be closed.';
    end if;

    -- Block resubmission to pending_verification or closing while active allocations exist
    if old.status = 'available' and new.status in ('pending_verification', 'closed') then
      if old.allocated_kg > 0 then
        raise exception 'Cannot close or unpublish harvest listing while % kg is actively allocated/reserved.', old.allocated_kg;
      end if;
    end if;

    if old.status = 'available' and new.status = 'available' then
      if new.quantity_kg <> old.quantity_kg or new.storage_condition <> old.storage_condition then
        raise exception 'Changing quantity or storage on a verified listing requires resubmitting to pending_verification.';
      end if;
      if new.reviewed_by is distinct from old.reviewed_by
         or new.reviewed_at is distinct from old.reviewed_at
         or new.review_notes is distinct from old.review_notes then
        raise exception 'Farmers cannot modify admin verification metadata.';
      end if;
    end if;

    if new.status in ('draft', 'pending_verification') then
      if old.status in ('rejected', 'available') then
        new.reviewed_by := null;
        new.reviewed_at := null;
        new.review_notes := '';
      else
        if new.reviewed_by is not null or new.reviewed_at is not null or new.review_notes <> '' then
          raise exception 'Farmers cannot set verification metadata.';
        end if;
      end if;
    end if;

    if new.status = 'closed' then
      if new.reviewed_by is distinct from old.reviewed_by
         or new.reviewed_at is distinct from old.reviewed_at
         or new.review_notes is distinct from old.review_notes then
        raise exception 'Farmers cannot modify verification metadata when closing a listing.';
      end if;
    end if;

  elsif v_caller_uid is not null and v_caller_role = 'admin'::public.smart_link_role then
    -- Admin cannot silently alter farmer listing quantity, price, storage, or accounting fields
    if new.quantity_kg <> old.quantity_kg
       or new.asking_price_php_per_kg <> old.asking_price_php_per_kg
       or new.storage_condition <> old.storage_condition
       or new.outreach_priority <> old.outreach_priority then
      raise exception 'Admin cannot modify farmer listing quantity, price, storage, or outreach priority.';
    end if;

    if new.earmarked_kg = old.earmarked_kg
       and new.reserved_kg = old.reserved_kg
       and new.allocated_kg = old.allocated_kg
       and new.delivered_kg = old.delivered_kg then
      -- Admin verification or fraud-closure transition
      if old.status = 'pending_verification' and new.status in ('available', 'rejected') then
        if new.reviewed_by is distinct from v_caller_uid or new.reviewed_at is null then
          raise exception 'Admin review must record the authenticated admin ID and timestamp.';
        end if;
      elsif new.status = 'closed' and old.allocated_kg = 0 then
        null;
      elsif new.status <> old.status then
        raise exception 'Invalid Admin harvest listing status transition from % to %.', old.status, new.status;
      end if;
    end if;

  elsif v_caller_uid is not null and v_caller_role = 'market'::public.smart_link_role then
    -- Markets can only trigger accounting updates indirectly through authorized SECURITY DEFINER RPCs
    if new.quantity_kg <> old.quantity_kg
       or new.asking_price_php_per_kg <> old.asking_price_php_per_kg
       or new.storage_condition <> old.storage_condition
       or new.outreach_priority <> old.outreach_priority
       or new.reviewed_by is distinct from old.reviewed_by then
      raise exception 'Market accounts cannot modify farmer harvest listing attributes.';
    end if;
  elsif v_caller_uid is not null then
    raise exception 'Role % is not authorized to update harvest listings.', v_caller_role;
  end if;

  return new;
end;
$$;
revoke all on function smart_link_private.enforce_harvest_listing_lifecycle() from public, anon, authenticated;

-- Market demand lifecycle trigger:
-- Enforces that only an active, Admin-VERIFIED Market account can own or create open market demands.
create or replace function smart_link_private.enforce_market_demand_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_role public.smart_link_role;
  v_owner_status text;
  v_owner_verification text;
begin
  select role, account_status, market_verification_status
    into v_owner_role, v_owner_status, v_owner_verification
    from public.profiles
   where id = new.market_id;

  if v_owner_role is distinct from 'market'::public.smart_link_role or v_owner_status <> 'active' then
    raise exception 'Market demands must be owned by an active market profile.';
  end if;

  if tg_op = 'INSERT' then
    -- Legacy migration inserts closed demands with legacy_processor_requirement_id set;
    -- All new live demands MUST belong to an Admin-verified Market account!
    if new.legacy_processor_requirement_id is null then
      if v_owner_verification <> 'verified' then
        raise exception 'Unverified Market accounts (status: %) cannot post active crop demands. Await Admin verification.',
          v_owner_verification;
      end if;
      if new.required_by < (now() at time zone 'Asia/Manila')::date then
        raise exception 'Market demand required_by date cannot be in the past (Asia/Manila).';
      end if;
      if new.reserved_quantity_kg <> 0 or new.fulfilled_quantity_kg <> 0 then
        raise exception 'New market demands must start with 0 reserved and 0 fulfilled quantity.';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE protections
  if new.id <> old.id
     or new.market_id <> old.market_id
     or new.crop <> old.crop
     or new.municipality <> old.municipality
     or new.created_at <> old.created_at then
    raise exception 'Immutable market demand attributes (id, market_id, crop, municipality) cannot be modified.';
  end if;

  if new.required_quantity_kg < (new.reserved_quantity_kg + new.fulfilled_quantity_kg) then
    raise exception 'Required demand (%) cannot be reduced below reserved + fulfilled quantity (%).',
      new.required_quantity_kg, (new.reserved_quantity_kg + new.fulfilled_quantity_kg);
  end if;

  if new.status = 'cancelled' and old.reserved_quantity_kg > 0 then
    raise exception 'Cannot cancel market demand while % kg is actively reserved; cancel or complete active allocations first.',
      old.reserved_quantity_kg;
  end if;

  new.updated_at := now();
  return new;
end;
$$;
revoke all on function smart_link_private.enforce_market_demand_lifecycle() from public, anon, authenticated;

drop trigger if exists trg_enforce_market_demand_lifecycle on public.market_demands;
create trigger trg_enforce_market_demand_lifecycle
before insert or update on public.market_demands
for each row execute function smart_link_private.enforce_market_demand_lifecycle();

-- ============================================================================
-- 7. ATOMIC SECURITY-DEFINER RPCs (ADMIN, MARKET & FARMER WORKFLOWS)
-- ============================================================================

-- 7A. Update review_harvest_listing so ONLY an active Admin can verify/reject harvest listings,
--     and every decision is logged to public.audit_logs.
create or replace function public.review_harvest_listing(
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
  if v_caller_role is distinct from 'admin'::public.smart_link_role then
    raise exception 'Unauthorized: only an active Admin may approve or reject harvest listings.';
  end if;

  if p_decision is null or p_decision not in ('available', 'rejected') then
    raise exception 'Invalid review decision (%): must be available (verified/published) or rejected.', p_decision;
  end if;

  v_clean_notes := coalesce(btrim(p_review_notes), '');
  if char_length(v_clean_notes) > 1000 then
    raise exception 'Review notes cannot exceed 1000 characters.';
  end if;
  if p_decision = 'rejected' and char_length(v_clean_notes) = 0 then
    raise exception 'Review notes are required when rejecting a harvest listing.';
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

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, reason, metadata
  ) values (
    v_caller_uid,
    'admin',
    case when p_decision = 'available' then 'HARVEST_LISTING_APPROVED' else 'HARVEST_LISTING_REJECTED' end,
    'harvest_listing',
    p_listing_id,
    v_clean_notes,
    jsonb_build_object(
      'previous_status', v_current_status,
      'new_status', p_decision,
      'quantity_kg', v_result.quantity_kg,
      'crop', v_result.crop
    )
  );

  return v_result;
end;
$$;
revoke all on function public.review_harvest_listing(uuid, text, text) from public, anon;
grant execute on function public.review_harvest_listing(uuid, text, text) to authenticated;

-- 7B. Safe Self-Registration Profile RPC for Farmer or Market (pending_verification):
--     Allows a newly authenticated user without a profile row to create either:
--     - role = 'farmer' (active, market_verification_status = 'not_applicable'), OR
--     - role = 'market' (active, market_verification_status = 'pending_verification' ALWAYS).
--     NEVER allows 'admin', 'coordinator', or 'processor'.
create or replace function public.register_account_profile(
  p_account_role text,
  p_display_name text,
  p_municipality public.smart_link_municipality,
  p_market_type text default null,
  p_organization_name text default ''
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_uid uuid;
  v_clean_name text;
  v_clean_org text;
  v_role public.smart_link_role;
  v_market_type text := null;
  v_verif_status text := 'not_applicable';
  v_existing public.profiles;
  v_result public.profiles;
begin
  v_caller_uid := (select auth.uid());
  if v_caller_uid is null then
    raise exception 'Authentication required to register a profile.';
  end if;

  select * into v_existing from public.profiles where id = v_caller_uid for update;
  if found then
    raise exception 'Profile already exists for this account (role: %). Role cannot be self-modified.', v_existing.role;
  end if;

  v_clean_name := btrim(coalesce(p_display_name, ''));
  if char_length(v_clean_name) < 1 or char_length(v_clean_name) > 100 then
    raise exception 'Display name must be between 1 and 100 characters.';
  end if;

  if lower(btrim(coalesce(p_account_role, ''))) = 'farmer' then
    v_role := 'farmer'::public.smart_link_role;
    v_verif_status := 'not_applicable';
  elsif lower(btrim(coalesce(p_account_role, ''))) = 'market' then
    v_role := 'market'::public.smart_link_role;
    -- Strictly enforce pending_verification for all newly registered Market accounts
    v_verif_status := 'pending_verification';
    v_market_type := lower(btrim(coalesce(p_market_type, 'public_market')));
    if v_market_type not in ('public_market', 'retail_buyer', 'cooperative', 'food_processor', 'institutional_buyer') then
      raise exception 'Invalid market_type (%). Choose public_market, retail_buyer, cooperative, food_processor, or institutional_buyer.',
        v_market_type;
    end if;
    v_clean_org := btrim(coalesce(p_organization_name, ''));
    if v_clean_org = '' then
      v_clean_org := v_clean_name;
    end if;
  else
    raise exception 'Unauthorized role registration attempt (%). Only farmer or market accounts can self-register.',
      p_account_role;
  end if;

  insert into public.profiles (
    id,
    display_name,
    municipality,
    role,
    account_status,
    market_type,
    organization_name,
    market_verification_status
  ) values (
    v_caller_uid,
    v_clean_name,
    p_municipality,
    v_role,
    'active',
    v_market_type,
    coalesce(v_clean_org, ''),
    v_verif_status
  ) returning * into v_result;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, reason, metadata
  ) values (
    v_caller_uid,
    v_role::text,
    'PROFILE_REGISTERED',
    'profile',
    v_caller_uid,
    'Self-registered account profile.',
    jsonb_build_object(
      'role', v_role,
      'market_type', v_market_type,
      'market_verification_status', v_verif_status
    )
  );

  return v_result;
end;
$$;
revoke all on function public.register_account_profile(text, text, public.smart_link_municipality, text, text) from public, anon;
grant execute on function public.register_account_profile(text, text, public.smart_link_municipality, text, text) to authenticated;

-- 7C. Admin Verification of Market Accounts:
--     Only an active Admin can verify, reject, or suspend a Market account.
create or replace function public.admin_verify_market_account(
  p_market_id uuid,
  p_decision text,
  p_notes text default ''
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_uid uuid;
  v_caller_role public.smart_link_role;
  v_target public.profiles;
  v_clean_notes text;
  v_result public.profiles;
begin
  v_caller_uid := (select auth.uid());
  if v_caller_uid is null then
    raise exception 'Authentication required.';
  end if;

  v_caller_role := smart_link_private.current_role();
  if v_caller_role is distinct from 'admin'::public.smart_link_role then
    raise exception 'Unauthorized: only an active Admin can verify or reject Market accounts.';
  end if;

  if p_decision is null or p_decision not in ('verified', 'rejected', 'suspended') then
    raise exception 'Invalid decision (%): must be verified, rejected, or suspended.', p_decision;
  end if;

  v_clean_notes := btrim(coalesce(p_notes, ''));
  if p_decision in ('rejected', 'suspended') and char_length(v_clean_notes) = 0 then
    raise exception 'A reason is required when rejecting or suspending a Market account.';
  end if;

  select * into v_target
    from public.profiles
   where id = p_market_id
     for update;

  if not found then
    raise exception 'Market profile (%) not found.', p_market_id;
  end if;

  if v_target.role is distinct from 'market'::public.smart_link_role then
    raise exception 'Profile (%) is not a Market account (role: %).', p_market_id, v_target.role;
  end if;

  update public.profiles
     set market_verification_status = p_decision,
         verified_by = v_caller_uid,
         verified_at = now(),
         verification_notes = v_clean_notes
   where id = p_market_id
  returning * into v_result;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, reason, metadata
  ) values (
    v_caller_uid,
    'admin',
    'MARKET_VERIFICATION_' || upper(p_decision),
    'profile',
    p_market_id,
    v_clean_notes,
    jsonb_build_object(
      'previous_verification_status', v_target.market_verification_status,
      'new_verification_status', p_decision,
      'market_type', v_target.market_type
    )
  );

  return v_result;
end;
$$;
revoke all on function public.admin_verify_market_account(uuid, text, text) from public, anon;
grant execute on function public.admin_verify_market_account(uuid, text, text) to authenticated;

-- 7D. Admin Resolution of Quarantined Legacy Coordinator Accounts:
--     Allows an Admin to explicitly review a quarantined former Coordinator and assign them to
--     'farmer', 'market' (pending_verification), or keep them 'suspended', with full audit trail.
create or replace function public.admin_resolve_legacy_account(
  p_profile_id uuid,
  p_new_role text,
  p_market_type text default null,
  p_resolution_notes text default ''
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_uid uuid;
  v_caller_role public.smart_link_role;
  v_target public.profiles;
  v_clean_notes text;
  v_assigned_role public.smart_link_role;
  v_assigned_market_type text := null;
  v_verif_status text := 'not_applicable';
  v_result public.profiles;
begin
  v_caller_uid := (select auth.uid());
  v_caller_role := smart_link_private.current_role();
  if v_caller_uid is null or v_caller_role is distinct from 'admin'::public.smart_link_role then
    raise exception 'Unauthorized: only an active Admin can resolve quarantined legacy accounts.';
  end if;

  v_clean_notes := btrim(coalesce(p_resolution_notes, ''));
  if char_length(v_clean_notes) = 0 then
    raise exception 'Resolution notes are required for audit logging.';
  end if;

  select * into v_target from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'Profile (%) not found.', p_profile_id;
  end if;

  if v_target.legacy_role is null then
    raise exception 'Profile (%) is not a legacy migrated account.', p_profile_id;
  end if;

  if p_new_role = 'farmer' then
    v_assigned_role := 'farmer'::public.smart_link_role;
    v_verif_status := 'not_applicable';
  elsif p_new_role = 'market' then
    v_assigned_role := 'market'::public.smart_link_role;
    v_assigned_market_type := coalesce(p_market_type, 'cooperative');
    v_verif_status := 'pending_verification';
  else
    raise exception 'Legacy accounts can only be resolved to farmer or market through this workflow.';
  end if;

  update public.profiles
     set role = v_assigned_role,
         account_status = 'active',
         market_type = v_assigned_market_type,
         organization_name = case when v_assigned_role = 'market'::public.smart_link_role then display_name else '' end,
         market_verification_status = v_verif_status,
         verified_by = v_caller_uid,
         verified_at = now(),
         verification_notes = v_clean_notes
   where id = p_profile_id
  returning * into v_result;

  update public.legacy_role_migration_quarantine
     set new_role = v_assigned_role,
         migration_disposition = 'admin_reviewed_and_resolved',
         resolved_by = v_caller_uid,
         resolved_at = now(),
         resolution_notes = v_clean_notes
   where profile_id = p_profile_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, reason, metadata
  ) values (
    v_caller_uid,
    'admin',
    'LEGACY_ACCOUNT_RESOLVED',
    'profile',
    p_profile_id,
    v_clean_notes,
    jsonb_build_object(
      'legacy_role', v_target.legacy_role,
      'assigned_role', v_assigned_role,
      'market_verification_status', v_verif_status
    )
  );

  return v_result;
end;
$$;
revoke all on function public.admin_resolve_legacy_account(uuid, text, text, text) from public, anon;
grant execute on function public.admin_resolve_legacy_account(uuid, text, text, text) to authenticated;

-- 7E. Farmer Allocates / Offers Harvest Quantity to a Market Demand:
--     Supports splitting 1 harvest across N markets (e.g., 100 kg -> 40 kg Market 1 + 35 kg Market 2 + 25 kg Market 3).
--     Acquires row locks in deterministic order (harvest_listings -> market_demands).
create or replace function public.allocate_harvest_to_demand(
  p_harvest_listing_id uuid,
  p_market_demand_id uuid,
  p_quantity_kg numeric,
  p_agreed_price_php_per_kg numeric default null,
  p_offer_notes text default '',
  p_idempotency_key uuid default gen_random_uuid()
)
returns public.supply_allocations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_uid uuid;
  v_caller_role public.smart_link_role;
  v_listing public.harvest_listings;
  v_demand public.market_demands;
  v_market_verif text;
  v_market_status text;
  v_price numeric(12,2);
  v_existing public.supply_allocations;
  v_result public.supply_allocations;
begin
  v_caller_uid := (select auth.uid());
  v_caller_role := smart_link_private.current_role();
  if v_caller_uid is null or v_caller_role is distinct from 'farmer'::public.smart_link_role then
    raise exception 'Unauthorized: only an active Farmer account can allocate harvest quantities to a market demand.';
  end if;

  if p_quantity_kg is null or p_quantity_kg <= 0 or p_quantity_kg > 1000000 then
    raise exception 'Allocation quantity must be greater than 0 and at most 1,000,000 kg.';
  end if;

  if p_idempotency_key is null then
    raise exception 'An idempotency key is required for harvest allocation requests.';
  end if;

  -- Serialize retries that use the same key. Without this transaction-scoped lock,
  -- two concurrent identical requests can both miss the pre-insert lookup and one
  -- will fail with a raw unique-constraint error instead of returning the first result.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text, 0)
  );

  -- Idempotency check
  select * into v_existing
    from public.supply_allocations
   where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.farmer_id <> v_caller_uid
       or v_existing.harvest_listing_id <> p_harvest_listing_id
       or v_existing.market_demand_id <> p_market_demand_id
       or v_existing.allocated_quantity_kg <> p_quantity_kg then
      raise exception 'Idempotency key was already used for a different allocation request.';
    end if;
    return v_existing;
  end if;

  -- 1. Lock harvest_listing first
  select * into v_listing
    from public.harvest_listings
   where id = p_harvest_listing_id
     for update;

  if not found then
    raise exception 'Harvest listing (%) not found.', p_harvest_listing_id;
  end if;

  if v_listing.farmer_id <> v_caller_uid then
    raise exception 'Farmers can only allocate quantities from their own harvest listings.';
  end if;

  if v_listing.status <> 'available' then
    raise exception 'Harvest listing must be verified and available (current status: %) before allocating to markets.',
      v_listing.status;
  end if;

  if p_quantity_kg > v_listing.remaining_kg then
    raise exception 'Allocation quantity (% kg) exceeds your remaining available harvest (% kg out of % kg total).',
      p_quantity_kg, v_listing.remaining_kg, v_listing.quantity_kg;
  end if;

  -- 2. Lock market_demand second
  select * into v_demand
    from public.market_demands
   where id = p_market_demand_id
     for update;

  if not found then
    raise exception 'Market demand (%) not found.', p_market_demand_id;
  end if;

  select account_status, market_verification_status
    into v_market_status, v_market_verif
    from public.profiles
   where id = v_demand.market_id;

  if v_market_status <> 'active' or v_market_verif <> 'verified' then
    raise exception 'Cannot allocate supply to an unverified or inactive Market account.';
  end if;

  if v_demand.status not in ('open', 'partially_fulfilled') then
    raise exception 'Market demand is no longer open for offers (current status: %).', v_demand.status;
  end if;

  if v_demand.required_by < (now() at time zone 'Asia/Manila')::date then
    raise exception 'Cannot allocate supply to an expired market demand (required_by: %).', v_demand.required_by;
  end if;

  if v_listing.crop <> v_demand.crop then
    raise exception 'Crop mismatch: harvest listing is % but market demand requires %.',
      v_listing.crop, v_demand.crop;
  end if;

  if p_quantity_kg > v_demand.remaining_demand_kg then
    raise exception 'Offer quantity (% kg) exceeds the Market''s remaining unfulfilled demand (% kg).',
      p_quantity_kg, v_demand.remaining_demand_kg;
  end if;

  if not v_demand.accept_partial and p_quantity_kg <> v_demand.remaining_demand_kg then
    raise exception 'This Market demand does not accept partial quantities; you must offer the full remaining % kg.',
      v_demand.remaining_demand_kg;
  end if;

  v_price := coalesce(p_agreed_price_php_per_kg, v_demand.offered_price_php_per_kg);
  if v_price < 0 or v_price > 1000000 then
    raise exception 'Agreed price per kg must be between 0 and 1,000,000 PHP.';
  end if;

  insert into public.supply_allocations (
    harvest_listing_id,
    market_demand_id,
    farmer_id,
    market_id,
    crop,
    allocated_quantity_kg,
    delivered_quantity_kg,
    released_quantity_kg,
    agreed_price_php_per_kg,
    status,
    offer_notes,
    idempotency_key
  ) values (
    p_harvest_listing_id,
    p_market_demand_id,
    v_caller_uid,
    v_demand.market_id,
    v_listing.crop,
    p_quantity_kg,
    0,
    0,
    v_price,
    'pending_acceptance',
    btrim(coalesce(p_offer_notes, '')),
    p_idempotency_key
  ) returning * into v_result;

  -- Synchronize listing earmarked_kg / allocated_kg
  perform smart_link_private.recompute_inventory_and_demand(p_harvest_listing_id, p_market_demand_id);

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, reason, metadata
  ) values (
    v_caller_uid,
    'farmer',
    'SUPPLY_OFFER_SUBMITTED',
    'supply_allocation',
    v_result.id,
    btrim(coalesce(p_offer_notes, '')),
    jsonb_build_object(
      'harvest_listing_id', p_harvest_listing_id,
      'market_demand_id', p_market_demand_id,
      'allocated_quantity_kg', p_quantity_kg,
      'status', 'pending_acceptance'
    )
  );

  return v_result;
end;
$$;
revoke all on function public.allocate_harvest_to_demand(uuid, uuid, numeric, numeric, text, uuid) from public, anon;
grant execute on function public.allocate_harvest_to_demand(uuid, uuid, numeric, numeric, text, uuid) to authenticated;

-- 7F. Verified Market Responds to Supply Offer (Accept -> 'reserved' | Reject -> 'rejected'):
--     Atomically locks harvest_listings -> market_demands -> supply_allocations.
--     Re-validates Market remaining_demand_kg at acceptance time so concurrent Farmer offers
--     can NEVER over-reserve the Market's required_quantity_kg!
--     If rejected, releases the earmarked quantity back to the Farmer's remaining_kg immediately.
create or replace function public.respond_to_supply_allocation(
  p_allocation_id uuid,
  p_decision text,
  p_response_notes text default ''
)
returns public.supply_allocations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_uid uuid;
  v_alloc public.supply_allocations;
  v_listing public.harvest_listings;
  v_demand public.market_demands;
  v_clean_notes text;
  v_result public.supply_allocations;
begin
  v_caller_uid := (select auth.uid());
  if v_caller_uid is null or not smart_link_private.is_verified_market() then
    raise exception 'Unauthorized: only an active, Admin-verified Market account can accept or reject supply offers.';
  end if;

  if p_decision is null or p_decision not in ('reserved', 'rejected') then
    raise exception 'Invalid decision (%): must be reserved (accept) or rejected.', p_decision;
  end if;

  v_clean_notes := btrim(coalesce(p_response_notes, ''));

  -- Lookup allocation IDs first, then lock in deterministic order: listing -> demand -> allocation
  select * into v_alloc
    from public.supply_allocations
   where id = p_allocation_id;

  if not found then
    raise exception 'Supply allocation (%) not found.', p_allocation_id;
  end if;

  if v_alloc.market_id <> v_caller_uid then
    raise exception 'Markets can only respond to supply offers directed to their own crop demands.';
  end if;

  select * into v_listing
    from public.harvest_listings
   where id = v_alloc.harvest_listing_id
     for update;

  select * into v_demand
    from public.market_demands
   where id = v_alloc.market_demand_id
     for update;

  select * into v_alloc
    from public.supply_allocations
   where id = p_allocation_id
     for update;

  if v_alloc.status not in ('proposed', 'pending_acceptance') then
    raise exception 'Supply allocation (%) cannot be accepted/rejected because its current status is %.',
      p_allocation_id, v_alloc.status;
  end if;

  if p_decision = 'reserved' then
    if v_demand.status not in ('open', 'partially_fulfilled') then
      raise exception 'Market demand is no longer open for reservations (status: %).', v_demand.status;
    end if;

    -- Atomic capacity re-validation at acceptance time (prevents race condition when multiple farmers offer to same market)
    if v_alloc.allocated_quantity_kg > v_demand.remaining_demand_kg then
      raise exception 'Cannot accept % kg offer: Market demand only has % kg unfulfilled capacity remaining.',
        v_alloc.allocated_quantity_kg, v_demand.remaining_demand_kg;
    end if;

    update public.supply_allocations
       set status = 'reserved',
           response_notes = v_clean_notes,
           responded_at = now(),
           updated_at = now()
     where id = p_allocation_id
    returning * into v_result;
  else
    -- Rejected: release the entire allocated_quantity_kg back to Farmer's remaining_kg
    update public.supply_allocations
       set status = 'rejected',
           released_quantity_kg = allocated_quantity_kg,
           response_notes = v_clean_notes,
           responded_at = now(),
           completed_at = now(),
           updated_at = now()
     where id = p_allocation_id
    returning * into v_result;
  end if;

  perform smart_link_private.recompute_inventory_and_demand(
    v_alloc.harvest_listing_id,
    v_alloc.market_demand_id
  );

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, reason, metadata
  ) values (
    v_caller_uid,
    'market',
    case when p_decision = 'reserved' then 'SUPPLY_OFFER_ACCEPTED_RESERVED' else 'SUPPLY_OFFER_REJECTED' end,
    'supply_allocation',
    p_allocation_id,
    v_clean_notes,
    jsonb_build_object(
      'harvest_listing_id', v_alloc.harvest_listing_id,
      'market_demand_id', v_alloc.market_demand_id,
      'quantity_kg', v_alloc.allocated_quantity_kg,
      'new_status', p_decision
    )
  );

  return v_result;
end;
$$;
revoke all on function public.respond_to_supply_allocation(uuid, text, text) from public, anon;
grant execute on function public.respond_to_supply_allocation(uuid, text, text) to authenticated;

-- 7G. Farmer Marks Reserved Allocation as 'in_delivery'
create or replace function public.mark_allocation_in_delivery(
  p_allocation_id uuid,
  p_notes text default ''
)
returns public.supply_allocations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_uid uuid;
  v_caller_role public.smart_link_role;
  v_alloc public.supply_allocations;
  v_result public.supply_allocations;
begin
  v_caller_uid := (select auth.uid());
  v_caller_role := smart_link_private.current_role();
  if v_caller_uid is null or v_caller_role is distinct from 'farmer'::public.smart_link_role then
    raise exception 'Unauthorized: only the owning Farmer can mark a reserved allocation as in_delivery.';
  end if;

  select * into v_alloc
    from public.supply_allocations
   where id = p_allocation_id
     for update;

  if not found then
    raise exception 'Supply allocation (%) not found.', p_allocation_id;
  end if;

  if v_alloc.farmer_id <> v_caller_uid then
    raise exception 'Farmers can only update their own supply allocations.';
  end if;

  if v_alloc.status <> 'reserved' then
    raise exception 'Only reserved allocations can transition to in_delivery (current status: %).', v_alloc.status;
  end if;

  update public.supply_allocations
     set status = 'in_delivery',
         offer_notes = case
           when btrim(coalesce(p_notes, '')) <> '' then btrim(p_notes)
           else offer_notes
         end,
         updated_at = now()
   where id = p_allocation_id
  returning * into v_result;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, reason, metadata
  ) values (
    v_caller_uid,
    'farmer',
    'ALLOCATION_MARKED_IN_DELIVERY',
    'supply_allocation',
    p_allocation_id,
    btrim(coalesce(p_notes, '')),
    jsonb_build_object('allocated_quantity_kg', v_alloc.allocated_quantity_kg)
  );

  return v_result;
end;
$$;
revoke all on function public.mark_allocation_in_delivery(uuid, text) from public, anon;
grant execute on function public.mark_allocation_in_delivery(uuid, text) to authenticated;

-- 7H. Market Confirms Actual Received Delivery (Full or Partial):
--     - Records an immutable row in public.delivery_records.
--     - Shifts received_quantity_kg out of reserved_kg and into delivered_kg / fulfilled_quantity_kg
--       (NEVER double-counting allocated_kg and delivered_kg!).
--     - If p_finalize_short_delivery = true when cumulative delivered < allocated_quantity_kg,
--       releases the unfulfilled remainder back to the Farmer's remaining_kg and Market's remaining_demand_kg.
create or replace function public.confirm_allocation_delivery(
  p_allocation_id uuid,
  p_received_quantity_kg numeric,
  p_finalize_short_delivery boolean default false,
  p_quality_grade_received text default 'Grade A',
  p_delivery_notes text default '',
  p_idempotency_key uuid default gen_random_uuid()
)
returns public.supply_allocations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_uid uuid;
  v_alloc public.supply_allocations;
  v_existing_rec public.delivery_records;
  v_outstanding numeric(12,3);
  v_new_delivered numeric(12,3);
  v_released_now numeric(12,3) := 0;
  v_new_released numeric(12,3);
  v_next_status text;
  v_result public.supply_allocations;
begin
  v_caller_uid := (select auth.uid());
  if v_caller_uid is null or not smart_link_private.is_verified_market() then
    raise exception 'Unauthorized: only an active, Admin-verified Market account can confirm crop delivery receipt.';
  end if;

  if p_received_quantity_kg is null or p_received_quantity_kg <= 0 then
    raise exception 'Received delivery quantity must be greater than 0 kg.';
  end if;

  if p_quality_grade_received not in ('Grade A', 'Grade B', 'Standard / Mixed') then
    raise exception 'Invalid quality grade (%).', p_quality_grade_received;
  end if;

  if p_idempotency_key is null then
    raise exception 'An idempotency key is required for delivery confirmation requests.';
  end if;

  -- Serialize same-key retries so a concurrent duplicate waits for and returns
  -- the first committed delivery result instead of racing the unique index.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text, 0)
  );

  -- Check idempotency key on delivery_records
  select * into v_existing_rec
    from public.delivery_records
   where idempotency_key = p_idempotency_key;
  if found then
    if v_existing_rec.confirmed_by <> v_caller_uid
       or v_existing_rec.allocation_id <> p_allocation_id
       or v_existing_rec.received_quantity_kg <> p_received_quantity_kg
       or v_existing_rec.quality_grade_received <> p_quality_grade_received then
      raise exception 'Idempotency key was already used for a different delivery confirmation request.';
    end if;
    select * into v_result from public.supply_allocations where id = v_existing_rec.allocation_id;
    return v_result;
  end if;

  select * into v_alloc from public.supply_allocations where id = p_allocation_id;
  if not found then
    raise exception 'Supply allocation (%) not found.', p_allocation_id;
  end if;

  if v_alloc.market_id <> v_caller_uid then
    raise exception 'Markets can only confirm deliveries for their own crop demands.';
  end if;

  -- Lock in deterministic hierarchy: harvest_listings -> market_demands -> supply_allocations
  perform 1 from public.harvest_listings where id = v_alloc.harvest_listing_id for update;
  perform 1 from public.market_demands where id = v_alloc.market_demand_id for update;
  select * into v_alloc from public.supply_allocations where id = p_allocation_id for update;

  if v_alloc.status not in ('reserved', 'in_delivery', 'partially_delivered') then
    raise exception 'Cannot confirm delivery for allocation (%) with status % (must be reserved, in_delivery, or partially_delivered).',
      p_allocation_id, v_alloc.status;
  end if;

  v_outstanding := v_alloc.allocated_quantity_kg - v_alloc.delivered_quantity_kg - v_alloc.released_quantity_kg;
  if p_received_quantity_kg > v_outstanding then
    raise exception 'Received quantity (% kg) exceeds outstanding undelivered allocation balance (% kg).',
      p_received_quantity_kg, v_outstanding;
  end if;

  v_new_delivered := v_alloc.delivered_quantity_kg + p_received_quantity_kg;

  if v_new_delivered = v_alloc.allocated_quantity_kg then
    v_next_status := 'delivered';
    v_released_now := 0;
  elsif p_finalize_short_delivery then
    -- Market & Farmer close the remaining unfulfilled balance after partial receipt
    v_next_status := 'delivered';
    v_released_now := v_alloc.allocated_quantity_kg - v_new_delivered - v_alloc.released_quantity_kg;
  else
    v_next_status := 'partially_delivered';
    v_released_now := 0;
  end if;

  v_new_released := v_alloc.released_quantity_kg + v_released_now;

  insert into public.delivery_records (
    allocation_id,
    harvest_listing_id,
    market_demand_id,
    confirmed_by,
    confirmed_by_role,
    received_quantity_kg,
    released_remainder_kg,
    quality_grade_received,
    delivery_notes,
    idempotency_key
  ) values (
    p_allocation_id,
    v_alloc.harvest_listing_id,
    v_alloc.market_demand_id,
    v_caller_uid,
    'market',
    p_received_quantity_kg,
    v_released_now,
    p_quality_grade_received,
    btrim(coalesce(p_delivery_notes, '')),
    p_idempotency_key
  );

  update public.supply_allocations
     set delivered_quantity_kg = v_new_delivered,
         released_quantity_kg = v_new_released,
         status = v_next_status,
         completed_at = case when v_next_status = 'delivered' then now() else completed_at end,
         updated_at = now()
   where id = p_allocation_id
  returning * into v_result;

  perform smart_link_private.recompute_inventory_and_demand(
    v_alloc.harvest_listing_id,
    v_alloc.market_demand_id
  );

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, reason, metadata
  ) values (
    v_caller_uid,
    'market',
    case when v_next_status = 'delivered' then 'DELIVERY_CONFIRMED_FINAL' else 'DELIVERY_CONFIRMED_PARTIAL' end,
    'supply_allocation',
    p_allocation_id,
    btrim(coalesce(p_delivery_notes, '')),
    jsonb_build_object(
      'received_quantity_kg', p_received_quantity_kg,
      'cumulative_delivered_kg', v_new_delivered,
      'released_remainder_kg', v_released_now,
      'new_status', v_next_status
    )
  );

  return v_result;
end;
$$;
revoke all on function public.confirm_allocation_delivery(uuid, numeric, boolean, text, text, uuid) from public, anon;
grant execute on function public.confirm_allocation_delivery(uuid, numeric, boolean, text, text, uuid) to authenticated;

-- 7I. Cancellation & Authorized Admin Dispute Resolution RPC:
--     - Farmers can cancel their own 'proposed' or 'pending_acceptance' offer before Market acceptance.
--     - Verified Markets or Farmers can cancel a 'reserved' allocation (before any partial delivery) with a reason.
--     - Admins can cancel/resolve a disputed allocation in ('pending_acceptance','reserved','in_delivery','partially_delivered'),
--       releasing ONLY the undelivered remainder (allocated_quantity_kg - delivered_quantity_kg - released_quantity_kg)
--       while preserving any already confirmed delivered_quantity_kg and writing an immutable audit log entry.
create or replace function public.cancel_or_resolve_supply_allocation(
  p_allocation_id uuid,
  p_reason text
)
returns public.supply_allocations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_uid uuid;
  v_caller_role public.smart_link_role;
  v_alloc public.supply_allocations;
  v_clean_reason text;
  v_undelivered_to_release numeric(12,3);
  v_result public.supply_allocations;
begin
  v_caller_uid := (select auth.uid());
  v_caller_role := smart_link_private.current_role();
  if v_caller_uid is null or v_caller_role is null then
    raise exception 'Authentication required.';
  end if;

  v_clean_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_clean_reason) = 0 then
    raise exception 'A cancellation or dispute resolution reason is required.';
  end if;

  select * into v_alloc from public.supply_allocations where id = p_allocation_id;
  if not found then
    raise exception 'Supply allocation (%) not found.', p_allocation_id;
  end if;

  -- Lock in deterministic hierarchy: harvest_listings -> market_demands -> supply_allocations
  perform 1 from public.harvest_listings where id = v_alloc.harvest_listing_id for update;
  perform 1 from public.market_demands where id = v_alloc.market_demand_id for update;
  select * into v_alloc from public.supply_allocations where id = p_allocation_id for update;

  if v_alloc.status in ('delivered', 'rejected', 'cancelled') then
    raise exception 'Supply allocation (%) is already in terminal status %.', p_allocation_id, v_alloc.status;
  end if;

  -- Re-check authorization and the now-current status only after acquiring the
  -- allocation lock. This closes a TOCTOU window where another transaction could
  -- move a reserved allocation into delivery/partial delivery between the old
  -- pre-lock authorization check and the cancellation update.
  if v_caller_role = 'farmer'::public.smart_link_role then
    if v_alloc.farmer_id <> v_caller_uid then
      raise exception 'Farmers can only cancel their own supply allocations.';
    end if;
    if v_alloc.status not in ('proposed', 'pending_acceptance', 'reserved') then
      raise exception 'Farmers cannot directly cancel an allocation once status is %; request Admin dispute resolution.',
        v_alloc.status;
    end if;
  elsif v_caller_role = 'market'::public.smart_link_role then
    if not smart_link_private.is_verified_market() or v_alloc.market_id <> v_caller_uid then
      raise exception 'Markets can only cancel allocations for their own crop demands.';
    end if;
    if v_alloc.status <> 'reserved' then
      raise exception 'Markets can use respond_to_supply_allocation to reject pending offers, or request Admin dispute resolution once in delivery.';
    end if;
  elsif v_caller_role = 'admin'::public.smart_link_role then
    -- Admin authorized dispute cancellation.
    null;
  else
    raise exception 'Unauthorized role (%).', v_caller_role;
  end if;

  -- Release ONLY the undelivered remainder (allocated - delivered - already_released)
  v_undelivered_to_release := v_alloc.allocated_quantity_kg - v_alloc.delivered_quantity_kg - v_alloc.released_quantity_kg;

  update public.supply_allocations
     set status = 'cancelled',
         released_quantity_kg = v_alloc.released_quantity_kg + v_undelivered_to_release,
         response_notes = v_clean_reason,
         completed_at = now(),
         updated_at = now()
   where id = p_allocation_id
  returning * into v_result;

  perform smart_link_private.recompute_inventory_and_demand(
    v_alloc.harvest_listing_id,
    v_alloc.market_demand_id
  );

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, reason, metadata
  ) values (
    v_caller_uid,
    v_caller_role::text,
    case when v_caller_role = 'admin'::public.smart_link_role then 'ADMIN_DISPUTE_ALLOCATION_CANCELLED' else 'ALLOCATION_CANCELLED' end,
    'supply_allocation',
    p_allocation_id,
    v_clean_reason,
    jsonb_build_object(
      'previous_status', v_alloc.status,
      'allocated_quantity_kg', v_alloc.allocated_quantity_kg,
      'delivered_quantity_kg_preserved', v_alloc.delivered_quantity_kg,
      'undelivered_quantity_kg_released', v_undelivered_to_release
    )
  );

  return v_result;
end;
$$;
revoke all on function public.cancel_or_resolve_supply_allocation(uuid, text) from public, anon;
grant execute on function public.cancel_or_resolve_supply_allocation(uuid, text) to authenticated;

-- ============================================================================
-- 8. ROW LEVEL SECURITY & PRIVILEGE GRANTS (3-ROLE MODEL: FARMER, MARKET, ADMIN)
-- ============================================================================

alter table public.market_demands enable row level security;
alter table public.supply_allocations enable row level security;
alter table public.delivery_records enable row level security;
alter table public.audit_logs enable row level security;
alter table public.legacy_role_migration_quarantine enable row level security;

revoke all on public.market_demands, public.supply_allocations, public.delivery_records,
  public.audit_logs, public.legacy_role_migration_quarantine from public, anon, authenticated;

grant select on public.market_demands, public.supply_allocations, public.delivery_records,
  public.audit_logs, public.legacy_role_migration_quarantine to authenticated;

-- Harvest listings: allow farmers to also specify unit, quality_grade, photo_url on insert/update
grant insert (farmer_id, crop, quantity_kg, unit, quality_grade, photo_url, asking_price_php_per_kg,
  harvest_date, municipality, barangay, storage_condition, outreach_priority, status)
  on public.harvest_listings to authenticated;
grant update (quantity_kg, quality_grade, photo_url, asking_price_php_per_kg,
  storage_condition, outreach_priority, status)
  on public.harvest_listings to authenticated;

-- Market demands: verified markets can insert new demands and update notes/status/required_quantity_kg/price
-- (accounting columns reserved_quantity_kg and fulfilled_quantity_kg are NEVER directly insertable/updatable by clients)
grant insert (market_id, crop, required_quantity_kg, unit, preferred_quality_grade,
  offered_price_php_per_kg, municipality, barangay, delivery_location_text,
  required_by, accept_partial, quality_notes, status)
  on public.market_demands to authenticated;
grant update (required_quantity_kg, preferred_quality_grade, offered_price_php_per_kg,
  barangay, delivery_location_text, accept_partial, quality_notes, status)
  on public.market_demands to authenticated;

-- Replace Phase 2A policies with strict 3-role (Farmer, Market, Admin) policies

-- 8A. PROFILES POLICIES
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select smart_link_private.current_role()) = 'admin'
  or (
    -- Farmers and Verified Markets can see verified Market directory entries & counterpart names
    (select smart_link_private.current_role()) in ('farmer', 'market')
    and (
      (role = 'market' and market_verification_status = 'verified' and account_status = 'active')
      or exists (
        select 1
          from public.supply_allocations sa
         where (sa.farmer_id = profiles.id and sa.market_id = (select auth.uid()))
            or (sa.market_id = profiles.id and sa.farmer_id = (select auth.uid()))
      )
    )
  )
);

drop policy if exists profiles_create_self on public.profiles;
create policy profiles_create_self on public.profiles for insert to authenticated
with check (
  id = (select auth.uid())
  and role = 'farmer'
  and account_status = 'active'
  and market_verification_status = 'not_applicable'
);

drop policy if exists profiles_edit_self on public.profiles;
create policy profiles_edit_self on public.profiles for update to authenticated
using (
  id = (select auth.uid())
  and (select smart_link_private.current_role()) in ('farmer', 'market', 'admin')
)
with check (
  id = (select auth.uid())
  and role = (select smart_link_private.current_role())
  and account_status = 'active'
);

-- 8B. HARVEST LISTINGS POLICIES
drop policy if exists harvests_read on public.harvest_listings;
create policy harvests_read on public.harvest_listings for select to authenticated
using (
  (farmer_id = (select auth.uid()) and (select smart_link_private.current_role()) = 'farmer')
  or (select smart_link_private.current_role()) = 'admin'
  or (status = 'available' and (select smart_link_private.is_verified_market()))
);

drop policy if exists harvests_create_self on public.harvest_listings;
create policy harvests_create_self on public.harvest_listings for insert to authenticated
with check (
  farmer_id = (select auth.uid())
  and (select smart_link_private.current_role()) = 'farmer'
  and status in ('draft', 'pending_verification')
);

drop policy if exists harvests_edit_self on public.harvest_listings;
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

-- 8C. MARKET DEMANDS POLICIES
drop policy if exists market_demands_read on public.market_demands;
create policy market_demands_read on public.market_demands for select to authenticated
using (
  (market_id = (select auth.uid()) and (select smart_link_private.current_role()) = 'market')
  or (select smart_link_private.current_role()) = 'admin'
  or (
    status in ('open', 'partially_fulfilled')
    and (select smart_link_private.current_role()) in ('farmer', 'market')
    and exists (
      select 1
        from public.profiles mp
       where mp.id = market_demands.market_id
         and mp.account_status = 'active'
         and mp.role = 'market'
         and mp.market_verification_status = 'verified'
    )
  )
);

drop policy if exists market_demands_create_self on public.market_demands;
create policy market_demands_create_self on public.market_demands for insert to authenticated
with check (
  market_id = (select auth.uid())
  and (select smart_link_private.is_verified_market())
  and status = 'open'
);

drop policy if exists market_demands_edit_self on public.market_demands;
create policy market_demands_edit_self on public.market_demands for update to authenticated
using (
  market_id = (select auth.uid())
  and (select smart_link_private.is_verified_market())
)
with check (
  market_id = (select auth.uid())
  and (select smart_link_private.is_verified_market())
  and status in ('open', 'partially_fulfilled', 'fulfilled', 'cancelled', 'closed')
);

-- 8D. SUPPLY ALLOCATIONS POLICIES (Read via RLS; all writes go through atomic RPCs)
drop policy if exists supply_allocations_read on public.supply_allocations;
create policy supply_allocations_read on public.supply_allocations for select to authenticated
using (
  (farmer_id = (select auth.uid()) and (select smart_link_private.current_role()) = 'farmer')
  or (market_id = (select auth.uid()) and (select smart_link_private.current_role()) = 'market')
  or (select smart_link_private.current_role()) = 'admin'
);

-- 8E. DELIVERY RECORDS POLICIES (Read via RLS; all writes go through confirm_allocation_delivery RPC)
drop policy if exists delivery_records_read on public.delivery_records;
create policy delivery_records_read on public.delivery_records for select to authenticated
using (
  (select smart_link_private.current_role()) = 'admin'
  or exists (
    select 1
      from public.supply_allocations sa
     where sa.id = delivery_records.allocation_id
       and (
         (sa.farmer_id = (select auth.uid()) and (select smart_link_private.current_role()) = 'farmer')
         or (sa.market_id = (select auth.uid()) and (select smart_link_private.current_role()) = 'market')
       )
  )
);

-- 8F. AUDIT LOGS & LEGACY QUARANTINE POLICIES
drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs for select to authenticated
using (
  (select smart_link_private.current_role()) = 'admin'
  or actor_id = (select auth.uid())
);

drop policy if exists legacy_quarantine_admin_read on public.legacy_role_migration_quarantine;
create policy legacy_quarantine_admin_read on public.legacy_role_migration_quarantine for select to authenticated
using (
  (select smart_link_private.current_role()) = 'admin'
);

-- 8G. LOCK DOWN LEGACY PHASE 2A TABLES TO ACTIVE 3-ROLE MODEL (Preserve historical reads for Admin/Owner)
drop policy if exists requirements_read on public.processor_requirements;
create policy requirements_read on public.processor_requirements for select to authenticated
using (
  (select smart_link_private.current_role()) = 'admin'
  or processor_id = (select auth.uid())
);
drop policy if exists requirements_create_self on public.processor_requirements;
drop policy if exists requirements_edit_self on public.processor_requirements;

drop policy if exists batches_read on public.pooled_batches;
create policy batches_read on public.pooled_batches for select to authenticated
using ((select smart_link_private.current_role()) = 'admin');

drop policy if exists contributions_read on public.batch_contributions;
create policy contributions_read on public.batch_contributions for select to authenticated
using ((select smart_link_private.current_role()) = 'admin');

drop policy if exists reservations_read on public.reservations;
create policy reservations_read on public.reservations for select to authenticated
using ((select smart_link_private.current_role()) = 'admin');

commit;

