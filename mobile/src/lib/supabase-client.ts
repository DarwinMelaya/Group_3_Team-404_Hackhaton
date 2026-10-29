// SMART-ANI · Phase 2B Supabase Auth, PostgREST & Coordinator Verification RPC Client
// Keep free of React Native imports so this module can be unit-tested directly with Node.

import { MUNICIPALITIES, type Harvest } from "./harvest.ts";
import { supabaseConfig, type SupabasePublicConfig } from "./supabase-config.ts";

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

export type DbHarvestListingRow = {
  id: string;
  farmer_id: string;
  crop: string;
  quantity_kg: number | string;
  asking_price_php_per_kg: number | string;
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
  return {
    id: row.id,
    farmerId: row.farmer_id,
    crop: row.crop,
    quantity: Number(row.quantity_kg),
    price: Number(row.asking_price_php_per_kg),
    harvestDate: row.harvest_date,
    municipality: row.municipality,
    barangay: row.barangay,
    storage: row.storage_condition,
    priority: row.outreach_priority === "Priority" ? "Priority" : "Standard",
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes ?? "",
    createdAt: row.created_at,
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
  defaults?: { displayName?: string; municipality?: string },
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
  const payload = {
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
