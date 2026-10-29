"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { usePortalAuth } from "../lib/portal-auth";
import { supabaseConfig } from "../lib/supabase-config";
import { Icon } from "./icon";

export function LoginClient() {
  const router = useRouter();
  const {
    isConfigured,
    setMode,
    session,
    profile,
    authReady,
    authError,
    signIn,
    signOut,
  } = usePortalAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !isConfigured) return;
    setFormError("");
    setBusy(true);
    try {
      const signedInProfile = await signIn(email, password);
      setPassword("");
      if (
        signedInProfile.role === "coordinator" ||
        signedInProfile.role === "admin" ||
        signedInProfile.role === "processor"
      ) {
        router.push("/harvest-exchange");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-card">
      <span className="pill green">
        {isConfigured
          ? "PHASE 2B · LIVE SUPABASE & DEMO WORKSPACE"
          : "PHASE 1 · DEMO WORKSPACE"}
      </span>
      <h2>Welcome to SMART-ANI.</h2>
      <p>
        Municipal supply aggregation, harvest verification, and value-add
        decision support for Marinduque.
      </p>

      {isConfigured && session && profile ? (
        <div className="login-status">
          <Icon name="leaf" size={26} />
          <h3>
            Signed in as {profile.display_name} ({profile.role})
          </h3>
          <p>
            Municipality: <strong>{profile.municipality}</strong> · Email:{" "}
            {session.user.email}
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 14,
            }}
          >
            <Link
              href="/harvest-exchange"
              className="button"
              onClick={() => setMode("live")}
            >
              Continue to live Harvest Exchange <Icon name="arrow" size={18} />
            </Link>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void signOut()}
            >
              Sign out of Supabase Agri
            </button>
          </div>
        </div>
      ) : isConfigured ? (
        <form onSubmit={(e) => void handleSubmit(e)} style={{ marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Coordinator / Processor Email
              <span className="search-field" style={{ minWidth: "100%" }}>
                <input
                  type="email"
                  required
                  placeholder="coordinator@marinduque.gov.ph"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </span>
            </label>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Password
              <span className="search-field" style={{ minWidth: "100%" }}>
                <input
                  type="password"
                  required
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </span>
            </label>
          </div>

          {!!(formError || authError) && (
            <p
              role="alert"
              style={{
                color: "#942E24",
                background: "#FDF0EE",
                border: "1px solid #E8B9B3",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              {formError || authError}
            </p>
          )}

          <button
            type="submit"
            className="button"
            disabled={busy || !authReady}
            style={{ marginBottom: 12 }}
          >
            {busy ? "Signing in…" : "Sign in to live Supabase Agri"}{" "}
            <Icon name="arrow" size={18} />
          </button>
        </form>
      ) : (
        <div className="login-status">
          <Icon name="leaf" size={26} />
          <h3>Explore the coordinator & processor preview.</h3>
          <p>
            Live authentication is ready to activate once{" "}
            <code>web/.env.local</code> is configured for project{" "}
            <strong>Agri</strong>. Review the workspace with clearly labeled
            sample records for Boac, Mogpog, Santa Cruz, Torrijos, Buenavista,
            and Gasan.
          </p>
        </div>
      )}

      <Link
        href="/dashboard"
        className={isConfigured ? "button secondary" : "button"}
        onClick={() => setMode("demo")}
      >
        Open demo workspace <Icon name="arrow" size={18} />
      </Link>

      <p className="fine-print">
        {isConfigured
          ? "Role-based access (Coordinator, Processor, Farmer, Admin) is verified from public.profiles in Supabase Agri."
          : "No account is created and no credentials are collected in demo mode. Role-based Supabase authentication (Farmer, Processor, Coordinator) activates when .env.local is configured."}
      </p>
      <p
        className="fine-print"
        role={supabaseConfig.status === "invalid" ? "alert" : undefined}
      >
        Backend status: {supabaseConfig.message}
      </p>
    </div>
  );
}

