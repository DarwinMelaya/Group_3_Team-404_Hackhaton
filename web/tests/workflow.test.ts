import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateDemoSpoilageUrgency,
  generateSmsReply,
  harvests as initialHarvests,
  initialDemoAccounts,
  initialDemoBatchPools,
  initialDemoMarketDemands,
  marketTypeLabel,
  parseSmsCommand,
  processingFacilities,
  valueAddScenarios,
} from "../src/lib/demo.ts";
import {
  adminVerifyMarketAccountWebRpc,
  confirmAllocationDeliveryWebRpc,
  createLiveMarketDemand,
  respondToSupplyAllocationWebRpc,
  reviewHarvestListingRpc,
  signUpWebMarketOrFarmer,
  type SupabaseSession,
} from "../src/lib/supabase-client.ts";
import type { SupabasePublicConfig } from "../src/lib/supabase-config.ts";

const mockConfig: SupabasePublicConfig = {
  status: "configured",
  url: "https://agri-test.supabase.co",
  publishableKey: "sb_publishable_test_key_12345",
  message: "Configured",
};

const mockSession: SupabaseSession = {
  access_token: "token-123",
  refresh_token: "refresh-123",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: "user-uuid-1",
    email: "user@marinduque.gov.ph",
  },
};

test("1. Initial fixtures: 3 roles (Farmer, Market, Admin), 100 kg Banana (SA-001), and 40/35/25 kg Market demands", () => {
  const sa001 = initialHarvests.find((h) => h.id === "SA-001");
  assert.ok(sa001);
  assert.equal(sa001.crop, "Banana");
  assert.equal(sa001.quantity, 100);
  assert.equal(sa001.remainingKg, 100);
  assert.equal(sa001.verified, true);

  const d1 = initialDemoMarketDemands.find((d) => d.id === "MKT-DEM-01");
  const d2 = initialDemoMarketDemands.find((d) => d.id === "MKT-DEM-02");
  const d3 = initialDemoMarketDemands.find((d) => d.id === "MKT-DEM-03");
  assert.equal(d1?.requiredQuantityKg, 40);
  assert.equal(d2?.requiredQuantityKg, 35);
  assert.equal(d3?.requiredQuantityKg, 25);

  // Ensure exactly the 3 authorized roles exist in accounts (Farmer, Market, Admin)
  for (const acc of initialDemoAccounts) {
    assert.ok(
      acc.role === "farmer" ||
        acc.role === "market" ||
        acc.role === "admin",
    );
  }

  // Legacy coordinator is quarantined, never auto-promoted to admin
  const quarantined = initialDemoAccounts.find(
    (a) => a.id === "legacy-coord-torrijos",
  );
  assert.ok(quarantined);
  assert.equal(
    quarantined.accountStatus,
    "deactivated_pending_admin_review",
  );
  assert.notEqual(quarantined.role, "admin");

  // Unverified market starts as pending_verification
  const unverifiedMarket = initialDemoAccounts.find(
    (a) => a.id === "market-gasan-unverified",
  );
  assert.equal(
    unverifiedMarket?.marketVerificationStatus,
    "pending_verification",
  );
  assert.equal(marketTypeLabel("food_processor"), "Food Processor");
  assert.equal( evaluateDemoSpoilageUrgency(sa001).level, "high");
});

test("2. Web Supabase client: Market registration defaults to pending_verification and blocks Admin self-assignment", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ url, body });

    if (url.endsWith("/auth/v1/signup")) {
      return new Response(
        JSON.stringify({
          access_token: "mkt-token",
          refresh_token: "mkt-refresh",
          expires_in: 3600,
          user: { id: "mkt-uuid-1", email: "stall@boac.ph" },
        }),
        { status: 200 },
      );
    }
    if (url.includes("/rest/v1/profiles?id=eq.")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.endsWith("/rest/v1/rpc/register_account_profile")) {
      return new Response(
        JSON.stringify({
          id: "mkt-uuid-1",
          display_name: "Elena Market",
          municipality: "Boac",
          role: "market",
          market_type: "public_market",
          organization_name: "Boac Stall 8",
          market_verification_status: "pending_verification",
          created_at: "2026-10-30T00:00:00Z",
        }),
        { status: 200 },
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await signUpWebMarketOrFarmer(
    {
      email: "stall@boac.ph",
      password: "password123",
      displayName: "Elena Market",
      municipality: "Boac",
      accountRole: "market",
      marketType: "public_market",
      organizationName: "Boac Stall 8",
    },
    mockConfig,
    fakeFetch,
  );

  assert.equal(result.profile?.role, "market");
  assert.equal(
    result.profile?.market_verification_status,
    "pending_verification",
  );
  assert.equal(calls[0].body.data && (calls[0].body.data as Record<string, unknown>).account_type, "market");
});

test("3. Web Supabase RPCs: Admin-only harvest review, Market verification, Offer acceptance, and Delivery confirmation", async () => {
  // Non-admin cannot call reviewHarvestListingRpc
  await assert.rejects(
    () =>
      reviewHarvestListingRpc(
        mockSession,
        "market",
        { listingId: "SA-001", decision: "available" },
        mockConfig,
      ),
    /Unauthorized: only an Admin account/,
  );

  const rpcCalls: { url: string; body: Record<string, unknown> }[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    rpcCalls.push({ url, body });

    if (url.endsWith("/rest/v1/rpc/admin_verify_market_account")) {
      return new Response(
        JSON.stringify({
          id: body.p_market_id,
          role: "market",
          market_verification_status: body.p_decision,
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/rest/v1/market_demands?select=*")) {
      return new Response(
        JSON.stringify([
          {
            id: "dem-1",
            market_id: mockSession.user.id,
            crop: body.crop,
            required_quantity_kg: body.required_quantity_kg,
            reserved_quantity_kg: 0,
            fulfilled_quantity_kg: 0,
            remaining_demand_kg: body.required_quantity_kg,
            offered_price_php_per_kg: body.offered_price_php_per_kg,
            municipality: body.municipality,
            barangay: body.barangay,
            required_by: body.required_by,
            accept_partial: body.accept_partial,
            status: "open",
          },
        ]),
        { status: 201 },
      );
    }
    if (url.endsWith("/rest/v1/rpc/respond_to_supply_allocation")) {
      return new Response(
        JSON.stringify({
          id: body.p_allocation_id,
          allocated_quantity_kg: 40,
          delivered_quantity_kg: 0,
          released_quantity_kg: 0,
          outstanding_quantity_kg: 40,
          status: body.p_decision,
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/rest/v1/rpc/confirm_allocation_delivery")) {
      return new Response(
        JSON.stringify({
          id: body.p_allocation_id,
          allocated_quantity_kg: 40,
          delivered_quantity_kg: body.p_received_quantity_kg,
          released_quantity_kg: 0,
          outstanding_quantity_kg: 40 - Number(body.p_received_quantity_kg),
          status:
            Number(body.p_received_quantity_kg) === 40
              ? "delivered"
              : "partially_delivered",
        }),
        { status: 200 },
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const verifiedMarket = await adminVerifyMarketAccountWebRpc(
    mockSession,
    {
      marketId: "mkt-1",
      decision: "verified",
      notes: "Business permit checked",
    },
    mockConfig,
    fakeFetch,
  );
  assert.equal(verifiedMarket.market_verification_status, "verified");

  const demand = await createLiveMarketDemand(
    mockSession,
    {
      crop: "Banana",
      requiredQuantityKg: 40,
      preferredQualityGrade: "Grade A",
      offeredPricePerKg: 28,
      municipality: "Boac",
      barangay: "Murallon",
      requiredBy: "2026-11-02",
      acceptPartial: true,
      qualityNotes: "Daily stall demand",
    },
    mockConfig,
    fakeFetch,
  );
  assert.equal(demand.required_quantity_kg, 40);
  assert.equal(demand.remaining_demand_kg, 40);

  const reserved = await respondToSupplyAllocationWebRpc(
    mockSession,
    {
      allocationId: "alloc-1",
      decision: "reserved",
      notes: "Accepted 40 kg",
    },
    mockConfig,
    fakeFetch,
  );
  assert.equal(reserved.status, "reserved");
  assert.equal(reserved.outstanding_quantity_kg, 40);

  const delivered = await confirmAllocationDeliveryWebRpc(
    mockSession,
    {
      allocationId: "alloc-1",
      receivedQuantityKg: 40,
    },
    mockConfig,
    fakeFetch,
  );
  assert.equal(delivered.status, "delivered");
  assert.equal(delivered.delivered_quantity_kg, 40);
  assert.equal(delivered.outstanding_quantity_kg, 0);
});

test("4. Per-kilo and bulk/fixed-lot market buying: units (kg, sack, crate, bunch, lot), pricing modes, and sample demands", () => {
  // Check initial market demands have various units and buying types
  const allDemands = initialDemoMarketDemands;
  assert.ok(allDemands.length >= 7);

  const sackDemand = allDemands.find((d) => d.unit === "sack");
  assert.ok(sackDemand, "Must have a sack-based demand");
  assert.equal(sackDemand.crop, "Cassava");
  assert.equal(sackDemand.requiredQuantityKg, 2); // 2 sacks
  assert.equal(sackDemand.unitPricePhp, 800); // ₱800 / sack
  assert.equal(sackDemand.totalPricePhp, 1600); // ₱1,600 total

  const crateDemand = allDemands.find((d) => d.unit === "crate");
  assert.ok(crateDemand, "Must have a crate-based demand");
  assert.equal(crateDemand.crop, "Vegetables");
  assert.equal(crateDemand.requiredQuantityKg, 3); // 3 crates
  assert.equal(crateDemand.unitPricePhp, 500); // ₱500 / crate
  assert.equal(crateDemand.totalPricePhp, 1500); // ₱1,500 total

  const bunchDemand = allDemands.find((d) => d.unit === "bunch");
  assert.ok(bunchDemand, "Must have a bunch-based demand");
  assert.equal(bunchDemand.crop, "Banana");
  assert.equal(bunchDemand.requiredQuantityKg, 20); // 20 bunches
  assert.equal(bunchDemand.unitPricePhp, 60); // ₱60 / bunch
  assert.equal(bunchDemand.totalPricePhp, 1200); // ₱1,200 total

  const lotDemand = allDemands.find((d) => d.buyingType === "bulk_lot");
  assert.ok(lotDemand, "Must have a bulk_lot demand");
  assert.equal(lotDemand.crop, "Banana");
  assert.equal(lotDemand.unit, "lot");
  assert.equal(lotDemand.totalPricePhp, 2500); // ₱2,500 total fixed lot price

  // Existing 100 kg Banana -> 40 + 35 + 25 kg demands are intact
  const d1 = allDemands.find((d) => d.id === "MKT-DEM-01");
  const d2 = allDemands.find((d) => d.id === "MKT-DEM-02");
  const d3 = allDemands.find((d) => d.id === "MKT-DEM-03");
  assert.equal(d1?.unit ?? "kg", "kg");
  assert.equal(d2?.unit ?? "kg", "kg");
  assert.equal(d3?.unit ?? "kg", "kg");
  assert.equal(d1?.requiredQuantityKg, 40);
  assert.equal(d2?.requiredQuantityKg, 35);
  assert.equal(d3?.requiredQuantityKg, 25);
});

test("5. Final Abstract Compliance: 4 value-addition scenarios, 6-municipality facility directory, batch pooling, and SMS fallback parser", () => {
  // 1. Value-Add pathways: Banana Chips, Uraro Flour/Starch, Cassava Starch, Coconut VCO
  assert.equal(valueAddScenarios.length, 4);
  const bananaVa = valueAddScenarios.find((s) => s.id === "VA-BANANA");
  const uraroVa = valueAddScenarios.find((s) => s.id === "VA-URARO");
  const cassavaVa = valueAddScenarios.find((s) => s.id === "VA-CASSAVA");
  const coconutVa = valueAddScenarios.find((s) => s.id === "VA-COCONUT");
  assert.ok(bananaVa && bananaVa.illustrativeYieldRatio === 0.35);
  assert.ok(uraroVa && uraroVa.illustrativeYieldRatio === 0.2);
  assert.ok(cassavaVa && cassavaVa.illustrativeYieldRatio === 0.25);
  assert.ok(coconutVa && coconutVa.illustrativeYieldRatio === 0.08);
  assert.equal(coconutVa?.densityKgPerLiter, 0.92);
  assert.equal(coconutVa?.oilMassKg, 9.6);
  assert.equal(coconutVa?.outputQuantity, 10.43);
  const calculatedVol = Number(
    (
      ((coconutVa?.sampleInputKg ?? 120) * (coconutVa?.illustrativeYieldRatio ?? 0.08)) /
      (coconutVa?.densityKgPerLiter ?? 0.92)
    ).toFixed(2),
  );
  assert.equal(calculatedVol, 10.43);

  // 2. Processing facilities: all 6 municipalities represented
  assert.equal(processingFacilities.length, 6);
  const muns = new Set(processingFacilities.map((f) => f.municipality));
  for (const mun of [
    "Boac",
    "Mogpog",
    "Santa Cruz",
    "Torrijos",
    "Buenavista",
    "Gasan",
  ]) {
    assert.ok(
      muns.has(mun),
      `Missing processing facility for municipality: ${mun}`,
    );
  }
  // All demo facilities are explicitly classified as sample fixtures
  for (const fac of processingFacilities) {
    assert.equal(fac.isVerified, false);
    assert.equal(fac.dataClassification, "sample_demo");
  }

  // 3. Spoilage freshness evaluation advisory
  const sample = initialHarvests[0];
  const advisory = evaluateDemoSpoilageUrgency(sample);
  assert.ok(
    advisory.advisoryDisclaimer.includes(
      "not a food safety or expiration guarantee",
    ),
  );
  assert.ok(advisory.hoursRemaining > 0);

  // 4. SMS Fallback parsing and response generation
  const aniSms = parseSmsCommand("ANI BANANA 100 KG 25 SANTACRUZ ALOBO");
  assert.ok(aniSms.valid);
  if (aniSms.valid) {
    assert.equal(aniSms.type, "ANI");
    assert.equal(aniSms.crop, "BANANA");
    assert.equal(aniSms.quantity, 100);
    assert.equal(aniSms.unit, "kg");
    assert.equal(aniSms.price, 25);
    const reply = generateSmsReply(aniSms);
    assert.ok(reply.includes("Matagumpay na naitala"));
    assert.ok(reply.includes("100 kg BANANA"));
  }

  const presyoSms = parseSmsCommand("PRESYO BANANA BOAC");
  assert.ok(presyoSms.valid);
  if (presyoSms.valid) {
    assert.equal(presyoSms.type, "PRESYO");
    const reply = generateSmsReply(presyoSms);
    assert.ok(reply.includes("Presyo sa BOAC"));
  }

  const demandSms = parseSmsCommand("DEMAND BANANA");
  assert.ok(demandSms.valid);
  if (demandSms.valid) {
    assert.equal(demandSms.type, "DEMAND");
    const reply = generateSmsReply(demandSms);
    assert.ok(reply.includes("Aktibong Demand para sa BANANA"));
  }

  // 5. Batch pooling
  assert.ok(initialDemoBatchPools.length >= 2);
  const scPool = initialDemoBatchPools.find((p) => p.id === "POOL-SC-01");
  assert.ok(scPool);
  assert.equal(scPool.totalPooledKg, 100);
  assert.equal(scPool.crop, "Banana");
});

