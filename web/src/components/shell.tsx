"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { type RoleType } from "../lib/demo";
import { usePortalAuth } from "../lib/portal-auth";
import { Icon } from "./icon";

function getRoleNavigation(role: RoleType) {
  if (role === "market") {
    return [
      { href: "/dashboard", label: "Dashboard", icon: "grid" as const },
      {
        href: "/processor-requests",
        label: "Post Demand",
        icon: "requests" as const,
      },
      {
        href: "/supply-pooling",
        label: "Farmer Offers",
        icon: "layers" as const,
      },
      {
        href: "/transactions",
        label: "Deliveries & Receipts",
        icon: "swap" as const,
      },
      {
        href: "/harvest-exchange",
        label: "Town Supply Board",
        icon: "leaf" as const,
      },
      {
        href: "/ai-value-add",
        label: "Processing Analysis",
        icon: "spark" as const,
      },
    ];
  }
  if (role === "admin") {
    return [
      { href: "/dashboard", label: "Dashboard", icon: "grid" as const },
      {
        href: "/transactions",
        label: "Users & Verification",
        icon: "swap" as const,
      },
      {
        href: "/harvest-exchange",
        label: "Harvests & Town Supply",
        icon: "leaf" as const,
      },
      {
        href: "/supply-pooling",
        label: "Supply & Batch Pooling",
        icon: "layers" as const,
      },
      {
        href: "/processor-requests",
        label: "Market Demands",
        icon: "requests" as const,
      },
      {
        href: "/ai-value-add",
        label: "Reports & Facilities",
        icon: "spark" as const,
      },
    ];
  }
  // Default: Farmer
  return [
    { href: "/dashboard", label: "Home", icon: "grid" as const },
    {
      href: "/harvest-exchange",
      label: "My Harvest Listings",
      icon: "leaf" as const,
    },
    {
      href: "/supply-pooling",
      label: "Find Markets & Allocate",
      icon: "layers" as const,
    },
    {
      href: "/transactions",
      label: "My Deliveries & Audit",
      icon: "swap" as const,
    },
    {
      href: "/ai-value-add",
      label: "Profit Calculator & Guides",
      icon: "spark" as const,
    },
    {
      href: "/processor-requests",
      label: "Market Demands",
      icon: "requests" as const,
    },
  ];
}

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Icon name="leaf" size={24} />
      </span>
      <div>
        <strong>SMART-ANI</strong>
        <small>POST-HARVEST EXCHANGE</small>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    isConfigured,
    mode,
    setMode,
    session,
    profile,
    signOut,
    activeDemoRole,
    setActiveDemoRole,
    activeDemoMarketId,
    setActiveDemoMarketId,
    activeDemoMarket,
    demoAccounts,
    resetDemoWorkspace,
  } = usePortalAuth();

  const isLiveAuthenticated = mode === "live" && !!session && !!profile;
  const activeNavRole: RoleType = isLiveAuthenticated
    ? (profile.role as RoleType)
    : activeDemoRole;
  const currentNav = getRoleNavigation(activeNavRole);

  if (pathname === "/login" || pathname === "/admin/login") return <>{children}</>;
  const current =
    currentNav.find((item) => item.href === pathname)?.label ?? "Workspace";
  const marketAccounts = demoAccounts.filter((a) => a.role === "market");

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Link
            href="/dashboard"
            aria-label="SMART-ANI dashboard"
            onClick={() => setOpen(false)}
          >
            <Brand />
          </Link>
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="workspace-label">
          <span className="status-dot" />{" "}
          {isLiveAuthenticated
            ? `LIVE AGRI · ${profile.role.toUpperCase()}`
            : `MARINDUQUE · ROLE: ${activeDemoRole.toUpperCase()}`}
        </div>
        <p className="nav-label">DEMAND-DRIVEN WORKSPACE</p>
        <nav aria-label="Main navigation">
          {currentNav.map((item) => (
            <Link
              onClick={() => setOpen(false)}
              className={`nav-item ${pathname === item.href ? "active" : ""}`}
              href={item.href}
              key={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.icon === "spark" && <span className="soon-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mission-card">
            <Icon name="leaf" size={24} />
            <h3>Prevent Crop Spoilage</h3>
            <p>
              Connecting Farmers, verified Markets (Public Markets,
              Cooperatives, Food Processors), and Admins across Marinduque.
            </p>
            <span>TEAM 404: SLEEP NOT FOUND ↗</span>
          </div>
          {isLiveAuthenticated ? (
            <button
              type="button"
              className="profile-link"
              style={{
                width: "100%",
                background: "transparent",
                borderLeft: 0,
                borderRight: 0,
                borderBottom: 0,
                textAlign: "left",
              }}
              onClick={() => void handleSignOut()}
            >
              <span className="avatar">
                {profile.role.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <strong>{profile.display_name}</strong>
                <small>
                  {profile.role} · {profile.municipality} (Sign out)
                </small>
              </span>
              <Icon name="logout" size={18} />
            </button>
          ) : (
            <Link className="profile-link" href="/login">
              <span className="avatar">
                {activeDemoRole.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <strong>Demo workspace</strong>
                <small>
                  Active role: {activeDemoRole.toUpperCase()}
                </small>
              </span>
              <Icon name="logout" size={18} />
            </Link>
          )}
        </div>
      </aside>
      {open && (
        <button
          className="nav-backdrop"
          aria-label="Dismiss navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-column">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="breadcrumb">
              SMART-ANI <span>/</span> <strong>{current}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="location">
              <Icon name="pin" size={15} /> Marinduque, Philippines
            </span>
            {mode === "demo" && (
              <div
                className="topbar-role-controls"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <select
                  aria-label="Active workspace role"
                  value={activeDemoRole}
                  onChange={(e) =>
                    setActiveDemoRole(e.target.value as RoleType)
                  }
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "5px 9px",
                    borderRadius: 999,
                    border: "1px solid var(--maximum-green)",
                    background: "var(--surface-soft)",
                    color: "var(--bush)",
                  }}
                >
                  <option value="market">Role: MARKET</option>
                  <option value="farmer">Role: FARMER</option>
                  <option value="admin">Role: ADMIN (Verification & Coordination)</option>
                </select>
                {activeDemoRole === "market" && (
                  <select
                    aria-label="Active market account"
                    value={activeDemoMarketId}
                    onChange={(e) => setActiveDemoMarketId(e.target.value)}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "5px 9px",
                      borderRadius: 999,
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--bush)",
                      maxWidth: 220,
                    }}
                  >
                    {marketAccounts.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.organizationName} (
                        {m.marketVerificationStatus === "verified"
                          ? "✓ Verified"
                          : "◷ Pending"}
                        )
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {isConfigured && (
              <button
                type="button"
                className="demo-chip"
                onClick={() => setMode(mode === "live" ? "demo" : "live")}
                title="Switch between Live Supabase Mode and Demo Preview"
              >
                {mode === "live"
                  ? isLiveAuthenticated
                    ? `LIVE · ${profile.role.toUpperCase()}`
                    : "LIVE SUPABASE MODE"
                  : "DEMO PREVIEW (SWITCH TO LIVE)"}
              </button>
            )}
            {!isConfigured && <span className="demo-chip">DEMO PREVIEW</span>}
            <span className="avatar small">
              {isLiveAuthenticated
                ? profile.role.slice(0, 2).toUpperCase()
                : activeDemoRole.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <div
          className="demo-notice"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>
            <span className="status-dot" />{" "}
            {mode === "live"
              ? isLiveAuthenticated
                ? `LIVE SUPABASE MODE (Agri) · Signed in as ${profile.display_name} (${profile.role.toUpperCase()} · ${profile.municipality}). Database RLS and Admin/Market RPCs are active.`
                : "LIVE SUPABASE MODE (Agri) · Not signed in. Sign in on the Login page with a Farmer, Market, or Admin account, or switch to Demo Preview."
              : `SMART-ANI Interactive Demo Mode · Active Role: ${activeDemoRole.toUpperCase()}${
                  activeDemoRole === "market" && activeDemoMarket
                    ? ` (${activeDemoMarket.organizationName} · ${activeDemoMarket.marketVerificationStatus})`
                    : ""
                } · Live Supabase Agri records are isolated from demo mode.`}
          </span>
          {mode === "demo" && (
            <button
              type="button"
              onClick={resetDemoWorkspace}
              style={{
                background: "transparent",
                border: "1px solid var(--bright-nori)",
                borderRadius: 999,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--bush)",
                cursor: "pointer",
              }}
            >
              ↺ Reset Demo Scenario
            </button>
          )}
        </div>
        <main id="main-content">{children}</main>
        <footer>
          <strong>SMART-ANI</strong> <span>·</span> Agriculture & Food
          Innovation · Team 404: Sleep Not Found
          <span className="footer-end">
            B2B Post-Harvest Exchange & Value-Addition Platform in Marinduque
          </span>
        </footer>
      </div>
    </div>
  );
}
