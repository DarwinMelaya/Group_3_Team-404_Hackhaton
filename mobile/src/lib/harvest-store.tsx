import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { initialHarvests, isHarvest, type Harvest } from "./harvest";
import { supabaseConfig } from "./supabase-config";
import {
  createPendingHarvestListing,
  fetchFarmerHarvestListings,
  fetchOrCreateUserProfile,
  isValidSession,
  refreshSupabaseSession,
  signInWithEmailPassword,
  signOutSession,
  signUpFarmerAccount,
  type SupabaseSession,
  type UserProfile,
} from "./supabase-client";

const DEMO_KEY = "smart-link:demo-harvests:v1";
const SESSION_KEY = "smart-ani:supabase-session:v1";

type WorkspaceMode = "demo" | "live";

type HarvestStoreValue = {
  mode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;
  harvests: Harvest[];
  ready: boolean;
  error: string;
  add: (
    harvest: Omit<
      Harvest,
      "id" | "status" | "farmerId" | "reviewedBy" | "reviewedAt" | "reviewNotes" | "createdAt"
    >,
  ) => Promise<Harvest>;
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
  signOut: () => Promise<void>;
};

const Store = createContext<HarvestStoreValue | null>(null);

export function HarvestProvider({ children }: { children: ReactNode }) {
  const isConfigured = supabaseConfig.status === "configured";
  const [mode, setModeState] = useState<WorkspaceMode>(
    isConfigured ? "live" : "demo",
  );
  const [demoHarvests, setDemoHarvests] = useState<Harvest[]>([]);
  const [demoReady, setDemoReady] = useState(false);
  const [demoError, setDemoError] = useState("");

  const [liveHarvests, setLiveHarvests] = useState<Harvest[]>([]);
  const [liveReady, setLiveReady] = useState(!isConfigured);
  const [liveError, setLiveError] = useState("");

  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(!isConfigured);
  const [authError, setAuthError] = useState("");

  const demoRecords = useRef<Harvest[]>([]);
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
        if (active) {
          demoRecords.current = parsed;
          setDemoHarvests(parsed);
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

  const loadLiveHarvestsForSession = useCallback(
    async (activeSession: SupabaseSession) => {
      setLiveReady(false);
      setLiveError("");
      try {
        const rows = await fetchFarmerHarvestListings(activeSession);
        setLiveHarvests(rows);
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
        await loadLiveHarvestsForSession(currentSession);
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
  }, [isConfigured, loadLiveHarvestsForSession]);

  function setMode(nextMode: WorkspaceMode) {
    if (nextMode === "live" && !isConfigured) return;
    setModeState(nextMode);
  }

  async function signIn(email: string, password: string) {
    setAuthError("");
    setLiveError("");
    const result = await signInWithEmailPassword({ email, password });
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
    setSession(result.session);
    setProfile(result.profile);
    setModeState("live");
    await loadLiveHarvestsForSession(result.session);
  }

  async function signUp(input: {
    email: string;
    password: string;
    displayName: string;
    municipality: string;
  }) {
    setAuthError("");
    setLiveError("");
    const result = await signUpFarmerAccount(input);
    if (result.session && result.profile) {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
      setSession(result.session);
      setProfile(result.profile);
      setModeState("live");
      await loadLiveHarvestsForSession(result.session);
    }
    return { confirmationRequired: result.confirmationRequired };
  }

  async function signOut() {
    const token = session?.access_token;
    await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    setSession(null);
    setProfile(null);
    setLiveHarvests([]);
    setLiveError("");
    setAuthError("");
    if (token) {
      await signOutSession(token);
    }
  }

  async function refreshHarvests() {
    if (mode === "live") {
      if (!session) {
        throw new Error("Sign in to your farmer account to load live harvests.");
      }
      await loadLiveHarvestsForSession(session);
    }
  }

  async function add(
    harvest: Omit<
      Harvest,
      "id" | "status" | "farmerId" | "reviewedBy" | "reviewedAt" | "reviewNotes" | "createdAt"
    >,
  ): Promise<Harvest> {
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

  const activeHarvests = mode === "live" ? liveHarvests : demoHarvests;
  const activeReady = mode === "live" ? authReady && liveReady : demoReady;
  const activeError = mode === "live" ? liveError : demoError;

  return (
    <Store.Provider
      value={{
        mode,
        setMode,
        harvests: activeHarvests,
        ready: activeReady,
        error: activeError,
        add,
        refreshHarvests,
        session,
        profile,
        authReady,
        authError,
        signIn,
        signUp,
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
