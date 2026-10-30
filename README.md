# SMART-ANI

**SMART-ANI: An AI-Powered B2B Post-Harvest Exchange and Value-Addition Platform in Marinduque**  
Agriculture & Food Innovation · **Team 404: Sleep Not Found**

A demand-driven agricultural harvest distribution, multi-market quantity allocation, spoilage prevention, and value-addition platform connecting **Farmers**, **Markets** (Public Markets, Wet Markets/Retailers, Cooperatives, Food Processors, Institutional Buyers), and **Admins** across Marinduque (`Boac`, `Mogpog`, `Santa Cruz`, `Torrijos`, `Buenavista`, `Gasan`) for target crops (`Banana`, `Arrowroot / Uraro`, `Cassava`, `Sweet Potato / Camote`, `Coconut`, `Vegetables`).

---

## Official 3-Role System Architecture

1. **FARMER (`farmer`)**
   - Register and sign in on the Farmer Mobile App (`mobile/`) or Web Portal (`web/`).
   - Add harvest listings with crop type, quantity (`kg`), quality grade (`Grade A`, `Grade B`, `Processing Grade`), harvest date, municipality, barangay, storage condition, photo/crate reference, and outreach priority.
   - Save **Offline Harvest Drafts** locally with idempotency keys (`idempotencyKey`) to prevent duplicate submissions when syncing.
   - Browse active verified Market demands filtered by crop, municipality, offered price (`₱/kg`), and delivery deadline.
   - **Split-allocate a single harvest across multiple Markets** (e.g., `100 kg` Banana → `40 kg` Market 1 + `35 kg` Market 2 + `25 kg` Market 3 = `0 kg` remaining).
   - Track **Total**, **Offered (Earmarked)**, **Reserved (Accepted)**, **Confirmed Delivered**, and **Remaining Available (`kg`)** with zero double-counting, plus advisory **Spoilage Urgency** alerts.

2. **MARKET (`market`)**
   - Unified buyer role covering **Public Markets**, **Wet Markets / Retailers**, **Cooperatives**, **Food Processors**, and **Institutional Buyers** (replaces the legacy separate `processor` login role).
   - Newly registered Market accounts default to `market_verification_status = 'pending_verification'`. **Unverified Markets are strictly blocked from posting active public demands or accepting farmer supply offers** until verified by an Admin.
   - Post crop demands with crop type, required quantity (`kg`), preferred quality grade, offered price (`₱/kg`), delivery location, required delivery date, and `accept_partial` (`Yes`/`No`).
   - Receive and accept (`reserved`) or reject (`rejected`) offers from one or multiple farmers (e.g., `100 kg` demand fulfilled by `40 kg` Farmer A + `35 kg` Farmer B + `25 kg` Farmer C), with atomic capacity validation at acceptance time.
   - Confirm full or partial actual received quantities (`confirm_allocation_delivery`), automatically updating delivered and remaining demand quantities.

3. **ADMIN (`admin`)**
   - Consolidates former Coordinator verification duties with full system governance.
   - Verify or reject Market accounts (`admin_verify_market_account`) and Farmer harvest listings (`review_harvest_listing`).
   - Safely review and resolve **quarantined legacy Coordinator/Processor accounts** (`admin_resolve_legacy_account` on `public.legacy_role_migration_quarantine`) — legacy Coordinators are **never** auto-promoted to Admin and **never** silently converted into active Farmers.
   - Monitor municipal supply vs. demand analytics, active allocations, delivery records, disputes/cancellations (`cancel_or_resolve_supply_allocation`), and immutable **Audit Logs** (`public.audit_logs`).

---

## Top Priority End-to-End Demo Walkthrough (100 kg Banana → 40 + 35 + 25 kg)

You can run the complete 14-step scenario in either the **Farmer Mobile App** (`http://localhost:8081/transactions`) or the **Web Portal** (`http://127.0.0.1:3000/supply-pooling` & `/transactions`):

1. **Market 1 (Boac Public Market Stall 12)** posts demand `MKT-DEM-01` for `40 kg` Banana (`₱28/kg`).
2. **Market 2 (Mogpog Growers & Retailers Coop)** posts demand `MKT-DEM-02` for `35 kg` Banana (`₱27/kg`).
3. **Market 3 (Santa Cruz Banana Chips Hub)** posts demand `MKT-DEM-03` for `25 kg` Banana (`₱26/kg`).
4. **Farmer (Kuya Dante, Santa Cruz)** registers harvest `SA-001` of `100 kg` Grade A Banana (`₱25/kg`).
5. **Admin** verifies the harvest listing and Market accounts (`Market 1`, `Market 2`, `Market 3` are verified; unverified `Gasan Wet Market` is blocked until Admin clicks `✓ Verify Market`).
6. **Farmer** views matching Banana demands on `Supply Pooling` (web) or `Transactions` (mobile).
7. **Farmer** offers `40 kg` to Market 1 (`remaining_kg` becomes `60 kg`).
8. **Farmer** offers `35 kg` to Market 2 (`remaining_kg` becomes `25 kg`).
9. **Farmer** offers `25 kg` to Market 3 (`remaining_kg` becomes `0 kg`; any `+1 kg` offer is blocked).
10. **Each Market** accepts its respective offer (`status = 'reserved'`).
11. **Farmer remaining available quantity** stays `0 kg` (no double-counting between `earmarked_kg` and `reserved_kg`).
12. **Markets confirm actual deliveries** (`40 kg`, `35 kg`, `25 kg`) on `/transactions`.
13. **Farmer inventory** (`delivered_kg = 100 kg`, `allocated_kg = 0 kg`, `remaining_kg = 0 kg`) and **Market remaining demand** (`0 kg` on all three markets) update automatically.
14. **Admin** monitors all three transactions and their immutable entries in the Audit Trail.

---

## Database & Security Architecture (`supabase/` — Prepared for Project `Agri`)

Apply the SQL migrations in order in the Supabase SQL Editor (only when explicitly authorized for the live database):

1. [`supabase/tests/000_verify_live_schema.sql`](supabase/tests/000_verify_live_schema.sql) — 100% read-only inspection of current tables, enums, RLS policies, and legacy accounts.
2. [`supabase/migrations/20261029000001_smart_link_foundation.sql`](supabase/migrations/20261029000001_smart_link_foundation.sql) — Phase 1/2A base schema (if not yet applied).
3. [`supabase/migrations/20261029000002_auto_create_farmer_profile.sql`](supabase/migrations/20261029000002_auto_create_farmer_profile.sql) — Auth profile trigger.
4. [`supabase/migrations/20261030000003_add_market_role_enum.sql`](supabase/migrations/20261030000003_add_market_role_enum.sql) — Adds `'market'` to `public.smart_link_role` in its own transaction boundary (prevents PostgreSQL `55P04` enum error).
5. [`supabase/migrations/20261030000004_demand_driven_farmer_market_admin.sql`](supabase/migrations/20261030000004_demand_driven_farmer_market_admin.sql) — 3-role enforcement, legacy role quarantine, `market_demands`, `supply_allocations`, `delivery_records`, `audit_logs`, non-double-counted generated columns, RLS policies, and 8 `SECURITY DEFINER` RPCs.
6. [`supabase/tests/002_phase_b_demand_allocation_rls_tests.sql`](supabase/tests/002_phase_b_demand_allocation_rls_tests.sql) — Transactional (`BEGIN ... ROLLBACK`) security, RLS, accounting, and concurrency test suite.

---

## Run on Your Laptop

Node.js 24 and npm are used in this workspace. In Windows PowerShell, use `npm.cmd` / `npx.cmd`.

### 1. Farmer Mobile App (Expo Web)
```powershell
cd C:\Smart_ANI\mobile
$env:EXPO_NO_TELEMETRY="1"
npm.cmd run web -- --port 8081 --host localhost
```
Open `http://localhost:8081`.

### 2. Market, Farmer & Admin Web Portal (Next.js)
```powershell
cd C:\Smart_ANI\web
npm.cmd run dev
```
Open `http://127.0.0.1:3000` (redirects to `/dashboard`) or `http://127.0.0.1:3000/login`.

---

## Verify & Test

```powershell
cd C:\Smart_ANI\mobile
$env:EXPO_NO_TELEMETRY="1"
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build:web

cd C:\Smart_ANI\web
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```
