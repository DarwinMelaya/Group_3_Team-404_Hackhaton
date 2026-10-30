-- SMART-ANI / Agri - Migration 20261030000005
-- PER-KILO AND BULK MARKET BUYING ENGINE
--
-- Adds support for:
-- 1. Measurement units: 'kg', 'sack', 'crate', 'bunch', 'lot' across harvest listings,
--    market demands, supply allocations, and delivery records.
-- 2. Buying types: 'per_unit' (price per kg/sack/crate/bunch) and 'bulk_lot' (fixed lump-sum for the lot).
-- 3. Explicit agreed weight conversions (conversion_rate_kg) so package-based demands
--    never assume universal kg equivalents when deducting from kg inventory.
-- 4. Historical consistency: storing agreed unit, quantity, conversion details, and total price.
-- 5. Full backward compatibility: default unit is 'kg' and buying_type is 'per_unit',
--    preserving existing 100 kg -> 40 + 35 + 25 kg workflows without breaking changes.

begin;

-- ============================================================================
-- 1. EXTEND HARVEST LISTINGS UNIT CONSTRAINT & CONVERSION
-- ============================================================================

alter table public.harvest_listings
  drop constraint if exists harvest_listings_unit_grade_photo_check;

alter table public.harvest_listings
  add column if not exists conversion_rate_kg numeric(12,3)
    check (conversion_rate_kg is null or conversion_rate_kg > 0);

alter table public.harvest_listings
  add constraint harvest_listings_unit_grade_photo_check check (
    unit in ('kg', 'sack', 'crate', 'bunch', 'lot')
    and quality_grade in ('Grade A', 'Grade B', 'Standard / Mixed')
    and char_length(photo_url) <= 500
  );

comment on column public.harvest_listings.unit is
  'Measurement unit: kg, sack, crate, bunch, or lot. Defaults to kg.';
comment on column public.harvest_listings.conversion_rate_kg is
  'Optional verified measured weight in kg per unit (e.g. 50 kg/sack). Never assumed universally.';

-- ============================================================================
-- 2. EXTEND MARKET DEMANDS FOR PER-UNIT & BULK / FIXED-LOT BUYING
-- ============================================================================

alter table public.market_demands
  add column if not exists buying_type text not null default 'per_unit',
  add column if not exists unit_price_php numeric(12,2) not null default 0,
  add column if not exists total_price_php numeric(12,2) not null default 0,
  add column if not exists expected_kg_per_unit numeric(12,3);

-- Update existing rows so unit_price_php and total_price_php match offered_price_php_per_kg
update public.market_demands
   set unit_price_php = offered_price_php_per_kg,
       total_price_php = round(required_quantity_kg * offered_price_php_per_kg, 2)
 where unit_price_php = 0 and offered_price_php_per_kg > 0;

alter table public.market_demands
  drop constraint if exists market_demands_unit_check,
  drop constraint if exists market_demands_buying_type_check,
  drop constraint if exists market_demands_pricing_check;

alter table public.market_demands
  add constraint market_demands_unit_check check (
    unit in ('kg', 'sack', 'crate', 'bunch', 'lot')
  ),
  add constraint market_demands_buying_type_check check (
    buying_type in ('per_unit', 'bulk_lot')
  ),
  add constraint market_demands_pricing_check check (
    unit_price_php >= 0
    and total_price_php >= 0
    and (expected_kg_per_unit is null or expected_kg_per_unit > 0)
    and (
      (buying_type = 'per_unit' and total_price_php = round(required_quantity_kg * unit_price_php, 2))
      or (buying_type = 'bulk_lot' and total_price_php > 0)
    )
  );

comment on column public.market_demands.buying_type is
  'per_unit (price per kg/sack/crate/bunch) or bulk_lot (fixed lump-sum for the whole lot/quantity).';
comment on column public.market_demands.unit_price_php is
  'Offered price per unit if buying_type = per_unit.';
comment on column public.market_demands.total_price_php is
  'Total offered price in PHP. For bulk_lot, this is the fixed agreed lot price.';
comment on column public.market_demands.expected_kg_per_unit is
  'Optional expected weight per package unit. Never universally assumed without verification.';

-- ============================================================================
-- 3. EXTEND SUPPLY ALLOCATIONS FOR PACKAGED & BULK ALLOCATIONS
-- ============================================================================

alter table public.supply_allocations
  add column if not exists buying_type text not null default 'per_unit',
  add column if not exists unit text not null default 'kg',
  add column if not exists total_agreed_price numeric(12,2) not null default 0,
  add column if not exists conversion_ratio_to_kg numeric(12,3),
  add column if not exists deducted_inventory_quantity numeric(12,3) not null default 0;

-- Backfill existing allocations
update public.supply_allocations
   set total_agreed_price = round(allocated_quantity_kg * agreed_price_php_per_kg, 2),
       deducted_inventory_quantity = allocated_quantity_kg
 where total_agreed_price = 0 and allocated_quantity_kg > 0;

alter table public.supply_allocations
  drop constraint if exists supply_allocations_buying_type_check,
  drop constraint if exists supply_allocations_unit_check;

alter table public.supply_allocations
  add constraint supply_allocations_buying_type_check check (
    buying_type in ('per_unit', 'bulk_lot')
  ),
  add constraint supply_allocations_unit_check check (
    unit in ('kg', 'sack', 'crate', 'bunch', 'lot')
    and (conversion_ratio_to_kg is null or conversion_ratio_to_kg > 0)
    and deducted_inventory_quantity >= 0
    and total_agreed_price >= 0
  );

comment on column public.supply_allocations.buying_type is
  'per_unit or bulk_lot buying type for this allocation offer.';
comment on column public.supply_allocations.unit is
  'Measurement unit of the allocation (matches market demand unit).';
comment on column public.supply_allocations.total_agreed_price is
  'Total monetary value in PHP for this allocation.';
comment on column public.supply_allocations.conversion_ratio_to_kg is
  'Agreed kg per package unit when allocating to/from kg inventory. Null if both use matching units.';
comment on column public.supply_allocations.deducted_inventory_quantity is
  'Quantity deducted from the Farmer harvest listing in the listings own measurement unit.';

-- ============================================================================
-- 4. EXTEND DELIVERY RECORDS FOR BULK / UNIT TRACKING
-- ============================================================================

alter table public.delivery_records
  add column if not exists unit text not null default 'kg',
  add column if not exists delivered_inventory_quantity numeric(12,3) not null default 0,
  add column if not exists total_amount_paid numeric(12,2) not null default 0;

update public.delivery_records
   set delivered_inventory_quantity = received_quantity_kg
 where delivered_inventory_quantity = 0 and received_quantity_kg > 0;

alter table public.delivery_records
  drop constraint if exists delivery_records_unit_check;

alter table public.delivery_records
  add constraint delivery_records_unit_check check (
    unit in ('kg', 'sack', 'crate', 'bunch', 'lot')
    and delivered_inventory_quantity >= 0
    and total_amount_paid >= 0
  );

-- ============================================================================
-- 5. UPDATED RPC: allocate_harvest_to_demand WITH CONVERSION SAFETY
-- ============================================================================

create or replace function public.allocate_harvest_to_demand(
  p_harvest_listing_id uuid,
  p_market_demand_id uuid,
  p_allocated_quantity numeric,
  p_agreed_price numeric default null,
  p_conversion_ratio_to_kg numeric default null,
  p_offer_notes text default '',
  p_idempotency_key uuid default null
)
returns public.supply_allocations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid;
  v_caller_role public.smart_link_role;
  v_caller_status text;
  v_harvest public.harvest_listings;
  v_demand public.market_demands;
  v_allocation public.supply_allocations;
  v_idem_key uuid;
  v_deducted_qty numeric(12,3);
  v_unit_price numeric(12,2);
  v_total_price numeric(12,2);
  v_conv_ratio numeric(12,3);
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'AUTH_REQUIRED: authentication is required to allocate harvest to demand.';
  end if;

  select role, account_status
    into v_caller_role, v_caller_status
    from public.profiles
   where id = v_caller_id;

  if v_caller_role <> 'farmer'::public.smart_link_role or v_caller_status <> 'active' then
    raise exception 'UNAUTHORIZED_ROLE: only active Farmer accounts can create supply allocations.';
  end if;

  if p_allocated_quantity is null or p_allocated_quantity <= 0 or p_allocated_quantity > 1000000 then
    raise exception 'INVALID_QUANTITY: allocated quantity must be greater than 0 and at most 1,000,000.';
  end if;

  v_idem_key := coalesce(p_idempotency_key, gen_random_uuid());

  -- Idempotency check
  select *
    into v_allocation
    from public.supply_allocations
   where idempotency_key = v_idem_key;

  if found then
    return v_allocation;
  end if;

  -- Lock harvest listing
  select *
    into v_harvest
    from public.harvest_listings
   where id = p_harvest_listing_id
   for update;

  if not found then
    raise exception 'HARVEST_NOT_FOUND: harvest listing does not exist.';
  end if;

  if v_harvest.farmer_id <> v_caller_id then
    raise exception 'CROSS_USER_FORBIDDEN: you can only allocate your own harvest listings.';
  end if;

  if v_harvest.status <> 'available' then
    raise exception 'HARVEST_NOT_AVAILABLE: harvest listing must be verified by Admin (status=available). Current: %', v_harvest.status;
  end if;

  -- Lock market demand
  select *
    into v_demand
    from public.market_demands
   where id = p_market_demand_id
   for update;

  if not found then
    raise exception 'DEMAND_NOT_FOUND: market demand does not exist.';
  end if;

  if v_demand.status not in ('open', 'partially_fulfilled') then
    raise exception 'DEMAND_NOT_OPEN: market demand is not open for offers. Status: %', v_demand.status;
  end if;

  if not smart_link_private.is_verified_market(v_demand.market_id) then
    raise exception 'UNVERIFIED_MARKET: cannot allocate supply to an unverified or suspended Market.';
  end if;

  if v_harvest.crop <> v_demand.crop then
    raise exception 'CROP_MISMATCH: harvest crop (%) does not match market demand crop (%).', v_harvest.crop, v_demand.crop;
  end if;

  -- Unit compatibility & conversion validation
  if v_harvest.unit = v_demand.unit then
    v_deducted_qty := round(p_allocated_quantity::numeric, 3);
    v_conv_ratio := null;
  elsif v_harvest.unit = 'kg' and v_demand.unit in ('sack', 'crate', 'bunch', 'lot') then
    -- Converting kg inventory to package demand: requires explicit agreed conversion
    if p_conversion_ratio_to_kg is null or p_conversion_ratio_to_kg <= 0 then
      raise exception 'EXPLICIT_CONVERSION_REQUIRED: allocating kg inventory to % demand requires an explicit agreed conversion (kg per %). Standard weights cannot be assumed.', v_demand.unit, v_demand.unit;
    end if;
    v_conv_ratio := round(p_conversion_ratio_to_kg::numeric, 3);
    v_deducted_qty := round((p_allocated_quantity * v_conv_ratio)::numeric, 3);
  elsif v_harvest.unit in ('sack', 'crate', 'bunch', 'lot') and v_demand.unit = 'kg' then
    -- Converting package inventory to kg demand
    if p_conversion_ratio_to_kg is null or p_conversion_ratio_to_kg <= 0 then
      raise exception 'EXPLICIT_CONVERSION_REQUIRED: allocating % inventory to kg demand requires an explicit agreed conversion (kg per %).', v_harvest.unit, v_harvest.unit;
    end if;
    v_conv_ratio := round(p_conversion_ratio_to_kg::numeric, 3);
    v_deducted_qty := round((p_allocated_quantity / v_conv_ratio)::numeric, 3);
  else
    raise exception 'INCOMPATIBLE_UNITS: cannot allocate between % and % without direct compatible measurement.', v_harvest.unit, v_demand.unit;
  end if;

  -- Validate farmer inventory limit
  if v_deducted_qty > v_harvest.remaining_kg then
    raise exception 'OVER_ALLOCATION_PREVENTED: offer requires % % which exceeds remaining available inventory (% %).',
      v_deducted_qty, v_harvest.unit, v_harvest.remaining_kg, v_harvest.unit;
  end if;

  -- Validate market demand limit
  if p_allocated_quantity > v_demand.remaining_demand_kg then
    raise exception 'MARKET_DEMAND_EXCEEDED: offer (% %) exceeds remaining market demand (% %).',
      p_allocated_quantity, v_demand.unit, v_demand.remaining_demand_kg, v_demand.unit;
  end if;

  if not v_demand.accept_partial and p_allocated_quantity <> v_demand.remaining_demand_kg then
    raise exception 'PARTIAL_OFFER_REJECTED: market requires full quantity fulfillment of % %.',
      v_demand.remaining_demand_kg, v_demand.unit;
  end if;

  -- Pricing calculation
  if v_demand.buying_type = 'bulk_lot' then
    v_total_price := coalesce(p_agreed_price, v_demand.total_price_php);
    v_unit_price := round((v_total_price / p_allocated_quantity)::numeric, 2);
  else
    v_unit_price := coalesce(p_agreed_price, v_demand.unit_price_php, v_demand.offered_price_php_per_kg);
    v_total_price := round((p_allocated_quantity * v_unit_price)::numeric, 2);
  end if;

  -- Insert supply allocation
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
    idempotency_key,
    buying_type,
    unit,
    total_agreed_price,
    conversion_ratio_to_kg,
    deducted_inventory_quantity
  ) values (
    v_harvest.id,
    v_demand.id,
    v_caller_id,
    v_demand.market_id,
    v_harvest.crop,
    p_allocated_quantity,
    0,
    0,
    v_unit_price,
    'pending_acceptance',
    coalesce(btrim(p_offer_notes), ''),
    v_idem_key,
    v_demand.buying_type,
    v_demand.unit,
    v_total_price,
    v_conv_ratio,
    v_deducted_qty
  )
  returning * into v_allocation;

  -- Update farmer harvest inventory
  perform smart_link_private.recompute_inventory_and_demand(v_harvest.id, v_demand.id);

  -- Audit log
  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, reason, metadata
  ) values (
    v_caller_id,
    'farmer',
    'ALLOCATE_HARVEST_OFFERED',
    'supply_allocations',
    v_allocation.id,
    format('Offered %s %s (%s) from harvest %s to market demand %s (deducting %s %s).',
      v_allocation.allocated_quantity_kg, v_allocation.unit, v_allocation.buying_type,
      v_harvest.id, v_demand.id, v_deducted_qty, v_harvest.unit),
    jsonb_build_object(
      'allocated_quantity', p_allocated_quantity,
      'unit', v_demand.unit,
      'buying_type', v_demand.buying_type,
      'deducted_inventory_quantity', v_deducted_qty,
      'total_price', v_total_price
    )
  );

  return v_allocation;
end;
$$;

commit;

