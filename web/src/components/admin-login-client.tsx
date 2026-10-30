"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { usePortalAuth } from "../lib/portal-auth";
import { Icon } from "./icon";

export function AdminLoginClient() {
  const router = useRouter();
  const {
    isConfigured,
    mode,
    setMode,
    session,
    profile,
    authReady,
    authError,
    signIn,
    signOut,
    activeDemoRole,
    setActiveDemoRole,
  } = usePortalAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const isLiveAuthenticated = mode === "live" && !!session && !!profile;
  const isAdminAuthenticated =
    (isLiveAuthenticated && profile.role === "admin") ||
    (mode === "demo" && activeDemoRole === "admin");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    setNotice("");

    if (!email.trim() || !email.includes("@")) {
      setFormError("Enter a valid municipal administrator email.");
      return;
    }
    if (!password || password.length < 6) {
      setFormError("Enter your admin password (minimum 6 characters).");
      return;
    }

    setBusy(true);
    try {
      if (isConfigured && mode === "live") {
        const signedInProfile = await signIn(email.trim(), password);
        if (signedInProfile.role !== "admin") {
          // Strictly reject non-admin logins on this portal
          await signOut();
          throw new Error(
            `Access Denied: Account "${signedInProfile.display_name}" has role "${signedInProfile.role}". The Web Admin Portal is strictly restricted to Municipal Administrators. Farmers and Market buyers must use the SMART-ANI Mobile Application.`,
          );
        }
        setPassword("");
        setNotice(`Welcome, Administrator ${signedInProfile.display_name}. Redirecting...`);
        router.push("/transactions");
      } else {
        // In Demo mode
        setActiveDemoRole("admin");
        setPassword("");
        setNotice("Signed in as Provincial Agri Admin in Demo Mode. Redirecting to Admin Workspace...");
        router.push("/transactions");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Admin authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleInstantDemoAdmin() {
    setActiveDemoRole("admin");
    setMode("demo");
    setNotice("Switched to Provincial Agri Admin (Demo). Redirecting to verification dashboard...");
    setTimeout(() => {
      router.push("/transactions");
    }, 400);
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      setNotice("Signed out of administrator session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
      {/* Brand & Eyebrow */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "var(--surface-celery, #eef4e8)",
            padding: "6px 14px",
            borderRadius: 999,
            marginBottom: 12,
            border: "1px solid var(--venus-flytrap, #94b54f)",
          }}
        >
          <Icon name="swap" size={16} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "var(--bush, #0b2e17)",
              letterSpacing: "0.5px",
            }}
          >
            MUNICIPAL ADMIN & COORDINATOR ACCESS
          </span>
        </div>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "var(--bush, #0b2e17)",
            margin: "0 0 6px 0",
          }}
        >
          Admin Portal Login
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--muted, #5c705e)",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Provincial harvest verification, market buyer approval, and fraud prevention
          for Marinduque municipalities.
        </p>
      </div>

      {/* Pre-provisioned Policy Warning */}
      <div
        style={{
          backgroundColor: "#FEFCE8",
          borderRadius: 12,
          padding: 14,
          border: "1px solid #EAB308",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18 }}>🛡️</span>
          <div>
            <strong
              style={{
                display: "block",
                fontSize: 12,
                color: "#854D0E",
                letterSpacing: "0.5px",
              }}
            >
              PRE-PROVISIONED ACCOUNTS ONLY
            </strong>
            <p
              style={{
                fontSize: 12,
                color: "#713F12",
                margin: "4px 0 0 0",
                lineHeight: 1.5,
              }}
            >
              Notice: Admin accounts are pre-provisioned by municipal authority.
              Public self-registration is strictly disabled to protect agricultural integrity.
            </p>
          </div>
        </div>
      </div>

      {/* Already logged in card */}
      {isAdminAuthenticated && (
        <div
          style={{
            backgroundColor: "var(--surface-soft, #eef5eb)",
            borderRadius: 12,
            padding: 18,
            border: "1px solid var(--maximum-green, #5d912f)",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "var(--bright-nori, #2d6320)",
                  letterSpacing: "0.5px",
                }}
              >
                ACTIVE ADMIN SESSION
              </span>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "var(--bush, #0b2e17)",
                  margin: "4px 0 0 0",
                }}
              >
                {isLiveAuthenticated ? profile.display_name : "Provincial Agri Admin"}
              </h3>
              <p style={{ fontSize: 12, color: "var(--muted, #5c705e)", margin: "2px 0 0 0" }}>
                Mode: {mode.toUpperCase()} · Role: ADMIN (Authorized)
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={busy}
              style={{
                backgroundColor: "#FEE2E2",
                color: "#DC2626",
                border: "1px solid #FCA5A5",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Log Out
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            <Link
              href="/transactions"
              style={{
                display: "block",
                textAlign: "center",
                backgroundColor: "var(--bush, #0b2e17)",
                color: "#fff",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Open Admin Dashboard & Market Verification →
            </Link>
          </div>
        </div>
      )}

      {/* Notifications */}
      {!!(formError || authError) && (
        <div
          style={{
            backgroundColor: "#FEE2E2",
            borderRadius: 10,
            padding: 14,
            border: "1px solid #F87171",
            color: "#B91C1C",
            fontSize: 13,
            lineHeight: 1.4,
            marginBottom: 16,
          }}
        >
          <strong>⚠️ {formError || authError}</strong>
        </div>
      )}

      {!!notice && (
        <div
          style={{
            backgroundColor: "#DCFCE7",
            borderRadius: 10,
            padding: 14,
            border: "1px solid #4ADE80",
            color: "#15803D",
            fontSize: 13,
            lineHeight: 1.4,
            marginBottom: 16,
          }}
        >
          {notice}
        </div>
      )}

      {/* Login Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          padding: 24,
          border: "1.5px solid var(--line, #e2e8f0)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div>
          <label
            htmlFor="admin-email"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--bush, #0b2e17)",
              marginBottom: 6,
            }}
          >
            Municipal Admin Email Address
          </label>
          <input
            id="admin-email"
            type="email"
            placeholder="admin.provincial@marinduque.ph"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1.5px solid var(--maximum-green, #5d912f)",
              fontSize: 14,
              color: "var(--bush, #0b2e17)",
              backgroundColor: "#FAFCF8",
            }}
          />
        </div>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <label
              htmlFor="admin-password"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--bush, #0b2e17)",
              }}
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: "none",
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--bright-nori, #2d6320)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1.5px solid var(--maximum-green, #5d912f)",
              fontSize: 14,
              color: "var(--bush, #0b2e17)",
              backgroundColor: "#FAFCF8",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={busy || !authReady}
          style={{
            backgroundColor: "var(--bush, #0b2e17)",
            color: "#fff",
            borderRadius: 8,
            padding: "14px 20px",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.5px",
            border: "none",
            cursor: "pointer",
            marginTop: 4,
            opacity: busy || !authReady ? 0.6 : 1,
          }}
        >
          {busy ? "Verifying Admin Credentials..." : "Log In as Administrator →"}
        </button>

        {/* Quick Evaluator Access */}
        <div
          style={{
            marginTop: 10,
            paddingTop: 16,
            borderTop: "1px solid var(--line, #e2e8f0)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--bush, #0b2e17)",
              letterSpacing: "0.8px",
              marginBottom: 6,
            }}
          >
            ⚡ FAST EVALUATOR DEMO ACCESS
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted, #5c705e)",
              margin: "0 0 10px 0",
              lineHeight: 1.4,
            }}
          >
            One-click bypass to evaluate Admin verification tools and municipal supply oversight:
          </p>
          <button
            type="button"
            onClick={handleInstantDemoAdmin}
            style={{
              width: "100%",
              backgroundColor: "var(--surface-celery, #eef4e8)",
              border: "1.5px solid var(--bright-nori, #2d6320)",
              borderRadius: 8,
              padding: "12px 16px",
              color: "var(--bush, #0b2e17)",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            ⚡ Instant Demo: Provincial Agri Admin (Marinduque)
          </button>
        </div>
      </form>

      {/* Role Navigation Footer */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 12,
          backgroundColor: "#fff",
          border: "1px solid var(--line, #e2e8f0)",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--muted, #5c705e)",
          }}
        >
          Looking for Farmer or Market login?
        </span>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 12 }}>
          <Link
            href="/login"
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "var(--bright-nori, #2d6320)",
              textDecoration: "underline",
            }}
          >
            General Web Login / Demo Selector
          </Link>
          <span style={{ color: "var(--line, #cbd5e1)" }}>•</span>
          <span
            style={{
              fontSize: 12,
              color: "var(--muted, #5c705e)",
            }}
          >
            Mobile App for Farmers & Markets
          </span>
        </div>
      </div>
    </div>
  );
}
