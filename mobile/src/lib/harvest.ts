export const PRIORITY_CROPS = [
  "Arrowroot (uraro)",
  "Cassava",
  "Banana",
  "Coconut",
] as const;

export const CROPS = [
  "Arrowroot (uraro)",
  "Cassava",
  "Banana",
  "Coconut",
  "Camote",
  "Vegetables",
] as const;

export function isPriorityCrop(crop: string): boolean {
  return (PRIORITY_CROPS as readonly string[]).includes(crop);
}

export const MUNICIPALITIES = [
  "Boac",
  "Mogpog",
  "Santa Cruz",
  "Torrijos",
  "Buenavista",
  "Gasan",
] as const;

export const STORAGE = [
  "Shaded and ventilated",
  "Ambient / open air",
  "Refrigerated",
  "Other / unknown",
] as const;

export const MEASUREMENT_UNITS = [
  "kg",
  "sack",
  "crate",
  "bunch",
  "lot",
] as const;

export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export const BUYING_TYPES = ["per_unit", "bulk_lot"] as const;
export type BuyingType = (typeof BUYING_TYPES)[number];

export function unitLabel(unit?: MeasurementUnit | string): string {
  switch (unit) {
    case "sack":
      return "sako (sack)";
    case "crate":
      return "kahon (crate)";
    case "bunch":
      return "buwig (bunch)";
    case "lot":
      return "buong lote (lot)";
    case "kg":
    default:
      return "kilo (kg)";
  }
}

export const QUALITY_GRADES = [
  "Grade A",
  "Grade B",
  "Standard / Mixed",
] as const;

export type QualityGrade = (typeof QUALITY_GRADES)[number];

export type AllocationStatus =
  | "proposed"
  | "pending_acceptance"
  | "reserved"
  | "in_delivery"
  | "partially_delivered"
  | "delivered"
  | "rejected"
  | "cancelled";

export type MarketType =
  | "public_market"
  | "retail_buyer"
  | "cooperative"
  | "food_processor"
  | "institutional_buyer";

export type Harvest = {
  id: string;
  farmerId?: string;
  crop: string;
  quantity: number;
  unit?: MeasurementUnit;
  conversionRateKg?: number;
  qualityGrade?: QualityGrade;
  photoRef?: string;
  price: number;
  harvestDate: string;
  municipality: string;
  barangay: string;
  storage: string;
  priority: "Standard" | "Priority";
  status?: "draft" | "pending_verification" | "available" | "rejected" | "closed";
  earmarkedKg?: number;
  reservedKg?: number;
  allocatedKg?: number;
  deliveredKg?: number;
  remainingKg?: number;
  syncState?: "synced" | "offline_draft";
  idempotencyKey?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string;
  createdAt?: string;
  gpsCoordinates?: string;
  harvestSchedule?: string;
  storageTempC?: number;
  assistedByCoordinator?: boolean;
  coordinatorName?: string;
  batchPoolId?: string;
};

export type HarvestInput = {
  crop: string;
  quantity: string;
  unit?: MeasurementUnit;
  conversionRateKg?: string | number;
  price: string;
  harvestDate: string;
  municipality: string;
  barangay: string;
  storage: string;
  priority: "Standard" | "Priority";
  qualityGrade?: QualityGrade;
  photoRef?: string;
  gpsCoordinates?: string;
  harvestSchedule?: string;
  storageTempC?: number | string;
  assistedByCoordinator?: boolean;
  coordinatorName?: string;
};

export type MarketDemand = {
  id: string;
  marketId: string;
  marketName: string;
  marketType: MarketType;
  marketVerified: boolean;
  crop: string;
  quantity?: number;
  requiredQuantityKg: number;
  reservedQuantityKg: number;
  fulfilledQuantityKg: number;
  remainingDemandKg: number;
  unit?: MeasurementUnit;
  buyingType?: BuyingType;
  unitPricePhp?: number;
  totalPricePhp?: number;
  expectedKgPerUnit?: number;
  preferredQualityGrade: "Any" | QualityGrade;
  offeredPricePerKg: number;
  municipality: string;
  barangay: string;
  requiredBy: string;
  acceptPartial: boolean;
  qualityNotes: string;
  status: "open" | "partially_fulfilled" | "fulfilled" | "cancelled" | "closed";
};

export type SupplyAllocation = {
  id: string;
  harvestListingId: string;
  marketDemandId: string;
  farmerId: string;
  marketId: string;
  marketName: string;
  marketMunicipality: string;
  crop: string;
  allocatedQuantityKg: number;
  deliveredQuantityKg: number;
  releasedQuantityKg: number;
  outstandingQuantityKg: number;
  agreedPricePerKg: number;
  unit?: MeasurementUnit;
  inventoryUnit?: MeasurementUnit;
  buyingType?: BuyingType;
  totalAgreedPrice?: number;
  conversionRatioToKg?: number;
  deductedInventoryQuantity?: number;
  status: AllocationStatus;
  offerNotes: string;
  responseNotes: string;
  idempotencyKey: string;
  offeredAt: string;
  respondedAt?: string | null;
  completedAt?: string | null;
};

export type SpoilageAdvisory = {
  level: "high" | "moderate" | "low";
  daysSinceHarvest: number;
  estimatedWindowDays: number;
  remainingWindowDays: number;
  badgeText: string;
  advisoryText: string;
};

export function todayInMarinduque(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDaysInMarinduque(days: number, baseDateStr = todayInMarinduque()): string {
  const base = new Date(`${baseDateStr}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function validateHarvest(
  input: HarvestInput,
  today = todayInMarinduque(),
): string | null {
  if (!(CROPS as readonly string[]).includes(input.crop))
    return "Choose a crop.";
  if (
    !input.quantity.trim() ||
    !Number.isFinite(Number(input.quantity)) ||
    Number(input.quantity) <= 0 ||
    Number(input.quantity) > 1000000
  )
    return "Enter a quantity greater than 0 and no more than 1,000,000 kg.";
  if (
    !input.price.trim() ||
    !Number.isFinite(Number(input.price)) ||
    Number(input.price) < 0 ||
    Number(input.price) > 1000000
  )
    return "Enter an asking price from 0 to 1,000,000 pesos per kg.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.harvestDate))
    return "Use YYYY-MM-DD for the harvest date.";
  const date = new Date(`${input.harvestDate}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.harvestDate
  )
    return "Enter a valid calendar date.";
  if (input.harvestDate > today) return "Harvest date cannot be in the future.";
  if (!(MUNICIPALITIES as readonly string[]).includes(input.municipality))
    return "Choose a municipality in Marinduque.";
  if (!input.barangay.trim() || input.barangay.trim().length > 100)
    return "Enter a barangay (1–100 characters).";
  if (!(STORAGE as readonly string[]).includes(input.storage))
    return "Choose a storage condition.";
  if (!["Standard", "Priority"].includes(input.priority))
    return "Choose a listing priority.";
  if (
    input.qualityGrade !== undefined &&
    !(QUALITY_GRADES as readonly string[]).includes(input.qualityGrade)
  )
    return "Choose a valid quality grade.";
  return null;
}

export function isHarvest(value: unknown): value is Harvest {
  if (typeof value !== "object" || value === null) return false;
  const h = value as Harvest;
  return (
    typeof h.id === "string" &&
    typeof h.quantity === "number" &&
    typeof h.price === "number" &&
    [
      "crop",
      "harvestDate",
      "municipality",
      "barangay",
      "storage",
      "priority",
    ].every((key) => typeof h[key as keyof Harvest] === "string") &&
    validateHarvest({
      ...h,
      quantity: String(h.quantity),
      price: String(h.price),
    }) === null
  );
}

/**
 * Computes non-double-counted inventory totals for a Farmer harvest listing.
 * - earmarkedKg: undelivered quantity in 'proposed' | 'pending_acceptance'
 * - reservedKg: undelivered quantity in 'reserved' | 'in_delivery' | 'partially_delivered'
 * - allocatedKg = earmarkedKg + reservedKg (outstanding committed quantity)
 * - deliveredKg: cumulative confirmed received quantity across all allocations
 * - remainingKg = quantity - allocatedKg - deliveredKg
 */
export function computeHarvestInventory(
  harvest: Harvest,
  allocations: readonly SupplyAllocation[],
): Harvest {
  const matching = allocations.filter((a) => a.harvestListingId === harvest.id);
  if (matching.length === 0) {
    const earmarked = harvest.earmarkedKg ?? 0;
    const reserved = harvest.reservedKg ?? 0;
    const allocated = harvest.allocatedKg ?? earmarked + reserved;
    const delivered = harvest.deliveredKg ?? 0;
    const remaining = Math.max(0, Number((harvest.quantity - allocated - delivered).toFixed(3)));
    return {
      ...harvest,
      unit: harvest.unit ?? "kg",
      qualityGrade: harvest.qualityGrade ?? "Grade A",
      earmarkedKg: earmarked,
      reservedKg: reserved,
      allocatedKg: allocated,
      deliveredKg: delivered,
      remainingKg: remaining,
    };
  }

  let earmarkedKg = 0;
  let reservedKg = 0;
  let deliveredKg = 0;

  for (const alloc of matching) {
    const outstandingAllocated = Math.max(
      0,
      Number(
        (
          alloc.allocatedQuantityKg -
          alloc.deliveredQuantityKg -
          alloc.releasedQuantityKg
        ).toFixed(3),
      ),
    );

    // If cross-unit deduction was recorded, scale by the inventory deduction ratio
    const invFactor =
      alloc.deductedInventoryQuantity && alloc.allocatedQuantityKg > 0
        ? alloc.deductedInventoryQuantity / alloc.allocatedQuantityKg
        : 1;

    const outstanding = Number((outstandingAllocated * invFactor).toFixed(3));
    const invDelivered = Number(
      (alloc.deliveredQuantityKg * invFactor).toFixed(3),
    );

    if (alloc.status === "proposed" || alloc.status === "pending_acceptance") {
      earmarkedKg = Number((earmarkedKg + outstanding).toFixed(3));
    } else if (
      alloc.status === "reserved" ||
      alloc.status === "in_delivery" ||
      alloc.status === "partially_delivered"
    ) {
      reservedKg = Number((reservedKg + outstanding).toFixed(3));
    }
    deliveredKg = Number((deliveredKg + invDelivered).toFixed(3));
  }

  const allocatedKg = Number((earmarkedKg + reservedKg).toFixed(3));
  const remainingKg = Math.max(
    0,
    Number((harvest.quantity - allocatedKg - deliveredKg).toFixed(3)),
  );

  return {
    ...harvest,
    unit: harvest.unit ?? "kg",
    qualityGrade: harvest.qualityGrade ?? "Grade A",
    earmarkedKg,
    reservedKg,
    allocatedKg,
    deliveredKg,
    remainingKg,
  };
}

/**
 * Computes Market demand capacity totals without double-counting reserved and fulfilled quantities.
 * Note: 'proposed' and 'pending_acceptance' offers do NOT reduce remainingDemandKg until accepted ('reserved').
 */
export function computeMarketDemandTotals(
  demand: MarketDemand,
  allocations: readonly SupplyAllocation[],
): MarketDemand {
  const matching = allocations.filter((a) => a.marketDemandId === demand.id);
  let reservedQuantityKg = 0;
  let fulfilledQuantityKg = 0;

  for (const alloc of matching) {
    const outstanding = Math.max(
      0,
      Number(
        (
          alloc.allocatedQuantityKg -
          alloc.deliveredQuantityKg -
          alloc.releasedQuantityKg
        ).toFixed(3),
      ),
    );
    if (
      alloc.status === "reserved" ||
      alloc.status === "in_delivery" ||
      alloc.status === "partially_delivered"
    ) {
      reservedQuantityKg = Number((reservedQuantityKg + outstanding).toFixed(3));
    }
    fulfilledQuantityKg = Number(
      (fulfilledQuantityKg + alloc.deliveredQuantityKg).toFixed(3),
    );
  }

  const remainingDemandKg = Math.max(
    0,
    Number(
      (
        demand.requiredQuantityKg -
        reservedQuantityKg -
        fulfilledQuantityKg
      ).toFixed(3),
    ),
  );

  let status = demand.status;
  if (status !== "cancelled" && status !== "closed") {
    if (fulfilledQuantityKg >= demand.requiredQuantityKg) {
      status = "fulfilled";
    } else if (fulfilledQuantityKg > 0 || reservedQuantityKg > 0) {
      status = "partially_fulfilled";
    } else {
      status = "open";
    }
  }

  return {
    ...demand,
    reservedQuantityKg,
    fulfilledQuantityKg,
    remainingDemandKg,
    status,
  };
}

export function validateAllocationOffer(params: {
  harvest: Harvest;
  demand: MarketDemand;
  quantityKg: number;
  conversionRatioToKg?: number;
  existingAllocations?: readonly SupplyAllocation[];
}): string | null {
  const {
    harvest,
    demand,
    quantityKg,
    conversionRatioToKg,
    existingAllocations = [],
  } = params;

  if (!Number.isFinite(quantityKg) || quantityKg <= 0 || quantityKg > 1000000) {
    return "Enter an allocation quantity greater than 0.";
  }

  if (harvest.status && harvest.status !== "available") {
    return `Harvest listing must be Admin-verified (available) before allocating to markets (current status: ${harvest.status}).`;
  }

  if (!demand.marketVerified) {
    return "Cannot allocate supply to an unverified Market account.";
  }

  if (demand.status !== "open" && demand.status !== "partially_fulfilled") {
    return `Market demand is no longer open for offers (status: ${demand.status}).`;
  }

  if (harvest.crop !== demand.crop) {
    return `Crop mismatch: your listing is ${harvest.crop}, but this market requires ${demand.crop}.`;
  }

  const harvestUnit = harvest.unit ?? "kg";
  const demandUnit = demand.unit ?? "kg";

  let requiredInventoryQuantity = quantityKg;
  if (harvestUnit !== demandUnit) {
    if (harvestUnit === "kg" && demandUnit !== "kg") {
      if (!conversionRatioToKg || conversionRatioToKg <= 0) {
        return `Explicit agreed conversion factor (weight per unit) is required to allocate kg-based inventory to package-based demand (kg per ${demandUnit}). Standard package weights cannot be assumed.`;
      }
      requiredInventoryQuantity = Number(
        (quantityKg * conversionRatioToKg).toFixed(3),
      );
    } else if (harvestUnit !== "kg" && demandUnit === "kg") {
      if (!conversionRatioToKg || conversionRatioToKg <= 0) {
        return `Explicit agreed conversion factor (weight per unit) is required to allocate ${harvestUnit} inventory to kg demand (kg per ${harvestUnit}).`;
      }
      requiredInventoryQuantity = Number(
        (quantityKg / conversionRatioToKg).toFixed(3),
      );
    } else {
      return `Incompatible units: cannot allocate directly between ${harvestUnit} and ${demandUnit} without explicit conversion factor.`;
    }
  }

  const computedHarvest = computeHarvestInventory(harvest, existingAllocations);
  const remainingHarvest = computedHarvest.remainingKg ?? harvest.quantity;

  if (requiredInventoryQuantity > remainingHarvest) {
    return `Allocation (${quantityKg} ${demandUnit}${
      harvestUnit !== demandUnit ? ` = ${requiredInventoryQuantity} ${harvestUnit}` : ""
    }) exceeds your remaining available harvest (${remainingHarvest} ${harvestUnit} out of ${harvest.quantity} ${harvestUnit}).`;
  }

  const computedDemand = computeMarketDemandTotals(demand, existingAllocations);
  if (quantityKg > computedDemand.remainingDemandKg) {
    return `Offer (${quantityKg} ${demandUnit}) exceeds the Market's remaining unfulfilled demand (${computedDemand.remainingDemandKg} ${demandUnit}).`;
  }

  if (!demand.acceptPartial && quantityKg !== computedDemand.remainingDemandKg) {
    return `This Market does not accept partial quantities; you must offer the full remaining ${computedDemand.remainingDemandKg} ${demandUnit}.`;
  }

  const duplicateActive = existingAllocations.some(
    (a) =>
      a.harvestListingId === harvest.id &&
      a.marketDemandId === demand.id &&
      (a.status === "proposed" ||
        a.status === "pending_acceptance" ||
        a.status === "reserved" ||
        a.status === "in_delivery" ||
        a.status === "partially_delivered"),
  );
  if (duplicateActive) {
    return "An active offer or reservation already exists between this harvest listing and this market demand.";
  }

  return null;
}

/**
 * Advisory Spoilage Urgency Indicator based on crop type, harvest date, and storage condition.
 * Explicitly labeled as an advisory planning estimate, never a food-safety guarantee.
 */
export function evaluateSpoilageUrgency(
  harvest: Pick<Harvest, "crop" | "harvestDate" | "storage" | "priority">,
  today = todayInMarinduque(),
): SpoilageAdvisory {
  const harvestMs = new Date(`${harvest.harvestDate}T00:00:00Z`).getTime();
  const todayMs = new Date(`${today}T00:00:00Z`).getTime();
  const daysSinceHarvest = Math.max(
    0,
    Math.round((todayMs - harvestMs) / (1000 * 60 * 60 * 24)),
  );

  const baseWindowByCrop: Record<string, number> = {
    Vegetables: 3,
    Banana: 5,
    Cassava: 4,
    Camote: 10,
    "Arrowroot (uraro)": 12,
    Coconut: 21,
  };
  let estimatedWindowDays = baseWindowByCrop[harvest.crop] ?? 5;

  if (harvest.storage === "Refrigerated") {
    estimatedWindowDays += 3;
  } else if (
    harvest.storage === "Ambient / open air" ||
    harvest.storage === "Other / unknown"
  ) {
    estimatedWindowDays = Math.max(2, estimatedWindowDays - 1);
  }

  const remainingWindowDays = estimatedWindowDays - daysSinceHarvest;

  if (remainingWindowDays <= 2 || harvest.priority === "Priority") {
    return {
      level: "high",
      daysSinceHarvest,
      estimatedWindowDays,
      remainingWindowDays: Math.max(0, remainingWindowDays),
      badgeText: "HIGH SPOILAGE URGENCY (ADVISORY)",
      advisoryText: `Harvested ${daysSinceHarvest}d ago (${harvest.storage}). Prioritize market allocation within ${Math.max(1, remainingWindowDays)}–2 days to prevent spoilage. Advisory estimate only; not a food-safety guarantee.`,
    };
  }

  if (remainingWindowDays <= 4) {
    return {
      level: "moderate",
      daysSinceHarvest,
      estimatedWindowDays,
      remainingWindowDays,
      badgeText: "MODERATE URGENCY (ADVISORY)",
      advisoryText: `Harvested ${daysSinceHarvest}d ago (${harvest.storage}). Approx. ${remainingWindowDays} days in typical handling window. Advisory estimate only.`,
    };
  }

  return {
    level: "low",
    daysSinceHarvest,
    estimatedWindowDays,
    remainingWindowDays,
    badgeText: "STABLE WINDOW (ADVISORY)",
    advisoryText: `Harvested ${daysSinceHarvest}d ago (${harvest.storage}). Typical handling window ~${remainingWindowDays} days remaining. Advisory estimate only.`,
  };
}

export function initialHarvests(): Harvest[] {
  const harvestDate = todayInMarinduque();
  return [
    {
      id: "demo-banana",
      crop: "Banana",
      quantity: 100,
      unit: "kg",
      qualityGrade: "Grade A",
      photoRef: "Saba green hands in ventilated crates (Santa Cruz)",
      price: 25,
      harvestDate,
      municipality: "Santa Cruz",
      barangay: "Demo barangay",
      storage: STORAGE[0],
      priority: "Priority",
      status: "available",
      earmarkedKg: 0,
      reservedKg: 0,
      allocatedKg: 0,
      deliveredKg: 0,
      remainingKg: 100,
    },
    {
      id: "demo-cassava",
      crop: "Cassava",
      quantity: 320,
      unit: "kg",
      qualityGrade: "Grade A",
      photoRef: "Freshly harvested cassava tubers",
      price: 18,
      harvestDate,
      municipality: "Boac",
      barangay: "Demo barangay",
      storage: STORAGE[0],
      priority: "Standard",
      status: "available",
      earmarkedKg: 0,
      reservedKg: 0,
      allocatedKg: 0,
      deliveredKg: 0,
      remainingKg: 320,
    },
  ];
}

export function initialMarketDemands(): MarketDemand[] {
  const today = todayInMarinduque();
  return [
    {
      id: "MKT-DEM-01",
      marketId: "market-boac-01",
      marketName: "Market 1 · Boac Public Market Stall 12",
      marketType: "public_market",
      marketVerified: true,
      crop: "Banana",
      requiredQuantityKg: 40,
      reservedQuantityKg: 0,
      fulfilledQuantityKg: 0,
      remainingDemandKg: 40,
      unit: "kg",
      buyingType: "per_unit",
      unitPricePhp: 30,
      totalPricePhp: 1200,
      preferredQualityGrade: "Grade A",
      offeredPricePerKg: 30,
      municipality: "Boac",
      barangay: "Murallon",
      requiredBy: addDaysInMarinduque(3, today),
      acceptPartial: true,
      qualityNotes: "40 kg Banana at ₱30 per kg (daily wet market retail).",
      status: "open",
    },
    {
      id: "MKT-DEM-02",
      marketId: "market-mogpog-02",
      marketName: "Market 2 · Mogpog Growers & Retailers Coop",
      marketType: "cooperative",
      marketVerified: true,
      crop: "Banana",
      requiredQuantityKg: 35,
      reservedQuantityKg: 0,
      fulfilledQuantityKg: 0,
      remainingDemandKg: 35,
      unit: "kg",
      buyingType: "per_unit",
      unitPricePhp: 27,
      totalPricePhp: 945,
      preferredQualityGrade: "Grade A",
      offeredPricePerKg: 27,
      municipality: "Mogpog",
      barangay: "Anapog",
      requiredBy: addDaysInMarinduque(4, today),
      acceptPartial: true,
      qualityNotes: "35 kg Banana at ₱27 per kg (cooperative distribution center).",
      status: "open",
    },
    {
      id: "MKT-DEM-03",
      marketId: "market-santacruz-03",
      marketName: "Market 3 · Santa Cruz Banana Chips Hub",
      marketType: "food_processor",
      marketVerified: true,
      crop: "Banana",
      requiredQuantityKg: 25,
      reservedQuantityKg: 0,
      fulfilledQuantityKg: 0,
      remainingDemandKg: 25,
      unit: "kg",
      buyingType: "per_unit",
      unitPricePhp: 26,
      totalPricePhp: 650,
      preferredQualityGrade: "Any",
      offeredPricePerKg: 26,
      municipality: "Santa Cruz",
      barangay: "Buyabod",
      requiredBy: addDaysInMarinduque(5, today),
      acceptPartial: true,
      qualityNotes: "25 kg Banana at ₱26 per kg (firm Saba for slicing/chips).",
      status: "open",
    },
    {
      id: "MKT-DEM-04",
      marketId: "market-mogpog-04",
      marketName: "Mogpog Cassava Starch & Food Hub",
      marketType: "food_processor",
      marketVerified: true,
      crop: "Cassava",
      requiredQuantityKg: 2,
      reservedQuantityKg: 0,
      fulfilledQuantityKg: 0,
      remainingDemandKg: 2,
      unit: "sack",
      buyingType: "per_unit",
      unitPricePhp: 800,
      totalPricePhp: 1600,
      preferredQualityGrade: "Grade A",
      offeredPricePerKg: 16,
      municipality: "Mogpog",
      barangay: "Gitnang Bayan",
      requiredBy: addDaysInMarinduque(6, today),
      acceptPartial: true,
      qualityNotes: "2 sacks Cassava at ₱800 per sack (₱1,600 total).",
      status: "open",
    },
    {
      id: "MKT-DEM-05",
      marketId: "market-gasan-05",
      marketName: "Gasan Fresh Produce & Veggie Stall",
      marketType: "retail_buyer",
      marketVerified: true,
      crop: "Vegetables",
      requiredQuantityKg: 3,
      reservedQuantityKg: 0,
      fulfilledQuantityKg: 0,
      remainingDemandKg: 3,
      unit: "crate",
      buyingType: "per_unit",
      unitPricePhp: 500,
      totalPricePhp: 1500,
      preferredQualityGrade: "Grade A",
      offeredPricePerKg: 20,
      municipality: "Gasan",
      barangay: "Poblacion",
      requiredBy: addDaysInMarinduque(3, today),
      acceptPartial: true,
      qualityNotes: "3 crates Vegetables at ₱500 per crate (₱1,500 total).",
      status: "open",
    },
    {
      id: "MKT-DEM-06",
      marketId: "market-boac-06",
      marketName: "Boac Wholesale Fruit Wholesalers",
      marketType: "public_market",
      marketVerified: true,
      crop: "Banana",
      requiredQuantityKg: 20,
      reservedQuantityKg: 0,
      fulfilledQuantityKg: 0,
      remainingDemandKg: 20,
      unit: "bunch",
      buyingType: "per_unit",
      unitPricePhp: 60,
      totalPricePhp: 1200,
      preferredQualityGrade: "Grade A",
      offeredPricePerKg: 12,
      municipality: "Boac",
      barangay: "San Miguel",
      requiredBy: addDaysInMarinduque(4, today),
      acceptPartial: true,
      qualityNotes: "20 bunches Banana at ₱60 per bunch (₱1,200 total).",
      status: "open",
    },
    {
      id: "MKT-DEM-07",
      marketId: "market-torrijos-07",
      marketName: "Torrijos Agro-Coop Bulk Aggregator",
      marketType: "cooperative",
      marketVerified: true,
      crop: "Banana",
      requiredQuantityKg: 1,
      reservedQuantityKg: 0,
      fulfilledQuantityKg: 0,
      remainingDemandKg: 1,
      unit: "lot",
      buyingType: "bulk_lot",
      unitPricePhp: 2500,
      totalPricePhp: 2500,
      preferredQualityGrade: "Standard / Mixed",
      offeredPricePerKg: 25,
      municipality: "Torrijos",
      barangay: "Poblacion",
      requiredBy: addDaysInMarinduque(5, today),
      acceptPartial: false,
      qualityNotes: "1 complete harvest lot Banana at ₱2,500 total (fixed bulk lot purchase).",
      status: "open",
    },
  ];
}

export const MARKET_BUSINESS_TYPES = [
  "Public / Wet Market Buyer",
  "Retailer / Grocery",
  "Cooperative",
  "Food Processor",
  "Institutional Buyer",
  "Wholesaler / Agricultural Trader",
] as const;

export type MarketBusinessType = (typeof MARKET_BUSINESS_TYPES)[number];

export type MarketAccount = {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  contactNumber?: string;
  municipality: string;
  businessAddress?: string;
  businessType: MarketBusinessType | string;
  verificationStatus: "verified" | "pending_verification" | "rejected";
  verificationNotes?: string;
};

export const INITIAL_DEMO_MARKETS: MarketAccount[] = [
  {
    id: "market-boac-01",
    name: "Market 1 · Boac Public Market Stall 12",
    contactPerson: "Aling Nena",
    email: "market1.boac@marinduque.ph",
    contactNumber: "0917-111-2233",
    municipality: "Boac",
    businessAddress: "Stall 12, Boac Public Market, Murallon, Boac",
    businessType: "Public / Wet Market Buyer",
    verificationStatus: "verified",
    verificationNotes: "Verified by Provincial Admin (Permit #BC-2026-112).",
  },
  {
    id: "market-mogpog-02",
    name: "Market 2 · Mogpog Growers & Retailers Coop",
    contactPerson: "Mang Mario",
    email: "coop.mogpog@marinduque.ph",
    contactNumber: "0918-222-3344",
    municipality: "Mogpog",
    businessAddress: "Cooperative Trading Post, Anapog, Mogpog",
    businessType: "Cooperative",
    verificationStatus: "verified",
    verificationNotes: "Verified CDA Cooperative buyer.",
  },
  {
    id: "market-santacruz-03",
    name: "Market 3 · Santa Cruz Banana Chips Hub",
    contactPerson: "Tita Grace",
    email: "chips.santacruz@marinduque.ph",
    contactNumber: "0919-333-4455",
    municipality: "Santa Cruz",
    businessAddress: "Buyabod Processing Center, Santa Cruz",
    businessType: "Food Processor",
    verificationStatus: "verified",
    verificationNotes: "Verified food processor classified as Market account.",
  },
  {
    id: "market-gasan-unverified",
    name: "Gasan Coastal Retail Stall (Unverified)",
    contactPerson: "Jun Reyes",
    email: "gasan.retail@marinduque.ph",
    contactNumber: "0920-444-5566",
    municipality: "Gasan",
    businessAddress: "Poblacion Market Center, Gasan",
    businessType: "Retailer / Grocery",
    verificationStatus: "pending_verification",
    verificationNotes: "Newly registered Market account; awaiting Admin verification.",
  },
];

export type FarmerAccount = {
  id: string;
  name: string;
  email: string;
  contactNumber?: string;
  municipality: string;
  barangay?: string;
  farmInfo?: string;
  verificationStatus: "verified" | "pending_verification";
};

export const INITIAL_DEMO_FARMER: FarmerAccount = {
  id: "farmer-dante-01",
  name: "Kuya Dante (Santa Cruz)",
  email: "farmer.dante@marinduque.ph",
  contactNumber: "0928-123-4567",
  municipality: "Santa Cruz",
  barangay: "Alobo",
  farmInfo: "Alobo Smallholder Farm (Saba & Rootcrops, 1.5 ha)",
  verificationStatus: "verified",
};

export type ProcessingFacility = {
  id: string;
  name: string;
  municipality: string;
  barangay: string;
  address: string;
  latitude: number;
  longitude: number;
  acceptedCrops: string[];
  capabilities: string[];
  processingFeeDescription: string;
  contactPerson: string;
  contactPhone: string;
  operatingHours: string;
  lastUpdated: string;
  isVerified: boolean;
  dataClassification: "sample_demo" | "verified";
  verificationNote: string;
};

export const MARINDUQUE_PROCESSING_FACILITIES: ProcessingFacility[] = [
  {
    id: "FAC-BOAC-01",
    name: "Boac Agri-Industrial Food Innovation Center",
    municipality: "Boac",
    barangay: "Poblacion",
    address: "Provincial Capitol Compound, Boac",
    latitude: 13.4464,
    longitude: 121.8419,
    acceptedCrops: ["Banana", "Arrowroot (uraro)", "Cassava", "Vegetables"],
    capabilities: [
      "Mechanical slicing & dehydration",
      "Vacuum-fryer for Banana Chips",
      "Rootcrop milling & flour pulverizer",
      "Nitrogen-flushed foil packaging",
    ],
    processingFeeDescription:
      "₱15/kg green Saba input (slicing & drying); ₱20/kg uraro rhizomes (washing & milling).",
    contactPerson: "Demo Coordinator (Illustrative Fixture)",
    contactPhone: "Sample Demo Only (Illustrative)",
    operatingHours: "Mon-Sat: 7:00 AM – 5:00 PM",
    lastUpdated: "October 2026",
    isVerified: false,
    dataClassification: "sample_demo",
    verificationNote:
      "Sample / Demonstration record for Marinduque prototype. Contact details, fees, and exact equipment are illustrative fixtures for UI demonstration.",
  },
  {
    id: "FAC-MOGPOG-02",
    name: "Mogpog Cassava Starch & Food Hub",
    municipality: "Mogpog",
    barangay: "Gitnang Bayan",
    address: "Municipal Agricultural Complex, Mogpog",
    latitude: 13.5042,
    longitude: 121.8617,
    acceptedCrops: ["Cassava", "Camote", "Banana"],
    capabilities: [
      "Root peeler & heavy-duty rasper",
      "Hydraulic starch press",
      "Sedimentation tanks & solar drying tunnel",
      "Food-grade cassava grates sealing",
    ],
    processingFeeDescription:
      "₱10/kg fresh roots rasping & pressing; ₱80/sack (50 kg) bulk starch extraction.",
    contactPerson: "Demo Coordinator (Illustrative Fixture)",
    contactPhone: "Sample Demo Only (Illustrative)",
    operatingHours: "Mon-Fri: 8:00 AM – 4:30 PM",
    lastUpdated: "October 2026",
    isVerified: false,
    dataClassification: "sample_demo",
    verificationNote:
      "Sample / Demonstration record for Marinduque prototype. Contact details, fees, and exact equipment are illustrative fixtures for UI demonstration.",
  },
  {
    id: "FAC-SANTACRUZ-03",
    name: "Santa Cruz Arrowroot / Uraro Processing Mill",
    municipality: "Santa Cruz",
    barangay: "Alobo",
    address: "Barangay Agro-Processing Center, Santa Cruz",
    latitude: 13.4839,
    longitude: 122.0289,
    acceptedCrops: ["Arrowroot (uraro)", "Cassava"],
    capabilities: [
      "High-pressure rhizome washer",
      "Cylindrical rasping drum",
      "Triple sedimentation decanters",
      "Fine mesh sieve & uraro starch drying tables",
    ],
    processingFeeDescription:
      "₱18/kg fresh rhizome processing fee or 15% toll milling starch share.",
    contactPerson: "Demo Coordinator (Illustrative Fixture)",
    contactPhone: "Sample Demo Only (Illustrative)",
    operatingHours: "Mon-Sat: 6:00 AM – 6:00 PM (Harvest Season)",
    lastUpdated: "October 2026",
    isVerified: false,
    dataClassification: "sample_demo",
    verificationNote:
      "Sample / Demonstration record for Marinduque prototype. Contact details, fees, and exact equipment are illustrative fixtures for UI demonstration.",
  },
  {
    id: "FAC-TORRIJOS-04",
    name: "Torrijos Multi-Commodity Agro-Processing Station",
    municipality: "Torrijos",
    barangay: "Maranlig",
    address: "National Highway, Maranlig, Torrijos",
    latitude: 13.3183,
    longitude: 122.0883,
    acceptedCrops: ["Banana", "Camote", "Coconut"],
    capabilities: [
      "Hot-air cabinet dehydrators",
      "Banana and camote chip cutters",
      "Smokeless copra drying beds",
      "Batch weighing & labeling",
    ],
    processingFeeDescription:
      "₱12/kg raw vegetable/fruit dehydration fee; ₱1.50/coconut copra processing.",
    contactPerson: "Demo Coordinator (Illustrative Fixture)",
    contactPhone: "Sample Demo Only (Illustrative)",
    operatingHours: "Mon-Fri: 7:30 AM – 4:30 PM",
    lastUpdated: "October 2026",
    isVerified: false,
    dataClassification: "sample_demo",
    verificationNote:
      "Sample / Demonstration record for Marinduque prototype. Contact details, fees, and exact equipment are illustrative fixtures for UI demonstration.",
  },
  {
    id: "FAC-BUENAVISTA-05",
    name: "Buenavista Virgin Coconut Oil & Copra Hub",
    municipality: "Buenavista",
    barangay: "Bagacay",
    address: "Bagacay Coastal Road, Buenavista",
    latitude: 13.2567,
    longitude: 121.9442,
    acceptedCrops: ["Coconut"],
    capabilities: [
      "Mechanical coconut de-sheller & grater",
      "Cold-press hydraulic milk extractor",
      "Centrifuge separator & micro-filtration",
      "Sterilized glass bottling line",
    ],
    processingFeeDescription:
      "₱11/nut cold-press VCO processing fee (returns 80 mL pure VCO per nut + meal).",
    contactPerson: "Demo Coordinator (Illustrative Fixture)",
    contactPhone: "Sample Demo Only (Illustrative)",
    operatingHours: "Mon-Sat: 8:00 AM – 5:00 PM",
    lastUpdated: "October 2026",
    isVerified: false,
    dataClassification: "sample_demo",
    verificationNote:
      "Sample / Demonstration record for Marinduque prototype. Contact details, fees, and exact equipment are illustrative fixtures for UI demonstration.",
  },
  {
    id: "FAC-GASAN-06",
    name: "Gasan Fresh Produce & Rootcrop Station",
    municipality: "Gasan",
    barangay: "Mahunig",
    address: "Airport Road, Mahunig, Gasan",
    latitude: 13.3197,
    longitude: 121.8467,
    acceptedCrops: ["Vegetables", "Cassava", "Banana"],
    capabilities: [
      "Rootcrop washing & sanitation tank",
      "Solar tunnel drying",
      "Commercial vacuum packaging",
      "Cold storage holding bay (8°C–12°C)",
    ],
    processingFeeDescription:
      "₱10/crate cold storage holding fee (up to 5 days); ₱14/kg dehydration.",
    contactPerson: "Demo Coordinator (Illustrative Fixture)",
    contactPhone: "Sample Demo Only (Illustrative)",
    operatingHours: "Daily: 6:00 AM – 7:00 PM",
    lastUpdated: "October 2026",
    isVerified: false,
    dataClassification: "sample_demo",
    verificationNote:
      "Sample / Demonstration record for Marinduque prototype. Contact details, fees, and exact equipment are illustrative fixtures for UI demonstration.",
  },
];

export type ValueAddOpportunity = {
  id: string;
  crop: string;
  productName: string;
  standardInputKg: number;
  inputUnit: string;
  rawPricePerKg: number;
  yieldRatio: number;
  oilMassKg?: number;
  outputQuantity: number;
  outputUnit: string;
  productPricePerKg: number;
  processingCostPerBatch: number;
  primaryEquipment: string;
  densityKgPerLiter?: number;
  byProducts?: string;
  assumptions: string;
  sampleDisclosure: string;
};

export const VALUE_ADD_OPPORTUNITIES: ValueAddOpportunity[] = [
  {
    id: "VA-BANANA-CHIPS",
    crop: "Banana",
    productName: "Banana Chips (Fried / Dehydrated Saba)",
    standardInputKg: 100,
    inputUnit: "kg green Saba",
    rawPricePerKg: 25,
    yieldRatio: 0.35,
    outputQuantity: 35,
    outputUnit: "kg (approx. 140 retail pouches of 250g)",
    productPricePerKg: 160,
    processingCostPerBatch: 1900,
    primaryEquipment:
      "Mandoline slicer, deep fryer / commercial dehydrator, foil sealer",
    byProducts: "~35 kg compostable banana peels",
    assumptions:
      "Unripe (firm green) Saba. Oil (₱700), fuel (₱400), pouches (₱490), and labor (₱310) included.",
    sampleDisclosure:
      "Sample illustrative estimates based on standard DTI-Shared Facility recovery benchmarks; not verified local market prices.",
  },
  {
    id: "VA-URARO-FLOUR",
    crop: "Arrowroot (uraro)",
    productName: "High-Purity Uraro Flour / Starch",
    standardInputKg: 100,
    inputUnit: "kg fresh rhizomes",
    rawPricePerKg: 35,
    yieldRatio: 0.2,
    outputQuantity: 20,
    outputUnit: "kg pure dry starch",
    productPricePerKg: 340,
    processingCostPerBatch: 1800,
    primaryEquipment:
      "Washer, rasper cylinder, water settling decanters, solar drying tunnel",
    byProducts: "~50 kg wet fiber residue for animal feed",
    assumptions:
      "Harvested at 8–10 months maturity. Moisture reduced below 12% for extended shelf life.",
    sampleDisclosure:
      "Sample illustrative estimates; starch yield depends on rhizome maturity and seasonal moisture level.",
  },
  {
    id: "VA-CASSAVA-STARCH",
    crop: "Cassava",
    productName: "Dried Cassava Starch / Flour",
    standardInputKg: 200,
    inputUnit: "kg fresh roots",
    rawPricePerKg: 16,
    yieldRatio: 0.25,
    outputQuantity: 50,
    outputUnit: "kg dried starch (2 x 25 kg sacks)",
    productPricePerKg: 110,
    processingCostPerBatch: 1300,
    primaryEquipment:
      "Mechanical peeler, root rasper, screw press, drying beds, 25 kg bags",
    byProducts: "~30 kg peels and press cake",
    assumptions:
      "Processed within 48 hours of harvest to prevent cyanogenic / vascular streaking discoloration.",
    sampleDisclosure:
      "Sample illustrative estimates; cyanide varieties require complete pressing and thorough drying.",
  },
  {
    id: "VA-COCONUT-VCO",
    crop: "Coconut",
    productName: "Virgin Coconut Oil (Cold-Pressed VCO)",
    standardInputKg: 120,
    inputUnit: "kg whole husked nuts (~120 nuts)",
    rawPricePerKg: 12,
    yieldRatio: 0.08,
    oilMassKg: 9.6,
    outputQuantity: 10.43,
    outputUnit: "Liters (approx. 21 bottles of 500 mL)",
    densityKgPerLiter: 0.92,
    productPricePerKg: 450,
    processingCostPerBatch: 1100,
    primaryEquipment:
      "De-sheller, meat grater, cold hydraulic press, centrifuge / filter, glass bottles",
    byProducts: "~20 kg high-protein dried coconut meal / flour for bakery or livestock feed",
    assumptions:
      "Cold-press expeller extraction without heat/chemicals. 120 kg whole husked nuts yields 9.6 kg oil mass (8% mass recovery). At 0.92 kg/L density, this produces 10.43 Liters of pure finished VCO.",
    sampleDisclosure:
      "Sample illustrative benchmarks (8% mass recovery = 9.6 kg oil; at 0.92 kg/L density = 10.43 L output); yields and prices are illustrative sample values, not verified industry guarantees.",
  },
];

export type MunicipalBatchPool = {
  id: string;
  batchCode: string;
  crop: string;
  qualityGrade: QualityGrade;
  municipality: string;
  totalPooledKg: number;
  farmerCount: number;
  participatingHarvestIds: string[];
  farmerNames: string[];
  status: "open_for_bidding" | "matched" | "allocated";
  targetMarket?: string;
  coordinatorName: string;
  createdAt: string;
  notes: string;
};

export const INITIAL_BATCH_POOLS: MunicipalBatchPool[] = [
  {
    id: "POOL-SC-01",
    batchCode: "BATCH-SC-BANANA-100",
    crop: "Banana",
    qualityGrade: "Grade A",
    municipality: "Santa Cruz",
    totalPooledKg: 100,
    farmerCount: 2,
    participatingHarvestIds: ["demo-banana", "demo-banana-p2"],
    farmerNames: ["Kuya Dante (Santa Cruz)", "Ka Ramon (Alobo)"],
    status: "matched",
    targetMarket: "Market 3 · Santa Cruz Banana Chips Hub",
    coordinatorName: "Maria Santos (Village Coordinator)",
    createdAt: "2026-10-30",
    notes:
      "Compatible green Saba harvest pooled for local banana chips processor.",
  },
  {
    id: "POOL-MG-02",
    batchCode: "BATCH-MG-CASSAVA-320",
    crop: "Cassava",
    qualityGrade: "Grade A",
    municipality: "Mogpog",
    totalPooledKg: 320,
    farmerCount: 2,
    participatingHarvestIds: ["demo-cassava-1", "demo-cassava-2"],
    farmerNames: ["Elena Gutierrez", "Pedro Morales"],
    status: "open_for_bidding",
    targetMarket: "Mogpog Cassava Starch & Food Hub",
    coordinatorName: "Carlos Reyes (Village Coordinator)",
    createdAt: "2026-10-30",
    notes: "Combined fresh cassava root lots ready for starch mill pick-up.",
  },
];

export type ParsedSmsCommand =
  | {
      valid: true;
      type: "ANI";
      crop: string;
      quantity: number;
      unit: string;
      price: number;
      municipality: string;
      barangay: string;
      raw: string;
    }
  | {
      valid: true;
      type: "PRESYO";
      crop: string;
      municipality: string;
      raw: string;
    }
  | {
      valid: true;
      type: "DEMAND";
      crop: string;
      raw: string;
    }
  | {
      valid: true;
      type: "TULONG";
      raw: string;
    }
  | {
      valid: false;
      error: string;
      raw: string;
    };

export function parseSmsCommand(rawText: string): ParsedSmsCommand {
  const text = rawText.trim();
  if (!text) {
    return {
      valid: false,
      error: "Empty message. Mag-text ng TULONG para sa format.",
      raw: text,
    };
  }
  const parts = text.split(/\s+/);
  const command = parts[0]?.toUpperCase();

  if (command === "TULONG" || command === "HELP") {
    return { valid: true, type: "TULONG", raw: text };
  }

  if (command === "DEMAND") {
    const crop = parts[1] ?? "BANANA";
    return { valid: true, type: "DEMAND", crop, raw: text };
  }

  if (command === "PRESYO" || command === "PRICE") {
    const crop = parts[1] ?? "BANANA";
    const municipality = parts[2] ?? "BOAC";
    return { valid: true, type: "PRESYO", crop, municipality, raw: text };
  }

  if (command === "ANI") {
    if (parts.length < 5) {
      return {
        valid: false,
        error:
          "Kulang ang detalye. Format: ANI <PANANIM> <DAMI> <YUNIT> <PRESYO> <BAYAN> <BARANGAY>",
        raw: text,
      };
    }
    const crop = parts[1];
    const qty = Number(parts[2]);
    const unit = parts[3].toLowerCase();
    const price = Number(parts[4]);
    const municipality = parts[5] ?? "Boac";
    const barangay = parts.slice(6).join(" ") || "Poblacion";

    if (!Number.isFinite(qty) || qty <= 0) {
      return {
        valid: false,
        error: "Maling dami ng ani. Ilagay ang tamang numero.",
        raw: text,
      };
    }
    if (!Number.isFinite(price) || price < 0) {
      return {
        valid: false,
        error: "Maling presyo. Ilagay ang tamang halaga sa piso.",
        raw: text,
      };
    }

    return {
      valid: true,
      type: "ANI",
      crop,
      quantity: qty,
      unit,
      price,
      municipality,
      barangay,
      raw: text,
    };
  }

  return {
    valid: false,
    error: `Hindi kilalang utos "${command}". Format: ANI, PRESYO, DEMAND, o TULONG.`,
    raw: text,
  };
}

export function generateSmsReply(parsed: ParsedSmsCommand): string {
  if (!parsed.valid) {
    return `SMART-ANI: ${parsed.error} Halimbawa: ANI BANANA 100 KG 25 SANTACRUZ ALOBO.`;
  }
  switch (parsed.type) {
    case "TULONG":
      return (
        "SMART-ANI SMS Gabay:\n" +
        "1. Magrehistro: ANI <CROP> <QTY> <UNIT> <PRESYO> <BAYAN> <BRGY>\n" +
        "2. Magtanong ng Presyo: PRESYO <CROP> <BAYAN>\n" +
        "3. Tingnan ang Demand: DEMAND <CROP>"
      );
    case "ANI":
      return (
        `SMART-ANI: Matagumpay na naitala! Batch #SA-261 ` +
        `(${parsed.quantity} ${parsed.unit} ${parsed.crop} @ ₱${parsed.price}/${parsed.unit}) ` +
        `sa ${parsed.barangay}, ${parsed.municipality}. Ipinagbigay-alam sa Village Coordinator para sa verification at matching.`
      );
    case "PRESYO":
      return (
        `SMART-ANI Presyo sa ${parsed.municipality}:\n` +
        `• ${parsed.crop}: ₱25–₱30/kg (Grade A)\n` +
        `• Cassava: ₱16–₱18/kg (Starch grade)\n` +
        `• Uraro: ₱35–₱40/kg (Rhizomes)\n` +
        `As of Oktubre 2026. Mag-text ng DEMAND ${parsed.crop} para sa mga mamimili.`
      );
    case "DEMAND":
      return (
        `SMART-ANI Aktibong Demand para sa ${parsed.crop}:\n` +
        `1. Boac Public Mkt: 40 kg @ ₱28/kg\n` +
        `2. Mogpog Coop: 35 kg @ ₱27/kg\n` +
        `3. Santa Cruz Chips Hub: 25 kg @ ₱26/kg\n` +
        `I-rehistro ang iyong ani gamit ang ANI command upang mag-alok.`
      );
  }
}

export const FARMING_GUIDES = [
  {
    crop: "Banana (Saba)",
    harvestTiming:
      "Harvest when hands are plump and full, with distinct angles rounded off, but skin remains uniformly green.",
    storageGuidance:
      "Store in cool, shaded, ventilated crates (13°C–15°C ideal). Keep away from ripe fruits to prevent ethylene-induced premature ripening.",
    valueAddPath:
      "Banana Chips: Slice thinly, immerse in light saltwater to prevent browning, fry/dehydrate, season with sugar or salt, seal in foil bags.",
    shelfLifeDays:
      "5–7 days shaded; 2–3 days if exposed to direct heat or sunlight.",
  },
  {
    crop: "Arrowroot / Uraro",
    harvestTiming:
      "Harvest at 8–10 months when foliage turns yellow and dies down. Dig carefully to avoid breaking rhizomes.",
    storageGuidance:
      "Do not wash until ready to mill. Store in dry, shaded sand or ventilated mesh bags to prevent mold and sprouting.",
    valueAddPath:
      "Uraro Flour: Wash thoroughly, grate finely, extract starch with clean water, decant 3 times, solar dry on clean tables to <12% moisture.",
    shelfLifeDays:
      "10–14 days unwashed in cool storage; up to 1 year once milled and dried into starch.",
  },
  {
    crop: "Cassava",
    harvestTiming:
      "Harvest at 8–12 months depending on variety. Harvest only what can be sold or processed within 48 hours.",
    storageGuidance:
      "Highly perishable due to post-harvest physiological deterioration (vascular streaking). Keep unpeeled roots submerged in moist sand or shaded ventilated crates.",
    valueAddPath:
      "Cassava Starch / Dried Grates: Peel, grate immediately, press to express liquid, dry into shelf-stable grates or extract high-grade starch.",
    shelfLifeDays:
      "2–3 days fresh root; 6+ months once dried into grates or starch powder.",
  },
  {
    crop: "Coconut",
    harvestTiming:
      "Harvest mature brown nuts (11–12 months old) for copra or virgin coconut oil. Shake to confirm water sloshing inside.",
    storageGuidance:
      "Store whole in covered, dry shed away from ground moisture. Keep dry to prevent pre-germination of the haustorium (tumbong).",
    valueAddPath:
      "Virgin Coconut Oil (VCO): De-husk, grate fresh white meat, cold press coconut milk, separate cream by gentle centrifugation or fermentation, micro-filter.",
    shelfLifeDays:
      "20–30 days whole husked nuts; 18–24 months for sealed Virgin Coconut Oil.",
  },
];

export const OFFLINE_FAQS = [
  {
    question: "Paano magtala ng ani kapag walang internet?",
    answer:
      "Gamitin ang 'I-save bilang Offline Draft'. Maiimbak ito sa iyong telepono nang ligtas at awtomatikong mag-si-sync kapag bumalik ang koneksyon.",
  },
  {
    question: "Bakit hindi pantay ang kilo sa bawat sako o kahon?",
    answer:
      "Ang mga sako at kahon ay nag-iiba ng bigat depende sa laki ng pananim at moisture. Nangangailangan ang SMART-ANI ng napagkasunduang conversion ratio (hal. 50 kg/sako) upang maiwasan ang dayaan.",
  },
  {
    question: "Ano ang pagkakaiba ng Grade A at Processing Grade?",
    answer:
      "Ang Grade A ay buo, walang pasa, at para sa retail table market. Ang Processing Grade naman ay maaaring may maliit na depekto sa hugis o balat ngunit sariwa at angkop sa paggawa ng chips, starch, o harina.",
  },
  {
    question: "Ano ang tungkulin ng Village Coordinator?",
    answer:
      "Tinutulungan ng Village Coordinator ang mga magsasaka sa pagrehistro, pag-verify ng ani sa barangay, at pagsasama-sama ng maliliit na ani (harvest pooling) upang maibenta nang maramihan sa malalaking mamimili.",
  },
];
