import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  INITIAL_DEMO_FARMER,
  INITIAL_DEMO_MARKETS,
  computeHarvestInventory,
  computeMarketDemandTotals,
  initialHarvests,
  initialMarketDemands,
  isHarvest,
  validateAllocationOffer,
  type FarmerAccount,
  type Harvest,
  type MarketAccount,
  type MarketDemand,
  type SupplyAllocation,
} from "./harvest";
import { supabaseConfig } from "./supabase-config";
import {
  allocateHarvestToDemandRpc,
  cancelSupplyAllocationRpc,
  createLiveMarketDemand,
  createPendingHarvestListing,
  fetchActiveMarketDemands,
  fetchFarmerHarvestListings,
  fetchFarmerSupplyAllocations,
  fetchOrCreateUserProfile,
  isValidSession,
  markAllocationInDeliveryRpc,
  refreshSupabaseSession,
  signInWithEmailPassword,
  signOutSession,
  signUpFarmerAccount,
  signUpMarketAccount,
  type SupabaseSession,
  type UserProfile,
} from "./supabase-client";

const DEMO_KEY = "smart-link:demo-harvests:v1";
const DEMO_DEMANDS_KEY = "smart-ani:demo-market-demands:v1";
const DEMO_ALLOCATIONS_KEY = "smart-ani:demo-allocations:v1";
const OFFLINE_DRAFTS_KEY = "smart-ani:offline-drafts:v1";
const SESSION_KEY = "smart-ani:supabase-session:v1";
const ACTIVE_ROLE_KEY = "smart-ani:active-role:v1";
const ACTIVE_MARKET_ID_KEY = "smart-ani:active-market-id:v1";
const DEMO_MARKETS_KEY = "smart-ani:demo-markets:v1";

type WorkspaceMode = "demo" | "live";

type HarvestCreatePayload = Omit<
  Harvest,
  | "id"
  | "status"
  | "farmerId"
  | "reviewedBy"
  | "reviewedAt"
  | "reviewNotes"
  | "createdAt"
  | "earmarkedKg"
  | "reservedKg"
  | "allocatedKg"
  | "deliveredKg"
  | "remainingKg"
>;

type HarvestStoreValue = {
  mode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;
  activeRole: "farmer" | "market";
  setActiveRole: (role: "farmer" | "market") => void;
  activeMarket: MarketAccount | null;
  setActiveMarket: (market: MarketAccount | null) => void;
  activeFarmer: FarmerAccount | null;
  setActiveFarmer: (farmer: FarmerAccount | null) => void;
  demoMarkets: MarketAccount[];
  registerDemoMarket: (input: {
    marketName: string;
    contactPerson: string;
    email: string;
    contactNumber?: string;
    municipality: string;
    businessAddress?: string;
    businessType: string;
  }) => MarketAccount;
  registerDemoFarmer: (input: {
    name: string;
    email: string;
    contactNumber?: string;
    municipality: string;
    barangay?: string;
    farmInfo?: string;
  }) => FarmerAccount;
  harvests: Harvest[];
  offlineDrafts: Harvest[];
  marketDemands: MarketDemand[];
  allocations: SupplyAllocation[];
  ready: boolean;
  error: string;
  add: (harvest: HarvestCreatePayload) => Promise<Harvest>;
  saveOfflineDraft: (harvest: HarvestCreatePayload) => Promise<Harvest>;
  syncOfflineDraft: (draftId: string) => Promise<Harvest>;
  addMarketDemand: (demand: {
    crop: string;
    requiredQuantityKg: number;
    unit?: string;
    buyingType?: string;
    unitPricePhp?: number;
    totalPricePhp?: number;
    municipality: string;
    barangay?: string;
    requiredBy: string;
    acceptPartial?: boolean;
    qualityNotes?: string;
    preferredQualityGrade?: string;
  }) => Promise<MarketDemand>;
  allocateToMarket: (params: {
    harvestId: string;
    demandId: string;
    quantityKg: number;
    agreedPricePerKg?: number;
    conversionRatioToKg?: number;
    offerNotes?: string;
  }) => Promise<SupplyAllocation>;
  markInDelivery: (
    allocationId: string,
    notes?: string,
  ) => Promise<SupplyAllocation>;
  cancelAllocation: (
    allocationId: string,
    reason: string,
  ) => Promise<SupplyAllocation>;
  demoRespondToAllocation: (
    allocationId: string,
    decision: "reserved" | "rejected",
    notes?: string,
  ) => Promise<SupplyAllocation>;
  demoConfirmDelivery: (
    allocationId: string,
    receivedKg: number,
    finalizeShort?: boolean,
    notes?: string,
  ) => Promise<SupplyAllocation>;
  resetDemoScenario: () => Promise<void>;
  refreshHarvests: () => Promise<void>;
  session: SupabaseSession | null;
  profile: UserProfile | null;
  authReady: boolean;
  authError: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    displayName: string;
    municipality: string;
  }) => Promise<{ confirmationRequired: boolean }>;
  signInFarmer: (email: string, password: string) => Promise<void>;
  signUpFarmer: (input: {
    email: string;
    password: string;
    displayName: string;
    municipality: string;
    contactNumber?: string;
    barangay?: string;
    farmInfo?: string;
  }) => Promise<{ confirmationRequired: boolean }>;
  signInMarket: (email: string, password: string) => Promise<{ verified: boolean; status: string }>;
  signUpMarket: (input: {
    email: string;
    password: string;
    marketName: string;
    contactPerson: string;
    contactNumber?: string;
    municipality: string;
    businessAddress?: string;
    businessType: string;
  }) => Promise<{ confirmationRequired: boolean; status: string }>;
  signInDemoFarmer: () => void;
  signInDemoMarket: (marketId?: string) => MarketAccount;
  signOut: () => Promise<void>;
};

const Store = createContext<HarvestStoreValue | null>(null);

export function HarvestProvider({ children }: { children: ReactNode }) {
  const isConfigured = supabaseConfig.status === "configured";
  const [mode, setModeState] = useState<WorkspaceMode>(
    isConfigured ? "live" : "demo",
  );
  const [demoHarvests, setDemoHarvests] = useState<Harvest[]>([]);
  const [demoDemands, setDemoDemands] = useState<MarketDemand[]>([]);
  const [demoAllocations, setDemoAllocations] = useState<SupplyAllocation[]>(
    [],
  );
  const [offlineDrafts, setOfflineDrafts] = useState<Harvest[]>([]);
  const [demoReady, setDemoReady] = useState(false);
  const [demoError, setDemoError] = useState("");

  const [liveHarvests, setLiveHarvests] = useState<Harvest[]>([]);
  const [liveDemands, setLiveDemands] = useState<MarketDemand[]>([]);
  const [liveAllocations, setLiveAllocations] = useState<SupplyAllocation[]>(
    [],
  );
  const [liveReady, setLiveReady] = useState(!isConfigured);
  const [liveError, setLiveError] = useState("");

  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(!isConfigured);
  const [authError, setAuthError] = useState("");

  const [activeRole, setActiveRoleState] = useState<"farmer" | "market">("farmer");
  const [demoMarkets, setDemoMarkets] = useState<MarketAccount[]>(INITIAL_DEMO_MARKETS);
  const [activeMarket, setActiveMarket] = useState<MarketAccount | null>(INITIAL_DEMO_MARKETS[0]);
  const [activeFarmer, setActiveFarmer] = useState<FarmerAccount | null>(INITIAL_DEMO_FARMER);

  const demoRecords = useRef<Harvest[]>([]);
  const demoDemandRecords = useRef<MarketDemand[]>([]);
  const demoAllocationRecords = useRef<SupplyAllocation[]>([]);
  const draftRecords = useRef<Harvest[]>([]);
  const saving = useRef(false);

  // Load isolated local demo records
  useEffect(() => {
    let active = true;
    async function loadDemo() {
      try {
        const raw = await AsyncStorage.getItem(DEMO_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : initialHarvests();
        if (!Array.isArray(parsed) || !parsed.every(isHarvest)) {
          throw new Error("Invalid stored data");
        }

        const rawDemands = await AsyncStorage.getItem(DEMO_DEMANDS_KEY);
        const parsedDemands: MarketDemand[] = rawDemands
          ? (JSON.parse(rawDemands) as MarketDemand[])
          : initialMarketDemands();

        const rawAllocations = await AsyncStorage.getItem(DEMO_ALLOCATIONS_KEY);
        const parsedAllocations: SupplyAllocation[] = rawAllocations
          ? (JSON.parse(rawAllocations) as SupplyAllocation[])
          : [];

        const rawDrafts = await AsyncStorage.getItem(OFFLINE_DRAFTS_KEY);
        const parsedDrafts: Harvest[] = rawDrafts
          ? (JSON.parse(rawDrafts) as Harvest[])
          : [];

        const storedRole = await AsyncStorage.getItem(ACTIVE_ROLE_KEY);
        const storedMarkets = await AsyncStorage.getItem(DEMO_MARKETS_KEY);
        const parsedMarkets: MarketAccount[] = storedMarkets
          ? (JSON.parse(storedMarkets) as MarketAccount[])
          : INITIAL_DEMO_MARKETS;

        const storedMarketId = await AsyncStorage.getItem(ACTIVE_MARKET_ID_KEY);
        const foundMarket = (Array.isArray(parsedMarkets) ? parsedMarkets : INITIAL_DEMO_MARKETS).find(
          (m) => m.id === storedMarketId,
        );

        if (active) {
          demoRecords.current = parsed;
          demoDemandRecords.current = Array.isArray(parsedDemands)
            ? parsedDemands
            : initialMarketDemands();
          demoAllocationRecords.current = Array.isArray(parsedAllocations)
            ? parsedAllocations
            : [];
          draftRecords.current = Array.isArray(parsedDrafts)
            ? parsedDrafts
            : [];

          if (storedRole === "market" || storedRole === "farmer") {
            setActiveRoleState(storedRole);
          }
          setDemoMarkets(Array.isArray(parsedMarkets) ? parsedMarkets : INITIAL_DEMO_MARKETS);
          setActiveMarket(
            foundMarket ??
              (Array.isArray(parsedMarkets) ? parsedMarkets : INITIAL_DEMO_MARKETS)[0],
          );

          setDemoHarvests(demoRecords.current);
          setDemoDemands(demoDemandRecords.current);
          setDemoAllocations(demoAllocationRecords.current);
          setOfflineDrafts(draftRecords.current);
          setDemoReady(true);
        }
      } catch {
        if (active) {
          setDemoError(
            "Local demo data could not be loaded. Allow browser storage or try a fresh browser profile. Existing data has not been overwritten.",
          );
        }
      }
    }
    void loadDemo();
    return () => {
      active = false;
    };
  }, []);

  const loadLiveWorkspaceForSession = useCallback(
    async (activeSession: SupabaseSession) => {
      setLiveReady(false);
      setLiveError("");
      try {
        const [rows, demands, allocs] = await Promise.all([
          fetchFarmerHarvestListings(activeSession),
          fetchActiveMarketDemands(activeSession).catch(() => []),
          fetchFarmerSupplyAllocations(activeSession).catch(() => []),
        ]);
        setLiveHarvests(rows);
        setLiveDemands(demands);
        setLiveAllocations(allocs);
      } catch (err) {
        setLiveError(
          err instanceof Error
            ? err.message
            : "Could not load your harvest records from Supabase Agri.",
        );
      } finally {
        setLiveReady(true);
      }
    },
    [],
  );

  // Restore persistent Supabase session on startup when configured
  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    let active = true;
    async function restoreSession() {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (!raw) {
          if (active) {
            setAuthReady(true);
            setLiveReady(true);
          }
          return;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!isValidSession(parsed)) {
          await AsyncStorage.removeItem(SESSION_KEY);
          if (active) {
            setAuthReady(true);
            setLiveReady(true);
          }
          return;
        }

        let currentSession = parsed;
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (currentSession.expires_at <= nowSeconds + 60) {
          currentSession = await refreshSupabaseSession(
            currentSession.refresh_token,
          );
          await AsyncStorage.setItem(
            SESSION_KEY,
            JSON.stringify(currentSession),
          );
        }

        const loadedProfile = await fetchOrCreateUserProfile(currentSession);
        if (!active) return;

        setSession(currentSession);
        setProfile(loadedProfile);
        setAuthReady(true);
        await loadLiveWorkspaceForSession(currentSession);
      } catch (err) {
        await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
        if (active) {
          setSession(null);
          setProfile(null);
          setAuthError(
            err instanceof Error
              ? err.message
              : "Saved session expired. Please sign in again.",
          );
          setAuthReady(true);
          setLiveReady(true);
        }
      }
    }
    void restoreSession();
    return () => {
      active = false;
    };
  }, [isConfigured, loadLiveWorkspaceForSession]);

  function setMode(nextMode: WorkspaceMode) {
    if (nextMode === "live" && !isConfigured) return;
    setModeState(nextMode);
  }

  const setActiveRole = useCallback(async (role: "farmer" | "market") => {
    setActiveRoleState(role);
    await AsyncStorage.setItem(ACTIVE_ROLE_KEY, role).catch(() => {});
  }, []);

  const setActiveMarketAccount = useCallback(async (market: MarketAccount | null) => {
    setActiveMarket(market);
    if (market) {
      await AsyncStorage.setItem(ACTIVE_MARKET_ID_KEY, market.id).catch(() => {});
    } else {
      await AsyncStorage.removeItem(ACTIVE_MARKET_ID_KEY).catch(() => {});
    }
  }, []);

  const signInDemoFarmer = useCallback(() => {
    setActiveRole("farmer");
    setActiveFarmer(INITIAL_DEMO_FARMER);
  }, [setActiveRole]);

  const signInDemoMarket = useCallback(
    (marketId?: string) => {
      setActiveRole("market");
      const m = demoMarkets.find((item) => item.id === marketId) ?? demoMarkets[0];
      setActiveMarketAccount(m);
      return m;
    },
    [demoMarkets, setActiveMarketAccount, setActiveRole],
  );

  const registerDemoMarket = useCallback(
    (input: {
      marketName: string;
      contactPerson: string;
      email: string;
      contactNumber?: string;
      municipality: string;
      businessAddress?: string;
      businessType: string;
    }) => {
      const newMarket: MarketAccount = {
        id: `market-demo-${Date.now().toString().slice(-4)}`,
        name: input.marketName,
        contactPerson: input.contactPerson,
        email: input.email,
        contactNumber: input.contactNumber,
        municipality: input.municipality,
        businessAddress: input.businessAddress,
        businessType: input.businessType,
        verificationStatus: "pending_verification",
        verificationNotes:
          "Newly registered Market account; awaiting Admin verification.",
      };
      const updated = [newMarket, ...demoMarkets];
      setDemoMarkets(updated);
      AsyncStorage.setItem(DEMO_MARKETS_KEY, JSON.stringify(updated)).catch(() => {});
      setActiveRole("market");
      setActiveMarketAccount(newMarket);
      return newMarket;
    },
    [demoMarkets, setActiveMarketAccount, setActiveRole],
  );

  const registerDemoFarmer = useCallback(
    (input: {
      name: string;
      email: string;
      contactNumber?: string;
      municipality: string;
      barangay?: string;
      farmInfo?: string;
    }) => {
      const newFarmer: FarmerAccount = {
        id: `farmer-demo-${Date.now().toString().slice(-4)}`,
        name: input.name,
        email: input.email,
        contactNumber: input.contactNumber,
        municipality: input.municipality,
        barangay: input.barangay,
        farmInfo: input.farmInfo,
        verificationStatus: "verified",
      };
      setActiveFarmer(newFarmer);
      setActiveRole("farmer");
      return newFarmer;
    },
    [setActiveRole],
  );

  const signInFarmer = useCallback(
    async (email: string, password: string) => {
      setAuthError("");
      setLiveError("");
      if (mode === "demo") {
        signInDemoFarmer();
        return;
      }
      const result = await signInWithEmailPassword({ email, password });
      if (result.profile.role === "admin") {
        throw new Error(
          "Admin access is strictly restricted to the Web Portal (/admin/login).",
        );
      }
      if (result.profile.role === "market") {
        throw new Error(
          "This account is registered as a Market Buyer. Please use Market Login.",
        );
      }
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
      setSession(result.session);
      setProfile(result.profile);
      setActiveRole("farmer");
      setModeState("live");
      await loadLiveWorkspaceForSession(result.session);
    },
    [loadLiveWorkspaceForSession, mode, setActiveRole, signInDemoFarmer],
  );

  const signUpFarmer = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName: string;
      municipality: string;
      contactNumber?: string;
      barangay?: string;
      farmInfo?: string;
    }) => {
      setAuthError("");
      setLiveError("");
      if (mode === "demo") {
        registerDemoFarmer({
          name: input.displayName,
          email: input.email,
          contactNumber: input.contactNumber,
          municipality: input.municipality,
          barangay: input.barangay,
          farmInfo: input.farmInfo,
        });
        return { confirmationRequired: false };
      }
      const result = await signUpFarmerAccount(input);
      if (result.session && result.profile) {
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
        setSession(result.session);
        setProfile(result.profile);
        setActiveRole("farmer");
        setModeState("live");
        await loadLiveWorkspaceForSession(result.session);
      }
      return { confirmationRequired: result.confirmationRequired };
    },
    [loadLiveWorkspaceForSession, mode, registerDemoFarmer, setActiveRole],
  );

  const signInMarket = useCallback(
    async (email: string, password: string) => {
      setAuthError("");
      setLiveError("");
      if (mode === "demo") {
        const m = signInDemoMarket();
        return {
          verified: m.verificationStatus === "verified",
          status: m.verificationStatus,
        };
      }
      const result = await signInWithEmailPassword({ email, password });
      if (result.profile.role === "admin") {
        throw new Error(
          "Admin access is strictly restricted to the Web Portal (/admin/login).",
        );
      }
      if (result.profile.role === "farmer") {
        throw new Error(
          "This account is registered as a Farmer. Please use Farmer Login.",
        );
      }
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
      setSession(result.session);
      setProfile(result.profile);
      setActiveRole("market");
      setModeState("live");
      await loadLiveWorkspaceForSession(result.session);
      const isVerified =
        (result.profile as unknown as { market_verification_status?: string })
          .market_verification_status === "verified";
      const status =
        (result.profile as unknown as { market_verification_status?: string })
          .market_verification_status ?? "pending_verification";
      return { verified: isVerified, status };
    },
    [loadLiveWorkspaceForSession, mode, setActiveRole, signInDemoMarket],
  );

  const signUpMarket = useCallback(
    async (input: {
      email: string;
      password: string;
      marketName: string;
      contactPerson: string;
      contactNumber?: string;
      municipality: string;
      businessAddress?: string;
      businessType: string;
    }) => {
      setAuthError("");
      setLiveError("");
      if (mode === "demo") {
        const m = registerDemoMarket(input);
        return { confirmationRequired: false, status: m.verificationStatus };
      }
      const result = await signUpMarketAccount(input);
      if (result.session && result.profile) {
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
        setSession(result.session);
        setProfile(result.profile);
        setActiveRole("market");
        setModeState("live");
        await loadLiveWorkspaceForSession(result.session);
      }
      return {
        confirmationRequired: result.confirmationRequired,
        status: "pending_verification",
      };
    },
    [loadLiveWorkspaceForSession, mode, registerDemoMarket, setActiveRole],
  );

  const addMarketDemand = useCallback(
    async (demand: {
      crop: string;
      requiredQuantityKg: number;
      unit?: string;
      buyingType?: string;
      unitPricePhp?: number;
      totalPricePhp?: number;
      municipality: string;
      barangay?: string;
      requiredBy: string;
      acceptPartial?: boolean;
      qualityNotes?: string;
      preferredQualityGrade?: string;
    }) => {
      if (mode === "live" && session) {
        const created = await createLiveMarketDemand(session, {
          crop: demand.crop,
          requiredQuantity: demand.requiredQuantityKg,
          unit: demand.unit,
          buyingType: demand.buyingType,
          unitPrice: demand.unitPricePhp,
          totalPrice: demand.totalPricePhp,
          municipality: demand.municipality,
          barangay: demand.barangay,
          requiredBy: demand.requiredBy,
          acceptPartial: demand.acceptPartial,
          qualityNotes: demand.qualityNotes,
          preferredQualityGrade: demand.preferredQualityGrade,
        });
        setLiveDemands((prev) => [created, ...prev]);
        return created;
      }
      const newDemand: MarketDemand = {
        id: `MKT-DEM-${Date.now().toString().slice(-4)}`,
        marketId: activeMarket?.id ?? "market-demo-01",
        marketName: activeMarket?.name ?? "Demo Market Buyer",
        marketType: (activeMarket?.businessType ?? "public_market") as any,
        marketVerified: activeMarket?.verificationStatus === "verified",
        crop: demand.crop,
        requiredQuantityKg: demand.requiredQuantityKg,
        reservedQuantityKg: 0,
        fulfilledQuantityKg: 0,
        remainingDemandKg: demand.requiredQuantityKg,
        unit: (demand.unit as any) ?? "kg",
        buyingType: (demand.buyingType as any) ?? "per_unit",
        unitPricePhp: demand.unitPricePhp,
        totalPricePhp: demand.totalPricePhp,
        preferredQualityGrade:
          (demand.preferredQualityGrade as any) ?? "Grade A",
        offeredPricePerKg: demand.unitPricePhp ?? 25,
        municipality: demand.municipality,
        barangay: demand.barangay ?? "Poblacion",
        requiredBy: demand.requiredBy,
        acceptPartial: demand.acceptPartial ?? true,
        qualityNotes: demand.qualityNotes ?? "",
        status: "open",
      };
      const updated = [newDemand, ...demoDemands];
      setDemoDemands(updated);
      demoDemandRecords.current = updated;
      await AsyncStorage.setItem(
        DEMO_DEMANDS_KEY,
        JSON.stringify(updated),
      ).catch(() => {});
      return newDemand;
    },
    [activeMarket, demoDemands, mode, session],
  );

  async function signIn(email: string, password: string) {
    return signInFarmer(email, password);
  }

  async function signUp(input: {
    email: string;
    password: string;
    displayName: string;
    municipality: string;
  }) {
    return signUpFarmer(input);
  }

  async function signOut() {
    const token = session?.access_token;
    await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    setSession(null);
    setProfile(null);
    setLiveHarvests([]);
    setLiveDemands([]);
    setLiveAllocations([]);
    setLiveError("");
    setAuthError("");
    if (token) {
      await signOutSession(token);
    }
  }

  async function refreshHarvests() {
    if (mode === "live") {
      if (!session) {
        throw new Error(
          "Sign in to your farmer account to load live harvests.",
        );
      }
      await loadLiveWorkspaceForSession(session);
    }
  }

  async function add(harvest: HarvestCreatePayload): Promise<Harvest> {
    if (saving.current) {
      throw new Error("Please wait before saving again.");
    }

    // LIVE SUPABASE MODE: never fall back to demo mode on failure
    if (mode === "live") {
      if (!session || !profile) {
        throw new Error(
          "Please sign in with your SMART-ANI farmer account before submitting a live harvest.",
        );
      }
      if (profile.role !== "farmer") {
        throw new Error(
          `Only farmer accounts can submit harvest listings (your role is ${profile.role}).`,
        );
      }
      saving.current = true;
      try {
        const created = await createPendingHarvestListing(session, harvest);
        setLiveHarvests((current) => [created, ...current]);
        return created;
      } finally {
        saving.current = false;
      }
    }

    // DEMO MODE: isolated local browser storage
    if (!demoReady) {
      throw new Error("Please wait before saving again.");
    }
    saving.current = true;
    try {
      const created: Harvest = {
        ...harvest,
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        unit: harvest.unit ?? "kg",
        qualityGrade: harvest.qualityGrade ?? "Grade A",
        status: "available",
        earmarkedKg: 0,
        reservedKg: 0,
        allocatedKg: 0,
        deliveredKg: 0,
        remainingKg: harvest.quantity,
        syncState: "synced",
      };
      const next = [created, ...demoRecords.current];
      await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(next));
      demoRecords.current = next;
      setDemoHarvests(next);
      return created;
    } catch {
      throw new Error(
        "Could not save this harvest. Check browser storage and try again.",
      );
    } finally {
      saving.current = false;
    }
  }

  async function saveOfflineDraft(
    harvest: HarvestCreatePayload,
  ): Promise<Harvest> {
    const idempotencyKey =
      harvest.idempotencyKey ??
      `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Deduplicate by idempotencyKey
    const existing = draftRecords.current.find(
      (d) => d.idempotencyKey === idempotencyKey,
    );
    if (existing) return existing;

    const draft: Harvest = {
      ...harvest,
      id: idempotencyKey,
      idempotencyKey,
      unit: harvest.unit ?? "kg",
      qualityGrade: harvest.qualityGrade ?? "Grade A",
      status: "draft",
      syncState: "offline_draft",
      earmarkedKg: 0,
      reservedKg: 0,
      allocatedKg: 0,
      deliveredKg: 0,
      remainingKg: harvest.quantity,
    };

    const next = [draft, ...draftRecords.current];
    await AsyncStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(next));
    draftRecords.current = next;
    setOfflineDrafts(next);
    return draft;
  }

  async function syncOfflineDraft(draftId: string): Promise<Harvest> {
    const draft = draftRecords.current.find((d) => d.id === draftId);
    if (!draft) {
      throw new Error("Offline draft not found or already synchronized.");
    }

    const synced = await add({
      crop: draft.crop,
      quantity: draft.quantity,
      unit: draft.unit,
      conversionRateKg: draft.conversionRateKg,
      price: draft.price,
      harvestDate: draft.harvestDate,
      municipality: draft.municipality,
      barangay: draft.barangay,
      storage: draft.storage,
      priority: draft.priority,
      qualityGrade: draft.qualityGrade,
      photoRef: draft.photoRef,
      gpsCoordinates: draft.gpsCoordinates,
      harvestSchedule: draft.harvestSchedule,
      storageTempC: draft.storageTempC,
      assistedByCoordinator: draft.assistedByCoordinator,
      coordinatorName: draft.coordinatorName,
      idempotencyKey: draft.idempotencyKey,
    });

    const remainingDrafts = draftRecords.current.filter(
      (d) => d.id !== draftId,
    );
    await AsyncStorage.setItem(
      OFFLINE_DRAFTS_KEY,
      JSON.stringify(remainingDrafts),
    );
    draftRecords.current = remainingDrafts;
    setOfflineDrafts(remainingDrafts);
    return synced;
  }

  const computedDemoHarvests = useMemo(
    () =>
      demoHarvests.map((h) => computeHarvestInventory(h, demoAllocations)),
    [demoHarvests, demoAllocations],
  );

  const computedDemoDemands = useMemo(
    () =>
      demoDemands.map((d) => computeMarketDemandTotals(d, demoAllocations)),
    [demoDemands, demoAllocations],
  );

  const computedLiveHarvests = useMemo(
    () =>
      liveHarvests.map((h) => computeHarvestInventory(h, liveAllocations)),
    [liveHarvests, liveAllocations],
  );

  const computedLiveDemands = useMemo(
    () =>
      liveDemands.map((d) => computeMarketDemandTotals(d, liveAllocations)),
    [liveDemands, liveAllocations],
  );

  async function allocateToMarket(params: {
    harvestId: string;
    demandId: string;
    quantityKg: number;
    agreedPricePerKg?: number;
    conversionRatioToKg?: number;
    offerNotes?: string;
  }): Promise<SupplyAllocation> {
    const activeHarvestList =
      mode === "live" ? computedLiveHarvests : computedDemoHarvests;
    const activeDemandList =
      mode === "live" ? computedLiveDemands : computedDemoDemands;
    const activeAllocationList =
      mode === "live" ? liveAllocations : demoAllocationRecords.current;

    const harvest = activeHarvestList.find((h) => h.id === params.harvestId);
    if (!harvest) {
      throw new Error("Select one of your available harvest listings.");
    }
    const demand = activeDemandList.find((d) => d.id === params.demandId);
    if (!demand) {
      throw new Error("Select an active Market crop demand.");
    }

    const validationError = validateAllocationOffer({
      harvest,
      demand,
      quantityKg: params.quantityKg,
      conversionRatioToKg: params.conversionRatioToKg,
      existingAllocations: activeAllocationList,
    });
    if (validationError) {
      throw new Error(validationError);
    }

    const harvestUnit = harvest.unit ?? "kg";
    const demandUnit = demand.unit ?? "kg";
    let deductedQty = Number(params.quantityKg.toFixed(3));
    if (harvestUnit === "kg" && demandUnit !== "kg" && params.conversionRatioToKg) {
      deductedQty = Number(
        (params.quantityKg * params.conversionRatioToKg).toFixed(3),
      );
    } else if (harvestUnit !== "kg" && demandUnit === "kg" && params.conversionRatioToKg) {
      deductedQty = Number(
        (params.quantityKg / params.conversionRatioToKg).toFixed(3),
      );
    }

    const unitPrice =
      params.agreedPricePerKg ?? demand.unitPricePhp ?? demand.offeredPricePerKg;
    const totalPrice =
      demand.buyingType === "bulk_lot"
        ? (demand.totalPricePhp ?? unitPrice)
        : Number((params.quantityKg * unitPrice).toFixed(2));

    if (mode === "live") {
      if (!session) {
        throw new Error("Sign in to your farmer account before allocating.");
      }
      const created = await allocateHarvestToDemandRpc(session, {
        harvestListingId: params.harvestId,
        marketDemandId: params.demandId,
        quantityKg: params.quantityKg,
        agreedPricePerKg: unitPrice,
        offerNotes: params.offerNotes,
      });
      await loadLiveWorkspaceForSession(session);
      return created;
    }

    const created: SupplyAllocation = {
      id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      harvestListingId: harvest.id,
      marketDemandId: demand.id,
      farmerId: "demo-farmer",
      marketId: demand.marketId,
      marketName: demand.marketName,
      marketMunicipality: demand.municipality,
      crop: harvest.crop,
      allocatedQuantityKg: Number(params.quantityKg.toFixed(3)),
      deliveredQuantityKg: 0,
      releasedQuantityKg: 0,
      outstandingQuantityKg: Number(params.quantityKg.toFixed(3)),
      agreedPricePerKg: unitPrice,
      unit: demand.unit ?? "kg",
      inventoryUnit: harvest.unit ?? "kg",
      buyingType: demand.buyingType ?? "per_unit",
      totalAgreedPrice: totalPrice,
      conversionRatioToKg: params.conversionRatioToKg,
      deductedInventoryQuantity: deductedQty,
      status: "pending_acceptance",
      offerNotes: (params.offerNotes ?? "").trim(),
      responseNotes: "",
      idempotencyKey: `idem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      offeredAt: new Date().toISOString(),
      respondedAt: null,
      completedAt: null,
    };

    const next = [created, ...demoAllocationRecords.current];
    await AsyncStorage.setItem(DEMO_ALLOCATIONS_KEY, JSON.stringify(next));
    demoAllocationRecords.current = next;
    setDemoAllocations(next);
    return created;
  }

  async function markInDelivery(
    allocationId: string,
    notes = "",
  ): Promise<SupplyAllocation> {
    if (mode === "live") {
      if (!session) throw new Error("Authentication required.");
      const updated = await markAllocationInDeliveryRpc(session, {
        allocationId,
        notes,
      });
      await loadLiveWorkspaceForSession(session);
      return updated;
    }

    const target = demoAllocationRecords.current.find(
      (a) => a.id === allocationId,
    );
    if (!target) throw new Error("Allocation not found.");
    if (target.status !== "reserved") {
      throw new Error(
        `Only reserved allocations can be marked In Delivery (current: ${target.status}).`,
      );
    }

    const updated: SupplyAllocation = {
      ...target,
      status: "in_delivery",
      offerNotes: notes.trim() || target.offerNotes,
    };
    const next = demoAllocationRecords.current.map((a) =>
      a.id === allocationId ? updated : a,
    );
    await AsyncStorage.setItem(DEMO_ALLOCATIONS_KEY, JSON.stringify(next));
    demoAllocationRecords.current = next;
    setDemoAllocations(next);
    return updated;
  }

  async function cancelAllocation(
    allocationId: string,
    reason: string,
  ): Promise<SupplyAllocation> {
    if (!reason.trim()) {
      throw new Error("Please enter a cancellation reason.");
    }
    if (mode === "live") {
      if (!session) throw new Error("Authentication required.");
      const updated = await cancelSupplyAllocationRpc(session, {
        allocationId,
        reason,
      });
      await loadLiveWorkspaceForSession(session);
      return updated;
    }

    const target = demoAllocationRecords.current.find(
      (a) => a.id === allocationId,
    );
    if (!target) throw new Error("Allocation not found.");
    if (
      target.status === "delivered" ||
      target.status === "rejected" ||
      target.status === "cancelled"
    ) {
      throw new Error(`Allocation is already ${target.status}.`);
    }

    const undelivered = Math.max(
      0,
      Number(
        (
          target.allocatedQuantityKg -
          target.deliveredQuantityKg -
          target.releasedQuantityKg
        ).toFixed(3),
      ),
    );
    const updated: SupplyAllocation = {
      ...target,
      status: "cancelled",
      releasedQuantityKg: Number(
        (target.releasedQuantityKg + undelivered).toFixed(3),
      ),
      outstandingQuantityKg: 0,
      responseNotes: reason.trim(),
      completedAt: new Date().toISOString(),
    };
    const next = demoAllocationRecords.current.map((a) =>
      a.id === allocationId ? updated : a,
    );
    await AsyncStorage.setItem(DEMO_ALLOCATIONS_KEY, JSON.stringify(next));
    demoAllocationRecords.current = next;
    setDemoAllocations(next);
    return updated;
  }

  async function demoRespondToAllocation(
    allocationId: string,
    decision: "reserved" | "rejected",
    notes = "",
  ): Promise<SupplyAllocation> {
    if (mode !== "demo") {
      throw new Error(
        "Market response simulation is only available in Demo Mode.",
      );
    }
    const target = demoAllocationRecords.current.find(
      (a) => a.id === allocationId,
    );
    if (!target) throw new Error("Allocation not found.");
    if (
      target.status !== "pending_acceptance" &&
      target.status !== "proposed"
    ) {
      throw new Error(
        `Offer is already ${target.status} and cannot be accepted or rejected again.`,
      );
    }

    const rawDemand = demoDemandRecords.current.find(
      (d) => d.id === target.marketDemandId,
    );
    if (!rawDemand) throw new Error("Market demand not found.");
    const currentDemand = computeMarketDemandTotals(
      rawDemand,
      demoAllocationRecords.current,
    );

    if (decision === "reserved") {
      if (target.allocatedQuantityKg > currentDemand.remainingDemandKg) {
        throw new Error(
          `Cannot accept ${target.allocatedQuantityKg} kg: Market only has ${currentDemand.remainingDemandKg} kg remaining demand.`,
        );
      }
    }

    const updated: SupplyAllocation =
      decision === "reserved"
        ? {
            ...target,
            status: "reserved",
            responseNotes: notes.trim() || "Market accepted & reserved supply.",
            respondedAt: new Date().toISOString(),
          }
        : {
            ...target,
            status: "rejected",
            releasedQuantityKg: target.allocatedQuantityKg,
            outstandingQuantityKg: 0,
            responseNotes:
              notes.trim() ||
              "Market declined offer; quantity restored to farmer.",
            respondedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };

    const next = demoAllocationRecords.current.map((a) =>
      a.id === allocationId ? updated : a,
    );
    await AsyncStorage.setItem(DEMO_ALLOCATIONS_KEY, JSON.stringify(next));
    demoAllocationRecords.current = next;
    setDemoAllocations(next);
    return updated;
  }

  async function demoConfirmDelivery(
    allocationId: string,
    receivedKg: number,
    finalizeShort = false,
    notes = "",
  ): Promise<SupplyAllocation> {
    if (mode !== "demo") {
      throw new Error(
        "Market delivery confirmation simulation is only available in Demo Mode.",
      );
    }
    const target = demoAllocationRecords.current.find(
      (a) => a.id === allocationId,
    );
    if (!target) throw new Error("Allocation not found.");
    if (
      target.status !== "reserved" &&
      target.status !== "in_delivery" &&
      target.status !== "partially_delivered"
    ) {
      throw new Error(
        `Cannot confirm delivery for status ${target.status} (must be reserved, in_delivery, or partially_delivered).`,
      );
    }

    const outstanding = Number(
      (
        target.allocatedQuantityKg -
        target.deliveredQuantityKg -
        target.releasedQuantityKg
      ).toFixed(3),
    );
    if (!Number.isFinite(receivedKg) || receivedKg <= 0) {
      throw new Error("Received quantity must be greater than 0 kg.");
    }
    if (receivedKg > outstanding) {
      throw new Error(
        `Received quantity (${receivedKg} kg) exceeds outstanding undelivered balance (${outstanding} kg).`,
      );
    }

    const newDelivered = Number(
      (target.deliveredQuantityKg + receivedKg).toFixed(3),
    );
    let nextStatus: SupplyAllocation["status"] = "partially_delivered";
    let releasedNow = 0;

    if (newDelivered === target.allocatedQuantityKg) {
      nextStatus = "delivered";
    } else if (finalizeShort) {
      nextStatus = "delivered";
      releasedNow = Number(
        (
          target.allocatedQuantityKg -
          newDelivered -
          target.releasedQuantityKg
        ).toFixed(3),
      );
    }

    const newReleased = Number(
      (target.releasedQuantityKg + releasedNow).toFixed(3),
    );
    const newOutstanding = Math.max(
      0,
      Number(
        (target.allocatedQuantityKg - newDelivered - newReleased).toFixed(3),
      ),
    );

    const updated: SupplyAllocation = {
      ...target,
      deliveredQuantityKg: newDelivered,
      releasedQuantityKg: newReleased,
      outstandingQuantityKg: newOutstanding,
      status: nextStatus,
      responseNotes:
        notes.trim() ||
        `Confirmed receipt of ${receivedKg} kg (cumulative ${newDelivered}/${target.allocatedQuantityKg} kg).`,
      completedAt:
        nextStatus === "delivered"
          ? new Date().toISOString()
          : target.completedAt,
    };

    const next = demoAllocationRecords.current.map((a) =>
      a.id === allocationId ? updated : a,
    );
    await AsyncStorage.setItem(DEMO_ALLOCATIONS_KEY, JSON.stringify(next));
    demoAllocationRecords.current = next;
    setDemoAllocations(next);
    return updated;
  }

  async function resetDemoScenario() {
    const freshHarvests = initialHarvests();
    const freshDemands = initialMarketDemands();
    await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(freshHarvests));
    await AsyncStorage.setItem(DEMO_DEMANDS_KEY, JSON.stringify(freshDemands));
    await AsyncStorage.setItem(DEMO_ALLOCATIONS_KEY, JSON.stringify([]));
    demoRecords.current = freshHarvests;
    demoDemandRecords.current = freshDemands;
    demoAllocationRecords.current = [];
    setDemoHarvests(freshHarvests);
    setDemoDemands(freshDemands);
    setDemoAllocations([]);
  }

  const activeHarvests =
    mode === "live" ? computedLiveHarvests : computedDemoHarvests;
  const activeDemands =
    mode === "live" ? computedLiveDemands : computedDemoDemands;
  const activeAllocations = mode === "live" ? liveAllocations : demoAllocations;
  const activeReady = mode === "live" ? authReady && liveReady : demoReady;
  const activeError = mode === "live" ? liveError : demoError;

  return (
    <Store.Provider
      value={{
        mode,
        setMode,
        activeRole,
        setActiveRole,
        activeMarket,
        setActiveMarket: setActiveMarketAccount,
        activeFarmer,
        setActiveFarmer,
        demoMarkets,
        registerDemoMarket,
        registerDemoFarmer,
        harvests: activeHarvests,
        offlineDrafts,
        marketDemands: activeDemands,
        allocations: activeAllocations,
        ready: activeReady,
        error: activeError,
        add,
        saveOfflineDraft,
        syncOfflineDraft,
        addMarketDemand,
        allocateToMarket,
        markInDelivery,
        cancelAllocation,
        demoRespondToAllocation,
        demoConfirmDelivery,
        resetDemoScenario,
        refreshHarvests,
        session,
        profile,
        authReady,
        authError,
        signIn,
        signUp,
        signInFarmer,
        signUpFarmer,
        signInMarket,
        signUpMarket,
        signInDemoFarmer,
        signInDemoMarket,
        signOut,
      }}
    >
      {children}
    </Store.Provider>
  );
}

export function useHarvests() {
  const store = useContext(Store);
  if (!store) throw new Error("HarvestProvider is required");
  return store;
}
