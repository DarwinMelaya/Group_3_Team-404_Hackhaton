"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  marketTypeLabel,
  municipalities,
  type MarketType,
  type RoleType,
} from "../lib/demo";
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
    registerAccount,
    signOut,
    activeDemoRole,
    setActiveDemoRole,
    registerDemoMarketAccount,
  } = usePortalAuth();

  const [authTab, setAuthTab] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [regRole, setRegRole] = useState<"market" | "farmer">("market");
  const [displayName, setDisplayName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [marketType, setMarketType] = useState<MarketType>("public_market");
  const [municipality, setMunicipality] = useState("Boac");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [regNotice, setRegNotice] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !isConfigured) return;
    setFormError("");
    setRegNotice("");
    setBusy(true);
    try {
      if (authTab === "signin") {
        const signedInProfile = await signIn(email, password);
        setPassword("");
        if (signedInProfile.role === "admin") {
          router.push("/transactions");
        } else if (signedInProfile.role === "market") {
          router.push("/processor-requests");
        } else {
          router.push("/dashboard");
        }
      } else {
        const createdProfile = await registerAccount({
          email,
          password,
          role: regRole,
          displayName,
          municipality,
          organizationName:
            regRole === "market" ? organizationName || displayName : undefined,
          marketType: regRole === "market" ? marketType : undefined,
        });
        setPassword("");
        setRegNotice(
          createdProfile.role === "market"
            ? `Registered Market account (${createdProfile.organization_name ?? createdProfile.display_name}) with status: pending_verification. Admin verification is required before posting active demands.`
            : `Registered Farmer account (${createdProfile.display_name}).`,
        );
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleDemoMarketRegister(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setRegNotice("");
    try {
      const created = registerDemoMarketAccount({
        displayName,
        organizationName,
        marketType,
        municipality,
      });
      setActiveDemoRole("market");
      setRegNotice(
        `Registered Market "${created.organizationName}" (${marketTypeLabel(created.marketType)}) in Demo Mode with status: pending_verification. Switch to the Admin role to verify this Market account.`,
      );
      setDisplayName("");
      setOrganizationName("");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not register demo market.",
      );
    }
  }

  return (
    <div className="login-card">
      <span className="pill green">
        {isConfigured
          ? "LIVE SUPABASE & DEMO WORKSPACE · FARMER · MARKET · ADMIN"
          : "DEMAND-DRIVEN EXCHANGE · FARMER · MARKET · ADMIN"}
      </span>
      <h2>Welcome to SMART-ANI.</h2>
      <p>
        Demand-driven agricultural harvest distribution and post-harvest
        spoilage prevention across Marinduque — connecting{" "}
        <strong>Farmers</strong>, <strong>Markets</strong> (Public Markets,
        Cooperatives, Food Processors, Retailers), and <strong>Admins</strong>.
      </p>

      <div
        style={{
          backgroundColor: "var(--surface-celery, #eef4e8)",
          borderRadius: 12,
          padding: 14,
          border: "1.5px solid var(--venus-flytrap, #94b54f)",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ fontSize: 13, color: "var(--bush, #0b2e17)", display: "block" }}>
            🛡️ Municipal Administrator Login
          </strong>
          <span style={{ fontSize: 12, color: "var(--muted, #5c705e)" }}>
            Municipal officers & coordinators verify markets and audit allocations at /admin/login.
          </span>
        </div>
        <Link
          href="/admin/login"
          style={{
            backgroundColor: "var(--bush, #0b2e17)",
            color: "#fff",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Admin Login →
        </Link>
      </div>

      {isConfigured && session && profile ? (
        <div className="login-status">
          <Icon name="leaf" size={26} />
          <h3>
            Signed in as {profile.display_name} ({profile.role.toUpperCase()})
          </h3>
          <p>
            Municipality: <strong>{profile.municipality}</strong> · Email:{" "}
            {session.user.email}
            {profile.role === "market" && (
              <>
                {" "}
                · Verification:{" "}
                <strong>
                  {profile.market_verification_status ?? "pending_verification"}
                </strong>
              </>
            )}
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
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button
              type="button"
              className={
                authTab === "signin" ? "button" : "button secondary"
              }
              onClick={() => setAuthTab("signin")}
              style={{ flex: 1, justifyContent: "center" }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={
                authTab === "register" ? "button" : "button secondary"
              }
              onClick={() => setAuthTab("register")}
              style={{ flex: 1, justifyContent: "center" }}
            >
              Register Market / Farmer
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {authTab === "register" && (
              <>
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Account Role (Admin self-registration is blocked)
                  <select
                    value={regRole}
                    onChange={(e) =>
                      setRegRole(e.target.value as "market" | "farmer")
                    }
                  >
                    <option value="market">
                      Market (Public Market / Cooperative / Processor / Buyer)
                    </option>
                    <option value="farmer">Farmer (Crop Producer)</option>
                  </select>
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
                  Contact Person Name
                  <span className="search-field" style={{ minWidth: "100%" }}>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Elena Marasigan"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </span>
                </label>
                {regRole === "market" && (
                  <>
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      Market / Buyer Organization Name
                      <span
                        className="search-field"
                        style={{ minWidth: "100%" }}
                      >
                        <input
                          type="text"
                          required
                          placeholder="e.g. Boac Central Public Market"
                          value={organizationName}
                          onChange={(e) => setOrganizationName(e.target.value)}
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
                      Market Classification
                      <select
                        value={marketType}
                        onChange={(e) =>
                          setMarketType(e.target.value as MarketType)
                        }
                      >
                        <option value="public_market">Public Market</option>
                        <option value="cooperative">Cooperative</option>
                        <option value="food_processor">Food Processor</option>
                        <option value="wet_market_retailer">
                          Wet Market / Retailer
                        </option>
                        <option value="institutional_buyer">
                          Institutional Buyer
                        </option>
                      </select>
                    </label>
                  </>
                )}
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Municipality
                  <select
                    value={municipality}
                    onChange={(e) => setMunicipality(e.target.value)}
                  >
                    {municipalities.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Farmer / Market / Admin Email
              <span className="search-field" style={{ minWidth: "100%" }}>
                <input
                  type="email"
                  required
                  placeholder="market@marinduque.gov.ph"
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

          {!!regNotice && (
            <p
              role="status"
              style={{
                color: "var(--bush)",
                background: "var(--soft-celery)",
                border: "1px solid var(--bright-nori)",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              {regNotice}
            </p>
          )}

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
            {busy
              ? "Submitting…"
              : authTab === "signin"
                ? "Sign in to live Supabase Agri"
                : "Register account in Supabase Agri"}{" "}
            <Icon name="arrow" size={18} />
          </button>
        </form>
      ) : (
        <div className="login-status">
          <Icon name="leaf" size={26} />
          <h3>Explore the Farmer, Market & Admin workspace.</h3>
          <p>
            Select your active role below or register a sample Market account
            (defaults to <code>pending_verification</code> until approved by an
            Admin). Live authentication activates once{" "}
            <code>web/.env.local</code> is configured for project{" "}
            <strong>Agri</strong>.
          </p>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 12,
              marginBottom: 12,
            }}
          >
            {(["market", "farmer", "admin"] as RoleType[]).map((roleOption) => (
              <button
                key={roleOption}
                type="button"
                className={
                  activeDemoRole === roleOption ? "button" : "button secondary"
                }
                onClick={() => setActiveDemoRole(roleOption)}
                style={{ padding: "8px 14px", fontSize: 13 }}
              >
                Role: {roleOption.toUpperCase()}
              </button>
            ))}
          </div>

          <details style={{ marginTop: 10 }}>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                color: "var(--bush)",
              }}
            >
              + Register a new Market account (starts as pending_verification)
            </summary>
            <form
              onSubmit={handleDemoMarketRegister}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 10,
              }}
            >
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Contact Person Name
                <span className="search-field" style={{ minWidth: "100%" }}>
                  <input
                    type="text"
                    placeholder="e.g. Lorna Mendoza"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </span>
              </label>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Market / Cooperative / Processor Name
                <span className="search-field" style={{ minWidth: "100%" }}>
                  <input
                    type="text"
                    placeholder="e.g. Torrijos Public Market Stall 4"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                  />
                </span>
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  aria-label="Market classification"
                  value={marketType}
                  onChange={(e) => setMarketType(e.target.value as MarketType)}
                  style={{ flex: 1 }}
                >
                  <option value="public_market">Public Market</option>
                  <option value="cooperative">Cooperative</option>
                  <option value="food_processor">Food Processor</option>
                  <option value="wet_market_retailer">
                    Wet Market / Retailer
                  </option>
                  <option value="institutional_buyer">
                    Institutional Buyer
                  </option>
                </select>
                <select
                  aria-label="Market municipality"
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  style={{ flex: 1 }}
                >
                  {municipalities.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="button secondary"
                style={{ justifyContent: "center" }}
              >
                Register Market (pending_verification)
              </button>
            </form>
          </details>

          {!!regNotice && (
            <p
              role="status"
              style={{
                color: "var(--bush)",
                background: "var(--soft-celery)",
                border: "1px solid var(--bright-nori)",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                marginTop: 10,
              }}
            >
              {regNotice}
            </p>
          )}
          {!!formError && (
            <p
              role="alert"
              style={{
                color: "#942E24",
                background: "#FDF0EE",
                border: "1px solid #E8B9B3",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                marginTop: 10,
              }}
            >
              {formError}
            </p>
          )}
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
          ? "Role-based access (Farmer, Market, Admin) is verified from public.profiles in Supabase Agri. New Market accounts default to pending_verification."
          : "No credentials are collected in demo mode. Official 3-role architecture: Farmer, Market (Public Market, Cooperative, Food Processor, Retailer), and Admin."}
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
