# SMART-ANI

**SMART-ANI: An AI-Powered B2B Post-Harvest Exchange and Value-Addition Platform in Marinduque**  
Agriculture & Food Innovation · **Team 404: Sleep Not Found**

A foundation, database-hardened, and Supabase-connected B2B post-harvest exchange connecting smallholder farmers, barangay coordinators, cooperatives, and food processors across Marinduque (`Boac`, `Mogpog`, `Santa Cruz`, `Torrijos`, `Buenavista`, `Gasan`) for target crops (`Banana`, `Arrowroot / Uraro`, `Cassava`, `Camote`, `Coconut`, `Vegetables`).

---

## Current Implemented Scope vs. Planned Proposal Backlog

### Implemented Now (Phase 1 UI/UX + Phase 2A Hardened SQL + Phase 2B Live Supabase Auth & Verification Workflow)
- **Farmer Mobile App (`mobile/` — Expo SDK 58, React Native, TypeScript, Expo Router, Expo Web):**
  - Five routes (`Dashboard`, `My Harvests`, `Add Harvest`, `Transactions`, `Profile`) with official **SMART-ANI** branding and the 5-color botanical palette (`#0B2E17` Bush, `#5D912F` Maximum Green, `#2D6320` Bright Nori, `#94B54F` Venus Flytrap, `#C3D187` Soft Celery).
  - **Live Supabase Mode + Isolated Demo Mode:** Explicit mode banner and switcher in `Profile`. Never mixes demo storage with live Supabase records.
  - **Farmer Authentication (`src/lib/supabase-client.ts`):** Sign up / sign in / sign out with persistent session storage (`AsyncStorage`), automatic token refresh, and safe `public.profiles` auto-creation defaulting to `role = 'farmer'` (never trusting client metadata for role assignment).
  - **Live Harvest Submission & Status Tracking:** Authenticated farmers submit harvests (`Add Harvest`) directly to `public.harvest_listings` with enforced `status = 'pending_verification'` and view real-time coordinator verification status (`pending_verification`, `available`, `rejected`) and `review_notes` in `My Harvests`.
- **Coordinator & Processor Web Portal (`web/` — Next.js App Router, React, TypeScript, Tailwind CSS):**
  - Seven routes (`Login`, `Dashboard`, `Harvest Exchange`, `Supply Pooling`, `Processor Requests`, `AI Value-Add Analysis`, `Transactions`).
  - **Multi-Role Supabase Authentication (`src/lib/portal-auth.tsx`):** Sign in / sign out with role-aware navigation for `coordinator`, `processor`, `farmer`, and `admin`, plus an explicit **Live Supabase Mode** vs. **Demo Preview** toggle.
  - **Authorized Coordinator Verification Queue (`src/components/harvest-table.tsx`):** Coordinators view `pending_verification` farmer listings and approve (`available`) or reject (`rejected` with required review notes) via the `public.review_harvest_listing` `SECURITY DEFINER` PostgreSQL RPC.
  - **Verified Live Harvest Exchange:** Processors see only coordinator-verified listings (`status = 'available'`), keeping unverified or rejected submissions out of the marketplace.
- **Database & Security Architecture (`supabase/` — Prepared for Project `Agri`):**
  - Complete 6-table PostgreSQL migration ([`supabase/migrations/20261029000001_smart_link_foundation.sql`](supabase/migrations/20261029000001_smart_link_foundation.sql)) with strict enums, column-level privilege grants, RLS policies, concurrency-safe quantity triggers, and the `public.review_harvest_listing` RPC.
  - Optional automatic farmer profile trigger ([`supabase/migrations/20261029000002_auto_create_farmer_profile.sql`](supabase/migrations/20261029000002_auto_create_farmer_profile.sql)).
  - Read-only live schema verification script ([`supabase/tests/000_verify_live_schema.sql`](supabase/tests/000_verify_live_schema.sql)) and transactional RLS security test suite ([`supabase/tests/001_security_and_rls_test_plan.sql`](supabase/tests/001_security_and_rls_test_plan.sql)).

### Planned Backlog for Subsequent Phases (Phase 2C / Phase 3)
1. **Live Supply Pooling & Idempotent Processor Reservations (Phase 2C):** Connecting `pooled_batches`, `batch_contributions`, `processor_requirements`, and `reservations` to the web and mobile UIs.
2. **Spoilage Countdown Marketplace & Advisory Urgency Monitoring (Phase 2C/3):** Advisory urgency tracking based on harvest date, crop type, and storage condition.
3. **Server-Side Agentic AI Value-Add Assistant (Phase 3):** Grounded AI recommendations explaining deterministic raw-vs-processed financial calculations.
4. **Offline Harvest Logging Queue & Proposed SMS Fallback Sync (Phase 3/4):** Account-bound offline queue with idempotency keys.

---

## Connecting to Live Supabase Project `Agri` (Phase 2B Setup)

1. **Verify or Apply Database Migrations in Supabase SQL Editor (`Agri`):**
   - Run [`supabase/tests/000_verify_live_schema.sql`](supabase/tests/000_verify_live_schema.sql) to inspect the current `Agri` database state.
   - If the tables are not yet created, run [`supabase/migrations/20261029000001_smart_link_foundation.sql`](supabase/migrations/20261029000001_smart_link_foundation.sql) and optionally [`supabase/migrations/20261029000002_auto_create_farmer_profile.sql`](supabase/migrations/20261029000002_auto_create_farmer_profile.sql).
2. **Create `mobile/.env.local` (ignored by Git):**
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://<your-agri-project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-or-anon-key>
   ```
3. **Create `web/.env.local` (ignored by Git):**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-agri-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-or-anon-key>
   ```
   *(Never place `service_role` or `sb_secret_...` keys in any `EXPO_PUBLIC_` or `NEXT_PUBLIC_` variable.)*

---

## Run on Your Laptop

Node.js 24 and npm are used in this workspace. In Windows PowerShell, use `npm.cmd` / `npx.cmd`. No physical phone or emulator is required.

### 1. Farmer Mobile App (Expo Web)
```powershell
cd C:\Smart_ANI\mobile
$env:EXPO_NO_TELEMETRY="1"
npm.cmd run web -- --port 8081 --host localhost
```
Open `http://localhost:8081`.

### 2. Coordinator & Processor Web Portal (Next.js)
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
