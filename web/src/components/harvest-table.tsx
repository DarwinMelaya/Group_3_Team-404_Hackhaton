"use client";

import Link from "next/link";
import { useState } from "react";
import { evaluateDemoSpoilageUrgency, money, municipalities } from "../lib/demo";
import { usePortalAuth } from "../lib/portal-auth";
import { Icon } from "./icon";

function cropBadgeColor(crop: string): "yellow" | "sand" | "sage" | "peach" {
  if (crop.startsWith("Banana")) return "yellow";
  if (crop.startsWith("Arrowroot") || crop.startsWith("Coconut")) return "sand";
  if (crop.startsWith("Cassava") || crop.startsWith("Vegetables")) return "sage";
  return "peach";
}

function cropMarkText(crop: string): string {
  return crop.slice(0, 2).toUpperCase();
}

export function HarvestExchangePanel() {
  const { mode, activeDemoRole } = usePortalAuth();
  const isLive = mode === "live";

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            SURPLUS MARKETPLACE · ROLE: {activeDemoRole.toUpperCase()}
          </p>
          <h2>Available harvests</h2>
          <p className="muted">
            {isLive
              ? "Verified harvest listings from Supabase Agri (status = available). Admins can also review pending submissions above."
              : "Search by crop, farmer, barangay, or municipality across all 6 listings, and track Total, Allocated, Delivered, and Remaining kilograms."}
          </p>
        </div>
        <span className="demo-chip">
          {isLive ? "LIVE SUPABASE AGRI" : "DEMO DATA"}
        </span>
      </div>

      <div
        style={{
          background: "var(--surface-soft)",
          border: "1px solid var(--venus-flytrap)",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 12,
          color: "var(--bush)",
          margin: "0 24px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon name="spark" size={16} />
        <span>
          <strong>Freshness Advisory Notice:</strong> Estimated freshness
          windows are advisory planning calculations only —{" "}
          <u>never a guaranteed food safety expiration date</u>. Always inspect
          crops physically upon delivery.
        </span>
      </div>

      <HarvestTable />
      <div className="panel-note">
        {isLive
          ? "Live Supabase Mode is active. Farmer submissions start as pending_verification and appear in the marketplace only after an Admin approves them via review_harvest_listing."
          : "Demo Mode is active. Remaining harvest = Total harvest − Allocated (Offered + Reserved) − Confirmed Delivered. Switch to Supply Pooling to split-allocate 100 kg Banana across Market 1 (40 kg), Market 2 (35 kg), and Market 3 (25 kg)."}
      </div>
    </section>
  );
}

export function HarvestTable({ compact = false }: { compact?: boolean }) {
  const {
    mode,
    setMode,
    session,
    profile,
    liveHarvests,
    harvestsLoading,
    harvestsError,
    refreshLiveHarvests,
    reviewListing,
    activeDemoRole,
    demoHarvests,
    adminReviewDemoHarvest,
  } = usePortalAuth();

  const [search, setSearch] = useState("");
  const [municipality, setMunicipality] = useState("All municipalities");
  const [priority, setPriority] = useState("All priorities");

  const [notesByListing, setNotesByListing] = useState<Record<string, string>>(
    {},
  );
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState("");
  const [reviewError, setReviewError] = useState("");

  const isLive = mode === "live";
  const isAdminLive = profile?.role === "admin";

  async function handleAdminLiveDecision(
    listingId: string,
    decision: "available" | "rejected",
  ) {
    if (reviewingId) return;
    const notes = (notesByListing[listingId] ?? "").trim();
    if (decision === "rejected" && !notes) {
      setReviewError(
        "Please enter a review reason before rejecting a harvest listing.",
      );
      return;
    }

    setReviewingId(listingId);
    setReviewError("");
    setReviewNotice("");
    try {
      const updated = await reviewListing({
        listingId,
        decision,
        reviewNotes: notes,
      });
      setReviewNotice(
        decision === "available"
          ? `Approved & published ${updated.crop} (${updated.quantity_kg} kg in ${updated.municipality}) to the Harvest Exchange.`
          : `Rejected ${updated.crop} listing (${updated.municipality}) with Admin review notes.`,
      );
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Admin verification RPC failed.",
      );
    } finally {
      setReviewingId(null);
    }
  }

  function handleAdminDemoDecision(
    harvestId: string,
    decision: "available" | "rejected",
  ) {
    setReviewError("");
    setReviewNotice("");
    try {
      const updated = adminReviewDemoHarvest({
        harvestId,
        decision,
        notes:
          decision === "available"
            ? "Verified by Admin for market allocation."
            : "Rejected by Admin due to incomplete documentation.",
      });
      setReviewNotice(
        decision === "available"
          ? `Admin verified ${updated.crop} (${updated.quantity} kg by ${updated.farmer} in ${updated.municipality}).`
          : `Admin rejected ${updated.crop} (${updated.id}).`,
      );
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Could not review demo listing.",
      );
    }
  }

  // LIVE SUPABASE MODE: never display demo records as live records
  if (isLive) {
    if (!session || !profile) {
      return (
        <div className="empty-state">
          <span className="pill amber">
            LIVE SUPABASE MODE · SIGN-IN REQUIRED
          </span>
          <h3>Sign in to view live Supabase Agri harvest records.</h3>
          <p>
            Live database mode is active. Sign in with an Admin account to
            verify pending farmer submissions, or sign in with a Market or
            Farmer account to browse verified harvests. Demo records are never
            mixed with live records.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/login" className="button">
              Sign in to Supabase Agri <Icon name="arrow" size={17} />
            </Link>
            <button
              type="button"
              className="button secondary"
              onClick={() => setMode("demo")}
            >
              Switch to Demo Preview
            </button>
          </div>
        </div>
      );
    }

    const pendingListings = liveHarvests.filter(
      (item) => item.status === "pending_verification",
    );
    const rejectedListings = liveHarvests.filter(
      (item) => item.status === "rejected",
    );
    const publishedListings = liveHarvests.filter(
      (item) =>
        item.status === "available" ||
        item.status === "partially_allocated" ||
        item.status === "fully_allocated" ||
        item.status === "delivered",
    );

    const filteredLive = publishedListings.filter(
      (harvest) =>
        `${harvest.crop} ${harvest.municipality} ${harvest.barangay} ${harvest.storage_condition}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (municipality === "All municipalities" ||
          harvest.municipality === municipality) &&
        (priority === "All priorities" ||
          harvest.outreach_priority === "Priority"),
    );

    return (
      <>
        {!compact && isAdminLive && (
          <div
            style={{
              margin: "0 24px 24px",
              padding: 20,
              borderRadius: 14,
              background: "var(--surface-soft)",
              border: "1px solid var(--maximum-green)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <div>
                <p className="eyebrow">
                  AUTHORIZED ADMIN VERIFICATION QUEUE · RPC:
                  review_harvest_listing
                </p>
                <h3>
                  Pending Harvest Submissions ({pendingListings.length})
                </h3>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Inspect farmer submissions and approve (publishes as{" "}
                  <code>available</code>) or reject with review notes.
                </p>
              </div>
              <button
                type="button"
                className="button secondary"
                disabled={harvestsLoading}
                onClick={() => void refreshLiveHarvests()}
              >
                {harvestsLoading ? "Refreshing…" : "↻ Refresh queue"}
              </button>
            </div>

            {!!reviewNotice && (
              <p
                role="status"
                style={{
                  background: "var(--soft-celery)",
                  border: "1px solid var(--bright-nori)",
                  color: "var(--bush)",
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {reviewNotice}
              </p>
            )}

            {!!reviewError && (
              <p
                role="alert"
                style={{
                  background: "#FDF0EE",
                  border: "1px solid #E8B9B3",
                  color: "#942E24",
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {reviewError}
              </p>
            )}

            {pendingListings.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                No harvest listings are currently awaiting Admin verification.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {pendingListings.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 16, color: "var(--bush)" }}>
                          {item.crop} — {item.quantity_kg.toLocaleString()} kg @{" "}
                          {money(item.asking_price_php_per_kg)}/kg
                        </strong>
                        <p
                          className="muted"
                          style={{ fontSize: 12, marginTop: 3 }}
                        >
                          Location: <strong>{item.barangay}</strong>,{" "}
                          <strong>{item.municipality}</strong> · Harvested:{" "}
                          {item.harvest_date} · Storage:{" "}
                          {item.storage_condition}
                        </p>
                      </div>
                      <span className="pill amber">
                        ◷ pending_verification · {item.outreach_priority}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <label className="search-field" style={{ flex: 1 }}>
                        <input
                          aria-label={`Review notes for ${item.crop} in ${item.municipality}`}
                          placeholder="Review notes or rejection reason (required if rejecting)…"
                          value={notesByListing[item.id] ?? ""}
                          onChange={(e) =>
                            setNotesByListing((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          maxLength={1000}
                        />
                      </label>
                      <button
                        type="button"
                        className="button"
                        disabled={reviewingId === item.id}
                        onClick={() =>
                          void handleAdminLiveDecision(item.id, "available")
                        }
                      >
                        {reviewingId === item.id
                          ? "Saving…"
                          : "✓ Approve & Publish"}
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={reviewingId === item.id}
                        onClick={() =>
                          void handleAdminLiveDecision(item.id, "rejected")
                        }
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rejectedListings.length > 0 && (
              <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
                Rejected listings awaiting farmer correction:{" "}
                <strong>{rejectedListings.length}</strong>
              </p>
            )}
          </div>
        )}

        {!compact && (
          <div className="table-filters">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input
                aria-label="Search harvests"
                placeholder="Search crops, barangays, storage, or municipalities…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              aria-label="Municipality"
              value={municipality}
              onChange={(event) => setMunicipality(event.target.value)}
            >
              <option>All municipalities</option>
              {municipalities.map((place) => (
                <option key={place}>{place}</option>
              ))}
            </select>
            <select
              aria-label="Priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option>All priorities</option>
              <option>Priority outreach</option>
            </select>
          </div>
        )}

        {!!harvestsError && (
          <div className="empty-state" role="alert">
            <h3>Could not load live harvest listings</h3>
            <p>{harvestsError}</p>
            <button
              type="button"
              className="button secondary"
              onClick={() => void refreshLiveHarvests()}
            >
              Retry connection
            </button>
          </div>
        )}

        {harvestsLoading && !harvestsError && (
          <div className="empty-state">
            <h3>Loading live verified harvests from Supabase Agri…</h3>
          </div>
        )}

        {!harvestsLoading && !harvestsError && (
          <>
            <div className="table-scroll">
              <table>
                <caption className="sr-only">
                  SMART-ANI live verified harvest listings from Supabase Agri.
                </caption>
                <thead>
                  <tr>
                    <th>Crop / Listing</th>
                    <th>Municipality / Storage</th>
                    <th>Inventory (Total / Rem.)</th>
                    <th>Asking Price</th>
                    <th>Admin Verification</th>
                    <th>Outreach Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {(compact ? filteredLive.slice(0, 4) : filteredLive).map(
                    (harvest) => (
                      <tr key={harvest.id}>
                        <td>
                          <div className="crop-cell">
                            <span
                              className={`crop-mark ${cropBadgeColor(harvest.crop)}`}
                            >
                              {cropMarkText(harvest.crop)}
                            </span>
                            <span>
                              <strong>{harvest.crop}</strong>
                              <small>
                                {harvest.quality_grade ?? "Grade A"} · Harvested{" "}
                                {harvest.harvest_date}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <strong>{harvest.municipality}</strong>
                          <small className="table-subtext">
                            {harvest.barangay} · {harvest.storage_condition}
                          </small>
                        </td>
                        <td>
                          <strong>
                            {(
                              harvest.remaining_kg ?? harvest.quantity_kg
                            ).toLocaleString()}
                          </strong>{" "}
                          <span className="muted">
                            / {harvest.quantity_kg.toLocaleString()} kg
                          </span>
                        </td>
                        <td>
                          <strong>
                            {money(harvest.asking_price_php_per_kg)}
                          </strong>
                          <span className="muted"> / kg</span>
                        </td>
                        <td>
                          <span className="pill green">
                            ✓ Verified ({harvest.status})
                          </span>
                        </td>
                        <td>
                          <span
                            className={`pill ${
                              harvest.outreach_priority === "Priority"
                                ? "amber"
                                : "green"
                            }`}
                          >
                            {harvest.outreach_priority === "Priority"
                              ? "Priority outreach"
                              : "Standard"}
                          </span>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {filteredLive.length === 0 && (
              <div className="empty-state">
                <h3>No verified harvests match your filters.</h3>
                <p>
                  Only Admin-verified listings appear in the Harvest Exchange
                  marketplace.
                </p>
                {(search !== "" ||
                  municipality !== "All municipalities" ||
                  priority !== "All priorities") && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setSearch("");
                      setMunicipality("All municipalities");
                      setPriority("All priorities");
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </>
    );
  }

  // DEMO MODE: isolated sample listings with live multi-market inventory accounting
  const filteredDemo = demoHarvests.filter(
    (harvest) =>
      `${harvest.crop} ${harvest.farmer} ${harvest.municipality} ${harvest.barangay}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (municipality === "All municipalities" ||
        harvest.municipality === municipality) &&
      (priority === "All priorities" || harvest.priority),
  );
  return (
    <>
      {!compact && (
        <div className="table-filters">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="Search harvests"
              placeholder="Search crops, farmers, barangays, or municipalities…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Municipality"
            value={municipality}
            onChange={(event) => setMunicipality(event.target.value)}
          >
            <option>All municipalities</option>
            {municipalities.map((place) => (
              <option key={place}>{place}</option>
            ))}
          </select>
          <select
            aria-label="Priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option>All priorities</option>
            <option>Priority outreach</option>
          </select>
        </div>
      )}

      {!compact && !!reviewNotice && (
        <p
          role="status"
          style={{
            margin: "0 24px 12px",
            background: "var(--soft-celery)",
            border: "1px solid var(--bright-nori)",
            color: "var(--bush)",
            padding: "10px 14px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {reviewNotice}
        </p>
      )}
      {!compact && !!reviewError && (
        <p
          role="alert"
          style={{
            margin: "0 24px 12px",
            background: "#FDF0EE",
            border: "1px solid #E8B9B3",
            color: "#942E24",
            padding: "10px 14px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {reviewError}
        </p>
      )}

      <div className="table-scroll">
        <table>
          <caption className="sr-only">
            SMART-ANI demo harvest listings. Priority is farmer selected;
            verification and inventory columns track real-time demo allocations.
          </caption>
          <thead>
            <tr>
              <th>Crop / Grower</th>
              <th>Municipality / Storage</th>
              <th>Inventory (Rem. / Total)</th>
              <th>Asking Price</th>
              <th>Admin Verification</th>
              <th>Outreach Priority & Advisory</th>
            </tr>
          </thead>
          <tbody>
            {(compact ? filteredDemo.slice(0, 4) : filteredDemo).map(
              (harvest) => {
                const urgency = evaluateDemoSpoilageUrgency(harvest);
                return (
                  <tr key={harvest.id}>
                    <td>
                      <div className="crop-cell">
                        <span className={`crop-mark ${harvest.color}`}>
                          {harvest.mark}
                        </span>
                        <span>
                          <strong>{harvest.crop}</strong>
                          <small>
                            {harvest.farmer} · {harvest.variety} ·{" "}
                            {harvest.qualityGrade}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong>{harvest.municipality}</strong>
                      <small className="table-subtext">
                        {harvest.barangay} · {harvest.storage}
                      </small>
                      {harvest.gpsLocation && (
                        <small
                          style={{
                            display: "block",
                            fontSize: 10,
                            color: "var(--maximum-green)",
                            fontWeight: 700,
                            marginTop: 2,
                          }}
                        >
                          📍 GPS: {harvest.gpsLocation.latitude.toFixed(4)}° N,{" "}
                          {harvest.gpsLocation.longitude.toFixed(4)}° E
                        </small>
                      )}
                    </td>
                    <td>
                      <strong>{harvest.remainingKg.toLocaleString()}</strong>{" "}
                      <span className="muted">
                        / {harvest.quantity.toLocaleString()} kg
                      </span>
                      <small className="table-subtext">
                        Offered: {harvest.earmarkedKg} kg · Reserved:{" "}
                        {harvest.reservedKg} kg · Delivered:{" "}
                        {harvest.deliveredKg} kg
                      </small>
                    </td>
                    <td>
                      <strong>{money(harvest.price)}</strong>
                      <span className="muted"> / kg</span>
                    </td>
                    <td>
                      <span
                        className={`pill ${
                          harvest.verified ? "green" : "subtle"
                        }`}
                      >
                        {harvest.verified
                          ? "✓ Verified listing"
                          : "◷ Pending review"}
                      </span>
                      {!compact &&
                        activeDemoRole === "admin" &&
                        !harvest.verified && (
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              marginTop: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className="button"
                              style={{
                                padding: "4px 10px",
                                fontSize: 11,
                              }}
                              onClick={() =>
                                handleAdminDemoDecision(harvest.id, "available")
                              }
                            >
                              ✓ Approve {harvest.id}
                            </button>
                            <button
                              type="button"
                              className="button secondary"
                              style={{
                                padding: "4px 10px",
                                fontSize: 11,
                              }}
                              onClick={() =>
                                handleAdminDemoDecision(harvest.id, "rejected")
                              }
                            >
                              ✕ Reject
                            </button>
                          </div>
                        )}
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: 5,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <span
                          className={`pill ${harvest.priority ? "amber" : "green"}`}
                        >
                          {harvest.priority ? "Priority outreach" : "Standard"}
                        </span>
                        {urgency.level === "high" && (
                          <span
                            className="pill"
                            style={{
                              backgroundColor: urgency.badgeText.includes("CRITICAL") ? "#FDF0EE" : "#FEF7E6",
                              color: urgency.badgeText.includes("CRITICAL") ? "#B42318" : "#B54708",
                              border: `1px solid ${urgency.badgeText.includes("CRITICAL") ? "#FDA29B" : "#FEDF89"}`,
                              fontSize: 10,
                              fontWeight: 800,
                            }}
                          >
                            {urgency.badgeText.includes("CRITICAL") ? "⚠️ " : "◷ "}
                            {urgency.badgeText}
                          </span>
                        )}
                      </div>
                      <small className="table-subtext">{urgency.label}</small>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
      {filteredDemo.length === 0 && (
        <div className="empty-state">
          <h3>No harvests match your filters.</h3>
          <p>Try a different crop or municipality.</p>
          <button
            className="button secondary"
            onClick={() => {
              setSearch("");
              setMunicipality("All municipalities");
              setPriority("All priorities");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="table-foot">
        <span>
          Showing{" "}
          {compact ? Math.min(filteredDemo.length, 4) : filteredDemo.length} of{" "}
          {demoHarvests.length} sample listings
        </span>
        <span>
          Spoilage urgency is advisory · Remaining stock updates automatically
          on offer, reservation, and delivery confirmation
        </span>
      </div>
    </>
  );
}
