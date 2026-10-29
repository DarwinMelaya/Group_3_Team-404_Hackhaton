// SMART LINK · Supabase public client configuration (existing project: Agri).
//
// Phase 1 only validates configuration; no Supabase client is created and no
// network request is made. Keep this file free of React Native imports so it can
// be unit tested with Node. The same validator exists in
// web/src/lib/supabase-config.ts; keep both in sync.
//
// Security rules enforced here:
// - Only the project URL and a PUBLISHABLE (or legacy anon) key may be public.
// - Secret keys (sb_secret_...) and service_role JWTs are rejected.
// - Key values are never included in status messages.

export type SupabasePublicConfig =
  | { status: "not-configured"; message: string }
  | { status: "invalid"; message: string }
  | {
      status: "configured";
      url: string;
      publishableKey: string;
      message: string;
    };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function jwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload: unknown = JSON.parse(atob(padded));
    if (typeof payload !== "object" || payload === null) return null;
    const role = (payload as { role?: unknown }).role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

export function parseSupabasePublicConfig(
  rawUrl: string | undefined,
  rawKey: string | undefined,
): SupabasePublicConfig {
  const urlValue = rawUrl?.trim() ?? "";
  const key = rawKey?.trim() ?? "";

  if (!urlValue && !key)
    return {
      status: "not-configured",
      message: "Supabase (Agri) is not configured. Running in demo mode.",
    };
  if (!urlValue || !key)
    return {
      status: "invalid",
      message:
        "Supabase configuration is incomplete. Set both the project URL and the publishable key.",
    };

  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return { status: "invalid", message: "Supabase URL is not a valid URL." };
  }
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:"))
    return {
      status: "invalid",
      message: "Supabase URL must use https (http is allowed only for localhost).",
    };
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    return {
      status: "invalid",
      message: "Supabase URL must be the bare project URL without path, query, or credentials.",
    };

  if (key.startsWith("sb_secret_"))
    return {
      status: "invalid",
      message:
        "A Supabase SECRET key was found in a public variable. Remove it immediately and rotate it; only the publishable key is allowed.",
    };
  const role = jwtRole(key);
  if (role === "service_role")
    return {
      status: "invalid",
      message:
        "A Supabase service_role key was found in a public variable. Remove it immediately and rotate it; only the publishable key is allowed.",
    };
  if (!key.startsWith("sb_publishable_") && role !== "anon")
    return {
      status: "invalid",
      message:
        "Supabase key format is not recognized. Use the project's publishable key (sb_publishable_...).",
    };

  return {
    status: "configured",
    url: url.origin,
    publishableKey: key,
    message:
      "Supabase (Agri) public configuration verified. Ready for live authentication and database operations.",
  };
}

// Expo inlines EXPO_PUBLIC_* only for static property access; do not refactor
// these into dynamic lookups.
export const supabaseConfig = parseSupabasePublicConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
