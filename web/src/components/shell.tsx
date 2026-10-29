"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { usePortalAuth } from "../lib/portal-auth";
import { Icon, type IconName } from "./icon";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/harvest-exchange", label: "Harvest Exchange", icon: "leaf" },
  { href: "/supply-pooling", label: "Supply Pooling", icon: "layers" },
  {
    href: "/processor-requests",
    label: "Processor Requests",
    icon: "requests",
  },
  { href: "/ai-value-add", label: "AI Value-Add Analysis", icon: "spark" },
  { href: "/transactions", label: "Transactions", icon: "swap" },
];

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
  const { isConfigured, mode, setMode, session, profile, signOut } =
    usePortalAuth();

  if (pathname === "/login") return <>{children}</>;
  const current =
    navigation.find((item) => item.href === pathname)?.label ?? "Workspace";

  const isLiveAuthenticated = mode === "live" && !!session && !!profile;

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
            : "MARINDUQUE · 6 MUNICIPALITIES"}
        </div>
        <p className="nav-label">MUNICIPAL WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
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
            <h3>From Surplus to Value-Add</h3>
            <p>
              Coordinating farmers, barangay coordinators, and processors across
              Marinduque.
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
              <span className="avatar">SA</span>
              <span>
                <strong>Demo workspace</strong>
                <small>Coordinator / processor preview</small>
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
                : "SA"}
            </span>
          </div>
        </header>
        <div className="demo-notice">
          <span className="status-dot" />{" "}
          {mode === "live"
            ? isLiveAuthenticated
              ? `LIVE SUPABASE MODE (Agri) · Signed in as ${profile.display_name} (${profile.role} · ${profile.municipality}). Database RLS and coordinator verification RPC are active.`
              : "LIVE SUPABASE MODE (Agri) · Not signed in. Sign in on the Login page with a Coordinator or Processor account, or switch to Demo Preview."
            : "SMART-ANI Phase 1 Demo · Sample records only. Live Supabase Agri records are isolated from demo mode."}
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
