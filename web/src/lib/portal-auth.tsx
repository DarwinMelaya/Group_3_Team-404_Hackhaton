"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabaseConfig } from "./supabase-config";
import {
  fetchOrCreateUserProfile,
  fetchPortalHarvestListings,
  isValidSession,
  refreshWebSession,
  reviewHarvestListingRpc,
  signInWebUser,
  signOutWebSession,
  type LiveHarvestListing,
  type SupabaseSession,
  type UserProfile,
} from "./supabase-client";

const WEB_SESSION_KEY = "smart-ani:web-supabase-session:v1";

type PortalMode = "demo" | "live";

type PortalAuthContextValue = {
  isConfigured: boolean;
  mode: PortalMode;
  setMode: (mode: PortalMode) => void;
  session: SupabaseSession | null;
  profile: UserProfile | null;
  authReady: boolean;
  authError: string;
  liveHarvests: LiveHarvestListing[];
  harvestsLoading: boolean;
  harvestsError: string;
  signIn: (email: string, password: string) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  refreshLiveHarvests: () => Promise<void>;
  reviewListing: (params: {
    listingId: string;
    decision: "available" | "rejected";
    reviewNotes?: string;
  }) => Promise<LiveHarvestListing>;
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
  const [harvestsLoading, setHarvestsLoading] = useState(false);
  const [harvestsError, setHarvestsError] = useState("");

  const loadListingsForUser = useCallback(
    async (activeSession: SupabaseSession, activeProfile: UserProfile) => {
      setHarvestsLoading(true);
      setHarvestsError("");
      try {
        const rows = await fetchPortalHarvestListings(
          activeSession,
          activeProfile.role,
        );
        setLiveHarvests(rows);
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
        "Sign in with a coordinator or admin account to review harvest listings.",
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
        harvestsLoading,
        harvestsError,
        signIn,
        signOut,
        refreshLiveHarvests,
        reviewListing,
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
