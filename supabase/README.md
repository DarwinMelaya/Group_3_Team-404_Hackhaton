# SMART-ANI · Agri Integration & Database Security Architecture

Status: **Phase 2A final hardened migration prepared locally; NOT YET APPLIED or runtime-tested against the live `Agri` project.**

* **Canonical Migration File:** [`migrations/20261029000001_smart_link_foundation.sql`](migrations/20261029000001_smart_link_foundation.sql)
* **Synchronized Proposal File:** [`proposals/001_smart_link_foundation.sql`](proposals/001_smart_link_foundation.sql)
* **Database Security & RLS Test Script:** [`tests/001_security_and_rls_test_plan.sql`](tests/001_security_and_rls_test_plan.sql)

Do not execute the migration against the live Supabase project **Agri** until the user explicitly approves live database application.

## Entity Relationships & Pooling Rules

`auth.users → profiles → harvest_listings / processor_requirements / pooled_batches`

`harvest_listings → batch_contributions ← pooled_batches → reservations ← processor_requirements`

1. **Units & Enums:** All quantities use kilograms (`numeric(12,3)`); prices use PHP/kg (`numeric(12,2)`). Crops, Marinduque municipalities (`Boac`, `Mogpog`, `Santa Cruz`, `Torrijos`, `Buenavista`, `Gasan`), storage conditions, and roles use strict PostgreSQL enums.
2. **Same-Municipality, Same-Crop, Same-Storage Pooling (Phase 2 Rule):**
   Composite foreign keys between `harvest_listings`, `pooled_batches`, and `batch_contributions` enforce that a pooled batch only combines harvests from the **same municipality**, **same crop**, and **same storage condition**. Cross-municipality pooling within a single batch is intentionally disallowed in Phase 2 to preserve location and storage traceability.
3. **Conservative 1-to-1 Listing Contribution Rule:**
   `batch_contributions.harvest_listing_id` is `UNIQUE`. In Phase 2, a harvest listing may contribute to at most one batch (up to its `quantity_kg`). Once pooled, the listing's asking price and storage condition cannot be changed and its status must remain `'available'`.
4. **Coordinator Verification & Harvest Lifecycle (`Draft → Pending Verification → Verified/Published or Rejected`):**
   - `harvest_listings.status` supports `'draft'`, `'pending_verification'` (default on submission), `'available'` (Coordinator-Verified / Published), `'rejected'`, and `'closed'`.
   - Farmers can only create `'draft'` or `'pending_verification'` listings. Farmers can **never** directly publish or approve their own listing (`status = 'available'`).
   - Only an authenticated `coordinator` or `admin` can approve (`'available'`) or reject (`'rejected'`) a `'pending_verification'` listing through the hardened `public.review_harvest_listing(p_listing_id, p_decision, p_review_notes)` RPC, which records `reviewed_by`, `reviewed_at`, and `review_notes` without allowing modification of farmer crop, quantity, price, or ownership.
   - Farmers can correct (`quantity_kg`, `asking_price_php_per_kg`, `storage_condition`, `outreach_priority`) and resubmit a `'rejected'` listing back to `'pending_verification'`, which automatically resets previous verification metadata (`reviewed_by = NULL`, `reviewed_at = NULL`, `review_notes = ''`).
5. **Creation-Time vs. Ongoing Requirement Date Validation:**
   `processor_requirements.required_by` enforces `required_by >= (created_at at time zone 'Asia/Manila')::date` as a timeless table check and `required_by >= (now() at time zone 'Asia/Manila')::date` on `INSERT`. Once `required_by` passes, the requirement can still be closed (`status = 'closed'`), while `enforce_reservation_integrity()` blocks new reservations against expired requirements.

## Access & Security Model

| Resource | Farmer | Processor | Coordinator / Admin |
| --- | --- | --- | --- |
| `profiles` | Read/create own (`role='farmer'`); edit own name/municipality | Read/edit own name/municipality | Read all profiles; edit own name/municipality |
| `harvest_listings` | Create own (`draft`/`pending_verification`); read **own only**; edit/resubmit own under trigger rules; **cannot** set `available` directly | Read **only verified/published (`status = 'available'`)** listings | Read all listings; approve/reject `pending_verification` listings via `public.review_harvest_listing()` |
| `processor_requirements` | Read `open` requirements | Create own (`open`); read own + `open`; edit own notes/status (`open`/`closed`) | Read all requirements |
| `pooled_batches` | Read `open` batches | Read `open` batches | Read all batches |
| `batch_contributions` | Read own listing's contribution | No direct read access | Read all contributions |
| `reservations` | Read if own listing contributes to the batch | Read reservations for own requirements | Read all reservations |

### Key Security Protections Implemented in Phase 2A

* **Dual-Layer Role Protection:** `profiles.role` has no `INSERT` or `UPDATE` column grant for `authenticated`, AND `profiles_edit_self` enforces `role = (select smart_link_private.current_role())` in its `WITH CHECK` clause.
* **Untrusted Metadata Immunity:** `smart_link_private.current_role()` reads exclusively from `public.profiles` where `id = (select auth.uid())` with `SET search_path = ''`. User-editable `raw_user_meta_data` JWT claims are never trusted.
* **Coordinator Verification Gate & Metadata Integrity:**
  - `reviewed_by`, `reviewed_at`, and `review_notes` have no `INSERT` or `UPDATE` column grants for `authenticated`.
  - A table `CHECK` constraint and `enforce_harvest_listing_lifecycle()` guarantee that `'draft'` and `'pending_verification'` rows have `NULL` reviewer metadata, while `'available'` and `'rejected'` rows must record a valid `coordinator` or `admin` reviewer and timestamp.
* **Farmer Listing Privacy:** `harvests_read` restricts farmers to reading only their own `harvest_listings` rows (`farmer_id = (select auth.uid())`), while processors only see verified (`status = 'available'`) rows and coordinators/admins see all rows.
* **Database-Level Quantity & Concurrency Guards:**
  `enforce_batch_contribution_integrity()` and `enforce_reservation_integrity()` acquire row-level locks (`SELECT ... FOR UPDATE`) in deterministic order (`pooled_batches` → `harvest_listings` / `processor_requirements`) and prevent over-contribution, over-reservation, unverified listing pooling, or reducing supply below active reservations.
