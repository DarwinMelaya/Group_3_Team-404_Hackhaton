// SMART-ANI · Web Portal Supabase Auth, PostgREST & 3-Role (Farmer, Market, Admin) RPC Client
// Keep free of framework imports so this module can be unit-tested directly with Node.

import { supabaseConfig, type SupabasePublicConfig } from "./supabase-config.ts";

export type SmartAniRole = "farmer" | "market" | "admin";

export type MarketType =
  | "public_market"
  | "wet_market_retailer"
  | "retail_buyer"
  | "cooperative"
  | "food_processor"
  | "institutional_buyer";

export type HarvestVerificationStatus =
  | "draft"
  | "pending_verification"
  | "available"
  | "partially_allocated"
  | "fully_allocated"
  | "delivered"
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
  verification_notes?: string;
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

export type LiveHarvestListing = {
  id: string;
  farmer_id: string;
  crop: string;
  quantity_kg: number;
  unit: string;
  quality_grade: string;
  photo_url: string;
  asking_price_php_per_kg: number;
  harvest_date: string;
  municipality: string;
  barangay: string;
  storage_condition: string;
  outreach_priority: "Standard" | "Priority";
  status: HarvestVerificationStatus;
  earmarked_kg: number;
  reserved_kg: number;
  allocated_kg: number;
  delivered_kg: number;
  remaining_kg: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string;
  created_at: string;
};

export type LiveMarketDemand = {
  id: string;
  market_id: string;
  crop: string;
  required_quantity_kg: number;
  reserved_quantity_kg: number;
  fulfilled_quantity_kg: number;
  remaining_demand_kg: number;
  unit: string;
  preferred_quality_grade: string;
  offered_price_php_per_kg: number;
  municipality: string;
  barangay: string;
  delivery_location_text: string;
  required_by: string;
  accept_partial: boolean;
  quality_notes: string;
  status: "open" | "partially_fulfilled" | "fulfilled" | "cancelled" | "closed";
  created_at: string;
};

export type LiveSupplyAllocation = {
  id: string;
  harvest_listing_id: string;
  market_demand_id: string;
  farmer_id: string;
  market_id: string;
  crop: string;
  allocated_quantity_kg: number;
  delivered_quantity_kg: number;
  released_quantity_kg: number;
  outstanding_quantity_kg: number;
  agreed_price_php_per_kg: number;
  status:
    | "proposed"
    | "pending_acceptance"
    | "reserved"
    | "in_delivery"
    | "partially_delivered"
    | "delivered"
    | "rejected"
    | "cancelled";
  offer_notes: string;
  response_notes: string;
  offered_at: string;
  responded_at: string | null;
  completed_at: string | null;
};

const VALID_MUNICIPALITIES = new Set([
  "Boac",
  "Mogpog",
  "Santa Cruz",
  "Torrijos",
  "Buenavista",
  "Gasan",
]);

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
    // Ignore JSON parse failures
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

function normalizeLiveListing(raw: Record<string, unknown>): LiveHarvestListing {
  const qty = Number(raw.quantity_kg ?? 0);
  const earmarked = Number(raw.earmarked_kg ?? 0);
  const reserved = Number(raw.reserved_kg ?? 0);
  const allocated = Number(raw.allocated_kg ?? earmarked + reserved);
  const delivered = Number(raw.delivered_kg ?? 0);
  const remaining =
    raw.remaining_kg !== undefined
      ? Number(raw.remaining_kg)
      : Math.max(0, Number((qty - allocated - delivered).toFixed(3)));

  return {
    id: String(raw.id ?? ""),
    farmer_id: String(raw.farmer_id ?? ""),
    crop: String(raw.crop ?? ""),
    quantity_kg: qty,
    unit: String(raw.unit ?? "kg"),
    quality_grade: String(raw.quality_grade ?? "Grade A"),
    photo_url: String(raw.photo_url ?? ""),
    asking_price_php_per_kg: Number(raw.asking_price_php_per_kg ?? 0),
    harvest_date: String(raw.harvest_date ?? ""),
    municipality: String(raw.municipality ?? ""),
    barangay: String(raw.barangay ?? ""),
    storage_condition: String(raw.storage_condition ?? ""),
    outreach_priority: raw.outreach_priority === "Priority" ? "Priority" : "Standard",
    status: (raw.status as HarvestVerificationStatus) ?? "pending_verification",
    earmarked_kg: earmarked,
    reserved_kg: reserved,
    allocated_kg: allocated,
    delivered_kg: delivered,
    remaining_kg: remaining,
    reviewed_by: typeof raw.reviewed_by === "string" ? raw.reviewed_by : null,
    reviewed_at: typeof raw.reviewed_at === "string" ? raw.reviewed_at : null,
    review_notes: typeof raw.review_notes === "string" ? raw.review_notes : "",
    created_at: String(raw.created_at ?? ""),
  };
}

function normalizeLiveDemand(raw: Record<string, unknown>): LiveMarketDemand {
  const req = Number(raw.required_quantity_kg ?? 0);
  const res = Number(raw.reserved_quantity_kg ?? 0);
  const ful = Number(raw.fulfilled_quantity_kg ?? 0);
  const rem =
    raw.remaining_demand_kg !== undefined
      ? Number(raw.remaining_demand_kg)
      : Math.max(0, Number((req - res - ful).toFixed(3)));

  return {
    id: String(raw.id ?? ""),
    market_id: String(raw.market_id ?? ""),
    crop: String(raw.crop ?? ""),
    required_quantity_kg: req,
    reserved_quantity_kg: res,
    fulfilled_quantity_kg: ful,
    remaining_demand_kg: rem,
    unit: String(raw.unit ?? "kg"),
    preferred_quality_grade: String(raw.preferred_quality_grade ?? "Any"),
    offered_price_php_per_kg: Number(raw.offered_price_php_per_kg ?? 0),
    municipality: String(raw.municipality ?? ""),
    barangay: String(raw.barangay ?? ""),
    delivery_location_text: String(raw.delivery_location_text ?? ""),
    required_by: String(raw.required_by ?? ""),
    accept_partial: Boolean(raw.accept_partial ?? true),
    quality_notes: String(raw.quality_notes ?? ""),
    status:
      (raw.status as LiveMarketDemand["status"]) ?? "open",
    created_at: String(raw.created_at ?? ""),
  };
}

function normalizeLiveAllocation(
  raw: Record<string, unknown>,
): LiveSupplyAllocation {
  const alloc = Number(raw.allocated_quantity_kg ?? 0);
  const deliv = Number(raw.delivered_quantity_kg ?? 0);
  const rel = Number(raw.released_quantity_kg ?? 0);
  const out =
    raw.outstanding_quantity_kg !== undefined
      ? Number(raw.outstanding_quantity_kg)
      : Math.max(0, Number((alloc - deliv - rel).toFixed(3)));

  return {
    id: String(raw.id ?? ""),
    harvest_listing_id: String(raw.harvest_listing_id ?? ""),
    market_demand_id: String(raw.market_demand_id ?? ""),
    farmer_id: String(raw.farmer_id ?? ""),
    market_id: String(raw.market_id ?? ""),
    crop: String(raw.crop ?? ""),
    allocated_quantity_kg: alloc,
    delivered_quantity_kg: deliv,
    released_quantity_kg: rel,
    outstanding_quantity_kg: out,
    agreed_price_php_per_kg: Number(raw.agreed_price_php_per_kg ?? 0),
    status: (raw.status as LiveSupplyAllocation["status"]) ?? "pending_acceptance",
    offer_notes: String(raw.offer_notes ?? ""),
    response_notes: String(raw.response_notes ?? ""),
    offered_at: String(raw.offered_at ?? ""),
    responded_at: typeof raw.responded_at === "string" ? raw.responded_at : null,
    completed_at: typeof raw.completed_at === "string" ? raw.completed_at : null,
  };
}

export async function fetchOrCreateUserProfile(
  session: SupabaseSession,
  defaults?: {
    displayName?: string;
    municipality?: string;
    accountRole?: "farmer" | "market";
    marketType?: MarketType;
    organizationName?: string;
  },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<UserProfile> {
  const cfg = requireConfigured(config);
  const queryUrl = `${cfg.url}/rest/v1/profiles?id=eq.${encodeURIComponent(
    session.user.id,
  )}&select=*`;
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

  const fallbackName =
    defaults?.displayName?.trim() ||
    session.user.email.split("@")[0]?.trim() ||
    "Marinduque User";
  const fallbackMunicipality = VALID_MUNICIPALITIES.has(defaults?.municipality ?? "")
    ? defaults!.municipality!
    : "Boac";

  if (defaults?.accountRole === "market") {
    const rpcRes = await fetchImpl(
      `${cfg.url}/rest/v1/rpc/register_account_profile`,
      {
        method: "POST",
        headers: buildHeaders(cfg.publishableKey, session.access_token),
        body: JSON.stringify({
          p_account_role: "market",
          p_display_name: fallbackName.slice(0, 100),
          p_municipality: fallbackMunicipality,
          p_market_type: defaults.marketType ?? "public_market",
          p_organization_name: (defaults.organizationName ?? fallbackName).slice(
            0,
            120,
          ),
        }),
      },
    );
    if (rpcRes.ok) {
      return (await rpcRes.json()) as UserProfile;
    }
  }

  const createRes = await fetchImpl(
    `${cfg.url}/rest/v1/profiles?select=*`,
    {
      method: "POST",
      headers: buildHeaders(cfg.publishableKey, session.access_token, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        id: session.user.id,
        display_name: fallbackName.slice(0, 100),
        municipality: fallbackMunicipality,
      }),
    },
  );

  if (!createRes.ok) {
    throw new Error(
      await parseErrorMessage(
        createRes,
        "Account has no profile in public.profiles and default profile creation failed",
      ),
    );
  }

  const createdRows: unknown = await createRes.json();
  if (!Array.isArray(createdRows) || createdRows.length === 0) {
    throw new Error("Profile creation succeeded but returned no profile record.");
  }
  return createdRows[0] as UserProfile;
}

export async function signUpWebMarketOrFarmer(
  input: {
    email: string;
    password: string;
    displayName: string;
    municipality: string;
    accountRole: "farmer" | "market";
    marketType?: MarketType;
    organizationName?: string;
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
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const res = await fetchImpl(`${cfg.url}/auth/v1/signup`, {
    method: "POST",
    headers: buildHeaders(cfg.publishableKey),
    body: JSON.stringify({
      email,
      password: input.password,
      data: {
        display_name: input.displayName.trim(),
        municipality: input.municipality,
        account_type: input.accountRole,
        market_type: input.marketType ?? "public_market",
        organization_name: (
          input.organizationName ?? input.displayName
        ).trim(),
      },
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Account registration failed"));
  }

  const data = (await res.json()) as Record<string, unknown>;
  const session = normalizeAuthSession(data);
  if (!session) {
    return { session: null, profile: null, confirmationRequired: true };
  }

  const profile = await fetchOrCreateUserProfile(
    session,
    {
      displayName: input.displayName,
      municipality: input.municipality,
      accountRole: input.accountRole,
      marketType: input.marketType,
      organizationName: input.organizationName,
    },
    cfg,
    fetchImpl,
  );
  return { session, profile, confirmationRequired: false };
}

export async function signInWebUser(
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

export async function refreshWebSession(
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

export async function signOutWebSession(
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
    // Always allow local sign-out cleanup
  }
}

export async function fetchPortalHarvestListings(
  session: SupabaseSession,
  role: SmartAniRole,
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveHarvestListing[]> {
  const cfg = requireConfigured(config);
  const filter =
    role === "admin" || role === "farmer"
      ? "select=*&order=created_at.desc"
      : "status=eq.available&select=*&order=created_at.desc";

  const res = await fetchImpl(`${cfg.url}/rest/v1/harvest_listings?${filter}`, {
    method: "GET",
    headers: buildHeaders(cfg.publishableKey, session.access_token),
  });

  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not load harvest listings from Supabase Agri"),
    );
  }

  const rows = (await res.json()) as Record<string, unknown>[];
  return Array.isArray(rows) ? rows.map(normalizeLiveListing) : [];
}

export async function fetchLiveMarketDemands(
  session: SupabaseSession,
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveMarketDemand[]> {
  const cfg = requireConfigured(config);
  const res = await fetchImpl(
    `${cfg.url}/rest/v1/market_demands?select=*&order=created_at.desc`,
    {
      method: "GET",
      headers: buildHeaders(cfg.publishableKey, session.access_token),
    },
  );
  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not load market demands"),
    );
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  return Array.isArray(rows) ? rows.map(normalizeLiveDemand) : [];
}

export async function createLiveMarketDemand(
  session: SupabaseSession,
  input: {
    crop: string;
    requiredQuantityKg: number;
    preferredQualityGrade: string;
    offeredPricePerKg: number;
    municipality: string;
    barangay: string;
    requiredBy: string;
    acceptPartial: boolean;
    qualityNotes: string;
  },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveMarketDemand> {
  const cfg = requireConfigured(config);
  const res = await fetchImpl(`${cfg.url}/rest/v1/market_demands?select=*`, {
    method: "POST",
    headers: buildHeaders(cfg.publishableKey, session.access_token, {
      Prefer: "return=representation",
    }),
    body: JSON.stringify({
      market_id: session.user.id,
      crop: input.crop,
      required_quantity_kg: input.requiredQuantityKg,
      unit: "kg",
      preferred_quality_grade: input.preferredQualityGrade,
      offered_price_php_per_kg: input.offeredPricePerKg,
      municipality: input.municipality,
      barangay: input.barangay.trim(),
      required_by: input.requiredBy,
      accept_partial: input.acceptPartial,
      quality_notes: input.qualityNotes.trim(),
      status: "open",
    }),
  });
  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not create market crop demand"),
    );
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  return normalizeLiveDemand(rows[0] ?? {});
}

export async function fetchLiveSupplyAllocations(
  session: SupabaseSession,
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveSupplyAllocation[]> {
  const cfg = requireConfigured(config);
  const res = await fetchImpl(
    `${cfg.url}/rest/v1/supply_allocations?select=*&order=offered_at.desc`,
    {
      method: "GET",
      headers: buildHeaders(cfg.publishableKey, session.access_token),
    },
  );
  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not load supply allocations"),
    );
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  return Array.isArray(rows) ? rows.map(normalizeLiveAllocation) : [];
}

export async function reviewHarvestListingRpc(
  session: SupabaseSession,
  role: SmartAniRole,
  params: {
    listingId: string;
    decision: "available" | "rejected";
    reviewNotes?: string;
  },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveHarvestListing> {
  const cfg = requireConfigured(config);
  if (role !== "admin") {
    throw new Error(
      "Unauthorized: only an Admin account may verify or reject harvest listings.",
    );
  }
  if (params.decision !== "available" && params.decision !== "rejected") {
    throw new Error("Decision must be available (approve) or rejected.");
  }

  const res = await fetchImpl(`${cfg.url}/rest/v1/rpc/review_harvest_listing`, {
    method: "POST",
    headers: buildHeaders(cfg.publishableKey, session.access_token),
    body: JSON.stringify({
      p_listing_id: params.listingId,
      p_decision: params.decision,
      p_review_notes: (params.reviewNotes ?? "").trim(),
    }),
  });

  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(
        res,
        "Admin verification RPC (review_harvest_listing) failed",
      ),
    );
  }

  const data = (await res.json()) as Record<string, unknown>;
  return normalizeLiveListing(data);
}

export async function adminVerifyMarketAccountWebRpc(
  session: SupabaseSession,
  params: {
    marketId: string;
    decision: "verified" | "rejected" | "suspended";
    notes: string;
  },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<UserProfile> {
  const cfg = requireConfigured(config);
  const res = await fetchImpl(
    `${cfg.url}/rest/v1/rpc/admin_verify_market_account`,
    {
      method: "POST",
      headers: buildHeaders(cfg.publishableKey, session.access_token),
      body: JSON.stringify({
        p_market_id: params.marketId,
        p_decision: params.decision,
        p_notes: params.notes.trim(),
      }),
    },
  );
  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Admin Market verification RPC failed"),
    );
  }
  return (await res.json()) as UserProfile;
}

export async function respondToSupplyAllocationWebRpc(
  session: SupabaseSession,
  params: {
    allocationId: string;
    decision: "reserved" | "rejected";
    notes?: string;
  },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveSupplyAllocation> {
  const cfg = requireConfigured(config);
  const res = await fetchImpl(
    `${cfg.url}/rest/v1/rpc/respond_to_supply_allocation`,
    {
      method: "POST",
      headers: buildHeaders(cfg.publishableKey, session.access_token),
      body: JSON.stringify({
        p_allocation_id: params.allocationId,
        p_decision: params.decision,
        p_response_notes: (params.notes ?? "").trim(),
      }),
    },
  );
  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not respond to supply offer"),
    );
  }
  return normalizeLiveAllocation(
    (await res.json()) as Record<string, unknown>,
  );
}

export async function confirmAllocationDeliveryWebRpc(
  session: SupabaseSession,
  params: {
    allocationId: string;
    receivedQuantityKg: number;
    finalizeShortDelivery?: boolean;
    qualityGradeReceived?: string;
    deliveryNotes?: string;
  },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveSupplyAllocation> {
  const cfg = requireConfigured(config);
  const res = await fetchImpl(
    `${cfg.url}/rest/v1/rpc/confirm_allocation_delivery`,
    {
      method: "POST",
      headers: buildHeaders(cfg.publishableKey, session.access_token),
      body: JSON.stringify({
        p_allocation_id: params.allocationId,
        p_received_quantity_kg: params.receivedQuantityKg,
        p_finalize_short_delivery: Boolean(params.finalizeShortDelivery),
        p_quality_grade_received: params.qualityGradeReceived ?? "Grade A",
        p_delivery_notes: (params.deliveryNotes ?? "").trim(),
      }),
    },
  );
  if (!res.ok) {
    throw new Error(
      await parseErrorMessage(res, "Could not confirm delivery receipt"),
    );
  }
  return normalizeLiveAllocation(
    (await res.json()) as Record<string, unknown>,
  );
}
