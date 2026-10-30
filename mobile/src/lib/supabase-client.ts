// SMART-ANI · Farmer Mobile Supabase Auth, PostgREST & Demand-Allocation RPC Client
// Keep free of React Native imports so this module can be unit-tested directly with Node.

import {
  MUNICIPALITIES,
  type AllocationStatus,
  type Harvest,
  type MarketDemand,
  type MarketType,
  type QualityGrade,
  type SupplyAllocation,
} from "./harvest.ts";
import { supabaseConfig, type SupabasePublicConfig } from "./supabase-config.ts";

export type SmartAniRole = "farmer" | "market" | "admin";

export type HarvestVerificationStatus =
  | "draft"
  | "pending_verification"
  | "available"
  | "rejected"
  | "closed";

export type UserProfile = {
  id: string;
  display_name: string;
  municipality: string;
  role: SmartAniRole;
  account_status?: "active" | "deactivated_pending_admin_review" | "suspended";
  market_type?: MarketType | null;
  organization_name?: string;
  market_verification_status?:
    | "not_applicable"
    | "pending_verification"
    | "verified"
    | "rejected"
    | "suspended";
  created_at: string;
};

export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
  };
};

export type DbHarvestListingRow = {
  id: string;
  farmer_id: string;
  crop: string;
  quantity_kg: number | string;
  unit?: string;
  quality_grade?: string;
  photo_url?: string;
  asking_price_php_per_kg: number | string;
  harvest_date: string;
  municipality: string;
  barangay: string;
  storage_condition: string;
  outreach_priority: "Standard" | "Priority";
  status: HarvestVerificationStatus;
  earmarked_kg?: number | string;
  reserved_kg?: number | string;
  allocated_kg?: number | string;
  delivered_kg?: number | string;
  remaining_kg?: number | string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string;
  created_at: string;
};

export type DbMarketDemandRow = {
  id: string;
  market_id: string;
  crop: string;
  required_quantity_kg: number | string;
  reserved_quantity_kg: number | string;
  fulfilled_quantity_kg: number | string;
  remaining_demand_kg?: number | string;
  preferred_quality_grade: string;
  offered_price_php_per_kg: number | string;
  municipality: string;
  barangay: string;
  required_by: string;
  accept_partial: boolean;
  quality_notes: string;
  status: "open" | "partially_fulfilled" | "fulfilled" | "cancelled" | "closed";
  created_at: string;
};

export type DbSupplyAllocationRow = {
  id: string;
  harvest_listing_id: string;
  market_demand_id: string;
  farmer_id: string;
  market_id: string;
  crop: string;
  allocated_quantity_kg: number | string;
  delivered_quantity_kg: number | string;
  released_quantity_kg: number | string;
  outstanding_quantity_kg?: number | string;
  agreed_price_php_per_kg: number | string;
  status: AllocationStatus;
  offer_notes: string;
  response_notes: string;
  idempotency_key: string;
  offered_at: string;
  responded_at: string | null;
  completed_at: string | null;
};

function requireConfigured(
  config: SupabasePublicConfig = supabaseConfig,
): Extract<SupabasePublicConfig, { status: "configured" }> {
  if (config.status !== "configured") {
    throw new Error(config.message);
  }
  return config;
}

function buildHeaders(
  publishableKey: string,
  accessToken?: string,
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: publishableKey,
    "Content-Type": "application/json",
    ...extra,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      const record = body as Record<string, unknown>;
      const msg =
        record.msg ??
        record.message ??
        record.error_description ??
        record.details ??
        record.error;
      if (typeof msg === "string" && msg.trim()) {
        return msg.trim();
      }
    }
  } catch {
    // Ignore JSON parse failures on non-JSON error responses
  }
  return `${fallback} (HTTP ${response.status})`;
}

export function isValidSession(value: unknown): value is SupabaseSession {
  if (typeof value !== "object" || value === null) return false;
  const s = value as SupabaseSession;
  return (
    typeof s.access_token === "string" &&
    s.access_token.length > 0 &&
    typeof s.refresh_token === "string" &&
    s.refresh_token.length > 0 &&
    typeof s.expires_at === "number" &&
    typeof s.user === "object" &&
    s.user !== null &&
    typeof s.user.id === "string" &&
    s.user.id.length > 0 &&
    typeof s.user.email === "string"
  );
}

export function mapDbRowToHarvest(row: DbHarvestListingRow): Harvest {
  const qty = Number(row.quantity_kg);
  const earmarked = Number(row.earmarked_kg ?? 0);
  const reserved = Number(row.reserved_kg ?? 0);
  const allocated = Number(row.allocated_kg ?? earmarked + reserved);
  const delivered = Number(row.delivered_kg ?? 0);
  const remaining =
    row.remaining_kg !== undefined
      ? Number(row.remaining_kg)
      : Math.max(0, Number((qty - allocated - delivered).toFixed(3)));

  return {
    id: row.id,
    farmerId: row.farmer_id,
    crop: row.crop,
    quantity: qty,
    unit: "kg",
    qualityGrade: (row.quality_grade as QualityGrade) ?? "Grade A",
    photoRef: row.photo_url ?? "",
    price: Number(row.asking_price_php_per_kg),
    harvestDate: row.harvest_date,
    municipality: row.municipality,
    barangay: row.barangay,
    storage: row.storage_condition,
    priority: row.outreach_priority === "Priority" ? "Priority" : "Standard",
    status: row.status,
    earmarkedKg: earmarked,
    reservedKg: reserved,
    allocatedKg: allocated,
    deliveredKg: delivered,
    remainingKg: remaining,
    syncState: "synced",
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes ?? "",
    createdAt: row.created_at,
  };
}

export function mapDbRowToMarketDemand(row: DbMarketDemandRow): MarketDemand {
  const req = Number(row.required_quantity_kg);
  const res = Number(row.reserved_quantity_kg ?? 0);
  const ful = Number(row.fulfilled_quantity_kg ?? 0);
  const rem =
    row.remaining_demand_kg !== undefined
      ? Number(row.remaining_demand_kg)
      : Math.max(0, Number((req - res - ful).toFixed(3)));

  return {
    id: row.id,
    marketId: row.market_id,
    marketName: `Verified Market (${row.municipality})`,
    marketType: "public_market",
    marketVerified: true,
    crop: row.crop,
    requiredQuantityKg: req,
    reservedQuantityKg: res,
    fulfilledQuantityKg: ful,
    remainingDemandKg: rem,
    preferredQualityGrade:
      (row.preferred_quality_grade as "Any" | QualityGrade) ?? "Any",
    offeredPricePerKg: Number(row.offered_price_php_per_kg),
    municipality: row.municipality,
    barangay: row.barangay ?? "",
    requiredBy: row.required_by,
    acceptPartial: Boolean(row.accept_partial),
    qualityNotes: row.quality_notes ?? "",
    status: row.status,
  };
}

export function mapDbRowToSupplyAllocation(
  row: DbSupplyAllocationRow,
): SupplyAllocation {
  const alloc = Number(row.allocated_quantity_kg);
  const deliv = Number(row.delivered_quantity_kg ?? 0);
  const rel = Number(row.released_quantity_kg ?? 0);
  const out =
    row.outstanding_quantity_kg !== undefined
      ? Number(row.outstanding_quantity_kg)
      : Math.max(0, Number((alloc - deliv - rel).toFixed(3)));

  return {
    id: row.id,
    harvestListingId: row.harvest_listing_id,
    marketDemandId: row.market_demand_id,
    farmerId: row.farmer_id,
    marketId: row.market_id,
    marketName: `Market #${row.market_id.slice(0, 6)}`,
    marketMunicipality: "Marinduque",
    crop: row.crop,
    allocatedQuantityKg: alloc,
    deliveredQuantityKg: deliv,
    releasedQuantityKg: rel,
    outstandingQuantityKg: out,
    agreedPricePerKg: Number(row.agreed_price_php_per_kg),
    status: row.status,
    offerNotes: row.offer_notes ?? "",
    responseNotes: row.response_notes ?? "",
    idempotencyKey: row.idempotency_key,
    offeredAt: row.offered_at,
    respondedAt: row.responded_at,
    completedAt: row.completed_at,
  };
}

function normalizeAuthSession(raw: Record<string, unknown>): SupabaseSession | null {
  const accessToken =
    typeof raw.access_token === "string" ? raw.access_token : "";
  const refreshToken =
    typeof raw.refresh_token === "string" ? raw.refresh_token : "";
  const expiresIn =
    typeof raw.expires_in === "number" ? raw.expires_in : 3600;
  const expiresAt =
    typeof raw.expires_at === "number"
      ? raw.expires_at
      : Math.floor(Date.now() / 1000) + expiresIn;
  const userObj =
    typeof raw.user === "object" && raw.user !== null
      ? (raw.user as Record<string, unknown>)
      : null;

  if (!accessToken || !refreshToken || !userObj || typeof userObj.id !== "string") {
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    user: {
      id: userObj.id,
      email: typeof userObj.email === "string" ? userObj.email : "",
    },
  };
}

export async function fetchOrCreateUserProfile(
  session: SupabaseSession,
  defaults?: {
    displayName?: string;
    municipality?: string;
    accountRole?: string;
    organizationName?: string;
  },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<UserProfile> {
  const cfg = requireConfigured(config);
  const queryUrl = `${cfg.url}/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}&select=id,display_name,municipality,role,created_at`;
  const getRes = await fetchImpl(queryUrl, {
    method: "GET",
    headers: buildHeaders(cfg.publishableKey, session.access_token),
  });

  if (!getRes.ok) {
    throw new Error(
      await parseErrorMessage(getRes, "Could not load user profile from Supabase Agri"),
    );
  }

  const rows: unknown = await getRes.json();
  if (Array.isArray(rows) && rows.length > 0) {
    return rows[0] as UserProfile;
  }

  // Create safe default farmer profile via RLS policy profiles_create_self (role column is never sent by client)
  const fallbackName =
    defaults?.displayName?.trim() ||
    session.user.email.split("@")[0]?.trim() ||
    "Marinduque Farmer";
  const fallbackMunicipality = (MUNICIPALITIES as readonly string[]).includes(
    defaults?.municipality ?? "",
  )
    ? defaults!.municipality!
    : "Boac";

  const createRes = await fetchImpl(`${cfg.url}/rest/v1/profiles?select=id,display_name,municipality,role,created_at`, {
    method: "POST",
    headers: buildHeaders(cfg.publishableKey, session.access_token, {
      Prefer: "return=representation",
    }),
    body: JSON.stringify({
      id: session.user.id,
      display_name: fallbackName.slice(0, 100),
      municipality: fallbackMunicipality,
    }),
  });

  if (!createRes.ok) {
    throw new Error(
      await parseErrorMessage(
        createRes,
        "Authenticated account has no profile and automatic farmer profile creation failed",
      ),
    );
  }

  const createdRows: unknown = await createRes.json();
  if (!Array.isArray(createdRows) || createdRows.length === 0) {
    throw new Error("Profile creation succeeded but returned no profile record.");
  }
  return createdRows[0] as UserProfile;
}

export async function signUpFarmerAccount(
  input: {
    email: string;
    password: string;
    displayName: string;
    municipality: string;
  },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  session: SupabaseSession | null;
  profile: UserProfile | null;
  confirmationRequired: boolean;
}> {
  const cfg = requireConfigured(config);
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const municipality = input.municipality.trim();

  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  if (!displayName || displayName.length > 100) {
    throw new Error("Enter your farmer display name (1–100 characters).");
  }
  if (!(MUNICIPALITIES as readonly string[]).includes(municipality)) {
    throw new Error("Choose a valid Marinduque municipality.");
  }

  // Never include 'role' in client metadata
  const res = await fetchImpl(`${cfg.url}/auth/v1/signup`, {
    method: "POST",
    headers: buildHeaders(cfg.publishableKey),
    body: JSON.stringify({
      email,
      password: input.password,
      data: {
        display_name: displayName,
        municipality,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Could not create farmer account"));
  }

  const data = (await res.json()) as Record<string, unknown>;
  const session = normalizeAuthSession(data);
  if (!session) {
    return {
      session: null,
      profile: null,
      confirmationRequired: true,
    };
  }

  const profile = await fetchOrCreateUserProfile(
    session,
    { displayName, municipality },
    cfg,
    fetchImpl,
  );
  return { session, profile, confirmationRequired: false };
}

export async function signUpMarketAccount(
  input: {
    email: string;
    password: string;
    marketName: string;
    contactPerson: string;
    contactNumber?: string;
    municipality: string;
    businessAddress?: string;
    businessType: string;
  },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  session: SupabaseSession | null;
  profile: UserProfile | null;
  confirmationRequired: boolean;
}> {
  const cfg = requireConfigured(config);
  const email = input.email.trim().toLowerCase();
  const marketName = input.marketName.trim();
  const contactPerson = input.contactPerson.trim();
  const municipality = input.municipality.trim();

  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  if (!marketName) {
    throw new Error("Enter your Market / Business Name.");
  }
  if (!contactPerson) {
    throw new Error("Enter the contact person name.");
  }
  if (!(MUNICIPALITIES as readonly string[]).includes(municipality)) {
    throw new Error("Choose a valid Marinduque municipality.");
  }

  const res = await fetchImpl(`${cfg.url}/auth/v1/signup`, {
    method: "POST",
    headers: buildHeaders(cfg.publishableKey),
    body: JSON.stringify({
      email,
      password: input.password,
      data: {
        display_name: marketName,
        contact_person: contactPerson,
        contact_number: input.contactNumber?.trim() || undefined,
        municipality,
        business_address: input.businessAddress?.trim() || undefined,
        business_type: input.businessType,
        account_type: "market",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Could not create market account"));
  }

  const data = (await res.json()) as Record<string, unknown>;
  const session = normalizeAuthSession(data);
  if (!session) {
    return { session: null, profile: null, confirmationRequired: true };
  }

  const profile = await fetchOrCreateUserProfile(
    session,
    {
      displayName: marketName,
      municipality,
      accountRole: "market",
      organizationName: marketName,
    },
    cfg,
    fetchImpl,
  );
  return { session, profile, confirmationRequired: false };
}

export async function signInWithEmailPassword(
  input: { email: string; password: string },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ session: SupabaseSession; profile: UserProfile }> {
  const cfg = requireConfigured(config);
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    throw new Error("Enter both your email and password.");
  }

  const res = await fetchImpl(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: buildHeaders(cfg.publishableKey),
    body: JSON.stringify({
      email,
      password: input.password,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Sign-in failed"));
  }

  const data = (await res.json()) as Record<string, unknown>;
  const session = normalizeAuthSession(data);
  if (!session) {
    throw new Error("Supabase did not return a valid session token.");
  }

  const profile = await fetchOrCreateUserProfile(session, undefined, cfg, fetchImpl);
  return { session, profile };
}

export async function refreshSupabaseSession(
  refreshToken: string,
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SupabaseSession> {
  const cfg = requireConfigured(config);
  const res = await fetchImpl(`${cfg.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: buildHeaders(cfg.publishableKey),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Session expired. Please sign in again"));
  }

  const data = (await res.json()) as Record<string, unknown>;
  const session = normalizeAuthSession(data);
  if (!session) {
    throw new Error("Could not refresh Supabase session.");
  }
  return session;
}

export async function signOutSession(
  accessToken: string,
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (config.status !== "configured") return;
  try {
    await fetchImpl(`${config.url}/auth/v1/logout`, {
      method: "POST",
      headers: buildHeaders(config.publishableKey, accessToken),
    });
  } catch {
    // Always allow local sign-out cleanup even if network is unreachable
  }
}

export async function fetchFarmerHarvestListings(
  session: SupabaseSession,
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<Harvest[]> {
  const cfg = requireConfigured(config);
  const url = `${cfg.url}/rest/v1/harvest_listings?farmer_id=eq.${encodeURIComponent(
    session.user.id,
  )}&select=*&order=created_at.desc`;
  const res = await fetchImpl(url, {
    method: "GET",
    headers: buildHeaders(cfg.publishableKey, session.access_token),
  });

  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not load your harvest listings from Supabase Agri"),
    );
  }

  const rows = (await res.json()) as DbHarvestListingRow[];
  return Array.isArray(rows) ? rows.map(mapDbRowToHarvest) : [];
}

export async function createPendingHarvestListing(
  session: SupabaseSession,
  harvest: Omit<Harvest, "id" | "status" | "farmerId" | "reviewedBy" | "reviewedAt" | "reviewNotes" | "createdAt">,
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<Harvest> {
  const cfg = requireConfigured(config);
  // Enforce that submitted listings ALWAYS start as 'pending_verification' and use the authenticated farmer's ID
  const payload: Record<string, unknown> = {
    farmer_id: session.user.id,
    crop: harvest.crop,
    quantity_kg: harvest.quantity,
    asking_price_php_per_kg: harvest.price,
    harvest_date: harvest.harvestDate,
    municipality: harvest.municipality,
    barangay: harvest.barangay.trim(),
    storage_condition: harvest.storage,
    outreach_priority: harvest.priority,
    status: "pending_verification" as const,
  };

  if (harvest.qualityGrade) {
    payload.quality_grade = harvest.qualityGrade;
  }
  if (harvest.photoRef) {
    payload.photo_url = harvest.photoRef.trim().slice(0, 500);
  }

  const res = await fetchImpl(`${cfg.url}/rest/v1/harvest_listings?select=*`, {
    method: "POST",
    headers: buildHeaders(cfg.publishableKey, session.access_token, {
      Prefer: "return=representation",
    }),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not submit harvest listing to Supabase Agri"),
    );
  }

  const rows = (await res.json()) as DbHarvestListingRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Supabase did not confirm the saved harvest record.");
  }

  return mapDbRowToHarvest(rows[0]);
}

export async function fetchActiveMarketDemands(
  session: SupabaseSession,
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<MarketDemand[]> {
  const cfg = requireConfigured(config);
  const url = `${cfg.url}/rest/v1/market_demands?status=in.(open,partially_fulfilled)&select=*&order=required_by.asc`;
  const res = await fetchImpl(url, {
    method: "GET",
    headers: buildHeaders(cfg.publishableKey, session.access_token),
  });

  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not load active market demands from Supabase Agri"),
    );
  }

  const rows = (await res.json()) as DbMarketDemandRow[];
  return Array.isArray(rows) ? rows.map(mapDbRowToMarketDemand) : [];
}

export async function createLiveMarketDemand(
  session: SupabaseSession,
  input: {
    crop: string;
    requiredQuantity: number;
    unit?: string;
    buyingType?: string;
    unitPrice?: number;
    totalPrice?: number;
    municipality: string;
    barangay?: string;
    requiredBy: string;
    acceptPartial?: boolean;
    qualityNotes?: string;
    preferredQualityGrade?: string;
  },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<MarketDemand> {
  const cfg = requireConfigured(config);
  const res = await fetchImpl(`${cfg.url}/rest/v1/market_demands`, {
    method: "POST",
    headers: {
      ...buildHeaders(cfg.publishableKey, session.access_token),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      market_id: session.user.id,
      crop: input.crop,
      required_quantity_kg: input.requiredQuantity,
      unit: input.unit ?? "kg",
      buying_type: input.buyingType ?? "per_unit",
      unit_price_php: input.unitPrice ?? null,
      total_price_php: input.totalPrice ?? null,
      municipality: input.municipality,
      barangay: input.barangay ?? null,
      required_by: input.requiredBy,
      accept_partial: input.acceptPartial ?? true,
      quality_notes: input.qualityNotes ?? null,
      preferred_quality_grade: input.preferredQualityGrade ?? "Grade A",
      status: "open",
    }),
  });

  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not post market demand to Supabase Agri"),
    );
  }

  const rows = (await res.json()) as DbMarketDemandRow[];
  if (!rows || rows.length === 0) {
    throw new Error("Supabase did not return the created market demand record.");
  }
  return mapDbRowToMarketDemand(rows[0]);
}

export async function fetchFarmerSupplyAllocations(
  session: SupabaseSession,
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SupplyAllocation[]> {
  const cfg = requireConfigured(config);
  const url = `${cfg.url}/rest/v1/supply_allocations?farmer_id=eq.${encodeURIComponent(
    session.user.id,
  )}&select=*&order=offered_at.desc`;
  const res = await fetchImpl(url, {
    method: "GET",
    headers: buildHeaders(cfg.publishableKey, session.access_token),
  });

  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not load supply allocations from Supabase Agri"),
    );
  }

  const rows = (await res.json()) as DbSupplyAllocationRow[];
  return Array.isArray(rows) ? rows.map(mapDbRowToSupplyAllocation) : [];
}

export async function allocateHarvestToDemandRpc(
  session: SupabaseSession,
  params: {
    harvestListingId: string;
    marketDemandId: string;
    quantityKg: number;
    agreedPricePerKg?: number;
    offerNotes?: string;
  },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SupplyAllocation> {
  const cfg = requireConfigured(config);
  const res = await fetchImpl(
    `${cfg.url}/rest/v1/rpc/allocate_harvest_to_demand`,
    {
      method: "POST",
      headers: buildHeaders(cfg.publishableKey, session.access_token),
      body: JSON.stringify({
        p_harvest_listing_id: params.harvestListingId,
        p_market_demand_id: params.marketDemandId,
        p_quantity_kg: params.quantityKg,
        p_agreed_price_php_per_kg: params.agreedPricePerKg ?? null,
        p_offer_notes: (params.offerNotes ?? "").trim(),
      }),
    },
  );

  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(
        res,
        "Could not allocate harvest quantity to market demand",
      ),
    );
  }

  const row = (await res.json()) as DbSupplyAllocationRow;
  return mapDbRowToSupplyAllocation(row);
}

export async function markAllocationInDeliveryRpc(
  session: SupabaseSession,
  params: { allocationId: string; notes?: string },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SupplyAllocation> {
  const cfg = requireConfigured(config);
  const res = await fetchImpl(
    `${cfg.url}/rest/v1/rpc/mark_allocation_in_delivery`,
    {
      method: "POST",
      headers: buildHeaders(cfg.publishableKey, session.access_token),
      body: JSON.stringify({
        p_allocation_id: params.allocationId,
        p_notes: (params.notes ?? "").trim(),
      }),
    },
  );

  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not mark allocation as in delivery"),
    );
  }

  const row = (await res.json()) as DbSupplyAllocationRow;
  return mapDbRowToSupplyAllocation(row);
}

export async function cancelSupplyAllocationRpc(
  session: SupabaseSession,
  params: { allocationId: string; reason: string },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SupplyAllocation> {
  const cfg = requireConfigured(config);
  const res = await fetchImpl(
    `${cfg.url}/rest/v1/rpc/cancel_or_resolve_supply_allocation`,
    {
      method: "POST",
      headers: buildHeaders(cfg.publishableKey, session.access_token),
      body: JSON.stringify({
        p_allocation_id: params.allocationId,
        p_reason: params.reason.trim(),
      }),
    },
  );

  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not cancel supply allocation"),
    );
  }

  const row = (await res.json()) as DbSupplyAllocationRow;
  return mapDbRowToSupplyAllocation(row);
}
