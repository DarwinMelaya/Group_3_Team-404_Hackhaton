import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allocateHarvestToDemandRpc,
  createPendingHarvestListing,
  fetchFarmerHarvestListings,
  fetchOrCreateUserProfile,
  isValidSession,
  signUpFarmerAccount,
  type DbHarvestListingRow,
  type SupabaseSession,
} from "../src/lib/supabase-client.ts";
import type { SupabasePublicConfig } from "../src/lib/supabase-config.ts";

const mockConfig: SupabasePublicConfig = {
  status: "configured",
  url: "https://example-agri.supabase.co",
  publishableKey: "sb_publishable_test_key_1234567890",
  message: "Supabase Agri client config validated.",
};

const mockSession: SupabaseSession = {
  access_token: "jwt-access-token",
  refresh_token: "jwt-refresh-token",
  expires_at: 1999999999,
  user: {
    id: "11111111-2222-3333-4444-555555555555",
    email: "farmer.saba@example.com",
  },
};

test("signUpFarmerAccount never sends role in signup metadata and creates safe farmer profile", async () => {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];

  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method, body });

    if (url.endsWith("/auth/v1/signup")) {
      return new Response(
        JSON.stringify({
          access_token: mockSession.access_token,
          refresh_token: mockSession.refresh_token,
          expires_in: 3600,
          user: mockSession.user,
        }),
        { status: 200 },
      );
    }

    if (url.includes("/rest/v1/profiles?id=eq.") && method === "GET") {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    if (url.includes("/rest/v1/profiles?select=") && method === "POST") {
      return new Response(
        JSON.stringify([
          {
            id: mockSession.user.id,
            display_name: "KuyaRamon",
            municipality: "Santa Cruz",
            role: "farmer",
            created_at: "2026-10-29T08:00:00Z",
          },
        ]),
        { status: 201 },
      );
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const result = await signUpFarmerAccount(
    {
      email: "farmer.saba@example.com",
      password: "password123",
      displayName: "KuyaRamon",
      municipality: "Santa Cruz",
    },
    mockConfig,
    fakeFetch,
  );

  assert.equal(result.confirmationRequired, false);
  assert.equal(result.profile?.role, "farmer");
  assert.equal(calls.length, 3);

  const signupBody = calls[0].body as { data: Record<string, unknown> };
  assert.equal("role" in signupBody.data, false);

  const profileInsertBody = calls[2].body as Record<string, unknown>;
  assert.equal("role" in profileInsertBody, false);
  assert.equal(profileInsertBody.id, mockSession.user.id);
  assert.equal(profileInsertBody.municipality, "Santa Cruz");
});

test("createPendingHarvestListing enforces pending_verification status and authenticated farmer_id", async () => {
  let capturedBody: Record<string, unknown> = {};

  const fakeFetch: typeof fetch = async (_input, init) => {
    capturedBody = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const savedRow: DbHarvestListingRow = {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      farmer_id: mockSession.user.id,
      crop: "Banana",
      quantity_kg: 100,
      asking_price_php_per_kg: 25,
      harvest_date: "2026-10-29",
      municipality: "Santa Cruz",
      barangay: "Alobo",
      storage_condition: "Shaded and ventilated",
      outreach_priority: "Priority",
      status: "pending_verification",
      earmarked_kg: 0,
      reserved_kg: 0,
      allocated_kg: 0,
      delivered_kg: 0,
      remaining_kg: 100,
      reviewed_by: null,
      reviewed_at: null,
      review_notes: "",
      created_at: "2026-10-29T08:05:00Z",
    };
    return new Response(JSON.stringify([savedRow]), { status: 201 });
  };

  const created = await createPendingHarvestListing(
    mockSession,
    {
      crop: "Banana",
      quantity: 100,
      price: 25,
      harvestDate: "2026-10-29",
      municipality: "Santa Cruz",
      barangay: "Alobo",
      storage: "Shaded and ventilated",
      priority: "Priority",
      qualityGrade: "Grade A",
    },
    mockConfig,
    fakeFetch,
  );

  assert.ok(capturedBody);
  assert.equal(capturedBody.status, "pending_verification");
  assert.equal(capturedBody.farmer_id, mockSession.user.id);
  assert.equal(capturedBody.quantity_kg, 100);
  assert.equal(created.status, "pending_verification");
  assert.equal(created.remainingKg, 100);
  assert.equal(created.farmerId, mockSession.user.id);
  assert.equal(created.municipality, "Santa Cruz");
});

test("fetchFarmerHarvestListings and allocateHarvestToDemandRpc map database quantities accurately", async () => {
  const sampleRows: DbHarvestListingRow[] = [
    {
      id: "listing-approved-1",
      farmer_id: mockSession.user.id,
      crop: "Banana",
      quantity_kg: "100",
      asking_price_php_per_kg: "25",
      harvest_date: "2026-10-29",
      municipality: "Santa Cruz",
      barangay: "Alobo",
      storage_condition: "Shaded and ventilated",
      outreach_priority: "Priority",
      status: "available",
      earmarked_kg: "0",
      reserved_kg: "40",
      allocated_kg: "40",
      delivered_kg: "0",
      remaining_kg: "60",
      reviewed_by: "admin-uuid-1",
      reviewed_at: "2026-10-29T08:15:00Z",
      review_notes: "Verified 100 kg Saba Banana in Santa Cruz.",
      created_at: "2026-10-29T08:05:00Z",
    },
  ];

  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("/rest/v1/rpc/allocate_harvest_to_demand")) {
      return new Response(
        JSON.stringify({
          id: "alloc-123",
          harvest_listing_id: "listing-approved-1",
          market_demand_id: "demand-m1",
          farmer_id: mockSession.user.id,
          market_id: "market-uuid-1",
          crop: "Banana",
          allocated_quantity_kg: 40,
          delivered_quantity_kg: 0,
          released_quantity_kg: 0,
          outstanding_quantity_kg: 40,
          agreed_price_php_per_kg: 28,
          status: "pending_acceptance",
          offer_notes: "40 kg split",
          response_notes: "",
          idempotency_key: "idem-1",
          offered_at: "2026-10-30T08:00:00Z",
          responded_at: null,
          completed_at: null,
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify(sampleRows), { status: 200 });
  };

  const listings = await fetchFarmerHarvestListings(
    mockSession,
    mockConfig,
    fakeFetch,
  );
  assert.equal(listings.length, 1);
  assert.equal(listings[0].status, "available");
  assert.equal(listings[0].quantity, 100);
  assert.equal(listings[0].reservedKg, 40);
  assert.equal(listings[0].remainingKg, 60);

  const alloc = await allocateHarvestToDemandRpc(
    mockSession,
    {
      harvestListingId: "listing-approved-1",
      marketDemandId: "demand-m1",
      quantityKg: 40,
      agreedPricePerKg: 28,
    },
    mockConfig,
    fakeFetch,
  );
  assert.equal(alloc.allocatedQuantityKg, 40);
  assert.equal(alloc.status, "pending_acceptance");
});

test("isValidSession and fetchOrCreateUserProfile validate session and existing profile", async () => {
  assert.equal(isValidSession(mockSession), true);
  assert.equal(isValidSession({ access_token: "" }), false);

  const fakeFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify([
        {
          id: mockSession.user.id,
          display_name: "Admin1",
          municipality: "Boac",
          role: "admin",
          created_at: "2026-10-29T08:00:00Z",
        },
      ]),
      { status: 200 },
    );

  const profile = await fetchOrCreateUserProfile(
    mockSession,
    undefined,
    mockConfig,
    fakeFetch,
  );
  assert.equal(profile.role, "admin");
  assert.equal(profile.municipality, "Boac");
});
