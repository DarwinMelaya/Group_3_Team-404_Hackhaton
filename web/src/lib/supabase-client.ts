// SMART-ANI · Phase 2B Web Supabase Auth, PostgREST & Coordinator Verification RPC Client
// Keep free of framework imports so this module can be unit-tested directly with Node.

import { supabaseConfig, type SupabasePublicConfig } from "./supabase-config";

export type SmartAniRole = "farmer" | "processor" | "coordinator" | "admin";

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
  asking_price_php_per_kg: number;
  harvest_date: string;
  municipality: string;
  barangay: string;
  storage_condition: string;
  outreach_priority: "Standard" | "Priority";
  status: HarvestVerificationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string;
  created_at: string;
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
  return {
    id: String(raw.id ?? ""),
    farmer_id: String(raw.farmer_id ?? ""),
    crop: String(raw.crop ?? ""),
    quantity_kg: Number(raw.quantity_kg ?? 0),
    asking_price_php_per_kg: Number(raw.asking_price_php_per_kg ?? 0),
    harvest_date: String(raw.harvest_date ?? ""),
    municipality: String(raw.municipality ?? ""),
    barangay: String(raw.barangay ?? ""),
    storage_condition: String(raw.storage_condition ?? ""),
    outreach_priority: raw.outreach_priority === "Priority" ? "Priority" : "Standard",
    status: (raw.status as HarvestVerificationStatus) ?? "pending_verification",
    reviewed_by: typeof raw.reviewed_by === "string" ? raw.reviewed_by : null,
    reviewed_at: typeof raw.reviewed_at === "string" ? raw.reviewed_at : null,
    review_notes: typeof raw.review_notes === "string" ? raw.review_notes : "",
    created_at: String(raw.created_at ?? ""),
  };
}

export async function fetchOrCreateUserProfile(
  session: SupabaseSession,
  defaults?: { displayName?: string; municipality?: string },
  config: SupabasePublicConfig = supabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<UserProfile> {
  const cfg = requireConfigured(config);
  const queryUrl = `${cfg.url}/rest/v1/profiles?id=eq.${encodeURIComponent(
    session.user.id,
  )}&select=id,display_name,municipality,role,created_at`;
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

  const createRes = await fetchImpl(
    `${cfg.url}/rest/v1/profiles?select=id,display_name,municipality,role,created_at`,
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
  // Processors only query status=eq.available (also enforced by database RLS policy harvests_read).
  // Coordinators and admins query all statuses so they can inspect pending_verification, available, and rejected rows.
  const filter =
    role === "coordinator" || role === "admin"
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
  if (role !== "coordinator" && role !== "admin") {
    throw new Error(
      "Unauthorized: only a coordinator or admin account may verify or reject harvest listings.",
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
        "Coordinator verification RPC (review_harvest_listing) failed",
      ),
    );
  }

  const data = (await res.json()) as Record<string, unknown>;
  return normalizeLiveListing(data);
}

