export const municipalities = [
  "Boac",
  "Mogpog",
  "Santa Cruz",
  "Torrijos",
  "Buenavista",
  "Gasan",
];

export type RoleType = "farmer" | "market" | "admin";

export const PRIORITY_CROPS = [
  "Arrowroot / Uraro",
  "Cassava",
  "Banana",
  "Coconut",
] as const;

export const crops = [
  "Arrowroot / Uraro",
  "Cassava",
  "Banana",
  "Coconut",
  "Sweet Potato / Camote",
  "Vegetables",
] as const;

export type GPSLocation = {
  latitude: number;
  longitude: number;
  label?: string;
};

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

export type MarketType =
  | "public_market"
  | "wet_market_retailer"
  | "retail_buyer"
  | "cooperative"
  | "food_processor"
  | "institutional_buyer";

export type QualityGrade =
  | "Grade A"
  | "Grade B"
  | "Processing Grade"
  | "Standard / Mixed"
  | "Any";

export const qualityGrades: QualityGrade[] = [
  "Grade A",
  "Grade B",
  "Processing Grade",
  "Standard / Mixed",
  "Any",
];

export function marketTypeLabel(type?: MarketType | null): string {
  switch (type) {
    case "public_market":
      return "Public Market";
    case "wet_market_retailer":
    case "retail_buyer":
      return "Wet Market / Retailer";
    case "cooperative":
      return "Cooperative";
    case "food_processor":
      return "Food Processor";
    case "institutional_buyer":
      return "Institutional Buyer";
    default:
      return "Market Buyer";
  }
}

export type DemoHarvestItem = {
  id: string;
  crop: string;
  variety: string;
  farmer: string;
  farmerId: string;
  municipality: string;
  barangay: string;
  storage: string;
  harvestDate: string;
  qualityGrade: QualityGrade;
  quantity: number;
  unit?: MeasurementUnit;
  conversionRateKg?: number;
  earmarkedKg: number;
  reservedKg: number;
  allocatedKg: number;
  deliveredKg: number;
  remainingKg: number;
  price: number;
  priority: boolean;
  verified: boolean;
  status:
    | "pending_verification"
    | "available"
    | "partially_allocated"
    | "fully_allocated"
    | "delivered"
    | "rejected"
    | "closed";
  reviewNotes?: string;
  mark: string;
  color: "yellow" | "sand" | "sage" | "peach";
  gpsLocation?: GPSLocation;
  harvestSchedule?: string;
  storageTempC?: number;
  batchPoolId?: string;
  coordinatorName?: string;
};

export function evaluateDemoSpoilageUrgency(item: DemoHarvestItem): {
  level: "high" | "moderate" | "normal";
  label: string;
  badgeText: string;
  hoursRemaining: number;
  daysRemaining: number;
  advisoryDisclaimer: string;
} {
  const disclaimer =
    "Advisory freshness estimate only — not a food safety or expiration guarantee.";
  if (item.remainingKg <= 0) {
    return {
      level: "normal",
      label: "✓ Fully allocated / delivered",
      badgeText: "DELIVERED",
      hoursRemaining: 0,
      daysRemaining: 0,
      advisoryDisclaimer: disclaimer,
    };
  }
  const isHighUrgency =
    item.priority ||
    item.crop === "Banana" ||
    item.crop === "Vegetables" ||
    item.crop === "Cassava";

  if (isHighUrgency) {
    const isCritical =
      item.priority && (item.crop === "Banana" || item.crop === "Vegetables");
    return {
      level: "high",
      label: isCritical
        ? "Critical Advisory: Spoilage risk within 36–48h"
        : "Advisory: High spoilage urgency (allocate within 48h)",
      badgeText: isCritical ? "CRITICAL URGENT (<36H)" : "HIGH URGENCY (<48H)",
      hoursRemaining: isCritical ? 36 : 48,
      daysRemaining: isCritical ? 1.5 : 2,
      advisoryDisclaimer: disclaimer,
    };
  }

  return {
    level: "moderate",
    label: "Advisory: Standard post-harvest window (3–5 days)",
    badgeText: "MODERATE (3–5D)",
    hoursRemaining: 96,
    daysRemaining: 4,
    advisoryDisclaimer: disclaimer,
  };
}

export type DemoMarketDemand = {
  id: string;
  marketId: string;
  processor: string;
  marketName: string;
  marketType: MarketType;
  marketVerified: boolean;
  crop: string;
  quantity: number;
  requiredQuantityKg: number;
  reservedQuantityKg: number;
  fulfilledQuantityKg: number;
  remainingDemandKg: number;
  unit?: MeasurementUnit;
  buyingType?: BuyingType;
  unitPricePhp?: number;
  totalPricePhp?: number;
  expectedKgPerUnit?: number;
  preferredQualityGrade: QualityGrade;
  offeredPricePerKg: number;
  municipality: string;
  barangay: string;
  deliveryLocation: string;
  storage: string;
  requiredBy: string;
  requiredDeliveryDate: string;
  acceptPartial: boolean;
  window: string;
  note: string;
  status:
    | "open"
    | "partially_allocated"
    | "partially_fulfilled"
    | "fulfilled"
    | "cancelled"
    | "expired"
    | "closed";
};

export type DemoSupplyAllocation = {
  id: string;
  harvestId: string;
  farmerName: string;
  farmerMunicipality: string;
  farmerBarangay: string;
  demandId: string;
  marketId: string;
  marketName: string;
  marketType: MarketType;
  marketMunicipality: string;
  crop: string;
  qualityGrade: QualityGrade;
  allocatedKg: number;
  deliveredKg: number;
  agreedPricePerKg: number;
  unit?: MeasurementUnit;
  inventoryUnit?: MeasurementUnit;
  buyingType?: BuyingType;
  totalAgreedPrice?: number;
  conversionRatioToKg?: number;
  deductedInventoryQuantity?: number;
  status:
    | "offered"
    | "reserved"
    | "in_delivery"
    | "partially_delivered"
    | "delivered"
    | "rejected"
    | "cancelled";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type DemoAccountProfile = {
  id: string;
  displayName: string;
  organizationName: string;
  municipality: string;
  role: RoleType;
  accountStatus: "active" | "deactivated_pending_admin_review" | "suspended";
  marketType?: MarketType | null;
  marketVerificationStatus:
    | "not_applicable"
    | "pending_verification"
    | "verified"
    | "rejected"
    | "suspended";
  legacyPreviousRole?: string;
  verificationNotes?: string;
};

export type DemoAuditLog = {
  id: string;
  actorName: string;
  actorRole: RoleType | "system";
  action: string;
  entityType: string;
  entityId: string;
  reason: string;
  summary?: string;
  createdAt: string;
};

export const harvests: DemoHarvestItem[] = [
  {
    id: "SA-001",
    crop: "Banana",
    variety: "Saba · Grade A harvest",
    farmer: "Kuya Dante · Santa Cruz",
    farmerId: "farmer-ramon-sc",
    municipality: "Santa Cruz",
    barangay: "Brgy. Alobo",
    storage: "Shaded and ventilated",
    harvestDate: "2026-10-29",
    qualityGrade: "Grade A",
    quantity: 100,
    earmarkedKg: 0,
    reservedKg: 0,
    allocatedKg: 0,
    deliveredKg: 0,
    remainingKg: 100,
    price: 25,
    priority: true,
    verified: true,
    status: "available",
    mark: "BA",
    color: "yellow",
  },
  {
    id: "SA-002",
    crop: "Cassava",
    variety: "Fresh roots · Grade A",
    farmer: "Farmer Elena (Mogpog)",
    farmerId: "farmer-elena-mg",
    municipality: "Mogpog",
    barangay: "Brgy. Anapog",
    storage: "Shaded and ventilated",
    harvestDate: "2026-10-29",
    qualityGrade: "Grade A",
    quantity: 320,
    earmarkedKg: 0,
    reservedKg: 0,
    allocatedKg: 0,
    deliveredKg: 0,
    remainingKg: 320,
    price: 18,
    priority: false,
    verified: true,
    status: "available",
    mark: "CA",
    color: "sand",
  },
  {
    id: "SA-003",
    crop: "Arrowroot / Uraro",
    variety: "Fresh rhizomes · Grade A",
    farmer: "Farmer Lito (Boac)",
    farmerId: "farmer-lito-bc",
    municipality: "Boac",
    barangay: "Brgy. Santol",
    storage: "Shaded and ventilated",
    harvestDate: "2026-10-28",
    qualityGrade: "Grade A",
    quantity: 140,
    earmarkedKg: 0,
    reservedKg: 0,
    allocatedKg: 0,
    deliveredKg: 0,
    remainingKg: 140,
    price: 35,
    priority: true,
    verified: true,
    status: "available",
    mark: "AR",
    color: "sage",
  },
  {
    id: "SA-004",
    crop: "Sweet Potato / Camote",
    variety: "Mixed sizes · Standard",
    farmer: "Farmer Noel (Torrijos)",
    farmerId: "farmer-noel-tj",
    municipality: "Torrijos",
    barangay: "Brgy. Poblacion",
    storage: "Ambient / open air",
    harvestDate: "2026-10-29",
    qualityGrade: "Grade B",
    quantity: 210,
    earmarkedKg: 0,
    reservedKg: 0,
    allocatedKg: 0,
    deliveredKg: 0,
    remainingKg: 210,
    price: 30,
    priority: false,
    verified: false,
    status: "pending_verification",
    mark: "CM",
    color: "peach",
  },
  {
    id: "SA-005",
    crop: "Coconut",
    variety: "Mature husked · Grade A",
    farmer: "Farmer Rosa (Buenavista)",
    farmerId: "farmer-rosa-bv",
    municipality: "Buenavista",
    barangay: "Brgy. Daykitin",
    storage: "Ambient / open air",
    harvestDate: "2026-10-27",
    qualityGrade: "Grade A",
    quantity: 460,
    earmarkedKg: 0,
    reservedKg: 0,
    allocatedKg: 0,
    deliveredKg: 0,
    remainingKg: 460,
    price: 15,
    priority: false,
    verified: true,
    status: "available",
    mark: "CO",
    color: "sand",
  },
  {
    id: "SA-006",
    crop: "Vegetables",
    variety: "Lowland greens · Grade A",
    farmer: "Farmer Marco (Gasan)",
    farmerId: "farmer-marco-gs",
    municipality: "Gasan",
    barangay: "Brgy. Tiguion",
    storage: "Refrigerated",
    harvestDate: "2026-10-30",
    qualityGrade: "Grade A",
    quantity: 90,
    earmarkedKg: 0,
    reservedKg: 0,
    allocatedKg: 0,
    deliveredKg: 0,
    remainingKg: 90,
    price: 40,
    priority: true,
    verified: false,
    status: "pending_verification",
    mark: "VE",
    color: "sage",
  },
];

export const initialDemoMarketDemands: DemoMarketDemand[] = [
  {
    id: "MKT-DEM-01",
    marketId: "market-boac-1",
    processor: "Market 1 · Boac Public Market Stall 12",
    marketName: "Market 1 · Boac Public Market Stall 12",
    marketType: "public_market",
    marketVerified: true,
    crop: "Banana",
    quantity: 40,
    requiredQuantityKg: 40,
    reservedQuantityKg: 0,
    fulfilledQuantityKg: 0,
    remainingDemandKg: 40,
    preferredQualityGrade: "Grade A",
    offeredPricePerKg: 28,
    municipality: "Boac",
    barangay: "Murallon",
    deliveryLocation: "Boac Public Market Receiving Bay",
    storage: "Shaded and ventilated",
    requiredBy: "2026-11-02",
    requiredDeliveryDate: "2026-11-02",
    acceptPartial: true,
    window: "Due 2026-11-02 · Partial OK",
    note: "Market 1 needs 40 kg Grade A Saba bananas for daily wet market retail.",
    status: "open",
  },
  {
    id: "MKT-DEM-02",
    marketId: "market-mogpog-2",
    processor: "Market 2 · Mogpog Growers & Retailers Coop",
    marketName: "Market 2 · Mogpog Growers & Retailers Coop",
    marketType: "cooperative",
    marketVerified: true,
    crop: "Banana",
    quantity: 35,
    requiredQuantityKg: 35,
    reservedQuantityKg: 0,
    fulfilledQuantityKg: 0,
    remainingDemandKg: 35,
    preferredQualityGrade: "Grade A",
    offeredPricePerKg: 27,
    municipality: "Mogpog",
    barangay: "Anapog",
    deliveryLocation: "Mogpog Coop Warehouse",
    storage: "Shaded and ventilated",
    requiredBy: "2026-11-03",
    requiredDeliveryDate: "2026-11-03",
    acceptPartial: true,
    window: "Due 2026-11-03 · Partial OK",
    note: "Market 2 cooperative buying 35 kg Saba bananas for municipal retail distribution.",
    status: "open",
  },
  {
    id: "MKT-DEM-03",
    marketId: "market-santacruz-3",
    processor: "Market 3 · Santa Cruz Banana Chips Hub",
    marketName: "Market 3 · Santa Cruz Banana Chips Hub",
    marketType: "food_processor",
    marketVerified: true,
    crop: "Banana",
    quantity: 25,
    requiredQuantityKg: 25,
    reservedQuantityKg: 0,
    fulfilledQuantityKg: 0,
    remainingDemandKg: 25,
    preferredQualityGrade: "Any",
    offeredPricePerKg: 26,
    municipality: "Santa Cruz",
    barangay: "Buyabod",
    deliveryLocation: "Buyabod Processing Facility",
    storage: "Shaded and ventilated",
    requiredBy: "2026-11-04",
    requiredDeliveryDate: "2026-11-04",
    acceptPartial: true,
    window: "Due 2026-11-04 · Partial OK",
    note: "Market 3 food processor needs 25 kg firm Saba bananas for chip dehydration.",
    status: "open",
  },
  {
    id: "MKT-DEM-04",
    marketId: "market-mogpog-04",
    processor: "Mogpog Cassava Starch & Food Hub",
    marketName: "Mogpog Cassava Starch & Food Hub",
    marketType: "food_processor",
    marketVerified: true,
    crop: "Cassava",
    quantity: 2,
    requiredQuantityKg: 2,
    reservedQuantityKg: 0,
    fulfilledQuantityKg: 0,
    remainingDemandKg: 2,
    unit: "sack",
    buyingType: "per_unit",
    unitPricePhp: 800,
    totalPricePhp: 1600,
    expectedKgPerUnit: 50,
    preferredQualityGrade: "Grade A",
    offeredPricePerKg: 16,
    municipality: "Mogpog",
    barangay: "Gitnang Bayan",
    deliveryLocation: "Mogpog Processing Bay",
    storage: "Ambient dry warehouse",
    requiredBy: "2026-11-06",
    requiredDeliveryDate: "2026-11-06",
    acceptPartial: true,
    window: "Due 2026-11-06 · 2 sacks @ ₱800/sack",
    note: "2 sacks Cassava at ₱800 per sack (~50 kg per sack, ₱1,600 total).",
    status: "open",
  },
  {
    id: "MKT-DEM-05",
    marketId: "market-gasan-05",
    processor: "Gasan Fresh Produce & Veggie Stall",
    marketName: "Gasan Fresh Produce & Veggie Stall",
    marketType: "retail_buyer",
    marketVerified: true,
    crop: "Vegetables",
    quantity: 3,
    requiredQuantityKg: 3,
    reservedQuantityKg: 0,
    fulfilledQuantityKg: 0,
    remainingDemandKg: 3,
    unit: "crate",
    buyingType: "per_unit",
    unitPricePhp: 500,
    totalPricePhp: 1500,
    expectedKgPerUnit: 25,
    preferredQualityGrade: "Grade A",
    offeredPricePerKg: 20,
    municipality: "Gasan",
    barangay: "Poblacion",
    deliveryLocation: "Gasan Public Market Stall 4",
    storage: "Ventilated crate",
    requiredBy: "2026-11-03",
    requiredDeliveryDate: "2026-11-03",
    acceptPartial: true,
    window: "Due 2026-11-03 · 3 crates @ ₱500/crate",
    note: "3 crates Vegetables at ₱500 per crate (~25 kg per crate, ₱1,500 total).",
    status: "open",
  },
  {
    id: "MKT-DEM-06",
    marketId: "market-boac-06",
    processor: "Boac Wholesale Fruit Wholesalers",
    marketName: "Boac Wholesale Fruit Wholesalers",
    marketType: "public_market",
    marketVerified: true,
    crop: "Banana",
    quantity: 20,
    requiredQuantityKg: 20,
    reservedQuantityKg: 0,
    fulfilledQuantityKg: 0,
    remainingDemandKg: 20,
    unit: "bunch",
    buyingType: "per_unit",
    unitPricePhp: 60,
    totalPricePhp: 1200,
    expectedKgPerUnit: 5,
    preferredQualityGrade: "Grade A",
    offeredPricePerKg: 12,
    municipality: "Boac",
    barangay: "San Miguel",
    deliveryLocation: "Boac Wholesale Fruit Dock",
    storage: "Ventilated ambient rack",
    requiredBy: "2026-11-04",
    requiredDeliveryDate: "2026-11-04",
    acceptPartial: true,
    window: "Due 2026-11-04 · 20 bunches @ ₱60/bunch",
    note: "20 bunches Banana at ₱60 per bunch (~5 kg per bunch, ₱1,200 total).",
    status: "open",
  },
  {
    id: "MKT-DEM-07",
    marketId: "market-torrijos-07",
    processor: "Torrijos Agro-Coop Bulk Aggregator",
    marketName: "Torrijos Agro-Coop Bulk Aggregator",
    marketType: "cooperative",
    marketVerified: true,
    crop: "Banana",
    quantity: 1,
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
    deliveryLocation: "Torrijos Agro-Trading Post",
    storage: "Ventilated bulk container",
    requiredBy: "2026-11-05",
    requiredDeliveryDate: "2026-11-05",
    acceptPartial: false,
    window: "Due 2026-11-05 · 1 complete harvest lot @ ₱2,500 total",
    note: "1 complete harvest lot at ₱2,500 total (fixed bulk lot purchase).",
    status: "open",
  },
  {
    id: "MKT-DEM-08",
    marketId: "market-boac-bulk",
    processor: "Boac Central Market Aggregator (100 kg Multi-Farmer Demand)",
    marketName: "Boac Central Market Aggregator (100 kg Multi-Farmer Demand)",
    marketType: "public_market",
    marketVerified: true,
    crop: "Banana",
    quantity: 100,
    requiredQuantityKg: 100,
    reservedQuantityKg: 0,
    fulfilledQuantityKg: 0,
    remainingDemandKg: 100,
    unit: "kg",
    buyingType: "per_unit",
    unitPricePhp: 29,
    totalPricePhp: 2900,
    preferredQualityGrade: "Grade A",
    offeredPricePerKg: 29,
    municipality: "Boac",
    barangay: "Poblacion",
    deliveryLocation: "Boac Central Wholesale Dock",
    storage: "Shaded and ventilated",
    requiredBy: "2026-11-05",
    requiredDeliveryDate: "2026-11-05",
    acceptPartial: true,
    window: "Due 2026-11-05 · Accepts Multi-Farmer Partial Lots",
    note: "Accepts partial deliveries from multiple farmers (e.g., 40 kg Farmer A + 35 kg Farmer B + 25 kg Farmer C).",
    status: "open",
  },
];

export const requirements = initialDemoMarketDemands;

export const initialDemoAllocations: DemoSupplyAllocation[] = [];

export const initialDemoAccounts: DemoAccountProfile[] = [
  {
    id: "farmer-ramon-sc",
    displayName: "Kuya Dante (Santa Cruz)",
    organizationName: "Alobo Smallholder Farm",
    municipality: "Santa Cruz",
    role: "farmer",
    accountStatus: "active",
    marketType: null,
    marketVerificationStatus: "not_applicable",
    verificationNotes: "Active verified smallholder grower in Santa Cruz.",
  },
  {
    id: "market-boac-1",
    displayName: "Market 1 · Boac Public Market",
    organizationName: "Market 1 · Boac Public Market Stall 12",
    municipality: "Boac",
    role: "market",
    accountStatus: "active",
    marketType: "public_market",
    marketVerificationStatus: "verified",
    verificationNotes: "Verified by Provincial Admin (Permit #BC-2026-112).",
  },
  {
    id: "market-mogpog-2",
    displayName: "Market 2 · Mogpog Coop",
    organizationName: "Market 2 · Mogpog Growers & Retailers Coop",
    municipality: "Mogpog",
    role: "market",
    accountStatus: "active",
    marketType: "cooperative",
    marketVerificationStatus: "verified",
    verificationNotes: "Verified CDA Cooperative buyer.",
  },
  {
    id: "market-santacruz-3",
    displayName: "Market 3 · Santa Cruz Processor",
    organizationName: "Market 3 · Santa Cruz Banana Chips Hub",
    municipality: "Santa Cruz",
    role: "market",
    accountStatus: "active",
    marketType: "food_processor",
    marketVerificationStatus: "verified",
    verificationNotes: "Verified food processor classified as Market account.",
  },
  {
    id: "market-boac-bulk",
    displayName: "Boac Central Market Aggregator",
    organizationName: "Boac Central Market Aggregator (100 kg Multi-Farmer Demand)",
    municipality: "Boac",
    role: "market",
    accountStatus: "active",
    marketType: "public_market",
    marketVerificationStatus: "verified",
    verificationNotes: "Verified municipal bulk market buyer.",
  },
  {
    id: "market-gasan-unverified",
    displayName: "Gasan Wet Market Buyer",
    organizationName: "Gasan Coastal Retail Stall (Unverified)",
    municipality: "Gasan",
    role: "market",
    accountStatus: "active",
    marketType: "wet_market_retailer",
    marketVerificationStatus: "pending_verification",
    verificationNotes:
      "Newly registered Market account; awaiting Admin verification before posting demands or accepting offers.",
  },
  {
    id: "legacy-coord-torrijos",
    displayName: "Former Coordinator Noel (Quarantined)",
    organizationName: "Legacy Barangay Coordinator Account",
    municipality: "Torrijos",
    role: "farmer",
    accountStatus: "deactivated_pending_admin_review",
    marketType: null,
    marketVerificationStatus: "not_applicable",
    legacyPreviousRole: "coordinator",
    verificationNotes:
      "Quarantined during 3-role migration; never auto-promoted to Admin or active Farmer without Admin review.",
  },
  {
    id: "coord-santacruz-maria",
    displayName: "Maria Santos (Designated Village Coordinator)",
    organizationName: "Brgy. Alobo Agricultural Committee",
    municipality: "Santa Cruz",
    role: "admin",
    accountStatus: "active",
    marketType: null,
    marketVerificationStatus: "not_applicable",
    verificationNotes:
      "Designated Village Coordinator operating with authorized Admin verification and batch pooling permissions.",
  },
  {
    id: "coord-mogpog-carlos",
    displayName: "Carlos Reyes (Designated Village Coordinator)",
    organizationName: "Brgy. Anapog Farmers Support",
    municipality: "Mogpog",
    role: "admin",
    accountStatus: "active",
    marketType: null,
    marketVerificationStatus: "not_applicable",
    verificationNotes:
      "Designated Village Coordinator operating with authorized Admin verification and batch pooling permissions.",
  },
  {
    id: "admin-provincial",
    displayName: "Marinduque Provincial Admin",
    organizationName: "SMART-ANI Governance Office",
    municipality: "Boac",
    role: "admin",
    accountStatus: "active",
    marketType: null,
    marketVerificationStatus: "not_applicable",
    verificationNotes: "Authorized system administrator.",
  },
];

export const initialDemoAuditLogs: DemoAuditLog[] = [
  {
    id: "AUD-001",
    actorName: "System Migration Engine",
    actorRole: "system",
    action: "THREE_ROLE_MODEL_ENFORCED",
    entityType: "profile",
    entityId: "ALL",
    reason:
      "Enforced Farmer, Market, and Admin roles. Mapped processors to Market accounts (pending_verification) and quarantined legacy coordinators.",
    summary: "3-Role Governance Active (Farmer, Market, Admin)",
    createdAt: "2026-10-30 08:00",
  },
  {
    id: "AUD-002",
    actorName: "Marinduque Provincial Admin",
    actorRole: "admin",
    action: "MARKET_VERIFICATION_VERIFIED",
    entityType: "profile",
    entityId: "market-boac-1",
    reason: "Verified business permit for Market 1, Market 2, and Market 3.",
    summary: "Verified Market 1, Market 2, and Market 3 accounts",
    createdAt: "2026-10-30 08:15",
  },
  {
    id: "AUD-003",
    actorName: "Marinduque Provincial Admin",
    actorRole: "admin",
    action: "HARVEST_LISTING_APPROVED",
    entityType: "harvest_listing",
    entityId: "SA-001",
    reason: "Verified 100 kg Grade A Banana harvest in Santa Cruz (Kuya Dante).",
    summary: "Published SA-001 (100 kg Banana) for multi-market allocation",
    createdAt: "2026-10-30 08:20",
  },
];

export const valueAddScenarios = [
  {
    id: "VA-BANANA",
    crop: "Banana",
    product: "Banana Chips (Dehydrated / Fried)",
    sampleInputKg: 100,
    inputUnit: "kg green Saba",
    rawPricePerKg: 25,
    illustrativeYieldRatio: 0.35,
    outputQuantity: 35,
    outputUnit: "kg (approx. 140 pouches of 250g)",
    illustrativeProductPricePerKg: 160,
    illustrativeProcessingCost: 1900,
    equipmentNote: "Slicer, fryer/dehydrator, food-grade sealing",
    sampleDisclosure:
      "Sample illustrative estimates based on standard DTI-Shared Facility recovery benchmarks; not verified local market prices.",
  },
  {
    id: "VA-URARO",
    crop: "Arrowroot / Uraro",
    product: "Uraro Starch / Flour",
    sampleInputKg: 100,
    inputUnit: "kg fresh rhizomes",
    rawPricePerKg: 35,
    illustrativeYieldRatio: 0.2,
    outputQuantity: 20,
    outputUnit: "kg pure dry starch",
    illustrativeProductPricePerKg: 340,
    illustrativeProcessingCost: 1800,
    equipmentNote: "Root washer, rasper cylinder, settling decanters, solar drying tunnel",
    sampleDisclosure:
      "Sample illustrative estimates; starch recovery depends on rhizome maturity (8–10 months) and moisture level.",
  },
  {
    id: "VA-CASSAVA",
    crop: "Cassava",
    product: "Dried Cassava Starch / Flour",
    sampleInputKg: 200,
    inputUnit: "kg fresh roots",
    rawPricePerKg: 16,
    illustrativeYieldRatio: 0.25,
    outputQuantity: 50,
    outputUnit: "kg dried starch (2 x 25kg sacks)",
    illustrativeProductPricePerKg: 110,
    illustrativeProcessingCost: 1300,
    equipmentNote: "Peeler, mechanical rasper, screw press, drying beds",
    sampleDisclosure:
      "Sample illustrative estimates; roots must be processed within 48 hours to prevent vascular streaking.",
  },
  {
    id: "VA-COCONUT",
    crop: "Coconut",
    product: "Virgin Coconut Oil (Cold-Pressed VCO)",
    sampleInputKg: 120,
    inputUnit: "kg whole husked nuts (~120 nuts)",
    rawPricePerKg: 12,
    illustrativeYieldRatio: 0.08,
    oilMassKg: 9.6,
    outputQuantity: 10.43,
    outputUnit: "Liters (approx. 21 bottles of 500 mL)",
    densityKgPerLiter: 0.92,
    illustrativeProductPricePerKg: 450,
    illustrativeProcessingCost: 1100,
    equipmentNote:
      "De-sheller, meat grater, cold hydraulic press, micro-filtration, sterile glass bottles",
    sampleDisclosure:
      "Sample illustrative estimates (8% oil mass recovery = 9.6 kg oil; at 0.92 kg/L density = 10.43 L output); yields and prices are illustrative sample values, not verified industry guarantees.",
  },
];

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

export const processingFacilities: ProcessingFacility[] = [
  {
    id: "FAC-BOAC-01",
    name: "Boac Agri-Industrial Food Innovation Center",
    municipality: "Boac",
    barangay: "Poblacion",
    address: "Provincial Capitol Compound, Boac",
    latitude: 13.4464,
    longitude: 121.8419,
    acceptedCrops: ["Banana", "Arrowroot / Uraro", "Cassava", "Vegetables"],
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
    acceptedCrops: ["Arrowroot / Uraro", "Cassava"],
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

export type DemoBatchPool = {
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

export const initialDemoBatchPools: DemoBatchPool[] = [
  {
    id: "POOL-SC-01",
    batchCode: "BATCH-SC-BANANA-100",
    crop: "Banana",
    qualityGrade: "Grade A",
    municipality: "Santa Cruz",
    totalPooledKg: 100,
    farmerCount: 2,
    participatingHarvestIds: ["SA-001", "SA-001-P2"],
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
    participatingHarvestIds: ["SA-002", "SA-002-P2"],
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

export const farmingGuides = [
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

export const offlineFaqs = [
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

export const totalKg = harvests.reduce(
  (total, harvest) => total + harvest.quantity,
  0,
);
export const priorityCount = harvests.filter(
  (harvest) => harvest.priority,
).length;
export const verifiedCount = harvests.filter(
  (harvest) => harvest.verified,
).length;
export const money = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
