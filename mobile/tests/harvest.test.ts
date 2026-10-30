import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeHarvestInventory,
  computeMarketDemandTotals,
  evaluateSpoilageUrgency,
  generateSmsReply,
  INITIAL_BATCH_POOLS,
  initialMarketDemands,
  isHarvest,
  MARINDUQUE_PROCESSING_FACILITIES,
  parseSmsCommand,
  todayInMarinduque,
  validateAllocationOffer,
  validateHarvest,
  VALUE_ADD_OPPORTUNITIES,
  type Harvest,
  type HarvestInput,
  type SupplyAllocation,
} from "../src/lib/harvest.ts";

const valid: HarvestInput = {
  crop: "Banana",
  quantity: "150",
  price: "25",
  harvestDate: "2026-10-29",
  municipality: "Boac",
  barangay: "Demo barangay",
  storage: "Shaded and ventilated",
  priority: "Standard",
};
test("accepts complete harvest, including zero asking price", () => {
  assert.equal(validateHarvest(valid, "2026-10-29"), null);
  assert.equal(validateHarvest({ ...valid, price: "0" }, "2026-10-29"), null);
});
test("rejects missing, negative, nonfinite and excessive quantities/prices", () => {
  for (const quantity of ["", "0", "-1", "Infinity", "1000001"])
    assert.ok(validateHarvest({ ...valid, quantity }, "2026-10-29"));
  for (const price of ["", "-1", "NaN", "1000001"])
    assert.ok(validateHarvest({ ...valid, price }, "2026-10-29"));
});
test("rejects invalid calendar dates, future dates and missing location", () => {
  for (const harvestDate of ["2026-02-30", "2026-10-30", "29/10/2026"])
    assert.ok(validateHarvest({ ...valid, harvestDate }, "2026-10-29"));
  assert.ok(validateHarvest({ ...valid, barangay: "  " }, "2026-10-29"));
  assert.ok(
    validateHarvest(
      { ...valid, municipality: "Outside Marinduque" },
      "2026-10-29",
    ),
  );
});
test("uses Philippine date across UTC midnight boundary", () => {
  assert.equal(
    todayInMarinduque(new Date("2026-10-28T18:00:00Z")),
    "2026-10-29",
  );
});
test("rejects malformed local storage records", () => {
  assert.equal(isHarvest(null), false);
  assert.equal(isHarvest({ id: "x", quantity: 3, price: 5 }), false);
});

test("accurately tracks 100 kg Banana split across 3 markets (40 + 35 + 25), rejects +1 kg over-allocation, and prevents double-counting on partial delivery", () => {
  const farmerHarvest: Harvest = {
    id: "harvest-100kg-santacruz",
    crop: "Banana",
    quantity: 100,
    price: 25,
    harvestDate: "2026-10-29",
    municipality: "Santa Cruz",
    barangay: "Alobo",
    storage: "Shaded and ventilated",
    priority: "Priority",
    status: "available",
  };

  const demands = initialMarketDemands();
  const [market1, market2, market3] = demands;

  // Step 1: Allocate 40 kg to Market 1, 35 kg to Market 2, 25 kg to Market 3
  const allocations: SupplyAllocation[] = [
    {
      id: "alloc-1",
      harvestListingId: farmerHarvest.id,
      marketDemandId: market1.id,
      farmerId: "f1",
      marketId: market1.marketId,
      marketName: market1.marketName,
      marketMunicipality: market1.municipality,
      crop: "Banana",
      allocatedQuantityKg: 40,
      deliveredQuantityKg: 0,
      releasedQuantityKg: 0,
      outstandingQuantityKg: 40,
      agreedPricePerKg: 28,
      status: "reserved",
      offerNotes: "",
      responseNotes: "",
      idempotencyKey: "k1",
      offeredAt: "2026-10-30T08:00:00Z",
    },
    {
      id: "alloc-2",
      harvestListingId: farmerHarvest.id,
      marketDemandId: market2.id,
      farmerId: "f1",
      marketId: market2.marketId,
      marketName: market2.marketName,
      marketMunicipality: market2.municipality,
      crop: "Banana",
      allocatedQuantityKg: 35,
      deliveredQuantityKg: 0,
      releasedQuantityKg: 0,
      outstandingQuantityKg: 35,
      agreedPricePerKg: 27,
      status: "reserved",
      offerNotes: "",
      responseNotes: "",
      idempotencyKey: "k2",
      offeredAt: "2026-10-30T08:01:00Z",
    },
    {
      id: "alloc-3",
      harvestListingId: farmerHarvest.id,
      marketDemandId: market3.id,
      farmerId: "f1",
      marketId: market3.marketId,
      marketName: market3.marketName,
      marketMunicipality: market3.municipality,
      crop: "Banana",
      allocatedQuantityKg: 25,
      deliveredQuantityKg: 0,
      releasedQuantityKg: 0,
      outstandingQuantityKg: 25,
      agreedPricePerKg: 26,
      status: "pending_acceptance",
      offerNotes: "",
      responseNotes: "",
      idempotencyKey: "k3",
      offeredAt: "2026-10-30T08:02:00Z",
    },
  ];

  const afterSplit = computeHarvestInventory(farmerHarvest, allocations);
  assert.equal(afterSplit.earmarkedKg, 25);
  assert.equal(afterSplit.reservedKg, 75);
  assert.equal(afterSplit.allocatedKg, 100);
  assert.equal(afterSplit.deliveredKg, 0);
  assert.equal(afterSplit.remainingKg, 0);

  // Attempting to allocate even 1 kg more must fail validation
  const overAllocError = validateAllocationOffer({
    harvest: farmerHarvest,
    demand: { ...market3, id: "MKT-DEM-EXTRA", remainingDemandKg: 20 },
    quantityKg: 1,
    existingAllocations: allocations,
  });
  assert.ok(overAllocError?.includes("exceeds your remaining available harvest"));

  // Rejecting Market 3's 25 kg offer restores 25 kg to Farmer
  allocations[2] = {
    ...allocations[2],
    status: "rejected",
    releasedQuantityKg: 25,
    outstandingQuantityKg: 0,
  };
  const afterRejection = computeHarvestInventory(farmerHarvest, allocations);
  assert.equal(afterRejection.allocatedKg, 75);
  assert.equal(afterRejection.remainingKg, 25);

  // Confirming partial delivery of 25 kg on Market 1's 40 kg shifts 25 kg from reservedKg to deliveredKg (no double count!)
  allocations[0] = {
    ...allocations[0],
    status: "partially_delivered",
    deliveredQuantityKg: 25,
    outstandingQuantityKg: 15,
  };
  const afterPartialDelivery = computeHarvestInventory(
    farmerHarvest,
    allocations,
  );
  assert.equal(afterPartialDelivery.reservedKg, 50); // 15 (M1) + 35 (M2)
  assert.equal(afterPartialDelivery.allocatedKg, 50);
  assert.equal(afterPartialDelivery.deliveredKg, 25);
  assert.equal(afterPartialDelivery.remainingKg, 25);

  const m1Totals = computeMarketDemandTotals(market1, allocations);
  assert.equal(m1Totals.reservedQuantityKg, 15);
  assert.equal(m1Totals.fulfilledQuantityKg, 25);
  assert.equal(m1Totals.remainingDemandKg, 0);
});

test("blocks allocation to unverified markets and evaluates spoilage urgency advisory", () => {
  const farmerHarvest: Harvest = {
    id: "h-1",
    crop: "Banana",
    quantity: 50,
    price: 25,
    harvestDate: "2026-10-25",
    municipality: "Boac",
    barangay: "Murallon",
    storage: "Ambient / open air",
    priority: "Priority",
    status: "available",
  };
  const unverifiedDemand = {
    ...initialMarketDemands()[0],
    marketVerified: false,
  };
  const err = validateAllocationOffer({
    harvest: farmerHarvest,
    demand: unverifiedDemand,
    quantityKg: 10,
  });
  assert.equal(err, "Cannot allocate supply to an unverified Market account.");

  const urgency = evaluateSpoilageUrgency(farmerHarvest, "2026-10-30");
  assert.equal(urgency.level, "high");
  assert.ok(urgency.advisoryText.includes("Advisory estimate only"));
});

test("per-unit and bulk-lot buying with package units (sack, crate, bunch, lot) and explicit conversion", () => {
  const bananaHarvestKg: Harvest = {
    id: "h-banana-kg",
    crop: "Banana",
    quantity: 100,
    unit: "kg",
    price: 30,
    harvestDate: "2026-10-29",
    municipality: "Boac",
    barangay: "Poblacion",
    storage: "Ventilated crate",
    priority: "Standard",
    status: "available",
  };

  const bunchDemand = {
    ...initialMarketDemands()[0],
    id: "demand-bunch",
    crop: "Banana",
    unit: "bunch" as const,
    buyingType: "per_unit" as const,
    unitPricePhp: 60,
    requiredQuantityKg: 20, // 20 bunches
    remainingDemandKg: 20,
    marketVerified: true,
  };

  // 1. Missing conversion factor when allocating kg inventory to bunch demand MUST FAIL
  const missingConvErr = validateAllocationOffer({
    harvest: bananaHarvestKg,
    demand: bunchDemand,
    quantityKg: 20,
    conversionRatioToKg: undefined,
  });
  assert.ok(missingConvErr?.includes("conversion factor"));

  // 2. With agreed conversion of 5 kg per bunch, offering 20 bunches requires 100 kg inventory
  const validConv = 5; // 5 kg / bunch
  const okValidation = validateAllocationOffer({
    harvest: bananaHarvestKg,
    demand: bunchDemand,
    quantityKg: 20,
    conversionRatioToKg: validConv,
  });
  assert.equal(okValidation, null);

  // 3. Trying to offer 21 bunches (21 * 5 = 105 kg) exceeds farmer's 100 kg stock
  const overConvErr = validateAllocationOffer({
    harvest: bananaHarvestKg,
    demand: { ...bunchDemand, remainingDemandKg: 30, requiredQuantityKg: 30 },
    quantityKg: 21,
    conversionRatioToKg: validConv,
  });
  assert.ok(overConvErr?.includes("exceeds your remaining available harvest"));

  // 4. Record allocation with deductedInventoryQuantity and test accounting
  const allocBunch: SupplyAllocation = {
    id: "alloc-bunch-1",
    harvestListingId: bananaHarvestKg.id,
    marketDemandId: bunchDemand.id,
    farmerId: "f1",
    marketId: bunchDemand.marketId,
    marketName: bunchDemand.marketName,
    marketMunicipality: bunchDemand.municipality,
    crop: "Banana",
    allocatedQuantityKg: 10, // 10 bunches offered
    deliveredQuantityKg: 0,
    releasedQuantityKg: 0,
    outstandingQuantityKg: 10,
    agreedPricePerKg: 60,
    unit: "bunch",
    inventoryUnit: "kg",
    buyingType: "per_unit",
    totalAgreedPrice: 600, // 10 bunches * ₱60
    conversionRatioToKg: 5,
    deductedInventoryQuantity: 50, // 10 bunches * 5 kg/bunch = 50 kg
    status: "reserved",
    offerNotes: "",
    responseNotes: "",
    idempotencyKey: "k-bunch",
    offeredAt: "2026-10-30T10:00:00Z",
  };

  const inventoryAfterBunch = computeHarvestInventory(bananaHarvestKg, [allocBunch]);
  assert.equal(inventoryAfterBunch.reservedKg, 50); // exactly 50 kg deducted
  assert.equal(inventoryAfterBunch.remainingKg, 50); // 50 kg remaining

  // 5. Test bulk/fixed-lot buying demand
  const bulkLotDemand = {
    ...initialMarketDemands()[0],
    id: "demand-bulk-lot",
    crop: "Banana",
    unit: "lot" as const,
    buyingType: "bulk_lot" as const,
    totalPricePhp: 2500, // ₱2,500 fixed lot price
    requiredQuantityKg: 1,
    remainingDemandKg: 1,
    marketVerified: true,
  };

  const allocLot: SupplyAllocation = {
    id: "alloc-lot-1",
    harvestListingId: bananaHarvestKg.id,
    marketDemandId: bulkLotDemand.id,
    farmerId: "f1",
    marketId: bulkLotDemand.marketId,
    marketName: bulkLotDemand.marketName,
    marketMunicipality: bulkLotDemand.municipality,
    crop: "Banana",
    allocatedQuantityKg: 1,
    deliveredQuantityKg: 0,
    releasedQuantityKg: 0,
    outstandingQuantityKg: 1,
    agreedPricePerKg: 2500,
    unit: "lot",
    inventoryUnit: "kg",
    buyingType: "bulk_lot",
    totalAgreedPrice: 2500,
    conversionRatioToKg: 50, // agreed lot weight is 50 kg
    deductedInventoryQuantity: 50,
    status: "reserved",
    offerNotes: "",
    responseNotes: "",
    idempotencyKey: "k-lot",
    offeredAt: "2026-10-30T10:05:00Z",
  };

  const inventoryAfterBoth = computeHarvestInventory(bananaHarvestKg, [allocBunch, allocLot]);
  assert.equal(inventoryAfterBoth.reservedKg, 100);
  assert.equal(inventoryAfterBoth.remainingKg, 0); // 100 kg fully committed!
});

test("final abstract alignment: value-add opportunities (4 crops), 6-municipality facility directory, batch pools, and SMS fallback parser", () => {
  // 1. Value add opportunities: Banana Chips, Uraro Flour, Cassava Starch, Coconut VCO
  assert.equal(VALUE_ADD_OPPORTUNITIES.length, 4);
  const banana = VALUE_ADD_OPPORTUNITIES.find((v) => v.crop === "Banana");
  const uraro = VALUE_ADD_OPPORTUNITIES.find((v) => v.crop === "Arrowroot (uraro)");
  const cassava = VALUE_ADD_OPPORTUNITIES.find((v) => v.crop === "Cassava");
  const coconut = VALUE_ADD_OPPORTUNITIES.find((v) => v.crop === "Coconut");
  assert.ok(banana && banana.yieldRatio === 0.35);
  assert.ok(uraro && uraro.yieldRatio === 0.2);
  assert.ok(cassava && cassava.yieldRatio === 0.25);
  assert.ok(coconut && coconut.yieldRatio === 0.08);
  assert.equal(coconut?.densityKgPerLiter, 0.92);
  assert.equal(coconut?.oilMassKg, 9.6);
  assert.equal(coconut?.outputQuantity, 10.43);
  const calculatedVolume = Number(
    (
      ((coconut?.standardInputKg ?? 120) * (coconut?.yieldRatio ?? 0.08)) /
      (coconut?.densityKgPerLiter ?? 0.92)
    ).toFixed(2),
  );
  assert.equal(calculatedVolume, 10.43);

  // 2. Facilities across all 6 municipalities
  assert.equal(MARINDUQUE_PROCESSING_FACILITIES.length, 6);
  const muns = new Set(
    MARINDUQUE_PROCESSING_FACILITIES.map((f) => f.municipality),
  );
  for (const mun of [
    "Boac",
    "Mogpog",
    "Santa Cruz",
    "Torrijos",
    "Buenavista",
    "Gasan",
  ]) {
    assert.ok(muns.has(mun), `Missing facility in ${mun}`);
  }
  for (const fac of MARINDUQUE_PROCESSING_FACILITIES) {
    assert.equal(fac.isVerified, false);
    assert.equal(fac.dataClassification, "sample_demo");
  }

  // 3. Batch pooling
  assert.ok(INITIAL_BATCH_POOLS.length >= 2);
  const scPool = INITIAL_BATCH_POOLS.find((p) => p.id === "POOL-SC-01");
  assert.ok(scPool && scPool.totalPooledKg === 100);

  // 4. SMS Fallback parser
  const parsedAni = parseSmsCommand("ANI BANANA 100 KG 25 SANTACRUZ ALOBO");
  assert.ok(parsedAni.valid);
  if (parsedAni.valid) {
    assert.equal(parsedAni.type, "ANI");
    assert.equal(parsedAni.crop, "BANANA");
    assert.equal(parsedAni.quantity, 100);
    assert.equal(parsedAni.unit, "kg");
    assert.equal(parsedAni.price, 25);
    const reply = generateSmsReply(parsedAni);
    assert.ok(reply.includes("Matagumpay na naitala"));
  }

  const parsedPresyo = parseSmsCommand("PRESYO BANANA BOAC");
  assert.ok(parsedPresyo.valid);
  if (parsedPresyo.valid) {
    assert.equal(parsedPresyo.type, "PRESYO");
    const reply = generateSmsReply(parsedPresyo);
    assert.ok(reply.includes("Presyo sa BOAC"));
  }

  const demandSms = parseSmsCommand("DEMAND BANANA");
  assert.ok(demandSms.valid);
  if (demandSms.valid) {
    assert.equal(demandSms.type, "DEMAND");
    const reply = generateSmsReply(demandSms);
    assert.ok(reply.includes("Aktibong Demand para sa BANANA"));
  }
});
