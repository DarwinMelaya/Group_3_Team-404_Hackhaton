import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPendingHarvestListing,
  fetchFarmerHarvestListings,
  fetchOrCreateUserProfile,
  isValidSession,
  mapDbRowToHarvest,
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
      crop: "Banana (Saba)",
      quantity_kg: 50,
      asking_price_php_per_kg: 24,
      harvest_date: "2026-10-29",
      municipality: "Santa Cruz",
      barangay: "Alobo",
      storage_condition: "Ambient",
      outreach_priority: "Priority",
      status: "pending_verification",
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
      crop: "Banana (Saba)",
      quantity: 50,
      price: 24,
      harvestDate: "2026-10-29",
      municipality: "Santa Cruz",
      barangay: "Alobo",
      storage: "Ambient",
      priority: "Priority",
    },
    mockConfig,
    fakeFetch,
  );

  assert.ok(capturedBody);
  assert.equal(capturedBody.status, "pending_verification");
  assert.equal(capturedBody.farmer_id, mockSession.user.id);
  assert.equal(capturedBody.quantity_kg, 50);
  assert.equal(created.status, "pending_verification");
  assert.equal(created.farmerId, mockSession.user.id);
  assert.equal(created.municipality, "Santa Cruz");
});

test("fetchFarmerHarvestListings and mapDbRowToHarvest preserve coordinator verification status and review notes", async () => {
  const sampleRows: DbHarvestListingRow[] = [
    {
      id: "listing-approved-1",
      farmer_id: mockSession.user.id,
      crop: "Banana (Saba)",
      quantity_kg: "50",
      asking_price_php_per_kg: "24.5",
      harvest_date: "2026-10-29",
      municipality: "Santa Cruz",
      barangay: "Alobo",
      storage_condition: "Ambient",
      outreach_priority: "Priority",
      status: "available",
      reviewed_by: "coord-uuid-1",
      reviewed_at: "2026-10-29T08:15:00Z",
      review_notes: "Verified 50 kg Saba Banana in Santa Cruz for processor pooling.",
      created_at: "2026-10-29T08:05:00Z",
    },
    {
      id: "listing-rejected-2",
      farmer_id: mockSession.user.id,
      crop: "Cassava",
      quantity_kg: 120,
      asking_price_php_per_kg: 18,
      harvest_date: "2026-10-29",
      municipality: "Boac",
      barangay: "Murallon",
      storage_condition: "Sacked",
      outreach_priority: "Standard",
      status: "rejected",
      reviewed_by: "coord-uuid-1",
      reviewed_at: "2026-10-29T08:20:00Z",
      review_notes: "Please confirm exact root dryness before republishing.",
      created_at: "2026-10-29T08:10:00Z",
    },
  ];

  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify(sampleRows), { status: 200 });

  const listings = await fetchFarmerHarvestListings(
    mockSession,
    mockConfig,
    fakeFetch,
  );

  assert.equal(listings.length, 2);
  assert.equal(listings[0].status, "available");
  assert.equal(listings[0].quantity, 50);
  assert.equal(listings[0].price, 24.5);
  assert.equal(
    listings[0].reviewNotes,
    "Verified 50 kg Saba Banana in Santa Cruz for processor pooling.",
  );
  assert.equal(listings[1].status, "rejected");
  assert.equal(
    listings[1].reviewNotes,
    "Please confirm exact root dryness before republishing.",
  );
});

test("isValidSession and fetchOrCreateUserProfile validate session and existing profile", async () => {
  assert.equal(isValidSession(mockSession), true);
  assert.equal(isValidSession({ access_token: "" }), false);

  const fakeFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify([
        {
          id: mockSession.user.id,
          display_name: "Coordinator1",
          municipality: "Boac",
          role: "coordinator",
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
  assert.equal(profile.role, "coordinator");
  assert.equal(profile.municipality, "Boac");
});
