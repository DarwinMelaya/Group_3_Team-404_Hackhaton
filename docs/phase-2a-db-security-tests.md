# SMART-ANI · Phase 2A Database Security, RLS & Coordinator Verification Test Plan

Execution status against live Supabase (`Agri`): **PREPARED LOCALLY — NOT YET EXECUTED ON LIVE DATABASE** (awaiting user approval to apply the migration first).

* **Migration Under Test:** [`supabase/migrations/20261029000001_smart_link_foundation.sql`](../supabase/migrations/20261029000001_smart_link_foundation.sql)
* **Automated SQL Verification Script:** [`supabase/tests/001_security_and_rls_test_plan.sql`](../supabase/tests/001_security_and_rls_test_plan.sql)

---

## Test Matrix (8 Core Security & Business Logic Scenarios)

| # | Test Scenario | What Is Verified | Enforcement Mechanism | Status |
| --- | --- | --- | --- | --- |
| **1** | **Farmer Ownership Isolation** | Farmer B cannot read (`SELECT`), modify (`UPDATE`), or delete (`DELETE`) Farmer A's listings, nor insert a listing using Farmer A's `farmer_id`. | `harvests_read`, `harvests_create_self`, `harvests_edit_self` RLS policies + absence of `DELETE` grant. | **PREPARED** (`001_security_and_rls_test_plan.sql`) — **NOT TESTED ON LIVE DB** |
| **2** | **Unauthorized Role Escalation & Metadata Spoofing** | A Farmer or Processor cannot set `role` on signup, cannot `UPDATE public.profiles SET role = 'coordinator'`, and cannot escalate privileges by injecting `{"role":"admin"}` into `raw_user_meta_data`. | Restricted column grants (`display_name, municipality` only) + `profiles_create_self` + `profiles_edit_self` (`role = current_role()`) + `smart_link_private.current_role()` reading `public.profiles`. | **PREPARED** (`001_security_and_rls_test_plan.sql`) — **NOT TESTED ON LIVE DB** |
| **3** | **Processor Listing Visibility** | Processors can read **only** coordinator-verified (`'available'`) listings on the Harvest Exchange; cannot see `'draft'`, `'pending_verification'`, `'rejected'`, or `'closed'` listings; cannot read farmer rows in `public.profiles`; and cannot call `review_harvest_listing()`. | `harvests_read` (`status = 'available' and current_role() = 'processor'`) + `profiles_read` + `review_harvest_listing()` role guard. | **PREPARED** (`001_security_and_rls_test_plan.sql`) — **NOT TESTED ON LIVE DB** |
| **4** | **Quantity Over-Allocation & Floor Protection** | Unverified listings (`status <> 'available'`) cannot be pooled; contributions cannot exceed `harvest_listings.quantity_kg` or `pooled_batches.target_quantity_kg`; reservations cannot exceed pooled batch supply (`SUM(batch_contributions.quantity_kg)`) or `processor_requirements.quantity_kg`; reducing/deleting a contribution below active reservations fails. | `enforce_batch_contribution_integrity()`, `enforce_reservation_integrity()`, `enforce_harvest_listing_lifecycle()`, `enforce_processor_requirement_lifecycle()`. | **PREPARED** (`001_security_and_rls_test_plan.sql`) — **NOT TESTED ON LIVE DB** |
| **5** | **Duplicate Reservations** | Submitting a reservation with a duplicate `idempotency_key` fails; submitting a second active (`status <> 'cancelled'`) reservation for the same `(batch_id, processor_requirement_id)` with a new `idempotency_key` also fails; reactivating a `'cancelled'` reservation fails. | `reservations_idempotency_key_key` unique constraint + `reservations_active_pair_idx` partial unique index + `enforce_reservation_integrity()`. | **PREPARED** (`001_security_and_rls_test_plan.sql`) — **NOT TESTED ON LIVE DB** |
| **6** | **Concurrent Reservation Attempts** | Two simultaneous transactions attempting to reserve 200 kg each from a batch that only has 300 kg pooled supply: the first transaction acquires `FOR UPDATE` locks on `pooled_batches` and `processor_requirements`, and the second waits and fails with a quantity-exceeded exception. | Deterministic `SELECT ... FOR UPDATE` row locking inside `enforce_reservation_integrity()`. | **PREPARED** (2-Session Concurrency Procedure below) — **NOT TESTED ON LIVE DB** |
| **7** | **Invalid Date or Quantity Submissions** | Future `harvest_date` (`> Asia/Manila today`) is rejected; past `required_by` (`< Asia/Manila today`) is rejected on `INSERT`; zero/negative/excessive (> 1,000,000 kg) quantities and negative prices are rejected; expired requirements can still be closed (`status = 'closed'`) but reject new reservations. | Table `CHECK` constraints + `enforce_harvest_listing_lifecycle()`, `enforce_processor_requirement_lifecycle()`, `enforce_reservation_integrity()`. | **PREPARED** (`001_security_and_rls_test_plan.sql`) — **NOT TESTED ON LIVE DB** |
| **8** | **Coordinator Verification, Rejection & Farmer Resubmission Workflow** | Default status on submission is `'pending_verification'`; farmer cannot directly insert or update `status = 'available'`, modify `review_notes`, or call `review_harvest_listing()`; coordinator approves (`'pending_verification' → 'available'`) or rejects (`'pending_verification' → 'rejected'`) via `public.review_harvest_listing()` recording `reviewed_by`, `reviewed_at`, `review_notes` without altering farmer crop/price/quantity; farmer corrects and resubmits `'rejected' → 'pending_verification'` (automatically clearing old review metadata); coordinator approves resubmitted listing. | `harvests_create_self` + `harvests_edit_self` + column grants + `enforce_harvest_listing_lifecycle()` + `public.review_harvest_listing()`. | **PREPARED** (`001_security_and_rls_test_plan.sql`) — **NOT TESTED ON LIVE DB** |

---

## How to Run the Single-Transaction Verification Script (Scenarios 1–5, 7–8)

Once you approve applying the migration to **Agri**:

1. Apply [`supabase/migrations/20261029000001_smart_link_foundation.sql`](../supabase/migrations/20261029000001_smart_link_foundation.sql) in the Supabase SQL Editor.
2. Open a new SQL query tab, paste [`supabase/tests/001_security_and_rls_test_plan.sql`](../supabase/tests/001_security_and_rls_test_plan.sql), and click **Run**.
3. Verify the notice: `ALL PHASE 2A SQL SECURITY, RLS & COORDINATOR VERIFICATION CHECKS PASSED IN TRANSACTION.`
4. Because the script ends with `ROLLBACK;`, no test accounts or listings remain in the database.

---

## How to Run Scenario 6 (Two-Session Concurrent Reservation Test)

Because PostgreSQL row-lock contention (`SELECT ... FOR UPDATE`) requires two concurrent transactions, run this test across **two separate `psql` / database sessions** against a test batch with **300 kg** pooled supply and two open processor requirements (`req_1` and `req_2`) of **250 kg** each:

### Session A:
```sql
begin;
-- Locks the pooled_batches row FOR UPDATE and reserves 200 kg (100 kg remaining)
insert into public.reservations (
  batch_id, processor_requirement_id, crop, quantity_kg, status, idempotency_key
) values (
  '<batch_id>', '<req_1_id>', 'Banana', 200, 'requested', gen_random_uuid()
);
-- Do not commit yet; move immediately to Session B.
```

### Session B (while Session A is still open):
```sql
begin;
-- Attempts to reserve 200 kg from the same 300 kg batch.
-- Blocks on SELECT ... FOR UPDATE in enforce_reservation_integrity() until Session A finishes.
insert into public.reservations (
  batch_id, processor_requirement_id, crop, quantity_kg, status, idempotency_key
) values (
  '<batch_id>', '<req_2_id>', 'Banana', 200, 'requested', gen_random_uuid()
);
```

### Commit Session A:
```sql
-- In Session A:
commit;
```

### Expected Result in Session B:
Session B immediately unblocks, re-evaluates the committed reservation total (`200 + 200 = 400 > 300`), and fails with:
`ERROR: Reservation quantity (200.000) exceeds available pooled harvest quantity (remaining: 100.000).`
