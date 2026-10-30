# SMART-ANI · Agri Integration & Database Security Architecture (Phase 2A + Phase B)

Repository status: **Phase B 3-Role Demand-Driven Migrations (`Farmer`, `Market`, `Admin`) are prepared locally. The live `Agri` migration state is UNKNOWN until `tests/000_verify_live_schema.sql` is run and reviewed.**

## Canonical SQL Migration & Test Files

1. **Foundation Migration (Phase 2A):** [`migrations/20261029000001_smart_link_foundation.sql`](migrations/20261029000001_smart_link_foundation.sql)
2. **Optional Auth Trigger (Phase 2B):** [`migrations/20261029000002_auto_create_farmer_profile.sql`](migrations/20261029000002_auto_create_farmer_profile.sql)
3. **Phase B Step 1 — Add `'market'` Role Enum Value (Commit First):** [`migrations/20261030000003_add_market_role_enum.sql`](migrations/20261030000003_add_market_role_enum.sql)
4. **Phase B Step 2 — Demand-Driven Farmer, Market & Admin Schema, RLS & Atomic RPCs:** [`migrations/20261030000004_demand_driven_farmer_market_admin.sql`](migrations/20261030000004_demand_driven_farmer_market_admin.sql)
5. **Synchronized Phase B Proposal:** [`proposals/002_demand_driven_farmer_market_admin.sql`](proposals/002_demand_driven_farmer_market_admin.sql)
6. **Read-Only Live Schema Verification Query:** [`tests/000_verify_live_schema.sql`](tests/000_verify_live_schema.sql)
7. **Phase B Transactional Security, Accounting & Concurrency Test Suite:** [`tests/002_phase_b_demand_allocation_rls_tests.sql`](tests/002_phase_b_demand_allocation_rls_tests.sql)
8. **One-Time Initial Admin Provisioning (manual privileged proposal; never automatic):** [`proposals/003_one_time_initial_admin_provisioning.sql`](proposals/003_one_time_initial_admin_provisioning.sql)

Do not execute the migrations against the live Supabase project **Agri** until explicitly approved.

Run the read-only preflight first. If and only if it reports zero active Admin
profiles after Phase B is installed, review the one-time provisioning proposal.
It promotes one existing, email-confirmed, active Farmer account in the privileged
SQL Editor, refuses to run when another active Admin exists, and writes an audit
record. It must never be exposed as a public endpoint or frontend action.

---

## Official 3-Role Governance & Legacy Migration Safety

Active operational roles in `smart_link_private.current_role()`:
1. **`farmer`** — Posts harvests, views active market demands, allocates harvest quantities across one or more markets, marks allocations as `in_delivery`, and tracks remaining inventory.
2. **`market`** — Public markets, retail buyers, cooperatives, food processors, and institutional buyers (`profiles.market_type`). Newly registered Market accounts **always default to `market_verification_status = 'pending_verification'`** and cannot post active public demands or accept farmer supply offers until verified by an Admin.
3. **`admin`** — Verifies Market accounts, reviews pending harvest listings, monitors municipal supply/demand and audit logs, and resolves disputed allocations through auditable RPCs.

### Legacy Role Quarantine Rules
* **Former `coordinator` accounts:** Are **never** automatically promoted to `admin` and **never** silently converted into active `farmer` accounts. They are placed into `account_status = 'deactivated_pending_admin_review'` and recorded in `public.legacy_role_migration_quarantine` (where `smart_link_private.current_role()` returns `NULL`) until an Admin explicitly reviews and resolves them via `public.admin_resolve_legacy_account()`.
* **Former `processor` accounts:** Mapped to `role = 'market'`, `market_type = 'food_processor'`, `legacy_role = 'processor'`, and `market_verification_status = 'pending_verification'`. Historical `processor_requirements` rows are preserved and non-destructively copied into `public.market_demands`.

---

## Non-Double-Counted Inventory & Demand Accounting

### 1. Supply Allocation Balance (`public.supply_allocations`)
For each allocation row:
* `allocated_quantity_kg` ($A_i$): Initial quantity offered/allocated.
* `delivered_quantity_kg` ($D_i$): Cumulative quantity confirmed received by the Market.
* `released_quantity_kg` ($R_i$): Undelivered quantity released due to rejection, cancellation, or short-delivery closure.
* `outstanding_quantity_kg` (Generated): $U_i = A_i - D_i - R_i$, with constraint $D_i + R_i \le A_i$.

### 2. Farmer Harvest Inventory (`public.harvest_listings`)
* `earmarked_kg`: $\sum U_i$ for offers in `'proposed'` or `'pending_acceptance'`.
* `reserved_kg`: $\sum U_i$ for accepted allocations in `'reserved'`, `'in_delivery'`, or `'partially_delivered'`.
* `allocated_kg`: `earmarked_kg + reserved_kg` (Total outstanding undelivered committed quantity).
* `delivered_kg`: $\sum D_i$ across all allocations.
* `remaining_kg` (Generated): `quantity_kg - allocated_kg - delivered_kg`.
* **Constraint:** `allocated_kg + delivered_kg <= quantity_kg`.

### 3. Market Demand Capacity (`public.market_demands`)
* `reserved_quantity_kg`: $\sum U_i$ for accepted allocations in `'reserved'`, `'in_delivery'`, or `'partially_delivered'`. *(Pending offers do not lock Market demand until accepted).*
* `fulfilled_quantity_kg`: $\sum D_i$ across all allocations.
* `remaining_demand_kg` (Generated): `required_quantity_kg - reserved_quantity_kg - fulfilled_quantity_kg`.
* **Constraint:** `reserved_quantity_kg + fulfilled_quantity_kg <= required_quantity_kg`.
