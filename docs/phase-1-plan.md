# SMART-ANI · Phase 1 decision card

The custom `hackathon-mvp-builder` skill guides this work. Organizer permission to use that skill is confirmed by the user. The official system name is **SMART-ANI** (*SMART-ANI: An AI-Powered B2B Post-Harvest Exchange and Value-Addition Platform in Marinduque*, by **Team 404: Sleep Not Found**); `C:\Smart_ANI` remains unchanged. All application code is written for this workspace. Other event constraints (AI disclosure, external services, starter code) remain subject to organizer rules.

- **Problem hypothesis:** Farmers in Marinduque may lose value when fragmented surplus harvests cannot reach buyers or processors promptly. No local spoilage rate or price effect is claimed as measured.
- **Primary user and outcome:** A farmer can enter a complete surplus listing and retrieve it after browser refresh. Phase 1 measures successful local record persistence, not income improvement.
- **Prototype:** A farmer Expo Web app and a coordinator/processor Next.js portal, with a reviewable Supabase foundation.
- **Exactly three core product features:** (1) harvest rescue and farmer-selected outreach priority; (2) supply pooling and processor matching; (3) transparent value-add scenario intelligence. Only the Phase 1 foundations below are implemented now.
- **Optional differentiator:** Future AI explanations grounded in deterministic calculations and real records; deferred.
- **Stack:** Existing Expo SDK 58 + TypeScript/Expo Router for laptop browser preview; Next.js App Router + TypeScript + Tailwind for the portal; existing Supabase Agri for future Auth/Postgres/Realtime. No phone/emulator is required.
- **Main risks and fallback:** Missing verified Agri access and pending SQL review → explicitly labeled isolated demo stores. Runtime/package incompatibility → compatible version checks and honest test results. No live buyer, earnings, or authentication claims.
- **Phase 1 demo:** Open farmer dashboard → add validated harvest → view success/list → refresh and verify the record. Separately open portal → browse and filter sample exchange → inspect planned pooling/AI/transaction pages.

## Scope and gates

**MUST:** preserve existing mobile repository/config; five farmer routes; seven portal routes; responsive layouts; validation, loading, error and empty states; local browser persistence; demo labels; safe empty environment templates; all six proposed SQL tables and restrictive RLS; typecheck/lint/build/browser validation.

**SHOULD:** polished visual hierarchy, keyboard focus/labels, sidebar at narrow widths, clear next-phase boundaries.

**LATER:** real sign-in, shared database records, Realtime, actual pooling/matching, reservations, financial engine, AI, media, notifications, offline sync. This phase does not claim the skill's real multi-role persistence gate has passed.

Roles: farmer owns harvests; processor owns requirements; coordinator manages future pooling; admin is assigned only through privileged onboarding. Local demo mode authenticates nobody. Proposed SQL defines the future permission boundary.

Screens: mobile `/`, `/harvests`, `/add-harvest`, `/transactions`, `/profile`; portal `/login`, `/dashboard`, `/harvest-exchange`, `/supply-pooling`, `/processor-requests`, `/ai-value-add`, `/transactions`.

Data contract: mobile `Harvest` (kg, PHP/kg, ISO date, crop, municipality, barangay, storage, priority) maps to proposed `harvest_listings` after authentication adds `farmer_id`. Demo IDs must never be treated as real UUIDs. The SQL adds ownership, server timestamps, statuses, constraints, and RLS.

Proposed future states: harvest `draft → available → closed`; requirement `open → closed`; pool `draft → open → closed`; reservation `requested → confirmed → completed` or `cancelled`. The proposal stores these states; transactional transitions are not implemented or authorized client operations yet.

Implementation order: inspect → mobile increment + checks → portal increment + checks → SQL review documentation → integrated browser checks + test matrix. Reserve a final verification block and a manual laptop walkthrough; do not spend that block adding later-phase features.
