"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  harvests as initialDemoHarvests,
  initialDemoAccounts,
  initialDemoAllocations,
  initialDemoAuditLogs,
  initialDemoMarketDemands,
  unitLabel,
  type BuyingType,
  type DemoAccountProfile,
  type DemoAuditLog,
  type DemoHarvestItem,
  type DemoMarketDemand,
  type DemoSupplyAllocation,
  type MarketType,
  type MeasurementUnit,
  type QualityGrade,
  type RoleType,
} from "./demo";
import { supabaseConfig } from "./supabase-config";
import {
  adminVerifyMarketAccountWebRpc,
  confirmAllocationDeliveryWebRpc,
  createLiveMarketDemand,
  fetchLiveMarketDemands,
  fetchLiveSupplyAllocations,
  fetchOrCreateUserProfile,
  fetchPortalHarvestListings,
  isValidSession,
  refreshWebSession,
  respondToSupplyAllocationWebRpc,
  reviewHarvestListingRpc,
  signInWebUser,
  signOutWebSession,
  signUpWebMarketOrFarmer,
  type LiveHarvestListing,
  type LiveMarketDemand,
  type LiveSupplyAllocation,
  type SupabaseSession,
  type UserProfile,
} from "./supabase-client";

const WEB_SESSION_KEY = "smart-ani:web-supabase-session:v1";
const WEB_DEMO_STATE_KEY = "smart-ani:web-demo-state:v1";

type PortalMode = "demo" | "live";

type PersistedDemoState = {
  activeDemoRole: RoleType;
  activeDemoMarketId: string;
  harvests: DemoHarvestItem[];
  demands: DemoMarketDemand[];
  allocations: DemoSupplyAllocation[];
  accounts: DemoAccountProfile[];
  auditLogs: DemoAuditLog[];
};

function recomputeDemoAccounting(
  rawHarvests: DemoHarvestItem[],
  rawDemands: DemoMarketDemand[],
  allocations: DemoSupplyAllocation[],
): {
  harvests: DemoHarvestItem[];
  demands: DemoMarketDemand[];
} {
  const nextHarvests = rawHarvests.map((harvest) => {
    const matching = allocations.filter((a) => a.harvestId === harvest.id);
    let earmarkedKg = 0;
    let reservedKg = 0;
    let deliveredKg = 0;

    for (const alloc of matching) {
      const undeliveredDemandUnits = Math.max(
        0,
        Number((alloc.allocatedKg - alloc.deliveredKg).toFixed(2)),
      );
      const invFactor =
        alloc.deductedInventoryQuantity && alloc.allocatedKg > 0
          ? alloc.deductedInventoryQuantity / alloc.allocatedKg
          : 1;
      const undelivered = Number((undeliveredDemandUnits * invFactor).toFixed(2));
      const delivered = Number(((alloc.deliveredKg || 0) * invFactor).toFixed(2));

      if (alloc.status === "offered") {
        earmarkedKg = Number((earmarkedKg + undelivered).toFixed(2));
      } else if (
        alloc.status === "reserved" ||
        alloc.status === "in_delivery" ||
        alloc.status === "partially_delivered"
      ) {
        reservedKg = Number((reservedKg + undelivered).toFixed(2));
      }
      if (
        alloc.status === "partially_delivered" ||
        alloc.status === "delivered" ||
        alloc.deliveredKg > 0
      ) {
        deliveredKg = Number((deliveredKg + delivered).toFixed(2));
      }
    }

    const allocatedKg = Number((earmarkedKg + reservedKg).toFixed(2));
    const remainingKg = Math.max(
      0,
      Number((harvest.quantity - allocatedKg - deliveredKg).toFixed(2)),
    );

    let status: DemoHarvestItem["status"] = harvest.verified
      ? "available"
      : "pending_verification";
    if (harvest.status === "rejected") {
      status = "rejected";
    } else if (harvest.verified) {
      if (remainingKg === 0 && deliveredKg >= harvest.quantity) {
        status = "delivered";
      } else if (remainingKg === 0 && allocatedKg > 0) {
        status = "fully_allocated";
      } else if (allocatedKg > 0 || deliveredKg > 0) {
        status = "partially_allocated";
      } else {
        status = "available";
      }
    }

    return {
      ...harvest,
      earmarkedKg,
      reservedKg,
      allocatedKg,
      deliveredKg,
      remainingKg,
      status,
    };
  });

  const nextDemands = rawDemands.map((demand) => {
    const matching = allocations.filter((a) => a.demandId === demand.id);
    let reservedQuantityKg = 0;
    let fulfilledQuantityKg = 0;

    for (const alloc of matching) {
      const undelivered = Math.max(
        0,
        Number((alloc.allocatedKg - alloc.deliveredKg).toFixed(2)),
      );
      if (
        alloc.status === "reserved" ||
        alloc.status === "in_delivery" ||
        alloc.status === "partially_delivered"
      ) {
        reservedQuantityKg = Number(
          (reservedQuantityKg + undelivered).toFixed(2),
        );
      }
      if (
        alloc.status === "partially_delivered" ||
        alloc.status === "delivered" ||
        alloc.deliveredKg > 0
      ) {
        fulfilledQuantityKg = Number(
          (fulfilledQuantityKg + alloc.deliveredKg).toFixed(2),
        );
      }
    }

    const remainingDemandKg = Math.max(
      0,
      Number(
        (
          demand.requiredQuantityKg -
          reservedQuantityKg -
          fulfilledQuantityKg
        ).toFixed(2),
      ),
    );

    let status = demand.status;
    if (status !== "cancelled" && status !== "expired") {
      if (fulfilledQuantityKg >= demand.requiredQuantityKg) {
        status = "fulfilled";
      } else if (reservedQuantityKg > 0 || fulfilledQuantityKg > 0) {
        status = "partially_allocated";
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
  });

  return { harvests: nextHarvests, demands: nextDemands };
}

type PortalAuthContextValue = {
  isConfigured: boolean;
  mode: PortalMode;
  setMode: (mode: PortalMode) => void;
  session: SupabaseSession | null;
  profile: UserProfile | null;
  authReady: boolean;
  authError: string;
  liveHarvests: LiveHarvestListing[];
  liveDemands: LiveMarketDemand[];
  liveAllocations: LiveSupplyAllocation[];
  harvestsLoading: boolean;
  harvestsError: string;
  signIn: (email: string, password: string) => Promise<UserProfile>;
  registerAccount: (input: {
    email: string;
    password: string;
    role: "farmer" | "market";
    displayName: string;
    municipality: string;
    organizationName?: string;
    marketType?: MarketType;
  }) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  refreshLiveHarvests: () => Promise<void>;
  reviewListing: (params: {
    listingId: string;
    decision: "available" | "rejected";
    reviewNotes?: string;
  }) => Promise<LiveHarvestListing>;
  postLiveDemand: (input: {
    crop: string;
    required_quantity_kg: number;
    preferred_quality_grade: QualityGrade;
    offered_price_php_per_kg: number;
    municipality: string;
    delivery_location: string;
    preferred_storage: string;
    required_delivery_date: string;
    accept_partial: boolean;
    notes?: string;
  }) => Promise<LiveMarketDemand>;
  respondLiveAllocation: (params: {
    allocationId: string;
    decision: "reserved" | "rejected";
    notes?: string;
  }) => Promise<LiveSupplyAllocation>;
  confirmLiveDelivery: (params: {
    allocationId: string;
    actualReceivedKg: number;
    finalizeShortDelivery?: boolean;
    deliveryNotes?: string;
  }) => Promise<LiveSupplyAllocation>;
  verifyLiveMarket: (params: {
    marketProfileId: string;
    decision: "verified" | "rejected";
    notes?: string;
  }) => Promise<void>;

  // Interactive Demo Mode State & Actions
  activeDemoRole: RoleType;
  setActiveDemoRole: (role: RoleType) => void;
  activeDemoMarketId: string;
  setActiveDemoMarketId: (marketId: string) => void;
  activeDemoMarket: DemoAccountProfile | undefined;
  demoHarvests: DemoHarvestItem[];
  demoDemands: DemoMarketDemand[];
  demoAllocations: DemoSupplyAllocation[];
  demoAccounts: DemoAccountProfile[];
  demoAuditLogs: DemoAuditLog[];
  registerDemoMarketAccount: (input: {
    displayName: string;
    organizationName: string;
    marketType: MarketType;
    municipality: string;
  }) => DemoAccountProfile;
  createDemoMarketDemand: (input: {
    crop: string;
    requiredQuantityKg: number;
    unit?: MeasurementUnit;
    buyingType?: BuyingType;
    unitPricePhp?: number;
    totalPricePhp?: number;
    expectedKgPerUnit?: number;
    preferredQualityGrade: QualityGrade;
    offeredPricePerKg: number;
    municipality: string;
    deliveryLocation: string;
    storage: string;
    requiredDeliveryDate: string;
    acceptPartial: boolean;
    note?: string;
  }) => DemoMarketDemand;
  updateDemoDemandStatus: (
    demandId: string,
    status: DemoMarketDemand["status"],
  ) => void;
  allocateDemoHarvestToMarket: (input: {
    harvestId: string;
    demandId: string;
    quantityKg: number;
    conversionRatioToKg?: number;
    agreedPricePerKg?: number;
    notes?: string;
  }) => DemoSupplyAllocation;
  respondDemoAllocation: (input: {
    allocationId: string;
    decision: "reserved" | "rejected";
    notes?: string;
  }) => DemoSupplyAllocation;
  markDemoInDelivery: (allocationId: string) => DemoSupplyAllocation;
  confirmDemoDelivery: (input: {
    allocationId: string;
    receivedKg: number;
    finalizeShort?: boolean;
    notes?: string;
  }) => DemoSupplyAllocation;
  cancelOrResolveDemoAllocation: (input: {
    allocationId: string;
    reason: string;
    isDispute?: boolean;
  }) => DemoSupplyAllocation;
  adminVerifyDemoMarket: (input: {
    accountId: string;
    decision: "verified" | "rejected";
    notes?: string;
  }) => DemoAccountProfile;
  adminResolveLegacyAccount: (input: {
    accountId: string;
    decision: "approve_as_farmer" | "approve_as_market" | "keep_deactivated";
    notes: string;
  }) => DemoAccountProfile;
  adminReviewDemoHarvest: (input: {
    harvestId: string;
    decision: "available" | "rejected";
    notes?: string;
  }) => DemoHarvestItem;
  resetDemoWorkspace: () => void;
};

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const isConfigured = supabaseConfig.status === "configured";
  const [mode, setModeState] = useState<PortalMode>(
    isConfigured ? "live" : "demo",
  );
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(!isConfigured);
  const [authError, setAuthError] = useState("");

  const [liveHarvests, setLiveHarvests] = useState<LiveHarvestListing[]>([]);
  const [liveDemands, setLiveDemands] = useState<LiveMarketDemand[]>([]);
  const [liveAllocations, setLiveAllocations] = useState<
    LiveSupplyAllocation[]
  >([]);
  const [harvestsLoading, setHarvestsLoading] = useState(false);
  const [harvestsError, setHarvestsError] = useState("");

  // Keep the first client render identical to the server render. Reading
  // localStorage in useState initializers makes persisted role/workflow data
  // disagree with SSR markup and causes a React hydration failure on reload.
  const [activeDemoRole, setActiveDemoRoleState] =
    useState<RoleType>("market");
  const [activeDemoMarketId, setActiveDemoMarketIdState] =
    useState("market-boac-1");
  const [rawDemoHarvests, setRawDemoHarvests] =
    useState<DemoHarvestItem[]>(initialDemoHarvests);
  const [rawDemoDemands, setRawDemoDemands] = useState<DemoMarketDemand[]>(
    initialDemoMarketDemands,
  );
  const [demoAllocations, setDemoAllocations] =
    useState<DemoSupplyAllocation[]>(initialDemoAllocations);
  const [demoAccounts, setDemoAccounts] =
    useState<DemoAccountProfile[]>(initialDemoAccounts);
  const [demoAuditLogs, setDemoAuditLogs] =
    useState<DemoAuditLog[]>(initialDemoAuditLogs);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(WEB_DEMO_STATE_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved) as Partial<PersistedDemoState>;

        if (
          parsed.activeDemoRole === "farmer" ||
          parsed.activeDemoRole === "market" ||
          parsed.activeDemoRole === "admin"
        ) {
          setActiveDemoRoleState(parsed.activeDemoRole);
        }
        if (typeof parsed.activeDemoMarketId === "string") {
          setActiveDemoMarketIdState(parsed.activeDemoMarketId);
        }
        if (Array.isArray(parsed.harvests) && parsed.harvests.length > 0) {
          setRawDemoHarvests(parsed.harvests);
        }
        if (Array.isArray(parsed.demands) && parsed.demands.length > 0) {
          setRawDemoDemands(parsed.demands);
        }
        if (Array.isArray(parsed.allocations)) {
          setDemoAllocations(parsed.allocations);
        }
        if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
          setDemoAccounts(parsed.accounts);
        }
        if (Array.isArray(parsed.auditLogs)) {
          setDemoAuditLogs(parsed.auditLogs);
        }
      } catch {
        // Keep the safe in-memory fixtures if stored demo data is unavailable.
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  const persistDemoSnapshot = useCallback(
    (next: Partial<PersistedDemoState>) => {
      try {
        const snapshot: PersistedDemoState = {
          activeDemoRole: next.activeDemoRole ?? activeDemoRole,
          activeDemoMarketId: next.activeDemoMarketId ?? activeDemoMarketId,
          harvests: next.harvests ?? rawDemoHarvests,
          demands: next.demands ?? rawDemoDemands,
          allocations: next.allocations ?? demoAllocations,
          accounts: next.accounts ?? demoAccounts,
          auditLogs: next.auditLogs ?? demoAuditLogs,
        };
        window.localStorage.setItem(
          WEB_DEMO_STATE_KEY,
          JSON.stringify(snapshot),
        );
      } catch {
        // Ignore localStorage quota/access error
      }
    },
    [
      activeDemoRole,
      activeDemoMarketId,
      rawDemoHarvests,
      rawDemoDemands,
      demoAllocations,
      demoAccounts,
      demoAuditLogs,
    ],
  );

  const { harvests: demoHarvests, demands: demoDemands } = useMemo(
    () =>
      recomputeDemoAccounting(rawDemoHarvests, rawDemoDemands, demoAllocations),
    [rawDemoHarvests, rawDemoDemands, demoAllocations],
  );

  const activeDemoMarket = useMemo(
    () => demoAccounts.find((a) => a.id === activeDemoMarketId),
    [demoAccounts, activeDemoMarketId],
  );

  function setActiveDemoRole(role: RoleType) {
    setActiveDemoRoleState(role);
    persistDemoSnapshot({ activeDemoRole: role });
  }

  function setActiveDemoMarketId(marketId: string) {
    setActiveDemoMarketIdState(marketId);
    persistDemoSnapshot({ activeDemoMarketId: marketId });
  }

  function appendAuditLog(
    entry: Omit<DemoAuditLog, "id" | "createdAt">,
    existingLogs = demoAuditLogs,
  ): DemoAuditLog[] {
    const log: DemoAuditLog = {
      id: `AUD-${String(existingLogs.length + 1).padStart(3, "0")}`,
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
      ...entry,
    };
    return [log, ...existingLogs];
  }

  function registerDemoMarketAccount(input: {
    displayName: string;
    organizationName: string;
    marketType: MarketType;
    municipality: string;
  }): DemoAccountProfile {
    if (!input.displayName.trim() || !input.organizationName.trim()) {
      throw new Error("Enter both contact person name and market/buyer name.");
    }
    const newAccount: DemoAccountProfile = {
      id: `market-${Date.now()}`,
      displayName: input.displayName.trim(),
      organizationName: input.organizationName.trim(),
      role: "market",
      marketType: input.marketType,
      municipality: input.municipality,
      accountStatus: "active",
      marketVerificationStatus: "pending_verification",
    };
    const nextAccounts = [...demoAccounts, newAccount];
    const nextLogs = appendAuditLog({
      actorName: newAccount.displayName,
      actorRole: "market",
      action: "register_account_profile",
      entityType: "profiles",
      entityId: newAccount.id,
      reason: `Registered new Market (${newAccount.marketType}) in ${newAccount.municipality}. Status set to pending_verification.`,
    });
    setDemoAccounts(nextAccounts);
    setDemoAuditLogs(nextLogs);
    setActiveDemoMarketIdState(newAccount.id);
    persistDemoSnapshot({
      accounts: nextAccounts,
      auditLogs: nextLogs,
      activeDemoMarketId: newAccount.id,
    });
    return newAccount;
  }

  function createDemoMarketDemand(input: {
    crop: string;
    requiredQuantityKg: number;
    unit?: MeasurementUnit;
    buyingType?: BuyingType;
    unitPricePhp?: number;
    totalPricePhp?: number;
    expectedKgPerUnit?: number;
    preferredQualityGrade: QualityGrade;
    offeredPricePerKg: number;
    municipality: string;
    deliveryLocation: string;
    storage: string;
    requiredDeliveryDate: string;
    acceptPartial: boolean;
    note?: string;
  }): DemoMarketDemand {
    const market = demoAccounts.find((a) => a.id === activeDemoMarketId);
    if (!market || market.role !== "market") {
      throw new Error("Select an active Market account before posting demand.");
    }
    if (market.marketVerificationStatus !== "verified") {
      throw new Error(
        `Unverified Market accounts (${market.organizationName} is ${market.marketVerificationStatus}) cannot post active crop demands. An Admin must verify this Market account first.`,
      );
    }
    if (
      !Number.isFinite(input.requiredQuantityKg) ||
      input.requiredQuantityKg <= 0
    ) {
      throw new Error("Required quantity must be greater than 0 kg.");
    }
    if (
      !Number.isFinite(input.offeredPricePerKg) ||
      input.offeredPricePerKg <= 0
    ) {
      throw new Error("Offered price per kg must be greater than ₱0.");
    }
    if (!input.deliveryLocation.trim()) {
      throw new Error("Enter the market delivery location or stall/receiving bay.");
    }

    const unit = input.unit ?? "kg";
    const buyingType = input.buyingType ?? "per_unit";
    const unitPrice = input.unitPricePhp ?? input.offeredPricePerKg;
    const totalPrice =
      buyingType === "bulk_lot"
        ? (input.totalPricePhp ?? input.offeredPricePerKg)
        : (input.totalPricePhp ?? Number((input.requiredQuantityKg * unitPrice).toFixed(2)));

    const nextId = `MKT-DEM-${String(rawDemoDemands.length + 1).padStart(2, "0")}`;
    const created: DemoMarketDemand = {
      id: nextId,
      marketId: market.id,
      processor: market.organizationName,
      marketName: market.organizationName,
      marketType: market.marketType ?? "public_market",
      marketVerified: true,
      crop: input.crop,
      quantity: Number(input.requiredQuantityKg.toFixed(2)),
      requiredQuantityKg: Number(input.requiredQuantityKg.toFixed(2)),
      reservedQuantityKg: 0,
      fulfilledQuantityKg: 0,
      remainingDemandKg: Number(input.requiredQuantityKg.toFixed(2)),
      unit,
      buyingType,
      unitPricePhp: buyingType === "per_unit" ? unitPrice : undefined,
      totalPricePhp: totalPrice,
      expectedKgPerUnit: input.expectedKgPerUnit,
      preferredQualityGrade: input.preferredQualityGrade,
      offeredPricePerKg: Number(input.offeredPricePerKg.toFixed(2)),
      municipality: input.municipality,
      barangay: input.deliveryLocation.trim(),
      deliveryLocation: input.deliveryLocation.trim(),
      storage: input.storage,
      requiredBy: input.requiredDeliveryDate,
      requiredDeliveryDate: input.requiredDeliveryDate,
      window: `Delivery by ${input.requiredDeliveryDate}`,
      acceptPartial: input.acceptPartial,
      status: "open",
      note:
        input.note?.trim() ||
        `${input.acceptPartial ? "Accepts partial farmer allocations." : "Requires full quantity fulfillment."}`,
    };

    const nextDemands = [created, ...rawDemoDemands];
    const nextLogs = appendAuditLog({
      actorName: market.organizationName,
      actorRole: "market",
      action: "create_market_demand",
      entityType: "market_demands",
      entityId: created.id,
      reason: `Posted demand for ${created.requiredQuantityKg} ${unitLabel(unit)} ${created.crop} @ ${buyingType === "bulk_lot" ? `₱${totalPrice} (bulk lot)` : `₱${unitPrice}/${unitLabel(unit)}`} (${created.municipality}).`,
    });
    setRawDemoDemands(nextDemands);
    setDemoAuditLogs(nextLogs);
    persistDemoSnapshot({ demands: nextDemands, auditLogs: nextLogs });
    return created;
  }

  function updateDemoDemandStatus(
    demandId: string,
    status: DemoMarketDemand["status"],
  ) {
    const nextDemands = rawDemoDemands.map((d) =>
      d.id === demandId ? { ...d, status } : d,
    );
    const nextLogs = appendAuditLog({
      actorName: activeDemoMarket?.organizationName ?? "Market / Admin",
      actorRole: activeDemoRole,
      action: "update_demand_status",
      entityType: "market_demands",
      entityId: demandId,
      reason: `Updated market demand status to ${status}.`,
    });
    setRawDemoDemands(nextDemands);
    setDemoAuditLogs(nextLogs);
    persistDemoSnapshot({ demands: nextDemands, auditLogs: nextLogs });
  }

  function allocateDemoHarvestToMarket(input: {
    harvestId: string;
    demandId: string;
    quantityKg: number;
    conversionRatioToKg?: number;
    agreedPricePerKg?: number;
    notes?: string;
  }): DemoSupplyAllocation {
    const harvest = demoHarvests.find((h) => h.id === input.harvestId);
    if (!harvest) {
      throw new Error("Selected harvest listing does not exist.");
    }
    if (!harvest.verified || harvest.status === "pending_verification" || harvest.status === "rejected") {
      throw new Error(
        `Harvest listing ${harvest.id} (${harvest.crop}) must be verified by Admin before allocating to markets.`,
      );
    }
    const demand = demoDemands.find((d) => d.id === input.demandId);
    if (!demand) {
      throw new Error("Selected market demand does not exist.");
    }
    if (demand.status !== "open" && demand.status !== "partially_allocated") {
      throw new Error(
        `Market demand ${demand.id} is currently ${demand.status} and cannot accept new offers.`,
      );
    }
    const marketAccount = demoAccounts.find((a) => a.id === demand.marketId);
    if (
      !demand.marketVerified ||
      (marketAccount && marketAccount.marketVerificationStatus !== "verified")
    ) {
      throw new Error(
        "Unverified Market accounts cannot receive or accept farmer supply offers.",
      );
    }
    if (harvest.crop.toLowerCase() !== demand.crop.toLowerCase()) {
      throw new Error(
        `Crop mismatch: cannot allocate ${harvest.crop} to a ${demand.crop} demand.`,
      );
    }
    if (!Number.isFinite(input.quantityKg) || input.quantityKg <= 0) {
      throw new Error("Enter an allocation quantity greater than 0.");
    }

    const harvestUnit = harvest.unit ?? "kg";
    const demandUnit = demand.unit ?? "kg";
    let deductedInventoryQuantity = Number(input.quantityKg.toFixed(2));

    if (harvestUnit === "kg" && demandUnit !== "kg") {
      if (!input.conversionRatioToKg || input.conversionRatioToKg <= 0) {
        throw new Error(
          `Paki-lagay ang conversion factor (ilang kg bawat ${unitLabel(demandUnit)}) upang mai-kaltas nang wasto sa kg inventory.`,
        );
      }
      deductedInventoryQuantity = Number(
        (input.quantityKg * input.conversionRatioToKg).toFixed(2),
      );
    } else if (harvestUnit !== "kg" && demandUnit === "kg") {
      if (!input.conversionRatioToKg || input.conversionRatioToKg <= 0) {
        throw new Error(
          `Paki-lagay ang conversion factor (ilang kg bawat ${unitLabel(harvestUnit)}) upang mai-kaltas nang wasto sa imbentaryo.`,
        );
      }
      deductedInventoryQuantity = Number(
        (input.quantityKg / input.conversionRatioToKg).toFixed(2),
      );
    } else if (harvestUnit !== demandUnit) {
      if (!input.conversionRatioToKg || input.conversionRatioToKg <= 0) {
        throw new Error(
          `Hindi tugma ang unit (${unitLabel(harvestUnit)} vs ${unitLabel(demandUnit)}). Paki-lagay ang conversion factor.`,
        );
      }
    }

    if (deductedInventoryQuantity > harvest.remainingKg) {
      throw new Error(
        `Over-allocation blocked: ${deductedInventoryQuantity} ${unitLabel(harvestUnit)} exceeds farmer remaining available stock (${harvest.remainingKg} ${unitLabel(harvestUnit)} of ${harvest.quantity} ${unitLabel(harvestUnit)} total).`,
      );
    }
    if (input.quantityKg > demand.remainingDemandKg) {
      throw new Error(
        `Market demand exceeded: ${input.quantityKg} ${unitLabel(demandUnit)} exceeds ${demand.marketName}'s remaining need (${demand.remainingDemandKg} ${unitLabel(demandUnit)} of ${demand.requiredQuantityKg} ${unitLabel(demandUnit)}).`,
      );
    }
    if (!demand.acceptPartial && input.quantityKg < demand.remainingDemandKg) {
      throw new Error(
        `${demand.marketName} does not accept partial quantities. Offer the full remaining ${demand.remainingDemandKg} ${unitLabel(demandUnit)}.`,
      );
    }

    const unitPrice =
      input.agreedPricePerKg ?? demand.unitPricePhp ?? demand.offeredPricePerKg;
    const totalAgreedPrice =
      demand.buyingType === "bulk_lot"
        ? (demand.totalPricePhp ?? unitPrice)
        : Number((input.quantityKg * unitPrice).toFixed(2));

    const created: DemoSupplyAllocation = {
      id: `ALLOC-${String(demoAllocations.length + 1).padStart(3, "0")}`,
      harvestId: harvest.id,
      farmerName: harvest.farmer,
      farmerMunicipality: harvest.municipality,
      farmerBarangay: harvest.barangay,
      demandId: demand.id,
      marketId: demand.marketId,
      marketName: demand.marketName,
      marketType: demand.marketType,
      marketMunicipality: demand.municipality,
      crop: harvest.crop,
      qualityGrade: harvest.qualityGrade,
      allocatedKg: Number(input.quantityKg.toFixed(2)),
      deliveredKg: 0,
      agreedPricePerKg: unitPrice,
      unit: demandUnit,
      inventoryUnit: harvestUnit,
      buyingType: demand.buyingType ?? "per_unit",
      totalAgreedPrice,
      conversionRatioToKg: input.conversionRatioToKg,
      deductedInventoryQuantity,
      status: "offered",
      notes:
        input.notes?.trim() ||
        `Allocated ${input.quantityKg} ${unitLabel(demandUnit)} ${harvest.crop} (${harvest.qualityGrade}) to ${demand.marketName}.`,
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
      updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    };

    const nextAllocations = [...demoAllocations, created];
    const nextLogs = appendAuditLog({
      actorName: harvest.farmer,
      actorRole: "farmer",
      action: "allocate_harvest_to_demand",
      entityType: "supply_allocations",
      entityId: created.id,
      reason: `Farmer offered ${created.allocatedKg} ${unitLabel(demandUnit)} ${created.crop} from ${harvest.id} to ${demand.marketName} (${demand.id}).`,
    });

    setDemoAllocations(nextAllocations);
    setDemoAuditLogs(nextLogs);
    persistDemoSnapshot({
      allocations: nextAllocations,
      auditLogs: nextLogs,
    });
    return created;
  }

  function respondDemoAllocation(input: {
    allocationId: string;
    decision: "reserved" | "rejected";
    notes?: string;
  }): DemoSupplyAllocation {
    const existing = demoAllocations.find((a) => a.id === input.allocationId);
    if (!existing) {
      throw new Error("Supply allocation offer not found.");
    }
    if (existing.status !== "offered") {
      throw new Error(
        `Offer ${existing.id} is already in status '${existing.status}' and cannot be accepted or rejected again.`,
      );
    }

    const demand = demoDemands.find((d) => d.id === existing.demandId);
    if (!demand) {
      throw new Error("Associated market demand not found.");
    }

    const marketAccount = demoAccounts.find((a) => a.id === demand.marketId);
    if (
      !demand.marketVerified ||
      (marketAccount && marketAccount.marketVerificationStatus !== "verified")
    ) {
      throw new Error(
        "Unverified Market accounts cannot accept farmer supply offers.",
      );
    }

    // Atomic capacity re-validation at acceptance time (prevents concurrent over-reservation)
    if (
      input.decision === "reserved" &&
      existing.allocatedKg > demand.remainingDemandKg
    ) {
      throw new Error(
        `Concurrency guard blocked acceptance: ${demand.marketName} only has ${demand.remainingDemandKg} kg of remaining unreserved demand, so this ${existing.allocatedKg} kg offer cannot be accepted.`,
      );
    }

    const updated: DemoSupplyAllocation = {
      ...existing,
      status: input.decision,
      notes:
        input.notes?.trim() ||
        (input.decision === "reserved"
          ? `Accepted & reserved by ${demand.marketName}.`
          : `Rejected by ${demand.marketName}; ${existing.allocatedKg} kg released back to farmer.`),
      updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    };

    const nextAllocations = demoAllocations.map((a) =>
      a.id === updated.id ? updated : a,
    );
    const nextLogs = appendAuditLog({
      actorName: demand.marketName,
      actorRole: "market",
      action:
        input.decision === "reserved"
          ? "accept_supply_allocation"
          : "reject_supply_allocation",
      entityType: "supply_allocations",
      entityId: updated.id,
      reason:
        input.decision === "reserved"
          ? `Market accepted & reserved ${updated.allocatedKg} kg ${updated.crop} from ${updated.farmerName}.`
          : `Market rejected offer of ${updated.allocatedKg} kg ${updated.crop}; quantity released back to farmer inventory.`,
    });

    setDemoAllocations(nextAllocations);
    setDemoAuditLogs(nextLogs);
    persistDemoSnapshot({
      allocations: nextAllocations,
      auditLogs: nextLogs,
    });
    return updated;
  }

  function markDemoInDelivery(allocationId: string): DemoSupplyAllocation {
    const existing = demoAllocations.find((a) => a.id === allocationId);
    if (!existing) {
      throw new Error("Allocation not found.");
    }
    if (existing.status !== "reserved") {
      throw new Error(
        "Only reserved allocations can be marked as in_delivery.",
      );
    }
    const updated: DemoSupplyAllocation = {
      ...existing,
      status: "in_delivery",
      updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    };
    const nextAllocations = demoAllocations.map((a) =>
      a.id === updated.id ? updated : a,
    );
    const nextLogs = appendAuditLog({
      actorName: existing.farmerName,
      actorRole: "farmer",
      action: "mark_allocation_in_delivery",
      entityType: "supply_allocations",
      entityId: updated.id,
      reason: `Farmer dispatched ${updated.allocatedKg} kg ${updated.crop} to ${updated.marketName}.`,
    });
    setDemoAllocations(nextAllocations);
    setDemoAuditLogs(nextLogs);
    persistDemoSnapshot({
      allocations: nextAllocations,
      auditLogs: nextLogs,
    });
    return updated;
  }

  function confirmDemoDelivery(input: {
    allocationId: string;
    receivedKg: number;
    finalizeShort?: boolean;
    notes?: string;
  }): DemoSupplyAllocation {
    const existing = demoAllocations.find((a) => a.id === input.allocationId);
    if (!existing) {
      throw new Error("Supply allocation not found.");
    }
    if (
      existing.status !== "reserved" &&
      existing.status !== "in_delivery" &&
      existing.status !== "partially_delivered"
    ) {
      throw new Error(
        `Allocation ${existing.id} is in status '${existing.status}'. Only reserved or in-delivery allocations can have delivery confirmed.`,
      );
    }
    const remainingToDeliver = Number(
      (existing.allocatedKg - existing.deliveredKg).toFixed(2),
    );
    if (!Number.isFinite(input.receivedKg) || input.receivedKg <= 0) {
      throw new Error("Confirmed received quantity must be greater than 0 kg.");
    }
    if (input.receivedKg > remainingToDeliver) {
      throw new Error(
        `Cannot confirm ${input.receivedKg} kg: only ${remainingToDeliver} kg remains undelivered on this ${existing.allocatedKg} kg reservation.`,
      );
    }

    const cumulativeDelivered = Number(
      (existing.deliveredKg + input.receivedKg).toFixed(2),
    );
    const isComplete =
      cumulativeDelivered >= existing.allocatedKg || !!input.finalizeShort;
    const effectiveAllocatedKg =
      isComplete && input.finalizeShort
        ? cumulativeDelivered
        : existing.allocatedKg;

    const updated: DemoSupplyAllocation = {
      ...existing,
      allocatedKg: effectiveAllocatedKg,
      deliveredKg: cumulativeDelivered,
      status: isComplete ? "delivered" : "partially_delivered",
      notes:
        input.notes?.trim() ||
        (isComplete
          ? `Delivery confirmed (${cumulativeDelivered} kg received by ${existing.marketName}).`
          : `Partial delivery confirmed (${cumulativeDelivered} / ${existing.allocatedKg} kg received).`),
      updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    };

    const nextAllocations = demoAllocations.map((a) =>
      a.id === updated.id ? updated : a,
    );
    const nextLogs = appendAuditLog({
      actorName: existing.marketName,
      actorRole: "market",
      action: "confirm_allocation_delivery",
      entityType: "delivery_records",
      entityId: updated.id,
      reason: `Confirmed receipt of ${input.receivedKg} kg ${existing.crop} (cumulative ${cumulativeDelivered} kg, status = ${updated.status}).`,
    });

    setDemoAllocations(nextAllocations);
    setDemoAuditLogs(nextLogs);
    persistDemoSnapshot({
      allocations: nextAllocations,
      auditLogs: nextLogs,
    });
    return updated;
  }

  function cancelOrResolveDemoAllocation(input: {
    allocationId: string;
    reason: string;
    isDispute?: boolean;
  }): DemoSupplyAllocation {
    const existing = demoAllocations.find((a) => a.id === input.allocationId);
    if (!existing) {
      throw new Error("Supply allocation not found.");
    }
    if (existing.status === "delivered" || existing.status === "cancelled") {
      throw new Error(
        `Allocation ${existing.id} is already ${existing.status}.`,
      );
    }
    if (!input.reason.trim()) {
      throw new Error("Provide a cancellation or dispute resolution reason.");
    }

    const releasedKg = Math.max(
      0,
      Number((existing.allocatedKg - existing.deliveredKg).toFixed(2)),
    );
    // If some quantity was already delivered, keep deliveredKg and cap allocatedKg = deliveredKg so only undelivered remainder is released
    const updated: DemoSupplyAllocation = {
      ...existing,
      allocatedKg: existing.deliveredKg > 0 ? existing.deliveredKg : existing.allocatedKg,
      status: existing.deliveredKg > 0 ? "delivered" : "cancelled",
      notes: `${input.isDispute ? "[ADMIN DISPUTE RESOLVED]" : "[CANCELLED]"} ${input.reason.trim()} (Released ${releasedKg} kg undelivered quantity).`,
      updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    };

    const nextAllocations = demoAllocations.map((a) =>
      a.id === updated.id ? updated : a,
    );
    const nextLogs = appendAuditLog({
      actorName:
        activeDemoRole === "admin"
          ? "Provincial Agri Admin"
          : existing.farmerName,
      actorRole: activeDemoRole,
      action: input.isDispute
        ? "admin_resolve_dispute"
        : "cancel_supply_allocation",
      entityType: "supply_allocations",
      entityId: updated.id,
      reason: `${input.reason.trim()} — Released ${releasedKg} kg undelivered quantity; preserved ${existing.deliveredKg} kg already delivered.`,
    });

    setDemoAllocations(nextAllocations);
    setDemoAuditLogs(nextLogs);
    persistDemoSnapshot({
      allocations: nextAllocations,
      auditLogs: nextLogs,
    });
    return updated;
  }

  function adminVerifyDemoMarket(input: {
    accountId: string;
    decision: "verified" | "rejected";
    notes?: string;
  }): DemoAccountProfile {
    if (activeDemoRole !== "admin") {
      throw new Error(
        "Unauthorized: Only an Admin account can verify or reject Market accounts.",
      );
    }
    const target = demoAccounts.find((a) => a.id === input.accountId);
    if (!target || target.role !== "market") {
      throw new Error("Target Market account not found.");
    }

    const updated: DemoAccountProfile = {
      ...target,
      marketVerificationStatus: input.decision,
    };
    const nextAccounts = demoAccounts.map((a) =>
      a.id === updated.id ? updated : a,
    );
    const nextDemands = rawDemoDemands.map((d) =>
      d.marketId === updated.id
        ? { ...d, marketVerified: input.decision === "verified" }
        : d,
    );
    const nextLogs = appendAuditLog({
      actorName: "Provincial Agri Admin",
      actorRole: "admin",
      action: "admin_verify_market_account",
      entityType: "profiles",
      entityId: updated.id,
      reason:
        input.notes?.trim() ||
        `Admin set ${updated.organizationName} verification status to ${input.decision}.`,
    });

    setDemoAccounts(nextAccounts);
    setRawDemoDemands(nextDemands);
    setDemoAuditLogs(nextLogs);
    persistDemoSnapshot({
      accounts: nextAccounts,
      demands: nextDemands,
      auditLogs: nextLogs,
    });
    return updated;
  }

  function adminResolveLegacyAccount(input: {
    accountId: string;
    decision: "approve_as_farmer" | "approve_as_market" | "keep_deactivated";
    notes: string;
  }): DemoAccountProfile {
    if (activeDemoRole !== "admin") {
      throw new Error(
        "Unauthorized: Only an Admin can resolve quarantined legacy accounts.",
      );
    }
    const target = demoAccounts.find((a) => a.id === input.accountId);
    if (!target) {
      throw new Error("Account not found.");
    }
    if (!input.notes.trim()) {
      throw new Error("Audit notes are required when resolving a legacy account.");
    }

    const updated: DemoAccountProfile = {
      ...target,
      role:
        input.decision === "approve_as_market"
          ? "market"
          : input.decision === "approve_as_farmer"
            ? "farmer"
            : target.role,
      marketType:
        input.decision === "approve_as_market"
          ? target.marketType ?? "cooperative"
          : undefined,
      accountStatus:
        input.decision === "keep_deactivated"
          ? "deactivated_pending_admin_review"
          : "active",
      marketVerificationStatus:
        input.decision === "approve_as_market"
          ? "verified"
          : "not_applicable",
    };

    const nextAccounts = demoAccounts.map((a) =>
      a.id === updated.id ? updated : a,
    );
    const nextLogs = appendAuditLog({
      actorName: "Provincial Agri Admin",
      actorRole: "admin",
      action: "admin_resolve_legacy_account",
      entityType: "legacy_role_migration_quarantine",
      entityId: updated.id,
      reason: `Resolved legacy ${target.legacyPreviousRole ?? target.role} account (${target.displayName}) -> ${input.decision}: ${input.notes.trim()}`,
    });

    setDemoAccounts(nextAccounts);
    setDemoAuditLogs(nextLogs);
    persistDemoSnapshot({ accounts: nextAccounts, auditLogs: nextLogs });
    return updated;
  }

  function adminReviewDemoHarvest(input: {
    harvestId: string;
    decision: "available" | "rejected";
    notes?: string;
  }): DemoHarvestItem {
    if (activeDemoRole !== "admin") {
      throw new Error(
        "Unauthorized: Only an Admin (with designated verification authority) can verify or reject farmer harvest listings.",
      );
    }
    const target = rawDemoHarvests.find((h) => h.id === input.harvestId);
    if (!target) {
      throw new Error("Harvest listing not found.");
    }
    if (input.decision === "rejected" && !input.notes?.trim()) {
      throw new Error(
        "Review notes are required when rejecting a harvest listing.",
      );
    }

    const updated: DemoHarvestItem = {
      ...target,
      verified: input.decision === "available",
      status: input.decision,
    };
    const nextHarvests = rawDemoHarvests.map((h) =>
      h.id === updated.id ? updated : h,
    );
    const actorLabel = "Provincial Agri Admin (Verification Duty)";
    const nextLogs = appendAuditLog({
      actorName: actorLabel,
      actorRole: "admin",
      action: "review_harvest_listing",
      entityType: "harvest_listings",
      entityId: updated.id,
      reason:
        input.notes?.trim() ||
        `${actorLabel} ${input.decision === "available" ? "approved & verified" : "rejected"} ${updated.crop} (${updated.quantity} kg by ${updated.farmer}).`,
    });

    setRawDemoHarvests(nextHarvests);
    setDemoAuditLogs(nextLogs);
    persistDemoSnapshot({ harvests: nextHarvests, auditLogs: nextLogs });
    return updated;
  }

  function resetDemoWorkspace() {
    setActiveDemoRoleState("market");
    setActiveDemoMarketIdState("market-boac-1");
    setRawDemoHarvests(initialDemoHarvests);
    setRawDemoDemands(initialDemoMarketDemands);
    setDemoAllocations(initialDemoAllocations);
    setDemoAccounts(initialDemoAccounts);
    setDemoAuditLogs(initialDemoAuditLogs);
    try {
      window.localStorage.removeItem(WEB_DEMO_STATE_KEY);
    } catch {
      // Ignore storage error
    }
  }

  const loadListingsForUser = useCallback(
    async (activeSession: SupabaseSession, activeProfile: UserProfile) => {
      setHarvestsLoading(true);
      setHarvestsError("");
      try {
        const [rows, demands, allocations] = await Promise.all([
          fetchPortalHarvestListings(activeSession, activeProfile.role),
          fetchLiveMarketDemands(activeSession).catch(() => []),
          fetchLiveSupplyAllocations(activeSession).catch(() => []),
        ]);
        setLiveHarvests(rows);
        setLiveDemands(demands);
        setLiveAllocations(allocations);
      } catch (err) {
        setHarvestsError(
          err instanceof Error
            ? err.message
            : "Could not load harvest listings from Supabase Agri.",
        );
      } finally {
        setHarvestsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    let active = true;
    async function restore() {
      try {
        const raw = window.localStorage.getItem(WEB_SESSION_KEY);
        if (!raw) {
          if (active) setAuthReady(true);
          return;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!isValidSession(parsed)) {
          window.localStorage.removeItem(WEB_SESSION_KEY);
          if (active) setAuthReady(true);
          return;
        }

        let currentSession = parsed;
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (currentSession.expires_at <= nowSeconds + 60) {
          currentSession = await refreshWebSession(
            currentSession.refresh_token,
          );
          window.localStorage.setItem(
            WEB_SESSION_KEY,
            JSON.stringify(currentSession),
          );
        }

        const loadedProfile = await fetchOrCreateUserProfile(currentSession);
        if (!active) return;

        setSession(currentSession);
        setProfile(loadedProfile);
        setModeState("live");
        setAuthReady(true);
        await loadListingsForUser(currentSession, loadedProfile);
      } catch (err) {
        try {
          window.localStorage.removeItem(WEB_SESSION_KEY);
        } catch {
          // Ignore storage error
        }
        if (active) {
          setSession(null);
          setProfile(null);
          setAuthError(
            err instanceof Error
              ? err.message
              : "Saved session expired. Please sign in again.",
          );
          setAuthReady(true);
        }
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, [isConfigured, loadListingsForUser]);

  function setMode(nextMode: PortalMode) {
    if (nextMode === "live" && !isConfigured) return;
    setModeState(nextMode);
  }

  async function signIn(email: string, password: string): Promise<UserProfile> {
    setAuthError("");
    setHarvestsError("");
    const result = await signInWebUser({ email, password });
    try {
      window.localStorage.setItem(
        WEB_SESSION_KEY,
        JSON.stringify(result.session),
      );
    } catch {
      // Ignore storage error
    }
    setSession(result.session);
    setProfile(result.profile);
    setModeState("live");
    await loadListingsForUser(result.session, result.profile);
    return result.profile;
  }

  async function registerAccount(input: {
    email: string;
    password: string;
    role: "farmer" | "market";
    displayName: string;
    municipality: string;
    organizationName?: string;
    marketType?: MarketType;
  }): Promise<UserProfile> {
    setAuthError("");
    setHarvestsError("");
    const result = await signUpWebMarketOrFarmer({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      municipality: input.municipality,
      accountRole: input.role,
      marketType: input.marketType,
      organizationName: input.organizationName,
    });
    if (result.session && result.profile) {
      try {
        window.localStorage.setItem(
          WEB_SESSION_KEY,
          JSON.stringify(result.session),
        );
      } catch {
        // Ignore storage error
      }
      setSession(result.session);
      setProfile(result.profile);
      setModeState("live");
      await loadListingsForUser(result.session, result.profile);
      return result.profile;
    }
    throw new Error(
      result.confirmationRequired
        ? "Account registered. Please confirm your email in Supabase Auth before signing in."
        : "Registration succeeded.",
    );
  }

  async function signOut(): Promise<void> {
    const token = session?.access_token;
    try {
      window.localStorage.removeItem(WEB_SESSION_KEY);
    } catch {
      // Ignore storage error
    }
    setSession(null);
    setProfile(null);
    setLiveHarvests([]);
    setLiveDemands([]);
    setLiveAllocations([]);
    setHarvestsError("");
    setAuthError("");
    if (token) {
      await signOutWebSession(token);
    }
  }

  async function refreshLiveHarvests(): Promise<void> {
    if (!session || !profile) {
      throw new Error("Sign in to refresh live harvest listings.");
    }
    await loadListingsForUser(session, profile);
  }

  async function reviewListing(params: {
    listingId: string;
    decision: "available" | "rejected";
    reviewNotes?: string;
  }): Promise<LiveHarvestListing> {
    if (!session || !profile) {
      throw new Error(
        "Sign in with an Admin account to review harvest listings.",
      );
    }
    const updated = await reviewHarvestListingRpc(
      session,
      profile.role,
      params,
    );
    setLiveHarvests((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    return updated;
  }

  async function postLiveDemand(input: {
    crop: string;
    required_quantity_kg: number;
    preferred_quality_grade: QualityGrade;
    offered_price_php_per_kg: number;
    municipality: string;
    delivery_location: string;
    preferred_storage: string;
    required_delivery_date: string;
    accept_partial: boolean;
    notes?: string;
  }): Promise<LiveMarketDemand> {
    if (!session || !profile) {
      throw new Error("Sign in with a verified Market account to post demand.");
    }
    const created = await createLiveMarketDemand(session, {
      crop: input.crop,
      requiredQuantityKg: input.required_quantity_kg,
      preferredQualityGrade: input.preferred_quality_grade,
      offeredPricePerKg: input.offered_price_php_per_kg,
      municipality: input.municipality,
      barangay: input.delivery_location,
      requiredBy: input.required_delivery_date,
      acceptPartial: input.accept_partial,
      qualityNotes: input.notes ?? "",
    });
    setLiveDemands((prev) => [created, ...prev]);
    return created;
  }

  async function respondLiveAllocation(params: {
    allocationId: string;
    decision: "reserved" | "rejected";
    notes?: string;
  }): Promise<LiveSupplyAllocation> {
    if (!session || !profile) {
      throw new Error("Sign in with a verified Market account.");
    }
    const updated = await respondToSupplyAllocationWebRpc(session, params);
    await loadListingsForUser(session, profile);
    return updated;
  }

  async function confirmLiveDelivery(params: {
    allocationId: string;
    actualReceivedKg: number;
    finalizeShortDelivery?: boolean;
    deliveryNotes?: string;
  }): Promise<LiveSupplyAllocation> {
    if (!session || !profile) {
      throw new Error("Sign in with a verified Market account.");
    }
    const updated = await confirmAllocationDeliveryWebRpc(session, {
      allocationId: params.allocationId,
      receivedQuantityKg: params.actualReceivedKg,
      finalizeShortDelivery: params.finalizeShortDelivery,
      deliveryNotes: params.deliveryNotes,
    });
    await loadListingsForUser(session, profile);
    return updated;
  }

  async function verifyLiveMarket(params: {
    marketProfileId: string;
    decision: "verified" | "rejected";
    notes?: string;
  }): Promise<void> {
    if (!session || !profile) {
      throw new Error("Sign in with an Admin account.");
    }
    await adminVerifyMarketAccountWebRpc(session, {
      marketId: params.marketProfileId,
      decision: params.decision,
      notes: params.notes ?? "Verified by Admin.",
    });
    await loadListingsForUser(session, profile);
  }

  return (
    <PortalAuthContext.Provider
      value={{
        isConfigured,
        mode,
        setMode,
        session,
        profile,
        authReady,
        authError,
        liveHarvests,
        liveDemands,
        liveAllocations,
        harvestsLoading,
        harvestsError,
        signIn,
        registerAccount,
        signOut,
        refreshLiveHarvests,
        reviewListing,
        postLiveDemand,
        respondLiveAllocation,
        confirmLiveDelivery,
        verifyLiveMarket,
        activeDemoRole,
        setActiveDemoRole,
        activeDemoMarketId,
        setActiveDemoMarketId,
        activeDemoMarket,
        demoHarvests,
        demoDemands,
        demoAllocations,
        demoAccounts,
        demoAuditLogs,
        registerDemoMarketAccount,
        createDemoMarketDemand,
        updateDemoDemandStatus,
        allocateDemoHarvestToMarket,
        respondDemoAllocation,
        markDemoInDelivery,
        confirmDemoDelivery,
        cancelOrResolveDemoAllocation,
        adminVerifyDemoMarket,
        adminResolveLegacyAccount,
        adminReviewDemoHarvest,
        resetDemoWorkspace,
      }}
    >
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) {
    throw new Error("usePortalAuth must be used within PortalAuthProvider");
  }
  return ctx;
}
