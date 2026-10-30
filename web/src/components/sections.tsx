"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  MEASUREMENT_UNITS,
  evaluateDemoSpoilageUrgency,
  farmingGuides,
  generateSmsReply,
  initialDemoBatchPools,
  marketTypeLabel,
  money,
  municipalities,
  offlineFaqs,
  parseSmsCommand,
  processingFacilities,
  unitLabel,
  valueAddScenarios,
  type BuyingType,
  type DemoBatchPool,
  type MeasurementUnit,
  type QualityGrade,
} from "../lib/demo";
import { usePortalAuth } from "../lib/portal-auth";
import { sections, type Section } from "../lib/sections";
import { HarvestExchangePanel } from "./harvest-table";
import { Icon } from "./icon";

export function SectionContent({
  section,
}: {
  section: Exclude<Section, "dashboard">;
}) {
  const info = sections[section];
  const {
    activeDemoRole,
    setActiveDemoRole,
    activeDemoMarketId,
    setActiveDemoMarketId,
    activeDemoMarket,
    demoHarvests,
    demoDemands,
    demoAllocations,
    demoAccounts,
    demoAuditLogs,
    createDemoMarketDemand,
    updateDemoDemandStatus,
    allocateDemoHarvestToMarket,
    respondDemoAllocation,
    markDemoInDelivery,
    confirmDemoDelivery,
    cancelOrResolveDemoAllocation,
    adminVerifyDemoMarket,
    adminResolveLegacyAccount,
  } = usePortalAuth();

  // State for Market Demand 5-Step Guided Creation (processor-requests)
  const [demandStep, setDemandStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [demandCrop, setDemandCrop] = useState("Banana");
  const [demandBuyingType, setDemandBuyingType] =
    useState<BuyingType>("per_unit");
  const [demandUnit, setDemandUnit] = useState<MeasurementUnit>("kg");
  const [demandQty, setDemandQty] = useState("40");
  const [demandExpectedKg, setDemandExpectedKg] = useState("");
  const [demandGrade, setDemandGrade] = useState<QualityGrade>("Grade A");
  const [demandPrice, setDemandPrice] = useState("28");
  const [demandMunicipality, setDemandMunicipality] = useState("Boac");
  const [demandLocation, setDemandLocation] = useState(
    "Boac Public Market Receiving Bay",
  );
  const [demandDate, setDemandDate] = useState("2026-11-02");
  const [demandAcceptPartial, setDemandAcceptPartial] = useState(true);
  const [demandNote, setDemandNote] = useState("");
  const [demandFeedback, setDemandFeedback] = useState("");
  const [demandError, setDemandError] = useState("");

  // Presets for quick 1-click test scenarios
  function applyDemandPreset(preset: {
    crop: string;
    buyingType: BuyingType;
    unit: MeasurementUnit;
    qty: string;
    price: string;
    expectedKg?: string;
    location: string;
    municipality: string;
    acceptPartial: boolean;
    note: string;
  }) {
    setDemandCrop(preset.crop);
    setDemandBuyingType(preset.buyingType);
    setDemandUnit(preset.unit);
    setDemandQty(preset.qty);
    setDemandPrice(preset.price);
    setDemandExpectedKg(preset.expectedKg ?? "");
    setDemandLocation(preset.location);
    setDemandMunicipality(preset.municipality);
    setDemandAcceptPartial(preset.acceptPartial);
    setDemandNote(preset.note);
    setDemandStep(4); // jump to price/delivery step so user can review immediately
  }

  // State for Farmer Split Allocation & Market Offer Acceptance (supply-pooling)
  const [selectedHarvestId, setSelectedHarvestId] = useState("SA-001");
  const [selectedDemandId, setSelectedDemandId] = useState("MKT-DEM-01");
  const [offerQty, setOfferQty] = useState("40");
  const [conversionRatio, setConversionRatio] = useState("50"); // default for package-to-kg
  const [offerNotes, setOfferNotes] = useState("");
  const [poolFeedback, setPoolFeedback] = useState("");
  const [poolError, setPoolError] = useState("");

  // State for Delivery Confirmation & Admin Controls (transactions)
  const [receivedKgByAlloc, setReceivedKgByAlloc] = useState<
    Record<string, string>
  >({});
  const [cancelReasonByAlloc, setCancelReasonByAlloc] = useState<
    Record<string, string>
  >({});
  const [txFeedback, setTxFeedback] = useState("");
  const [txError, setTxError] = useState("");

  // State for interactive Value-Add simulator (ai-value-add)
  const [simInputKg, setSimInputKg] = useState(100);
  const [simRawPrice, setSimRawPrice] = useState(25);
  const [simYieldPct, setSimYieldPct] = useState(35);
  const [simProcessedPrice, setSimProcessedPrice] = useState(160);
  const [simProcCost, setSimProcCost] = useState(1900);
  const [activeValueAddCrop, setActiveValueAddCrop] = useState<
    "Banana" | "Arrowroot / Uraro" | "Cassava" | "Coconut"
  >("Banana");

  // Tabs for Supply Pooling
  const [poolingTab, setPoolingTab] = useState<
    "split_allocation" | "town_supply_board" | "batch_pooling"
  >("split_allocation");
  const [batchPools, setBatchPools] =
    useState<DemoBatchPool[]>(initialDemoBatchPools);
  const [newPoolCrop, setNewPoolCrop] = useState("Banana");
  const [newPoolMunicipality, setNewPoolMunicipality] = useState("Santa Cruz");
  const [newPoolTargetMarket, setNewPoolTargetMarket] = useState(
    "Market 3 · Santa Cruz Banana Chips Hub",
  );
  const [newPoolFeedback, setNewPoolFeedback] = useState("");

  // Tabs for AI Value-Add & Facilities & Knowledge Base
  const [valueAddTab, setValueAddTab] = useState<
    "calculator" | "facilities" | "farming_guide"
  >("calculator");
  const [facilityMunFilter, setFacilityMunFilter] = useState("All");
  const [facilityCropFilter, setFacilityCropFilter] = useState("All");

  // State for SMS Fallback Simulator (transactions)
  const [smsCommandInput, setSmsCommandInput] = useState(
    "ANI BANANA 100 KG 25 SANTACRUZ ALOBO",
  );
  const [smsConversation, setSmsConversation] = useState<
    { from: "farmer" | "gateway"; text: string; time: string }[]
  >([
    {
      from: "farmer",
      text: "ANI BANANA 100 KG 25 SANTACRUZ ALOBO",
      time: "10:14 AM",
    },
    {
      from: "gateway",
      text: "SMART-ANI: Matagumpay na naitala! Batch #SA-261 (100 kg Banana @ ₱25/kg) sa Brgy. Alobo, Santa Cruz. Ipinagbigay-alam sa Village Coordinator para sa verification at matching.",
      time: "10:14 AM",
    },
  ]);
  const [smsFeedback, setSmsFeedback] = useState("");

  function applyValueAddPreset(
    crop: "Banana" | "Arrowroot / Uraro" | "Cassava" | "Coconut",
  ) {
    setActiveValueAddCrop(crop);
    switch (crop) {
      case "Banana":
        setSimInputKg(100);
        setSimRawPrice(25);
        setSimYieldPct(35);
        setSimProcessedPrice(160);
        setSimProcCost(1900);
        break;
      case "Arrowroot / Uraro":
        setSimInputKg(100);
        setSimRawPrice(35);
        setSimYieldPct(20);
        setSimProcessedPrice(340);
        setSimProcCost(1800);
        break;
      case "Cassava":
        setSimInputKg(200);
        setSimRawPrice(16);
        setSimYieldPct(25);
        setSimProcessedPrice(110);
        setSimProcCost(1300);
        break;
      case "Coconut":
        setSimInputKg(120);
        setSimRawPrice(12);
        setSimYieldPct(8);
        setSimProcessedPrice(450);
        setSimProcCost(1100);
        break;
    }
  }

  function handleCreateBatchPool(e: FormEvent) {
    e.preventDefault();
    setNewPoolFeedback("");
    const compatibleHarvests = demoHarvests.filter(
      (h) =>
        h.crop.toLowerCase().includes(newPoolCrop.toLowerCase()) &&
        h.municipality === newPoolMunicipality &&
        h.remainingKg > 0,
    );
    const totalKg = compatibleHarvests.reduce((sum, h) => sum + h.remainingKg, 0);
    const poolCode = `BATCH-${newPoolMunicipality.slice(0, 2).toUpperCase()}-${newPoolCrop.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-3)}`;

    const newPool: DemoBatchPool = {
      id: `POOL-${Date.now()}`,
      batchCode: poolCode,
      crop: newPoolCrop,
      qualityGrade: "Grade A",
      municipality: newPoolMunicipality,
      totalPooledKg: totalKg > 0 ? totalKg : 100,
      farmerCount: compatibleHarvests.length > 0 ? compatibleHarvests.length : 2,
      participatingHarvestIds: compatibleHarvests.map((h) => h.id),
      farmerNames: compatibleHarvests.length > 0 ? compatibleHarvests.map((h) => h.farmer) : ["Kuya Dante", "Ka Ramon"],
      status: "open_for_bidding",
      targetMarket: newPoolTargetMarket,
      coordinatorName: activeDemoRole === "admin" ? "Maria Santos (Village Coordinator / Admin)" : "Village Agricultural Coordinator",
      createdAt: new Date().toISOString().slice(0, 10),
      notes: `Pooled ${totalKg > 0 ? totalKg : 100} kg of compatible ${newPoolCrop} across smallholder farms in ${newPoolMunicipality}.`,
    };

    setBatchPools([newPool, ...batchPools]);
    setNewPoolFeedback(
      `✓ Matagumpay na nilikha ang pinagsamang batch ${newPool.batchCode} (${newPool.totalPooledKg} kg ${newPool.crop}) para sa ${newPool.targetMarket}!`,
    );
  }

  function handleSendSms(e: FormEvent) {
    e.preventDefault();
    if (!smsCommandInput.trim()) return;
    const commandText = smsCommandInput.trim();
    const parsed = parseSmsCommand(commandText);
    const replyText = generateSmsReply(parsed);
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setSmsConversation((prev) => [
      ...prev,
      { from: "farmer", text: commandText, time: now },
      { from: "gateway", text: replyText, time: now },
    ]);
    setSmsFeedback(
      parsed.valid
        ? `✓ Naipadala at nasagot ng SMART-ANI Gateway (${parsed.type})!`
        : `⚠️ Maling format: ${parsed.error}`,
    );
  }

  const selectedHarvest =
    demoHarvests.find((h) => h.id === selectedHarvestId) ?? demoHarvests[0];
  const selectedDemand =
    demoDemands.find((d) => d.id === selectedDemandId) ?? demoDemands[0];

  function handlePostDemand(e: FormEvent) {
    e.preventDefault();
    setDemandError("");
    setDemandFeedback("");
    try {
      const qtyNum = Number(demandQty);
      const priceNum = Number(demandPrice);
      const isBulk = demandBuyingType === "bulk_lot";
      const expectedKgNum = demandExpectedKg.trim()
        ? Number(demandExpectedKg)
        : undefined;

      const created = createDemoMarketDemand({
        crop: demandCrop,
        requiredQuantityKg: qtyNum,
        unit: demandUnit,
        buyingType: demandBuyingType,
        unitPricePhp: isBulk ? undefined : priceNum,
        totalPricePhp: isBulk
          ? priceNum
          : Number((qtyNum * priceNum).toFixed(2)),
        expectedKgPerUnit: expectedKgNum,
        preferredQualityGrade: demandGrade,
        offeredPricePerKg: isBulk
          ? Number((priceNum / (qtyNum || 1)).toFixed(2))
          : demandUnit === "kg"
            ? priceNum
            : Number((priceNum / (expectedKgNum ?? 1)).toFixed(2)),
        municipality: demandMunicipality,
        deliveryLocation: demandLocation,
        storage: "Ambient ventilated crate",
        requiredDeliveryDate: demandDate,
        acceptPartial: demandAcceptPartial,
        note: demandNote,
      });
      setDemandFeedback(
        `Matagumpay na naipost ang pangangailangan ${created.id}: ${created.requiredQuantityKg} ${unitLabel(created.unit)} ${created.crop} para sa ${created.marketName} (${isBulk ? `₱${priceNum} buong lote` : `₱${priceNum}/${unitLabel(created.unit)}`}).`,
      );
      setDemandStep(1);
      setDemandNote("");
    } catch (err) {
      setDemandError(
        err instanceof Error ? err.message : "Could not post market demand.",
      );
    }
  }

  function handleAllocateSubmit(e: FormEvent) {
    e.preventDefault();
    setPoolError("");
    setPoolFeedback("");
    try {
      const harvestUnit = selectedHarvest?.unit ?? "kg";
      const demandUnit = selectedDemand?.unit ?? "kg";
      const unitsDiffer = harvestUnit !== demandUnit;

      const created = allocateDemoHarvestToMarket({
        harvestId: selectedHarvestId,
        demandId: selectedDemandId,
        quantityKg: Number(offerQty),
        conversionRatioToKg: unitsDiffer ? Number(conversionRatio) : undefined,
        notes: offerNotes,
      });
      setPoolFeedback(
        `Nai-alok ang ${created.allocatedKg} ${unitLabel(created.unit)} ${created.crop} mula sa ${created.harvestId} (${created.farmerName}) papunta sa ${created.marketName} (${created.demandId}). Katayuan: offered.`,
      );
      setOfferNotes("");
    } catch (err) {
      setPoolError(
        err instanceof Error ? err.message : "Could not allocate harvest.",
      );
    }
  }

  function handleQuickAllocate(
    harvestId: string,
    demandId: string,
    quantityKg: number,
  ) {
    setPoolError("");
    setPoolFeedback("");
    try {
      const created = allocateDemoHarvestToMarket({
        harvestId,
        demandId,
        quantityKg,
      });
      setPoolFeedback(
        `Nai-alok ang ${created.allocatedKg} ${unitLabel(created.unit)} ${created.crop} mula sa ${created.harvestId} papunta sa ${created.marketName} (${created.demandId}).`,
      );
    } catch (err) {
      setPoolError(
        err instanceof Error ? err.message : "Quick allocation failed.",
      );
    }
  }

  function handleMarketResponse(
    allocationId: string,
    decision: "reserved" | "rejected",
  ) {
    setPoolError("");
    setPoolFeedback("");
    try {
      const updated = respondDemoAllocation({
        allocationId,
        decision,
      });
      setPoolFeedback(
        decision === "reserved"
          ? `${updated.marketName} accepted & reserved ${updated.allocatedKg} kg ${updated.crop} (${updated.id}).`
          : `${updated.marketName} rejected ${updated.id}; ${updated.allocatedKg} kg released back to farmer remaining stock.`,
      );
    } catch (err) {
      setPoolError(
        err instanceof Error ? err.message : "Could not respond to offer.",
      );
    }
  }

  function handleConfirmDelivery(
    allocationId: string,
    defaultRemainingKg: number,
    finalizeShort = false,
  ) {
    setTxError("");
    setTxFeedback("");
    try {
      const rawVal = receivedKgByAlloc[allocationId];
      const receivedKg =
        rawVal !== undefined && rawVal.trim() !== ""
          ? Number(rawVal)
          : defaultRemainingKg;
      const updated = confirmDemoDelivery({
        allocationId,
        receivedKg,
        finalizeShort,
      });
      setTxFeedback(
        `Confirmed delivery of ${receivedKg} kg ${updated.crop} for ${updated.marketName} (${updated.id} → status: ${updated.status}, cumulative delivered: ${updated.deliveredKg} kg).`,
      );
      setReceivedKgByAlloc((prev) => ({ ...prev, [allocationId]: "" }));
    } catch (err) {
      setTxError(
        err instanceof Error ? err.message : "Could not confirm delivery.",
      );
    }
  }

  function handleCancelOrDispute(allocationId: string, isDispute = false) {
    setTxError("");
    setTxFeedback("");
    try {
      const reason =
        (cancelReasonByAlloc[allocationId] ?? "").trim() ||
        (isDispute
          ? "Admin dispute resolution: released undelivered balance."
          : "Cancelled before final delivery; undelivered stock released.");
      const updated = cancelOrResolveDemoAllocation({
        allocationId,
        reason,
        isDispute,
      });
      setTxFeedback(
        `Resolved ${updated.id} (status: ${updated.status}). Undelivered remainder released back to farmer inventory and market demand.`,
      );
    } catch (err) {
      setTxError(
        err instanceof Error ? err.message : "Could not cancel allocation.",
      );
    }
  }

  function handleAdminMarketVerification(
    accountId: string,
    decision: "verified" | "rejected",
  ) {
    setTxError("");
    setTxFeedback("");
    try {
      const updated = adminVerifyDemoMarket({
        accountId,
        decision,
      });
      setTxFeedback(
        `Admin updated Market "${updated.organizationName}" verification status to: ${updated.marketVerificationStatus}.`,
      );
    } catch (err) {
      setTxError(
        err instanceof Error ? err.message : "Market verification failed.",
      );
    }
  }

  function handleAdminLegacyResolution(
    accountId: string,
    decision: "approve_as_farmer" | "approve_as_market" | "keep_deactivated",
  ) {
    setTxError("");
    setTxFeedback("");
    try {
      const updated = adminResolveLegacyAccount({
        accountId,
        decision,
        notes: `Admin reviewed quarantined legacy account and applied ${decision}.`,
      });
      setTxFeedback(
        `Resolved legacy account ${updated.displayName}: role=${updated.role}, status=${updated.accountStatus}.`,
      );
    } catch (err) {
      setTxError(
        err instanceof Error ? err.message : "Legacy resolution failed.",
      );
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            SMART-ANI · MARINDUQUE, PHILIPPINES · ROLE:{" "}
            {activeDemoRole.toUpperCase()}
          </p>
          <h1>{info.title}</h1>
          <p>{info.description}</p>
        </div>
        <span className="pill green">
          Active Role: {activeDemoRole.toUpperCase()}
        </span>
      </div>

      {section === "harvest-exchange" && (
        <>
          <div className="info-banner">
            <Icon name="leaf" />
            <p>
              <strong>Verification, Inventory & Spoilage Guide:</strong>{" "}
              <em>Admin verified</em> indicates listings approved for market
              allocation. Each row tracks{" "}
              <strong>
                Remaining / Total kg (Offered, Reserved, Delivered)
              </strong>{" "}
              with zero double-counting, while <em>Priority outreach</em> is an
              advisory farmer preference (not a food-safety guarantee).
            </p>
          </div>
          <HarvestExchangePanel />
        </>
      )}

      {section === "supply-pooling" && (
        <>
          <div className="info-banner">
            <Icon name="layers" />
            <p>
              <strong>
                Paghahati-hati ng Ani sa Iba&apos;t Ibang Pamilihan (Multi-Market
                Harvest Distribution):
              </strong>{" "}
              Ang magsasaka na may <strong>100 kg ng Saging (SA-001)</strong> ay
              maaaring mag-alok ng <strong>40 kg sa Market 1</strong>,{" "}
              <strong>35 kg sa Market 2</strong>, at{" "}
              <strong>25 kg sa Market 3</strong>. Ligtas ang bawat transaksyon:
              hindi kailanman magiging doble ang bawas sa imbentaryo, at may
              suporta para sa per-kilo, sako, kahon, buwig, at pakyawan / bulk
              lot!
            </p>
          </div>

          {!!poolFeedback && (
            <p
              role="status"
              style={{
                background: "var(--soft-celery)",
                border: "1px solid var(--bright-nori)",
                color: "var(--bush)",
                padding: "12px 16px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {poolFeedback}
            </p>
          )}

          {!!poolError && (
            <p
              role="alert"
              style={{
                background: "#FDF0EE",
                border: "1px solid #E8B9B3",
                color: "#942E24",
                padding: "12px 16px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {poolError}
            </p>
          )}

          {/* Sub-navigation for Supply Pooling */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className={`button ${poolingTab === "split_allocation" ? "" : "secondary"}`}
              style={{ padding: "8px 16px", fontSize: 13 }}
              onClick={() => setPoolingTab("split_allocation")}
            >
              1. Multi-Market Split Allocation (100 kg → 40+35+25 kg)
            </button>
            <button
              type="button"
              className={`button ${poolingTab === "town_supply_board" ? "" : "secondary"}`}
              style={{ padding: "8px 16px", fontSize: 13 }}
              onClick={() => setPoolingTab("town_supply_board")}
            >
              2. Town Supply Board (Municipal Aggregation)
            </button>
            <button
              type="button"
              className={`button ${poolingTab === "batch_pooling" ? "" : "secondary"}`}
              style={{ padding: "8px 16px", fontSize: 13 }}
              onClick={() => setPoolingTab("batch_pooling")}
            >
              3. Harvest Batch Pooling (Village Coordinator)
            </button>
          </div>

          {poolingTab === "split_allocation" && (
            <>
              {/* Farmer Split-Allocation Control Panel */}
              <section className="panel" style={{ padding: 24, marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <div>
                <p className="eyebrow">
                  HAKBANG 1 · PAMAMAHAGI NG ANI SA MGA PAMILIHAN (SPLIT ALLOCATION)
                </p>
                <h2>Aking Ani at Pamamahagi (My Harvest & Split Allocation)</h2>
                <p className="muted">
                  Piliin ang iyong na-verify na ani at ipamahagi sa isa o higit
                  pang mga pamilihang naghahanap ng pananim.
                </p>
              </div>
              {selectedHarvest && (
                <div
                  style={{
                    background: "var(--surface-soft)",
                    border: "1px solid var(--maximum-green)",
                    borderRadius: 12,
                    padding: "10px 16px",
                    fontSize: 13,
                  }}
                >
                  <strong>
                    {selectedHarvest.id} ({selectedHarvest.crop} ·{" "}
                    {selectedHarvest.farmer})
                  </strong>
                  <div>
                    Kabuuang Dami:{" "}
                    <strong>
                      {selectedHarvest.quantity}{" "}
                      {unitLabel(selectedHarvest.unit)}
                    </strong>{" "}
                    · Inialok:{" "}
                    <strong>
                      {selectedHarvest.earmarkedKg}{" "}
                      {unitLabel(selectedHarvest.unit)}
                    </strong>{" "}
                    · Nakalaan:{" "}
                    <strong>
                      {selectedHarvest.reservedKg}{" "}
                      {unitLabel(selectedHarvest.unit)}
                    </strong>{" "}
                    · Naihatid:{" "}
                    <strong>
                      {selectedHarvest.deliveredKg}{" "}
                      {unitLabel(selectedHarvest.unit)}
                    </strong>{" "}
                    ·{" "}
                    <span style={{ color: "var(--bright-nori)" }}>
                      Natitirang Ani (Remaining Crops):{" "}
                      <strong data-testid="selected-harvest-remaining-kg">
                        {selectedHarvest.remainingKg}{" "}
                        {unitLabel(selectedHarvest.unit)}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick 1-click buttons for the 100 kg -> 40 + 35 + 25 kg Banana scenario */}
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 18,
              }}
            >
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  handleQuickAllocate("SA-001", "MKT-DEM-01", 40)
                }
              >
                ⚡ 1-Click Offer: 40 kg Saging → Market 1 (Boac)
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  handleQuickAllocate("SA-001", "MKT-DEM-02", 35)
                }
              >
                ⚡ 1-Click Offer: 35 kg Saging → Market 2 (Mogpog)
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  handleQuickAllocate("SA-001", "MKT-DEM-03", 25)
                }
              >
                ⚡ 1-Click Offer: 25 kg Saging → Market 3 (Santa Cruz)
              </button>
            </div>

            <form
              onSubmit={handleAllocateSubmit}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 12,
                alignItems: "end",
              }}
            >
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Aking Ani (My Harvest Listing)
                <select
                  aria-label="Farmer harvest listing"
                  value={selectedHarvestId}
                  onChange={(e) => setSelectedHarvestId(e.target.value)}
                >
                  {demoHarvests.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.id} · {h.crop} ({h.farmer}) — {h.remainingKg}/
                      {h.quantity} {unitLabel(h.unit)} natitira
                    </option>
                  ))}
                </select>
              </label>

              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Mga Pamilihang Nangangailangan (Market Demand)
                <select
                  aria-label="Target market demand"
                  value={selectedDemandId}
                  onChange={(e) => setSelectedDemandId(e.target.value)}
                >
                  {demoDemands.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · {d.marketName} ({d.crop}) — {d.remainingDemandKg}
                      /{d.requiredQuantityKg} {unitLabel(d.unit)} kailangan (
                      {d.buyingType === "bulk_lot"
                        ? `₱${d.totalPricePhp ?? d.offeredPricePerKg} pakyawan`
                        : `₱${d.unitPricePhp ?? d.offeredPricePerKg}/${unitLabel(d.unit)}`}
                      )
                    </option>
                  ))}
                </select>
              </label>

              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Dami na Iaalok (Offer Quantity in{" "}
                {unitLabel(selectedDemand?.unit)})
                <span className="search-field" style={{ minWidth: "100%" }}>
                  <input
                    aria-label="Allocation quantity (kg)"
                    type="number"
                    step="0.01"
                    value={offerQty}
                    onChange={(e) => setOfferQty(e.target.value)}
                    placeholder={`Hal. 40 ${unitLabel(selectedDemand?.unit)}`}
                  />
                </span>
              </label>

              {/* Explicit conversion box when farmer harvest unit differs from market demand unit */}
              {selectedHarvest?.unit &&
                selectedDemand?.unit &&
                selectedHarvest.unit !== selectedDemand.unit && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      background: "var(--surface-soft)",
                      border: "1px solid var(--maximum-green)",
                      borderRadius: 10,
                      padding: 12,
                      marginTop: 4,
                    }}
                  >
                    <p
                      style={{
                        fontWeight: 700,
                        margin: 0,
                        color: "var(--bush)",
                        fontSize: 13,
                      }}
                    >
                      ⚖️ Napagkasunduang Conversion Factor (Unit Conversion):
                    </p>
                    <p
                      style={{
                        fontSize: 13,
                        margin: "4px 0 8px",
                        color: "var(--muted)",
                      }}
                    >
                      Ang iyong imbentaryo ay nasa{" "}
                      <strong>{unitLabel(selectedHarvest.unit)}</strong> ngunit
                      ang pamilihan ay humihiling ng{" "}
                      <strong>{unitLabel(selectedDemand.unit)}</strong>.
                      Hindi namin hulaan ang timbang; pakisaad ang napagkasunduang
                      timbang sa bawat yunit:
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        Ilang kilo (kg) bawat{" "}
                        {unitLabel(
                          selectedDemand.unit === "kg"
                            ? selectedHarvest.unit
                            : selectedDemand.unit,
                        )}
                        :
                        <input
                          type="number"
                          step="0.1"
                          value={conversionRatio}
                          onChange={(e) => setConversionRatio(e.target.value)}
                          style={{
                            width: 85,
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid var(--line)",
                          }}
                        />
                      </label>
                      {Number(conversionRatio) > 0 && Number(offerQty) > 0 && (
                        <span
                          style={{
                            fontSize: 13,
                            color: "var(--bright-nori)",
                            fontWeight: 700,
                          }}
                        >
                          → Mababawas sa iyong imbentaryo:{" "}
                          <strong>
                            {selectedHarvest.unit === "kg"
                              ? (
                                  Number(offerQty) * Number(conversionRatio)
                                ).toFixed(2)
                              : (
                                  Number(offerQty) / Number(conversionRatio)
                                ).toFixed(2)}{" "}
                            {unitLabel(selectedHarvest.unit)}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                )}

              <button
                type="submit"
                className="button"
                style={{ justifyContent: "center" }}
              >
                Magpadala ng Alok (Send Offer) <Icon name="arrow" size={16} />
              </button>
            </form>
          </section>

          {/* Step 2: Market Offers & Reservations Queue */}
          <section className="panel" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <p className="eyebrow">
                HAKBANG 2 · PAGTANGGAP AT PAGPAPATIBAY NG PAMILIHAN (RESERVATION)
              </p>
              <h2>
                Mga Alok at Reserbasyon (Offers & Reservations:{" "}
                {demoAllocations.length})
              </h2>
              <p className="muted">
                Sinusuri ng pamilihan ang mga alok ng magsasaka at tatanggapin
                (status = reserved) o tatanggihan (ibabalik ang dami sa
                natitirang ani ng magsasaka nang walang bawas).
              </p>
            </div>

            {demoAllocations.length === 0 ? (
              <p className="muted">
                Wala pang naipapadalang alok mula sa magsasaka. Gamitin ang form
                o 1-click buttons sa itaas upang mag-alok ng saging sa Market 1,
                Market 2, at Market 3.
              </p>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {demoAllocations.map((alloc) => (
                  <div
                    key={alloc.id}
                    data-testid={`allocation-card-${alloc.id}`}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: 16,
                      background: "var(--surface)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <strong>
                          {alloc.id}: {alloc.allocatedKg}{" "}
                          {unitLabel(alloc.unit)} {alloc.crop} (
                          {alloc.qualityGrade})
                        </strong>
                        <span
                          className={`pill ${
                            alloc.status === "reserved" ||
                            alloc.status === "delivered"
                              ? "green"
                              : alloc.status === "offered" ||
                                  alloc.status === "partially_delivered" ||
                                  alloc.status === "in_delivery"
                                ? "amber"
                                : "subtle"
                          }`}
                        >
                          Katayuan: {alloc.status}
                        </span>
                        {alloc.buyingType === "bulk_lot" && (
                          <span className="pill subtle">Pakyawan / Bulk Lot</span>
                        )}
                      </div>
                      <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        Mula: <strong>{alloc.farmerName}</strong> (
                        {alloc.harvestId} · {alloc.farmerMunicipality}) → Papunta:{" "}
                        <strong>{alloc.marketName}</strong> ({alloc.demandId} ·{" "}
                        {alloc.marketMunicipality}) · Presyo:{" "}
                        <strong>
                          {alloc.buyingType === "bulk_lot"
                            ? `${money(alloc.totalAgreedPrice ?? alloc.agreedPricePerKg)} kabuuan`
                            : `${money(alloc.agreedPricePerKg)}/${unitLabel(alloc.unit)}`}
                        </strong>{" "}
                        · Naihatid:{" "}
                        <strong>
                          {alloc.deliveredKg} {unitLabel(alloc.unit)}
                        </strong>
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {alloc.status === "offered" && (
                        <>
                          <button
                            type="button"
                            className="button"
                            onClick={() =>
                              handleMarketResponse(alloc.id, "reserved")
                            }
                          >
                            ✓ Tanggapin & Ireserba ({alloc.allocatedKg}{" "}
                            {unitLabel(alloc.unit)})
                          </button>
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() =>
                              handleMarketResponse(alloc.id, "rejected")
                            }
                          >
                            ✕ Tanggihan ang Alok
                          </button>
                        </>
                      )}
                      {(alloc.status === "reserved" ||
                        alloc.status === "in_delivery" ||
                        alloc.status === "partially_delivered") && (
                        <Link href="/transactions" className="button secondary">
                          Kumpirmahin ang Paghahatid →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Market Demand Cards with Multi-Farmer Coverage */}
          <div className="cards-grid">
            {demoDemands.map((request) => {
              const matchingAllocations = demoAllocations.filter(
                (a) =>
                  a.demandId === request.id &&
                  a.status !== "rejected" &&
                  a.status !== "cancelled",
              );
              const coveredKg =
                request.reservedQuantityKg + request.fulfilledQuantityKg;
              const pct = Math.round(
                Math.min(coveredKg / request.requiredQuantityKg, 1) * 100,
              );
              return (
                <article
                  className="panel opportunity-card"
                  key={request.id}
                  data-testid={`demand-card-${request.id}`}
                >
                  <div className="card-top-row">
                    <span className="pill green">
                      {marketTypeLabel(request.marketType).toUpperCase()}
                    </span>
                    <span className="eyebrow">{request.id}</span>
                  </div>
                  <h2>
                    {request.crop} — {request.requiredQuantityKg}{" "}
                    {unitLabel(request.unit)}
                  </h2>
                  <p>
                    <strong>{request.marketName}</strong> ·{" "}
                    <Icon name="pin" size={15} /> {request.municipality}
                  </p>
                  <div className="coverage">
                    <strong>
                      {request.remainingDemandKg.toLocaleString()}{" "}
                      <small>{unitLabel(request.unit)} natitirang kailangan</small>
                    </strong>
                    <span>
                      Nakalaan: {request.reservedQuantityKg}{" "}
                      {unitLabel(request.unit)} · Naihatid:{" "}
                      {request.fulfilledQuantityKg} {unitLabel(request.unit)} (
                      {pct}% natugunan)
                    </span>
                  </div>
                  <div className="bar-track large">
                    <div
                      style={{
                        width: `${Math.min(
                          (coveredKg / request.requiredQuantityKg) * 100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="muted">
                    Presyo:{" "}
                    <strong>
                      {request.buyingType === "bulk_lot"
                        ? `${money(request.totalPricePhp ?? request.offeredPricePerKg)} pakyawan (bulk lot)`
                        : `${money(request.unitPricePhp ?? request.offeredPricePerKg)}/${unitLabel(request.unit)}`}
                    </strong>{" "}
                    · Kalidad: <strong>{request.preferredQualityGrade}</strong>{" "}
                    · Partial:{" "}
                    <strong>{request.acceptPartial ? "Oo" : "Hindi"}</strong>
                  </p>

                  <div className="card-divider" />

                  <div className="contributors-box">
                    <span className="contributors-title">
                      Alok ng mga magsasaka ({matchingAllocations.length}):
                    </span>
                    {matchingAllocations.length === 0 ? (
                      <p className="muted" style={{ fontSize: 12 }}>
                        Wala pang alok sa kasalukuyan.
                      </p>
                    ) : (
                      matchingAllocations.map((item) => (
                        <div className="contributor-row" key={item.id}>
                          <span>
                            {item.farmerName} ({item.status})
                          </span>
                          <strong>
                            {item.allocatedKg} {unitLabel(item.unit)} (deliv:{" "}
                            {item.deliveredKg} {unitLabel(item.unit)})
                          </strong>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              );
            })}
          </div>
            </>
          )}

          {poolingTab === "town_supply_board" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <section className="panel" style={{ padding: 24 }}>
                <div style={{ marginBottom: 16 }}>
                  <p className="eyebrow">
                    MARINDUQUE MUNICIPAL SUPPLY AGGREGATION BOARD (6 MUNICIPALITIES)
                  </p>
                  <h2>Town Supply Board & Aggregated Harvests</h2>
                  <p className="muted">
                    Consolidated view of verified agricultural surplus and harvesting schedules across Boac, Mogpog, Santa Cruz, Torrijos, Buenavista, and Gasan.
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                    marginBottom: 24,
                  }}
                >
                  {municipalities.map((mun) => {
                    const munHarvests = demoHarvests.filter((h) => h.municipality === mun);
                    const totalKg = munHarvests.reduce((sum, h) => sum + h.quantity, 0);
                    const remainingKg = munHarvests.reduce((sum, h) => sum + h.remainingKg, 0);
                    const verifiedCount = munHarvests.filter((h) => h.verified).length;
                    const cropsList = Array.from(new Set(munHarvests.map((h) => h.crop))).join(", ");

                    return (
                      <div
                        key={mun}
                        style={{
                          background: "var(--surface-soft)",
                          border: "1px solid var(--line)",
                          borderRadius: 12,
                          padding: 14,
                        }}
                      >
                        <strong style={{ fontSize: 16, color: "var(--bush)", display: "block" }}>
                          {mun}
                        </strong>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 8px" }}>
                          {cropsList || "No active listings"}
                        </p>
                        <div style={{ fontSize: 13 }}>
                          <strong>{remainingKg.toLocaleString()} kg</strong>{" "}
                          <span className="muted">/ {totalKg} kg total</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 11, color: "var(--bright-nori)", fontWeight: 700 }}>
                          ✓ {verifiedCount} verified listing{verifiedCount === 1 ? "" : "s"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Bayan / Farm Location & GPS</th>
                        <th>Pananim at Kalidad</th>
                        <th>Magsasaka / Outreach</th>
                        <th>Kabuuang Dami & Natitira</th>
                        <th>Iskedyul ng Ani & Imbakan</th>
                        <th>Freshness Spoilage Advisory</th>
                        <th>Status / Verification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demoHarvests.map((item) => {
                        const urgency = evaluateDemoSpoilageUrgency(item);
                        return (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.municipality}</strong>
                              <small className="table-subtext">{item.barangay}</small>
                              {item.gpsLocation && (
                                <small
                                  style={{
                                    display: "block",
                                    fontSize: 10,
                                    color: "var(--maximum-green)",
                                    fontWeight: 700,
                                    marginTop: 2,
                                  }}
                                >
                                  📍 {item.gpsLocation.latitude.toFixed(4)}° N, {item.gpsLocation.longitude.toFixed(4)}° E
                                </small>
                              )}
                            </td>
                            <td>
                              <strong>{item.crop}</strong>
                              <small className="table-subtext">{item.variety} · {item.qualityGrade}</small>
                            </td>
                            <td>
                              <strong>{item.farmer}</strong>
                              <span className={`pill ${item.priority ? "amber" : "subtle"}`} style={{ fontSize: 10, marginTop: 4, display: "inline-block" }}>
                                {item.priority ? "Priority Outreach" : "Standard"}
                              </span>
                            </td>
                            <td>
                              <strong>{item.remainingKg} kg natitira</strong>
                              <small className="table-subtext">out of {item.quantity} kg total ({money(item.price)}/kg)</small>
                            </td>
                            <td>
                              <span>{item.harvestSchedule ?? "Single harvest"}</span>
                              <small className="table-subtext">Storage: {item.storage} ({item.storageTempC ? `${item.storageTempC}°C` : "ambient"})</small>
                            </td>
                            <td>
                              <span
                                className="pill"
                                style={{
                                  backgroundColor: urgency.badgeText.includes("CRITICAL") ? "#FDF0EE" : urgency.level === "high" ? "#FEF7E6" : "var(--surface-soft)",
                                  color: urgency.badgeText.includes("CRITICAL") ? "#B42318" : urgency.level === "high" ? "#B54708" : "var(--bush)",
                                  fontSize: 10,
                                  fontWeight: 800,
                                }}
                              >
                                {urgency.badgeText}
                              </span>
                              <small className="table-subtext" style={{ fontSize: 10 }}>{urgency.label}</small>
                            </td>
                            <td>
                              <span className={`pill ${item.verified ? "green" : "amber"}`}>
                                {item.verified ? "✓ Verified" : "◷ Pending"}
                              </span>
                              {item.coordinatorName && (
                                <small style={{ display: "block", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                                  Assisted: {item.coordinatorName}
                                </small>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {poolingTab === "batch_pooling" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <section className="panel" style={{ padding: 24 }}>
                <div style={{ marginBottom: 16 }}>
                  <p className="eyebrow">
                    VILLAGE COORDINATOR & ADMIN TOOL · HARVEST BATCH POOLING
                  </p>
                  <h2>Combine Compatible Smallholder Farmer Batches</h2>
                  <p className="muted">
                    Village Coordinators aggregate small harvests from multiple local growers (e.g., 40 kg Kuya Dante + 35 kg Ka Ramon) into a single unified lot to meet wholesale and food processor purchase minimums.
                  </p>
                </div>

                {!!newPoolFeedback && (
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
                      marginBottom: 16,
                    }}
                  >
                    {newPoolFeedback}
                  </p>
                )}

                <form
                  onSubmit={handleCreateBatchPool}
                  style={{
                    background: "var(--surface-soft)",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: 16,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 12,
                    alignItems: "end",
                    marginBottom: 24,
                  }}
                >
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Pananim (Crop to Pool)
                    <select
                      value={newPoolCrop}
                      onChange={(e) => setNewPoolCrop(e.target.value)}
                      style={{ width: "100%", padding: 8, borderRadius: 8, marginTop: 4 }}
                    >
                      <option value="Banana">Banana (Saba)</option>
                      <option value="Cassava">Cassava</option>
                      <option value="Arrowroot / Uraro">Arrowroot / Uraro</option>
                      <option value="Coconut">Coconut</option>
                      <option value="Sweet Potato / Camote">Camote</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Bayan (Municipality)
                    <select
                      value={newPoolMunicipality}
                      onChange={(e) => setNewPoolMunicipality(e.target.value)}
                      style={{ width: "100%", padding: 8, borderRadius: 8, marginTop: 4 }}
                    >
                      {municipalities.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Target Market Buyer
                    <select
                      value={newPoolTargetMarket}
                      onChange={(e) => setNewPoolTargetMarket(e.target.value)}
                      style={{ width: "100%", padding: 8, borderRadius: 8, marginTop: 4 }}
                    >
                      {demoDemands.map((d) => (
                        <option key={d.id} value={`${d.marketName} (${d.requiredQuantityKg} kg needed)`}>
                          {d.marketName} — {d.crop} ({d.remainingDemandKg} kg needed)
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="button"
                    style={{ height: 40 }}
                  >
                    + Pagsamahin ang Batch (Create Pool)
                  </button>
                </form>

                <h3 style={{ fontSize: 16, marginBottom: 12, color: "var(--bush)" }}>
                  Mga Aktibong Pinagsamang Batch ({batchPools.length})
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                  {batchPools.map((pool) => (
                    <article
                      key={pool.id}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div>
                          <span className="pill green" style={{ fontSize: 10 }}>{pool.batchCode}</span>
                          <strong style={{ display: "block", fontSize: 16, marginTop: 4, color: "var(--bush)" }}>
                            {pool.crop} — {pool.totalPooledKg} kg
                          </strong>
                        </div>
                        <span className="pill subtle" style={{ fontSize: 10 }}>
                          {pool.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0" }}>
                        Bayan: <strong>{pool.municipality}</strong> · Quality: <strong>{pool.qualityGrade}</strong>
                      </p>
                      <p style={{ fontSize: 12, color: "var(--bush)" }}>
                        {pool.notes}
                      </p>
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--muted)" }}>
                        <div>Mga Magsasaka: <strong>{pool.farmerNames.join(", ")}</strong> ({pool.farmerCount} growers)</div>
                        <div style={{ marginTop: 2 }}>Coordinator: <strong>{pool.coordinatorName}</strong></div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {section === "processor-requests" && (
        <>
          <div className="info-banner">
            <Icon name="requests" />
            <p>
              <strong>Market Demand Posting & Multi-Farmer Fulfillment:</strong>{" "}
              Verified Markets (Public Markets, Cooperatives, Food Processors,
              Retailers) post their required crop quantities, quality grades,
              and offered prices.{" "}
              <strong>
                Unverified Markets are strictly blocked from posting active
                demands until verified by an Admin.
              </strong>
            </p>
          </div>

          {!!demandFeedback && (
            <p
              role="status"
              style={{
                background: "var(--soft-celery)",
                border: "1px solid var(--bright-nori)",
                color: "var(--bush)",
                padding: "12px 16px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {demandFeedback}
            </p>
          )}

          {!!demandError && (
            <p
              role="alert"
              style={{
                background: "#FDF0EE",
                border: "1px solid #E8B9B3",
                color: "#942E24",
                padding: "12px 16px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {demandError}
            </p>
          )}

          {/* 5-Step Guided Market Demand Wizard */}
          <section className="panel" style={{ padding: 24, marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <div>
                <p className="eyebrow">
                  5-STEP GUIDED MARKET DEMAND POSTING ENGINE
                </p>
                <h2>Mag-post ng Pangangailangan sa Pananim (Market Demand)</h2>
                <p className="muted">
                  Kasalukuyang Pamilihan:{" "}
                  <strong>
                    {activeDemoMarket?.organizationName ?? "Pumili ng Pamilihan"}
                  </strong>{" "}
                  (Katayuan:{" "}
                  <code>
                    {activeDemoMarket?.marketVerificationStatus ?? "unknown"}
                  </code>
                  )
                </p>
              </div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Pumili ng Account ng Pamilihan:{" "}
                <select
                  aria-label="Posting market account"
                  value={activeDemoMarketId}
                  onChange={(e) => setActiveDemoMarketId(e.target.value)}
                >
                  {demoAccounts
                    .filter((a) => a.role === "market")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.organizationName} ({m.marketVerificationStatus})
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {/* Quick 1-Click Presets for Rapid Evaluation */}
            <div style={{ marginBottom: 18 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--muted)",
                  marginRight: 8,
                }}
              >
                Mabilisang Halimbawa (1-Click Presets):
              </span>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={() =>
                    applyDemandPreset({
                      crop: "Banana",
                      buyingType: "per_unit",
                      unit: "kg",
                      qty: "40",
                      price: "30",
                      location: "Boac Public Market Stall 12",
                      municipality: "Boac",
                      acceptPartial: true,
                      note: "40 kg Saba Banana @ ₱30/kg",
                    })
                  }
                >
                  🍌 40 kg Saging @ ₱30/kg
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={() =>
                    applyDemandPreset({
                      crop: "Cassava",
                      buyingType: "per_unit",
                      unit: "sack",
                      qty: "2",
                      price: "800",
                      expectedKg: "50",
                      location: "Mogpog Processing Facility",
                      municipality: "Mogpog",
                      acceptPartial: false,
                      note: "2 sako Kamoteng Kahoy @ ₱800 bawat sako (~50kg/sako)",
                    })
                  }
                >
                  🥔 2 sako Cassava @ ₱800/sako
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={() =>
                    applyDemandPreset({
                      crop: "Vegetables",
                      buyingType: "per_unit",
                      unit: "crate",
                      qty: "3",
                      price: "500",
                      expectedKg: "25",
                      location: "Santa Cruz Wholesale Bay",
                      municipality: "Santa Cruz",
                      acceptPartial: true,
                      note: "3 kahon Gulay @ ₱500 bawat kahon (~25kg/kahon)",
                    })
                  }
                >
                  🥬 3 kahon Gulay @ ₱500/kahon
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={() =>
                    applyDemandPreset({
                      crop: "Banana",
                      buyingType: "per_unit",
                      unit: "bunch",
                      qty: "20",
                      price: "60",
                      expectedKg: "5",
                      location: "Torrijos Farmers Corner",
                      municipality: "Torrijos",
                      acceptPartial: true,
                      note: "20 buwig Saging @ ₱60 bawat buwig",
                    })
                  }
                >
                  🍌 20 buwig Saging @ ₱60/buwig
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={() =>
                    applyDemandPreset({
                      crop: "Banana",
                      buyingType: "bulk_lot",
                      unit: "lot",
                      qty: "1",
                      price: "2500",
                      location: "Gasan Agri Hub",
                      municipality: "Gasan",
                      acceptPartial: false,
                      note: "1 buong lote @ ₱2,500 pakyawan",
                    })
                  }
                >
                  📦 1 buong lote @ ₱2,500 pakyawan
                </button>
              </div>
            </div>

            {/* Stepper Navigation Tabs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 8,
                marginBottom: 20,
              }}
            >
              {[
                { step: 1, label: "1. Pananim (Crop)" },
                { step: 2, label: "2. Paraan (Type)" },
                { step: 3, label: "3. Dami (Qty & Unit)" },
                { step: 4, label: "4. Presyo (Pricing)" },
                { step: 5, label: "5. Suriin (Review)" },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setDemandStep(s.step as 1 | 2 | 3 | 4 | 5)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    border:
                      demandStep === s.step
                        ? "2px solid var(--maximum-green)"
                        : "1px solid var(--line)",
                    background:
                      demandStep === s.step
                        ? "var(--surface-soft)"
                        : "var(--surface)",
                    color:
                      demandStep === s.step ? "var(--bush)" : "var(--muted)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <form onSubmit={handlePostDemand}>
              {/* STEP 1: Crop Selection */}
              {demandStep === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <h3 style={{ margin: "0 0 6px" }}>
                      Hakbang 1: Piliin ang Pananim (Select Crop)
                    </h3>
                    <p className="muted" style={{ margin: 0 }}>
                      Anong uri ng ani ang kailangan ng iyong pamilihan o pasilidad?
                    </p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {[
                      { name: "Arrowroot / Uraro", tag: "Uraro Rhizomes", isPriority: true },
                      { name: "Cassava", tag: "Kamoteng Kahoy", isPriority: true },
                      { name: "Banana", tag: "Saging / Saba", isPriority: true },
                      { name: "Coconut", tag: "Niyog / Buko", isPriority: true },
                      { name: "Sweet Potato / Camote", tag: "Kamote Tubers", isPriority: false },
                      { name: "Vegetables", tag: "Sariwang Gulay", isPriority: false },
                    ].map((c) => {
                      const isSelected = demandCrop === c.name;
                      return (
                        <div
                          key={c.name}
                          onClick={() => setDemandCrop(c.name)}
                          style={{
                            padding: 16,
                            borderRadius: 12,
                            border: isSelected
                              ? "2px solid var(--bright-nori)"
                              : "1px solid var(--line)",
                            background: isSelected
                              ? "var(--surface-soft)"
                              : "var(--surface)",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            position: "relative",
                          }}
                        >
                          {c.isPriority && (
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: 10,
                                fontWeight: 700,
                                color: "var(--bright-nori)",
                                background: "var(--soft-celery)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                marginBottom: 6,
                              }}
                            >
                              ⭐ Priority Crop
                            </span>
                          )}
                          <strong
                            style={{
                              display: "block",
                              color: isSelected
                                ? "var(--bright-nori)"
                                : "var(--bush)",
                              fontSize: 15,
                            }}
                          >
                            {c.name}
                          </strong>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {c.tag}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="button"
                      onClick={() => setDemandStep(2)}
                    >
                      Susunod: Paraan ng Pagbili →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Buying Type (Per-Unit vs. Bulk / Fixed-Lot) */}
              {demandStep === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <h3 style={{ margin: "0 0 6px" }}>
                      Hakbang 2: Paraan ng Pagbili (Buying Type)
                    </h3>
                    <p className="muted" style={{ margin: 0 }}>
                      Pumili kung bibili bawat yunit (kilo, sako, kahon, buwig) o
                      pakyawan / buong lote (fixed bulk price).
                    </p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 14,
                    }}
                  >
                    <div
                      onClick={() => {
                        setDemandBuyingType("per_unit");
                        if (demandUnit === "lot") setDemandUnit("kg");
                      }}
                      style={{
                        padding: 18,
                        borderRadius: 12,
                        border:
                          demandBuyingType === "per_unit"
                            ? "2px solid var(--bright-nori)"
                            : "1px solid var(--line)",
                        background:
                          demandBuyingType === "per_unit"
                            ? "var(--surface-soft)"
                            : "var(--surface)",
                        cursor: "pointer",
                      }}
                    >
                      <strong style={{ fontSize: 15, display: "block" }}>
                        ⚖️ Bawat Yunit (Per-Unit Buying)
                      </strong>
                      <p
                        className="muted"
                        style={{ fontSize: 13, margin: "6px 0 0" }}
                      >
                        Nagtatakda ng presyo bawat kilo, bawat sako, bawat
                        kahon, o bawat buwig (hal. ₱30/kg, ₱800/sako).
                      </p>
                    </div>

                    <div
                      onClick={() => {
                        setDemandBuyingType("bulk_lot");
                        setDemandUnit("lot");
                      }}
                      style={{
                        padding: 18,
                        borderRadius: 12,
                        border:
                          demandBuyingType === "bulk_lot"
                            ? "2px solid var(--bright-nori)"
                            : "1px solid var(--line)",
                        background:
                          demandBuyingType === "bulk_lot"
                            ? "var(--surface-soft)"
                            : "var(--surface)",
                        cursor: "pointer",
                      }}
                    >
                      <strong style={{ fontSize: 15, display: "block" }}>
                        📦 Buong Lote / Pakyawan (Bulk Lot Buying)
                      </strong>
                      <p
                        className="muted"
                        style={{ fontSize: 13, margin: "6px 0 0" }}
                      >
                        Isang pirmihang kabuuang halaga para sa buong lote ng ani
                        (hal. ₱2,500 buong ani nang minsanan).
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setDemandStep(1)}
                    >
                      ← Bumalik
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() => setDemandStep(3)}
                    >
                      Susunod: Dami at Sukat →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Quantity & Measurement Unit */}
              {demandStep === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <h3 style={{ margin: "0 0 6px" }}>
                      Hakbang 3: Dami at Yunit ng Pagsukat (Quantity & Unit)
                    </h3>
                    <p className="muted" style={{ margin: 0 }}>
                      Tukuyin ang kinakailangang dami at ang yunit na gagamitin.
                    </p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Yunit ng Pagsukat (Unit)
                      <select
                        aria-label="Demand measurement unit"
                        value={demandUnit}
                        onChange={(e) =>
                          setDemandUnit(e.target.value as MeasurementUnit)
                        }
                      >
                        {MEASUREMENT_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u.toUpperCase()} — {unitLabel(u)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Kinakailangang Dami ({unitLabel(demandUnit)})
                      <span className="search-field" style={{ minWidth: "100%" }}>
                        <input
                          aria-label="Required quantity"
                          type="number"
                          step="0.01"
                          value={demandQty}
                          onChange={(e) => setDemandQty(e.target.value)}
                          placeholder="Hal. 40"
                        />
                      </span>
                    </label>

                    {demandUnit !== "kg" && demandUnit !== "lot" && (
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Tantiyang Timbang bawat {unitLabel(demandUnit)} (kg - opsyonal)
                        <span className="search-field" style={{ minWidth: "100%" }}>
                          <input
                            aria-label="Expected kg per unit"
                            type="number"
                            step="0.1"
                            value={demandExpectedKg}
                            onChange={(e) => setDemandExpectedKg(e.target.value)}
                            placeholder="Hal. 50 kg/sako"
                          />
                        </span>
                      </label>
                    )}

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Nais na Kalidad (Quality Grade)
                      <select
                        aria-label="Preferred quality grade"
                        value={demandGrade}
                        onChange={(e) =>
                          setDemandGrade(e.target.value as QualityGrade)
                        }
                      >
                        <option value="Grade A">Grade A (Pang-export / Premium)</option>
                        <option value="Grade B">Grade B (Standard Market)</option>
                        <option value="Processing Grade">Processing Grade (Para sa luto/giling)</option>
                        <option value="Any">Kahit Anong Kalidad (Any)</option>
                      </select>
                    </label>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setDemandStep(2)}
                    >
                      ← Bumalik
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() => setDemandStep(4)}
                    >
                      Susunod: Presyo at Petsa →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Pricing & Delivery Destination */}
              {demandStep === 4 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <h3 style={{ margin: "0 0 6px" }}>
                      Hakbang 4: Presyo at Detalye ng Paghahatid (Pricing & Delivery)
                    </h3>
                    <p className="muted" style={{ margin: 0 }}>
                      Ilagay ang presyo, lokasyon ng bagsakan, at huling araw ng pagtanggap.
                    </p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {demandBuyingType === "bulk_lot"
                        ? "Kabuuang Halaga ng Buong Lote (PHP ₱)"
                        : `Alok na Presyo bawat ${unitLabel(demandUnit)} (PHP ₱)`}
                      <span className="search-field" style={{ minWidth: "100%" }}>
                        <input
                          aria-label="Offered price"
                          type="number"
                          step="0.01"
                          value={demandPrice}
                          onChange={(e) => setDemandPrice(e.target.value)}
                          placeholder="Hal. 30"
                        />
                      </span>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Bayan sa Marinduque (Municipality)
                      <select
                        aria-label="Demand municipality"
                        value={demandMunicipality}
                        onChange={(e) => setDemandMunicipality(e.target.value)}
                      >
                        {municipalities.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Lugar ng Bagsakan (Delivery Location / Stall)
                      <span className="search-field" style={{ minWidth: "100%" }}>
                        <input
                          aria-label="Delivery location"
                          type="text"
                          value={demandLocation}
                          onChange={(e) => setDemandLocation(e.target.value)}
                        />
                      </span>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Huling Araw ng Paghahatid (Delivery Deadline)
                      <span className="search-field" style={{ minWidth: "100%" }}>
                        <input
                          aria-label="Required delivery date"
                          type="text"
                          value={demandDate}
                          onChange={(e) => setDemandDate(e.target.value)}
                        />
                      </span>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Tumatanggap ng Partial Delivery
                      <select
                        aria-label="Accept partial quantities"
                        value={demandAcceptPartial ? "yes" : "no"}
                        onChange={(e) =>
                          setDemandAcceptPartial(e.target.value === "yes")
                        }
                      >
                        <option value="yes">
                          Oo (Maaaring hatiin sa maraming magsasaka)
                        </option>
                        <option value="no">
                          Hindi (Kailangang buong dami)
                        </option>
                      </select>
                    </label>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setDemandStep(3)}
                    >
                      ← Bumalik
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() => setDemandStep(5)}
                    >
                      Susunod: Pagsusuri at Pag-post →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: Review & Post */}
              {demandStep === 5 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <h3 style={{ margin: "0 0 6px" }}>
                      Hakbang 5: Pagsusuri bago I-post (Review & Post)
                    </h3>
                    <p className="muted" style={{ margin: 0 }}>
                      Suriin ang buod ng iyong pangangailangan bago opisyal na ilathala.
                    </p>
                  </div>

                  <div
                    style={{
                      background: "var(--surface-soft)",
                      border: "1px solid var(--maximum-green)",
                      borderRadius: 12,
                      padding: 18,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <span className="eyebrow">PAMILIHAN / BUYER</span>
                      <strong>{activeDemoMarket?.organizationName}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {activeDemoMarket?.municipality}
                      </div>
                    </div>

                    <div>
                      <span className="eyebrow">PANANIM AT KALIDAD</span>
                      <strong>
                        {demandCrop} ({demandGrade})
                      </strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Paraan:{" "}
                        {demandBuyingType === "bulk_lot"
                          ? "Pakyawan (Bulk Lot)"
                          : "Bawat Yunit"}
                      </div>
                    </div>

                    <div>
                      <span className="eyebrow">DAMI AT SUKAT</span>
                      <strong>
                        {demandQty} {unitLabel(demandUnit)}
                      </strong>
                      {demandExpectedKg && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          ~{demandExpectedKg} kg bawat {unitLabel(demandUnit)}
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="eyebrow">ALOK NA HALAGA</span>
                      <strong style={{ color: "var(--bright-nori)", fontSize: 16 }}>
                        {demandBuyingType === "bulk_lot"
                          ? `₱${Number(demandPrice).toLocaleString()} buong lote`
                          : `₱${Number(demandPrice).toLocaleString()}/${unitLabel(demandUnit)}`}
                      </strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Tinatayang Badyet: ₱
                        {demandBuyingType === "bulk_lot"
                          ? Number(demandPrice).toLocaleString()
                          : (
                              Number(demandQty) * Number(demandPrice) || 0
                            ).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <span className="eyebrow">LOKASYON NG BAGSAKAN</span>
                      <strong>{demandLocation}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {demandMunicipality}, Marinduque
                      </div>
                    </div>

                    <div>
                      <span className="eyebrow">PETSA AT ALITUNTUNIN</span>
                      <strong>Paghahatid sa: {demandDate}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {demandAcceptPartial
                          ? "✓ Tumatanggap ng hati-hating alok"
                          : "⚠ Buong dami lamang"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setDemandStep(4)}
                    >
                      ← Bumalik sa Presyo
                    </button>
                    <button
                      type="submit"
                      className="button"
                      style={{ padding: "10px 24px", fontSize: 15 }}
                    >
                      ✓ I-post ang Pangangailangan (Post Demand)
                    </button>
                  </div>
                </div>
              )}
            </form>
          </section>

          <div className="cards-grid">
            {demoDemands.map((request) => (
              <article className="panel opportunity-card" key={request.id}>
                <div className="card-top-row">
                  <span className="eyebrow">
                    {request.id} · {marketTypeLabel(request.marketType)}
                  </span>
                  <span
                    className={`pill ${
                      request.status === "fulfilled"
                        ? "green"
                        : request.status === "cancelled"
                          ? "subtle"
                          : "amber"
                    }`}
                  >
                    {request.status.toUpperCase()}
                  </span>
                </div>
                <h2>
                  {request.crop} — {request.requiredQuantityKg}{" "}
                  {unitLabel(request.unit)}
                </h2>
                <p>
                  <strong>{request.marketName}</strong>
                </p>
                <div className="coverage">
                  <strong>
                    {request.remainingDemandKg.toLocaleString()} /{" "}
                    {request.requiredQuantityKg.toLocaleString()}{" "}
                    <small>{unitLabel(request.unit)} remaining</small>
                  </strong>
                  <span>
                    {request.buyingType === "bulk_lot"
                      ? `${money(request.totalPricePhp ?? request.offeredPricePerKg)} pakyawan (bulk lot)`
                      : `${money(request.unitPricePhp ?? request.offeredPricePerKg)}/${unitLabel(request.unit)}`}{" "}
                    · {request.preferredQualityGrade}
                  </span>
                </div>
                <p>
                  <Icon name="pin" size={16} />
                  <strong>{request.municipality}</strong> ·{" "}
                  {request.deliveryLocation} · Partial:{" "}
                  <strong>{request.acceptPartial ? "Yes" : "No"}</strong>
                </p>
                <p className="muted" style={{ fontSize: 12 }}>
                  Nakalaan:{" "}
                  <strong>
                    {request.reservedQuantityKg} {unitLabel(request.unit)}
                  </strong>{" "}
                  · Naihatid:{" "}
                  <strong>
                    {request.fulfilledQuantityKg} {unitLabel(request.unit)}
                  </strong>{" "}
                  · {request.window}
                </p>
                <div className="card-divider" />
                <p className="muted">{request.note}</p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Link href="/supply-pooling" className="button secondary">
                    Allocate / Offer Supply →
                  </Link>
                  {request.status !== "cancelled" &&
                    request.status !== "fulfilled" && (
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() =>
                          updateDemoDemandStatus(request.id, "cancelled")
                        }
                      >
                        Close Demand
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {section === "ai-value-add" && (
        <>
          <div className="info-banner">
            <Icon name="spark" />
            <p>
              <strong>Advisory Decision-Support Preview:</strong> All figures
              below are <strong>illustrative mathematical examples</strong>{" "}
              comparing raw farmgate selling against value-added processing.
              Adjust the interactive assumptions below to compare raw vs.
              processed returns.
            </p>
          </div>

          {/* Sub-navigation for AI Value-Add */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className={`button ${valueAddTab === "calculator" ? "" : "secondary"}`}
              style={{ padding: "8px 16px", fontSize: 13 }}
              onClick={() => setValueAddTab("calculator")}
            >
              1. Processed-Product Profit Calculator (4 Crops)
            </button>
            <button
              type="button"
              className={`button ${valueAddTab === "facilities" ? "" : "secondary"}`}
              style={{ padding: "8px 16px", fontSize: 13 }}
              onClick={() => setValueAddTab("facilities")}
            >
              2. Processing Facilities Directory (All 6 Municipalities)
            </button>
            <button
              type="button"
              className={`button ${valueAddTab === "farming_guide" ? "" : "secondary"}`}
              style={{ padding: "8px 16px", fontSize: 13 }}
              onClick={() => setValueAddTab("farming_guide")}
            >
              3. AI Farming & Storage Guide (Offline Ready)
            </button>
          </div>

          {valueAddTab === "calculator" && (
            <>
              <section className="analysis-intro panel">
                <span className="value-icon">
                  <Icon name="spark" size={30} />
                </span>
                <p className="eyebrow">
                  TRANSPARENT VALUE-ADD PROFIT SIMULATOR · INTERACTIVE CALCULATOR
                </p>
                <h2>
                  Compare raw farmgate sales against
                  <br />
                  value-added processing pathways.
                </h2>
                <p>
                  SMART-ANI computes deterministic revenue and cost scenarios from
                  explicit yield and cost assumptions before committing surplus to
                  raw buyers or food-processor Markets.
                </p>

                {/* 4 1-Click Preset Buttons */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 16,
                    marginBottom: 8,
                  }}
                >
                  <button
                    type="button"
                    className={`button ${activeValueAddCrop === "Banana" ? "" : "secondary"}`}
                    style={{ fontSize: 12, padding: "6px 12px" }}
                    onClick={() => applyValueAddPreset("Banana")}
                  >
                    🍌 Banana → Banana Chips (35% yield)
                  </button>
                  <button
                    type="button"
                    className={`button ${activeValueAddCrop === "Arrowroot / Uraro" ? "" : "secondary"}`}
                    style={{ fontSize: 12, padding: "6px 12px" }}
                    onClick={() => applyValueAddPreset("Arrowroot / Uraro")}
                  >
                    🌾 Arrowroot / Uraro → Starch (20% yield)
                  </button>
                  <button
                    type="button"
                    className={`button ${activeValueAddCrop === "Cassava" ? "" : "secondary"}`}
                    style={{ fontSize: 12, padding: "6px 12px" }}
                    onClick={() => applyValueAddPreset("Cassava")}
                  >
                    🥔 Cassava → Starch (25% yield)
                  </button>
                  <button
                    type="button"
                    className={`button ${activeValueAddCrop === "Coconut" ? "" : "secondary"}`}
                    style={{ fontSize: 12, padding: "6px 12px" }}
                    onClick={() => applyValueAddPreset("Coconut")}
                  >
                    🥥 Coconut → Virgin Coconut Oil (8% yield)
                  </button>
                </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                marginTop: 18,
                marginBottom: 18,
                padding: 16,
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
              }}
            >
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Input Harvest (kg)
                <input
                  aria-label="Simulator input kg"
                  type="number"
                  value={simInputKg}
                  onChange={(e) =>
                    setSimInputKg(Math.max(1, Number(e.target.value) || 0))
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    marginTop: 4,
                    color: "#0B2E17",
                  }}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Raw Price (₱/kg)
                <input
                  aria-label="Simulator raw price"
                  type="number"
                  value={simRawPrice}
                  onChange={(e) =>
                    setSimRawPrice(Math.max(1, Number(e.target.value) || 0))
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    marginTop: 4,
                    color: "#0B2E17",
                  }}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Conversion Yield (%)
                <input
                  aria-label="Simulator yield percent"
                  type="number"
                  value={simYieldPct}
                  onChange={(e) =>
                    setSimYieldPct(
                      Math.min(100, Math.max(1, Number(e.target.value) || 0)),
                    )
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    marginTop: 4,
                    color: "#0B2E17",
                  }}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Processed Price (₱/kg)
                <input
                  aria-label="Simulator processed price"
                  type="number"
                  value={simProcessedPrice}
                  onChange={(e) =>
                    setSimProcessedPrice(
                      Math.max(1, Number(e.target.value) || 0),
                    )
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    marginTop: 4,
                    color: "#0B2E17",
                  }}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Processing Cost (₱)
                <input
                  aria-label="Simulator processing cost"
                  type="number"
                  value={simProcCost}
                  onChange={(e) =>
                    setSimProcCost(Math.max(0, Number(e.target.value) || 0))
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    marginTop: 4,
                    color: "#0B2E17",
                  }}
                />
              </label>
            </div>

            {(() => {
              const rawRev = simInputKg * simRawPrice;
              const outKg = Number(
                ((simInputKg * simYieldPct) / 100).toFixed(1),
              );
              const grossProc = outKg * simProcessedPrice;
              const netProc = grossProc - simProcCost;
              const diff = netProc - rawRev;
              return (
                <div className="formula-grid">
                  <div>
                    <span>01 / RAW FARMGATE SCENARIO ({simInputKg} kg)</span>
                    <h3>Raw Revenue: {money(rawRev)}</h3>
                    <code>
                      {simInputKg} kg × ₱{simRawPrice}/kg = {money(rawRev)}
                    </code>
                  </div>
                  <div>
                    <span>
                      02 / VALUE-ADDED SCENARIO ({outKg} kg output @{" "}
                      {simYieldPct}% yield)
                    </span>
                    <h3>
                      Net Value vs. Raw: {diff >= 0 ? "+" : ""}
                      {money(diff)}
                    </h3>
                    <code>
                      Gross {money(grossProc)} − Cost {money(simProcCost)} − Raw{" "}
                      {money(rawRev)} = {diff >= 0 ? "+" : ""}
                      {money(diff)}
                    </code>
                  </div>
                </div>
              );
            })()}
            <p className="analysis-note">
              Actual outcomes depend on crop quality, conversion recovery, fuel
              and labor costs, packaging, and verified buyer demand.
            </p>
          </section>

          <div className="cards-grid product-ideas">
            {valueAddScenarios.map((scenario) => {
              const rawRevenue =
                scenario.sampleInputKg * scenario.rawPricePerKg;
              const outputMassKg =
                scenario.sampleInputKg * scenario.illustrativeYieldRatio;
              const outputUnits = scenario.densityKgPerLiter
                ? Number((outputMassKg / scenario.densityKgPerLiter).toFixed(2))
                : Math.round(outputMassKg);
              const unitSymbol = scenario.densityKgPerLiter ? "L" : "kg";
              const grossProcessed = Math.round(
                outputUnits * scenario.illustrativeProductPricePerKg,
              );
              const netAfterProcessingCost =
                grossProcessed - scenario.illustrativeProcessingCost;
              const illustrativeDiff = netAfterProcessingCost - rawRevenue;

              return (
                <article className="panel opportunity-card" key={scenario.id}>
                  <div className="card-top-row">
                    <span className="pill amber">ILLUSTRATIVE SIMULATION</span>
                    <span className="eyebrow">{scenario.crop}</span>
                  </div>
                  <h2>{scenario.product}</h2>
                  <p className="muted">
                    Sample input: <strong>{scenario.sampleInputKg} kg</strong>{" "}
                    raw {scenario.crop.toLowerCase()}
                  </p>

                  <div className="sim-breakdown">
                    <div className="sim-row">
                      <span>
                        Raw selling ({money(scenario.rawPricePerKg)}/kg)
                      </span>
                      <strong>{money(rawRevenue)}</strong>
                    </div>
                    <div className="sim-row">
                      <span>
                        Est. processed output (
                        {Math.round(scenario.illustrativeYieldRatio * 100)}%
                        {scenario.densityKgPerLiter ? ` mass @ ${scenario.densityKgPerLiter} kg/L` : " yield"}
                        )
                      </span>
                      <strong>{outputUnits} {unitSymbol}</strong>
                    </div>
                    <div className="sim-row">
                      <span>
                        Gross processed value (
                        {money(scenario.illustrativeProductPricePerKg)}/{unitSymbol})
                      </span>
                      <strong>{money(grossProcessed)}</strong>
                    </div>
                    <div className="sim-row">
                      <span>Illustrative processing cost</span>
                      <strong>
                        − {money(scenario.illustrativeProcessingCost)}
                      </strong>
                    </div>
                    <div className="sim-row highlight">
                      <span>Illustrative net vs. raw sale</span>
                      <strong>
                        {illustrativeDiff >= 0 ? "+" : ""}
                        {money(illustrativeDiff)}
                      </strong>
                    </div>
                  </div>

                  <p className="muted">
                    <strong>Required setup:</strong> {scenario.equipmentNote}
                  </p>
                  <span className="pill subtle">
                    Unverified sample assumptions · Not financial advice
                  </span>
                </article>
              );
            })}
          </div>
            </>
          )}

          {valueAddTab === "facilities" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <section className="panel" style={{ padding: 24 }}>
                <div
                  style={{
                    background: "#FEF7E6",
                    border: "1px solid #FEDF89",
                    borderRadius: 10,
                    padding: "12px 16px",
                    marginBottom: 16,
                    color: "#7A2E0E",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  <strong>⚠️ SAMPLE / DEMONSTRATION DATA (6 MUNICIPALITIES):</strong> The processing centers, machinery inventories, illustrative contacts, and processing fee schedules shown below are representative demonstration fixtures for Boac, Mogpog, Santa Cruz, Torrijos, Buenavista, and Gasan. They are NOT officially accredited commercial centers or active phone numbers.
                </div>

                <div style={{ marginBottom: 16 }}>
                  <p className="eyebrow">
                    PROCESSING FACILITIES DIRECTORY (DEMO FIXTURES · 6 MUNICIPALITIES)
                  </p>
                  <h2>Sample Agricultural Processing Directory</h2>
                  <p className="muted">
                    Explore illustrative post-harvest facilities with representative equipment for chipping, starch milling, rootcrop powderizing, and cold-press Virgin Coconut Oil across all 6 municipalities.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Filter Bayan (Municipality):
                    <select
                      value={facilityMunFilter}
                      onChange={(e) => setFacilityMunFilter(e.target.value)}
                      style={{ padding: "6px 12px", borderRadius: 8, marginLeft: 6 }}
                    >
                      <option value="All">All 6 Municipalities</option>
                      {municipalities.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Filter Pananim (Crop):
                    <select
                      value={facilityCropFilter}
                      onChange={(e) => setFacilityCropFilter(e.target.value)}
                      style={{ padding: "6px 12px", borderRadius: 8, marginLeft: 6 }}
                    >
                      <option value="All">All Crops</option>
                      <option value="Banana">Banana</option>
                      <option value="Arrowroot">Arrowroot / Uraro</option>
                      <option value="Cassava">Cassava</option>
                      <option value="Coconut">Coconut</option>
                      <option value="Vegetables">Vegetables</option>
                    </select>
                  </label>
                  <span
                    className="pill amber"
                    style={{ alignSelf: "center", fontSize: 11, fontWeight: 700 }}
                  >
                    Sample Demo Directory
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: 16,
                  }}
                >
                  {processingFacilities
                    .filter((fac) => {
                      if (facilityMunFilter !== "All" && fac.municipality !== facilityMunFilter) return false;
                      if (facilityCropFilter !== "All" && !fac.acceptedCrops.some((c) => c.toLowerCase().includes(facilityCropFilter.toLowerCase()))) return false;
                      return true;
                    })
                    .map((fac) => (
                      <article
                        key={fac.id}
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--line)",
                          borderRadius: 12,
                          padding: 18,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div>
                            <span className="pill green" style={{ fontSize: 10 }}>{fac.municipality}</span>
                            <strong style={{ display: "block", fontSize: 16, marginTop: 4, color: "var(--bush)" }}>
                              {fac.name}
                            </strong>
                            <small className="muted">{fac.address}</small>
                          </div>
                          <span className="pill amber" style={{ fontSize: 10, fontWeight: 700 }}>
                            SAMPLE DEMO
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--maximum-green)",
                            fontWeight: 700,
                            background: "var(--surface-soft)",
                            padding: "4px 8px",
                            borderRadius: 6,
                            display: "inline-block",
                          }}
                        >
                          📍 GPS: {fac.latitude.toFixed(4)}° N, {fac.longitude.toFixed(4)}° E
                        </div>

                        <div>
                          <strong style={{ fontSize: 12, display: "block", color: "var(--bush)" }}>
                            Accepted Crops:
                          </strong>
                          <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 6px" }}>
                            {fac.acceptedCrops.join(" · ")}
                          </p>
                        </div>

                        <div>
                          <strong style={{ fontSize: 12, display: "block", color: "var(--bush)" }}>
                            Equipment & Capabilities:
                          </strong>
                          <ul style={{ margin: "2px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--muted)" }}>
                            {fac.capabilities.map((c) => (
                              <li key={c}>{c}</li>
                            ))}
                          </ul>
                        </div>

                        <div style={{ background: "var(--surface-soft)", padding: 10, borderRadius: 8, fontSize: 12 }}>
                          <strong style={{ color: "var(--bush)" }}>Processing Rates:</strong>{" "}
                          <span>{fac.processingFeeDescription}</span>
                        </div>

                        <div style={{ fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                          Contact: <strong>{fac.contactPerson}</strong> ({fac.contactPhone}) · Hours: {fac.operatingHours}
                        </div>
                      </article>
                    ))}
                </div>
              </section>
            </div>
          )}

          {valueAddTab === "farming_guide" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <section className="panel" style={{ padding: 24 }}>
                <div style={{ marginBottom: 16 }}>
                  <p className="eyebrow">
                    SMART-ANI KNOWLEDGE BASE · DETERMINISTIC DECISION SUPPORT
                  </p>
                  <h2>AI Farming, Storage & Spoilage Prevention Guide</h2>
                  <p className="muted">
                    Preloaded post-harvest preservation practices, crop maturity indicators, value-addition processing procedures, and fair price benchmarks for Marinduque farmers.
                  </p>
                </div>

                <div
                  style={{
                    background: "var(--surface-soft)",
                    border: "1px solid var(--venus-flytrap)",
                    borderRadius: 10,
                    padding: "10px 16px",
                    fontSize: 12,
                    color: "var(--bush)",
                    marginBottom: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Icon name="spark" size={18} />
                  <span>
                    <strong>Honest AI & Knowledge Disclosure:</strong> This guide operates as an{" "}
                    <u>offline-ready deterministic knowledge engine</u> based on Philippine Department of Agriculture (DA) and UPLB Postharvest Horticulture Research & Training Center standards. Optional online LLM assistant integration is supported when connectivity is restored without fabricating food safety data.
                  </span>
                </div>

                <h3 style={{ fontSize: 16, marginBottom: 12, color: "var(--bush)" }}>
                  Gabay sa Pag-iimbak at Pag-ani (Storage & Harvest Guides)
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 14,
                    marginBottom: 28,
                  }}
                >
                  {farmingGuides.map((guide) => (
                    <article
                      key={guide.crop}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <span className="pill green" style={{ fontSize: 11, marginBottom: 6, display: "inline-block" }}>
                        {guide.crop}
                      </span>
                      <div style={{ fontSize: 12, marginBottom: 8 }}>
                        <strong style={{ color: "var(--bush)", display: "block" }}>Tamang Pag-ani (Harvest Timing):</strong>
                        <p style={{ color: "var(--muted)", margin: "2px 0 0" }}>{guide.harvestTiming}</p>
                      </div>
                      <div style={{ fontSize: 12, marginBottom: 8 }}>
                        <strong style={{ color: "var(--bush)", display: "block" }}>Pag-iimbak at Temperatura (Storage & Freshness):</strong>
                        <p style={{ color: "var(--muted)", margin: "2px 0 0" }}>{guide.storageGuidance}</p>
                      </div>
                      <div style={{ fontSize: 12, marginBottom: 8 }}>
                        <strong style={{ color: "var(--bush)", display: "block" }}>Value-Addition (Pagpoproseso):</strong>
                        <p style={{ color: "var(--muted)", margin: "2px 0 0" }}>{guide.valueAddPath}</p>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--bright-nori)", fontWeight: 700, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
                        Tantiyang Freshness Window: {guide.shelfLifeDays}
                      </div>
                    </article>
                  ))}
                </div>

                <h3 style={{ fontSize: 16, marginBottom: 12, color: "var(--bush)" }}>
                  Mga Madalas Itanong ng Magsasaka (Offline FAQs)
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {offlineFaqs.map((faq, i) => (
                    <div
                      key={i}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: "12px 16px",
                      }}
                    >
                      <strong style={{ fontSize: 14, color: "var(--bush)", display: "block" }}>
                        ❓ {faq.question}
                      </strong>
                      <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
                        {faq.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {section === "transactions" && (
        <>
          <div className="info-banner">
            <Icon name="swap" />
            <p>
              <strong>
                Delivery Confirmation, Admin Verification, Disputes & Audit
                Logs:
              </strong>{" "}
              No crop is marked as <code>delivered</code> until receipt is
              confirmed by the Market. Admins verify Market accounts, resolve
              cancellations/disputes without silent quantity edits, and inspect
              the immutable audit trail.
            </p>
          </div>

          {!!txFeedback && (
            <p
              role="status"
              style={{
                background: "var(--soft-celery)",
                border: "1px solid var(--bright-nori)",
                color: "var(--bush)",
                padding: "12px 16px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {txFeedback}
            </p>
          )}

          {!!txError && (
            <p
              role="alert"
              style={{
                background: "#FDF0EE",
                border: "1px solid #E8B9B3",
                color: "#942E24",
                padding: "12px 16px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {txError}
            </p>
          )}

          {/* Section 1: Delivery Confirmation & Dispute/Cancellation Controls */}
          <section className="panel" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <p className="eyebrow">
                DELIVERY CONFIRMATION & CANCELLATION / DISPUTE WORKFLOW
              </p>
              <h2>
                Active Reservations & Confirmed Deliveries (
                {demoAllocations.length})
              </h2>
              <p className="muted">
                Confirm full or partial received quantities (shifts{" "}
                <code>reserved</code> → <code>delivered</code> without
                double-counting) or cancel/resolve disputes to release only the
                undelivered remainder.
              </p>
            </div>

            {demoAllocations.length === 0 ? (
              <div className="empty-state" style={{ padding: 28 }}>
                <h3>No supply allocations recorded yet.</h3>
                <p>
                  Go to Supply Pooling to allocate 100 kg Banana across Market 1
                  (40 kg), Market 2 (35 kg), and Market 3 (25 kg), then confirm
                  deliveries here.
                </p>
                <Link href="/supply-pooling" className="button">
                  Go to Supply Pooling <Icon name="arrow" size={16} />
                </Link>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {demoAllocations.map((alloc) => {
                  const undeliveredKg = Math.max(
                    0,
                    Number((alloc.allocatedKg - alloc.deliveredKg).toFixed(2)),
                  );
                  return (
                    <div
                      key={alloc.id}
                      data-testid={`tx-allocation-${alloc.id}`}
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                        padding: 16,
                        background: "var(--surface)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <strong>
                            {alloc.id} · {alloc.crop} ({alloc.qualityGrade}) —{" "}
                            {alloc.farmerName} → {alloc.marketName}
                          </strong>
                          <p
                            className="muted"
                            style={{ fontSize: 13, marginTop: 3 }}
                          >
                            Allocated:{" "}
                            <strong>
                              {alloc.allocatedKg} {unitLabel(alloc.unit)}
                            </strong>{" "}
                            · Confirmed Delivered:{" "}
                            <strong>
                              {alloc.deliveredKg} {unitLabel(alloc.unit)}
                            </strong>{" "}
                            · Undelivered Remainder:{" "}
                            <strong>
                              {undeliveredKg} {unitLabel(alloc.unit)}
                            </strong>{" "}
                            · Price:{" "}
                            <strong>
                              {alloc.buyingType === "bulk_lot"
                                ? `${money(alloc.totalAgreedPrice ?? alloc.agreedPricePerKg)} buong lote`
                                : `${money(alloc.agreedPricePerKg)}/${unitLabel(alloc.unit)}`}
                            </strong>
                          </p>
                        </div>
                        <span
                          className={`pill ${
                            alloc.status === "delivered"
                              ? "green"
                              : alloc.status === "reserved" ||
                                  alloc.status === "in_delivery" ||
                                  alloc.status === "partially_delivered"
                                ? "amber"
                                : "subtle"
                          }`}
                        >
                          {alloc.status.toUpperCase()}
                        </span>
                      </div>

                      {(alloc.status === "reserved" ||
                        alloc.status === "in_delivery" ||
                        alloc.status === "partially_delivered") && (
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            alignItems: "center",
                            paddingTop: 8,
                            borderTop: "1px solid var(--line)",
                          }}
                        >
                          {alloc.status === "reserved" && (
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => {
                                try {
                                  markDemoInDelivery(alloc.id);
                                  setTxFeedback(
                                    `Marked ${alloc.id} as in_delivery.`,
                                  );
                                } catch (err) {
                                  setTxError(
                                    err instanceof Error
                                      ? err.message
                                      : "Error",
                                  );
                                }
                              }}
                            >
                              Mark In Delivery
                            </button>
                          )}

                          <label
                            className="search-field"
                            style={{ minWidth: 160 }}
                          >
                            <input
                              aria-label={`Actual received kg for ${alloc.id}`}
                              type="number"
                              step="0.01"
                              placeholder={`Received kg (max ${undeliveredKg})`}
                              value={receivedKgByAlloc[alloc.id] ?? ""}
                              onChange={(e) =>
                                setReceivedKgByAlloc((prev) => ({
                                  ...prev,
                                  [alloc.id]: e.target.value,
                                }))
                              }
                            />
                          </label>

                          <button
                            type="button"
                            className="button"
                            onClick={() =>
                              handleConfirmDelivery(
                                alloc.id,
                                undeliveredKg,
                                false,
                              )
                            }
                          >
                            ✓ Confirm Delivery (
                            {receivedKgByAlloc[alloc.id]?.trim()
                              ? `${receivedKgByAlloc[alloc.id]} kg`
                              : `${undeliveredKg} kg`}
                            )
                          </button>

                          <label
                            className="search-field"
                            style={{ minWidth: 190, flex: 1 }}
                          >
                            <input
                              aria-label={`Cancellation or dispute reason for ${alloc.id}`}
                              type="text"
                              placeholder="Cancellation / dispute reason…"
                              value={cancelReasonByAlloc[alloc.id] ?? ""}
                              onChange={(e) =>
                                setCancelReasonByAlloc((prev) => ({
                                  ...prev,
                                  [alloc.id]: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() =>
                              handleCancelOrDispute(
                                alloc.id,
                                activeDemoRole === "admin",
                              )
                            }
                          >
                            Release Undelivered ({undeliveredKg} kg)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 2: Admin Governance — Market Verification & Legacy Quarantine */}
          <section className="panel" style={{ padding: 24, marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <div>
                <p className="eyebrow">
                  ADMIN GOVERNANCE · MARKET VERIFICATION & LEGACY ROLE MIGRATION
                </p>
                <h2>Market Account Verification & Quarantined Accounts</h2>
                <p className="muted">
                  Only an authorized Admin (`Role: ADMIN`) can verify Market
                  accounts or resolve quarantined legacy Coordinator/Processor
                  accounts.
                </p>
              </div>
              {activeDemoRole !== "admin" && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setActiveDemoRole("admin")}
                >
                  Switch to Role: ADMIN
                </button>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {demoAccounts
                .filter(
                  (a) =>
                    a.role === "market" ||
                    a.accountStatus === "deactivated_pending_admin_review",
                )
                .map((acc) => (
                  <div
                    key={acc.id}
                    data-testid={`account-card-${acc.id}`}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: 16,
                      background: "var(--surface)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <strong>{acc.organizationName}</strong>
                      <span
                        className={`pill ${
                          acc.marketVerificationStatus === "verified"
                            ? "green"
                            : "amber"
                        }`}
                      >
                        {acc.accountStatus ===
                        "deactivated_pending_admin_review"
                          ? "QUARANTINED LEGACY"
                          : acc.marketVerificationStatus}
                      </span>
                    </div>
                    <p className="muted" style={{ fontSize: 12 }}>
                      Contact: {acc.displayName} · {acc.municipality} · Role:{" "}
                      <strong>{acc.role.toUpperCase()}</strong>
                      {acc.marketType && (
                        <> ({marketTypeLabel(acc.marketType)})</>
                      )}
                      {acc.legacyPreviousRole && (
                        <>
                          {" "}
                          · Legacy role:{" "}
                          <code>{acc.legacyPreviousRole}</code>
                        </>
                      )}
                    </p>

                    {acc.accountStatus ===
                    "deactivated_pending_admin_review" ? (
                      <div
                        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                      >
                        <button
                          type="button"
                          className="button secondary"
                          style={{ padding: "6px 10px", fontSize: 12 }}
                          onClick={() =>
                            handleAdminLegacyResolution(
                              acc.id,
                              "approve_as_farmer",
                            )
                          }
                        >
                          Approve as Farmer
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          style={{ padding: "6px 10px", fontSize: 12 }}
                          onClick={() =>
                            handleAdminLegacyResolution(
                              acc.id,
                              "approve_as_market",
                            )
                          }
                        >
                          Approve as Market
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                      >
                        {acc.marketVerificationStatus !== "verified" && (
                          <button
                            type="button"
                            className="button"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() =>
                              handleAdminMarketVerification(acc.id, "verified")
                            }
                          >
                            ✓ Verify Market ({acc.id})
                          </button>
                        )}
                        {acc.marketVerificationStatus !== "rejected" && (
                          <button
                            type="button"
                            className="button secondary"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() =>
                              handleAdminMarketVerification(acc.id, "rejected")
                            }
                          >
                            ✕ Reject Market
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </section>

          {/* Section 3: Immutable Audit Logs */}
          <section className="panel" style={{ padding: 24 }}>
            <div style={{ marginBottom: 14 }}>
              <p className="eyebrow">
                IMMUTABLE TRANSACTION & GOVERNANCE AUDIT LOGS
              </p>
              <h2>Audit Trail ({demoAuditLogs.length} entries)</h2>
              <p className="muted">
                Every Market verification, harvest review, offer, reservation,
                delivery confirmation, and dispute/cancellation is logged.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 360,
                overflowY: "auto",
              }}
            >
              {demoAuditLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    fontSize: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    <strong>
                      [{log.id}] {log.action}
                    </strong>{" "}
                    on <code>{log.entityType}</code> ({log.entityId}) —{" "}
                    {log.reason}
                  </span>
                  <span className="muted">
                    {log.actorName} ({log.actorRole.toUpperCase()}) ·{" "}
                    {log.createdAt}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Interactive SMS Fallback Simulator & Dispatcher */}
          <section className="panel" style={{ padding: 24, marginTop: 24 }}>
            <div
              style={{
                background: "#FEF7E6",
                border: "1px solid #FEDF89",
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 16,
                color: "#7A2E0E",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              <strong>⚠️ DEMONSTRATION SIMULATOR ONLY:</strong> This interactive terminal simulates the deterministic SMS command parsing and response generation for low-connectivity rural zones. No live cellular transmission is occurring. In production, this parser is wired to a telecom carrier webhook (e.g., Semaphore Philippines / Twilio SMS).
            </div>

            <div style={{ marginBottom: 14 }}>
              <p className="eyebrow">
                TELECOMMUNICATIONS INTEGRATION & BASIC PHONE FALLBACK (SIMULATOR)
              </p>
              <h2>SMS Fallback Simulator (Interactive Demo Console)</h2>
              <p className="muted">
                Farmers in remote barangays without internet can report harvests, check market demand, or query prices via standard 2G/SMS text messages.
              </p>
            </div>

            <div
              style={{
                background: "var(--surface-soft)",
                border: "1px solid var(--venus-flytrap)",
                borderRadius: 10,
                padding: "10px 16px",
                fontSize: 12,
                color: "var(--bush)",
                marginBottom: 18,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Icon name="swap" size={18} />
              <span>
                <strong>Telco Integration Architecture:</strong> Operates via webhook endpoint{" "}
                <code>/api/sms/inbound</code> connected to Semaphore SMS API or Twilio. This interactive terminal simulates the exact payload parser and automated replies in real time without incurring cellular SMS charges.
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {/* Left Column: Command Reference & Quick Presets */}
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <h3 style={{ fontSize: 15, marginBottom: 8, color: "var(--bush)" }}>
                  Opisyal na SMS Syntax Format
                </h3>
                <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ background: "var(--surface-soft)", padding: 8, borderRadius: 6 }}>
                    <strong>1. Magrehistro ng Ani:</strong>
                    <code style={{ display: "block", marginTop: 2 }}>ANI &lt;CROP&gt; &lt;QTY&gt; &lt;UNIT&gt; &lt;PRICE&gt; &lt;BAYAN&gt; &lt;BRGY&gt;</code>
                  </div>
                  <div style={{ background: "var(--surface-soft)", padding: 8, borderRadius: 6 }}>
                    <strong>2. Magtanong ng Presyo:</strong>
                    <code style={{ display: "block", marginTop: 2 }}>PRESYO &lt;CROP&gt; &lt;BAYAN&gt;</code>
                  </div>
                  <div style={{ background: "var(--surface-soft)", padding: 8, borderRadius: 6 }}>
                    <strong>3. Tingnan ang Demand:</strong>
                    <code style={{ display: "block", marginTop: 2 }}>DEMAND &lt;CROP&gt;</code>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <strong style={{ fontSize: 12, color: "var(--bush)", display: "block", marginBottom: 6 }}>
                    I-click ang sample para masubukan:
                  </strong>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button
                      type="button"
                      className="button secondary"
                      style={{ fontSize: 11, textAlign: "left", padding: "6px 10px" }}
                      onClick={() => setSmsCommandInput("ANI BANANA 100 KG 25 SANTACRUZ ALOBO")}
                    >
                      ANI BANANA 100 KG 25 SANTACRUZ ALOBO
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      style={{ fontSize: 11, textAlign: "left", padding: "6px 10px" }}
                      onClick={() => setSmsCommandInput("PRESYO BANANA BOAC")}
                    >
                      PRESYO BANANA BOAC
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      style={{ fontSize: 11, textAlign: "left", padding: "6px 10px" }}
                      onClick={() => setSmsCommandInput("DEMAND BANANA")}
                    >
                      DEMAND BANANA
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      style={{ fontSize: 11, textAlign: "left", padding: "6px 10px" }}
                      onClick={() => setSmsCommandInput("TULONG")}
                    >
                      TULONG
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Simulated Phone / SMS Terminal */}
              <div
                style={{
                  background: "#0B2E17",
                  border: "2px solid #2D6320",
                  borderRadius: 14,
                  padding: 16,
                  color: "#FFFFFF",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 340,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#C3D187" }}>
                      📱 SMART-ANI TELCO GATEWAY (2158-ANI)
                    </span>
                    <span style={{ fontSize: 10, color: "#94B54F" }}>SIGNAL: 2G/GSM · READY</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                    {smsConversation.map((msg, idx) => (
                      <div
                        key={idx}
                        style={{
                          alignSelf: msg.from === "farmer" ? "flex-end" : "flex-start",
                          background: msg.from === "farmer" ? "#5D912F" : "rgba(255,255,255,0.15)",
                          color: "#FFFFFF",
                          padding: "8px 12px",
                          borderRadius: 10,
                          maxWidth: "85%",
                          fontSize: 12,
                          lineHeight: 1.4,
                        }}
                      >
                        <div style={{ fontSize: 9, opacity: 0.7, marginBottom: 2 }}>
                          {msg.from === "farmer" ? "Magsasaka (0919-XXX-XXXX)" : "SMART-ANI Auto-Reply"} · {msg.time}
                        </div>
                        <pre style={{ margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap" }}>
                          {msg.text}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleSendSms} style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <input
                    aria-label="SMS text input"
                    type="text"
                    value={smsCommandInput}
                    onChange={(e) => setSmsCommandInput(e.target.value)}
                    placeholder="Mag-type ng SMS (hal. ANI BANANA 100 KG 25 BOAC POBLACION)..."
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #5D912F",
                      background: "#FFFFFF",
                      color: "#0B2E17",
                      fontSize: 12,
                    }}
                  />
                  <button
                    type="submit"
                    className="button"
                    style={{ background: "#5D912F", borderColor: "#94B54F", color: "#FFFFFF", fontSize: 12, padding: "0 14px" }}
                  >
                    Ipadala ↗
                  </button>
                </form>
              </div>
            </div>
            {!!smsFeedback && (
              <p style={{ marginTop: 10, fontSize: 12, color: "var(--bright-nori)", fontWeight: 700 }}>
                {smsFeedback}
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
