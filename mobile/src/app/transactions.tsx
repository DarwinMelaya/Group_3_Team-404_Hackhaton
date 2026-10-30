import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import {
  Choices,
  colors,
  Field,
  Heading,
  Page,
  styles,
} from "../components/ui";
import {
  CROPS,
  FARMING_GUIDES,
  generateSmsReply,
  MARINDUQUE_PROCESSING_FACILITIES,
  MUNICIPALITIES,
  OFFLINE_FAQS,
  parseSmsCommand,
  unitLabel,
  VALUE_ADD_OPPORTUNITIES,
} from "../lib/harvest";
import { useHarvests } from "../lib/harvest-store";

type ActiveTab = "demand" | "facilities" | "sms" | "guide";

export default function Transactions() {
  const {
    mode,
    harvests,
    marketDemands,
    allocations,
    allocateToMarket,
    markInDelivery,
    cancelAllocation,
    demoRespondToAllocation,
    demoConfirmDelivery,
    resetDemoScenario,
  } = useHarvests();

  const { harvestId: initialHarvestId, tab: initialTab } = useLocalSearchParams<{
    harvestId?: string;
    tab?: string;
  }>();

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    (initialTab as ActiveTab) || "demand",
  );

  // Demand Board Filters
  const [cropFilter, setCropFilter] = useState<string>("All");
  const [municipalityFilter, setMunicipalityFilter] = useState<string>("All");
  const [minPriceFilter, setMinPriceFilter] = useState<string>("");

  // Allocation Form State
  const availableHarvests = harvests.filter(
    (h) => (h.remainingKg ?? h.quantity) > 0 && h.status !== "rejected",
  );
  const [selectedHarvestId, setSelectedHarvestId] = useState<string>(
    initialHarvestId ?? availableHarvests[0]?.id ?? "",
  );
  const [selectedDemandId, setSelectedDemandId] = useState<string>(
    marketDemands[0]?.id ?? "",
  );
  const [allocateQty, setAllocateQty] = useState<string>("");
  const [conversionRatioInput, setConversionRatioInput] = useState<string>("50");
  const [offerNotes, setOfferNotes] = useState<string>("");
  const [partialReceiptInputs, setPartialReceiptInputs] = useState<
    Record<string, string>
  >({});

  // Facilities Tab State
  const [facilityTownFilter, setFacilityTownFilter] = useState<string>("All");

  // SMS Console State (Simulation Demo)
  const [smsInput, setSmsInput] = useState<string>(
    "ANI BANANA 100 KG 25 SANTACRUZ ALOBO",
  );
  const [smsLog, setSmsLog] = useState<
    { command: string; reply: string; timestamp: string }[]
  >([
    {
      command: "PRESYO BANANA SANTACRUZ",
      reply:
        "SMART-ANI Presyo sa Santa Cruz: • Banana (Saba): ₱25–₱30/kg (Grade A). Demand: 3 aktibong mamimili. (Simulated Demo Reply)",
      timestamp: "10:30 AM",
    },
  ]);

  // Decision Support & Value-Add State
  const [selectedVaId, setSelectedVaId] = useState<string>("VA-BANANA-CHIPS");
  const [vaBatchInput, setVaBatchInput] = useState<string>("100");
  const [offlineCached, setOfflineCached] = useState<boolean>(true);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const activeHarvest =
    availableHarvests.find((h) => h.id === selectedHarvestId) ??
    availableHarvests[0] ??
    null;

  const filteredDemands = marketDemands.filter((demand) => {
    if (cropFilter !== "All" && demand.crop !== cropFilter) return false;
    if (
      municipalityFilter !== "All" &&
      demand.municipality !== municipalityFilter
    )
      return false;
    if (
      minPriceFilter.trim() &&
      Number.isFinite(Number(minPriceFilter)) &&
      demand.offeredPricePerKg < Number(minPriceFilter)
    )
      return false;
    return true;
  });

  const activeDemand =
    filteredDemands.find((d) => d.id === selectedDemandId) ??
    filteredDemands[0] ??
    null;

  const filteredFacilities = MARINDUQUE_PROCESSING_FACILITIES.filter(
    (fac) => facilityTownFilter === "All" || fac.municipality === facilityTownFilter,
  );

  const activeVaOpportunity =
    VALUE_ADD_OPPORTUNITIES.find((v) => v.id === selectedVaId) ??
    VALUE_ADD_OPPORTUNITIES[0];

  const parsedVaInput = Math.max(1, Number(vaBatchInput) || activeVaOpportunity.standardInputKg);
  const vaBatchRatio = parsedVaInput / activeVaOpportunity.standardInputKg;
  const vaRawCost = parsedVaInput * activeVaOpportunity.rawPricePerKg;
  const vaOutputMassKg = parsedVaInput * activeVaOpportunity.yieldRatio;
  const vaProductOutput = activeVaOpportunity.densityKgPerLiter
    ? Number((vaOutputMassKg / activeVaOpportunity.densityKgPerLiter).toFixed(2))
    : vaOutputMassKg;
  const vaGrossRev = Math.round(vaProductOutput * activeVaOpportunity.productPricePerKg);
  const vaProcessingCost = Math.round(activeVaOpportunity.processingCostPerBatch * vaBatchRatio);
  const vaNetProfit = vaGrossRev - vaRawCost - vaProcessingCost;

  async function handleAllocateSubmit() {
    if (busy) return;
    setActionError("");
    setNotice("");
    if (!activeHarvest) {
      setActionError("Pumili ng isa sa iyong mga ani na may natitirang stock.");
      return;
    }
    if (!activeDemand) {
      setActionError("Pumili ng pamilihang nangangailangan ng ani sa ibaba.");
      return;
    }
    const qty = Number(allocateQty);
    if (!allocateQty.trim() || !Number.isFinite(qty) || qty <= 0) {
      setActionError(
        `Maglagay ng wastong dami sa ${unitLabel(activeDemand.unit ?? "kg")}.`,
      );
      return;
    }

    const harvestUnit = activeHarvest.unit ?? "kg";
    const demandUnit = activeDemand.unit ?? "kg";
    const unitsDiffer = harvestUnit !== demandUnit;

    setBusy(true);
    try {
      const created = await allocateToMarket({
        harvestId: activeHarvest.id,
        demandId: activeDemand.id,
        quantityKg: qty,
        conversionRatioToKg: unitsDiffer
          ? Number(conversionRatioInput)
          : undefined,
        agreedPricePerKg:
          activeDemand.unitPricePhp ?? activeDemand.offeredPricePerKg,
        offerNotes,
      });
      setAllocateQty("");
      setOfferNotes("");
      setNotice(
        `Naipasa ang alok na ${created.allocatedQuantityKg} ${unitLabel(created.unit)} ${created.crop} papunta sa ${created.marketName} (Katayuan: pending_acceptance).`,
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not allocate harvest.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickSplitAllocate(
    demandId: string,
    quantityKg: number,
  ) {
    if (busy || !activeHarvest) return;
    setActionError("");
    setNotice("");
    setBusy(true);
    try {
      const demand = marketDemands.find((d) => d.id === demandId);
      const created = await allocateToMarket({
        harvestId: activeHarvest.id,
        demandId,
        quantityKg,
        agreedPricePerKg: demand?.offeredPricePerKg,
        offerNotes: `Direct Farmer allocation of ${quantityKg} kg`,
      });
      setNotice(
        `Inialok ang ${created.allocatedQuantityKg} kg ${created.crop} sa ${created.marketName}. Natitirang ani: ${Math.max(0, (activeHarvest.remainingKg ?? activeHarvest.quantity) - quantityKg)} kg.`,
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not allocate harvest.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusAction(fn: () => Promise<void>) {
    if (busy) return;
    setActionError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleSendSmsSimulated(cmdToRun?: string) {
    const text = (cmdToRun ?? smsInput).trim();
    if (!text) return;
    const parsed = parseSmsCommand(text);
    const reply = generateSmsReply(parsed);
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    setSmsLog((prev) => [{ command: text, reply, timestamp }, ...prev]);
    if (!cmdToRun) setSmsInput("");
  }

  return (
    <Page>
      <Heading
        title="Transactions & Value-Add"
        description="Demand matching, multi-market harvest distribution, processing facilities across Marinduque, and low-connectivity SMS fallback."
      />

      {/* TOP NAVIGATION TABS */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          backgroundColor: colors.surfaceSoft,
          padding: 6,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {[
          { key: "demand", label: "Pamilihan & Alokasyon" },
          { key: "facilities", label: "Pasilidad (Sample Demo)" },
          { key: "sms", label: "SMS Simulator (Demo)" },
          { key: "guide", label: "Gabay at Tubo (Decision Support)" },
        ].map((tab) => {
          const isCurrent = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key as ActiveTab)}
              style={{
                flex: 1,
                minWidth: 130,
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: isCurrent ? colors.brightNori : "transparent",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: isCurrent ? colors.white : colors.bush,
                  textAlign: "center",
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!!notice && (
        <Text role="status" style={styles.badge}>
          {notice}
        </Text>
      )}
      {!!actionError && (
        <Text
          role="alert"
          style={{
            color: colors.dangerText,
            backgroundColor: colors.dangerBg,
            borderColor: colors.dangerBorder,
            borderWidth: 1,
            padding: 13,
            borderRadius: 12,
            fontWeight: "700",
          }}
        >
          {actionError}
        </Text>
      )}

      {/* TAB 1: DEMAND BOARD & HARVEST ALLOCATION */}
      {activeTab === "demand" && (
        <>
          {/* 1. FARMER INVENTORY & ALLOCATION FORM */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceSoft,
                borderColor: colors.maximumGreen,
              },
            ]}
          >
            <View style={styles.row}>
              <Text style={styles.sectionLabel}>
                1. SELECT YOUR HARVEST TO ALLOCATE
              </Text>
              {mode === "demo" && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    void handleStatusAction(async () => {
                      await resetDemoScenario();
                      setNotice(
                        "Reset to official 100 kg Banana (Santa Cruz) & Market 1 (40 kg), Market 2 (35 kg), Market 3 (25 kg) scenario.",
                      );
                    })
                  }
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.brightNori,
                    backgroundColor: colors.white,
                  }}
                >
                  <Text
                    style={{ fontSize: 11, fontWeight: "800", color: colors.bush }}
                  >
                    ↻ Reset 100 kg Banana Scenario
                  </Text>
                </Pressable>
              )}
            </View>

            {availableHarvests.length === 0 ? (
              <Text style={styles.subtitle}>
                All of your current harvest listings have 0 kg remaining to
                allocate, or no verified harvest is available. Add a new harvest or
                release a pending offer below.
              </Text>
            ) : (
              <>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {availableHarvests.map((item) => {
                    const selected = item.id === activeHarvest?.id;
                    const rem = item.remainingKg ?? item.quantity;
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        onPress={() => setSelectedHarvestId(item.id)}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: selected ? colors.brightNori : colors.border,
                          backgroundColor: selected
                            ? colors.softCelery
                            : colors.white,
                        }}
                      >
                        <Text
                          style={{
                            fontWeight: "800",
                            color: colors.bush,
                            fontSize: 13,
                          }}
                        >
                          {selected ? "✓ " : ""}
                          {item.crop} ({item.municipality}) · {rem} kg remaining of{" "}
                          {item.quantity} kg
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {activeHarvest && (
                  <View
                    style={{
                      backgroundColor: colors.white,
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 4,
                    }}
                  >
                    <Text
                      style={{ fontWeight: "800", color: colors.bush, fontSize: 14 }}
                    >
                      Selected Inventory: {activeHarvest.crop} (
                      {activeHarvest.municipality}) — Total:{" "}
                      {activeHarvest.quantity} kg | Offered:{" "}
                      {activeHarvest.earmarkedKg ?? 0} kg | Reserved:{" "}
                      {activeHarvest.reservedKg ?? 0} kg | Delivered:{" "}
                      {activeHarvest.deliveredKg ?? 0} kg
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.brightNori, fontWeight: "700" }}>
                      Remaining Available for Allocation:{" "}
                      {activeHarvest.remainingKg ?? activeHarvest.quantity} kg
                    </Text>
                    {activeHarvest.gpsCoordinates && (
                      <Text style={{ fontSize: 11, color: colors.muted }}>
                        📍 Sakahan GPS: {activeHarvest.gpsCoordinates} · Ani: {activeHarvest.harvestDate}
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}
          </View>

          {/* 2. MATCHING MARKET DEMAND BOARD */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>
              2. MATCHING MARKET DEMAND BOARD (MARINDUQUE)
            </Text>
            <Choices
              label="Filter demand by crop"
              values={["All", ...CROPS]}
              value={cropFilter}
              onChange={setCropFilter}
            />
            <Choices
              label="Filter demand by municipality"
              values={["All", ...MUNICIPALITIES]}
              value={municipalityFilter}
              onChange={setMunicipalityFilter}
            />
            <Field
              label="Minimum offered price (PHP / kg)"
              placeholder="e.g. 25"
              keyboardType="decimal-pad"
              value={minPriceFilter}
              onChangeText={setMinPriceFilter}
            />
          </View>

          {filteredDemands.map((demand) => {
            const isSelected = activeDemand?.id === demand.id;
            const canQuickFill =
              activeHarvest &&
              activeHarvest.crop === demand.crop &&
              demand.remainingDemandKg > 0 &&
              (activeHarvest.remainingKg ?? activeHarvest.quantity) >=
                demand.remainingDemandKg;

            return (
              <View
                key={demand.id}
                style={[
                  styles.card,
                  {
                    borderLeftWidth: 5,
                    borderLeftColor: isSelected
                      ? colors.brightNori
                      : colors.maximumGreen,
                  },
                ]}
              >
                <View style={styles.row}>
                  <View style={{ gap: 2 }}>
                    <Text style={styles.heading}>
                      {demand.marketName} ({demand.crop})
                    </Text>
                    <Text style={styles.subtitle}>
                      {demand.barangay}, {demand.municipality} · Preferred:{" "}
                      {demand.preferredQualityGrade} · Due {demand.requiredBy}
                    </Text>
                  </View>
                  <Text style={styles.badge}>
                    ₱{demand.offeredPricePerKg}/kg ·{" "}
                    {demand.acceptPartial ? "Partial OK" : "Full Lot Only"}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: colors.surfaceSoft,
                    padding: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <Text style={{ fontWeight: "800", color: colors.bush }}>
                    Remaining Demand: {demand.remainingDemandKg} kg
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    Required: {demand.requiredQuantityKg} kg | Reserved:{" "}
                    {demand.reservedQuantityKg} kg | Fulfilled:{" "}
                    {demand.fulfilledQuantityKg} kg
                  </Text>
                </View>

                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {demand.qualityNotes}
                </Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedDemandId(demand.id);
                      if (demand.remainingDemandKg > 0) {
                        setAllocateQty(String(demand.remainingDemandKg));
                      }
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: colors.brightNori,
                      backgroundColor: isSelected
                        ? colors.softCelery
                        : colors.white,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.bush,
                        fontWeight: "800",
                        fontSize: 12,
                      }}
                    >
                      {isSelected
                        ? "✓ Selected for Custom Allocation"
                        : "Select Market"}
                    </Text>
                  </Pressable>

                  {canQuickFill && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() =>
                        void handleQuickSplitAllocate(
                          demand.id,
                          demand.remainingDemandKg,
                        )
                      }
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 10,
                        backgroundColor: colors.brightNori,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.white,
                          fontWeight: "800",
                          fontSize: 12,
                        }}
                      >
                        Offer {demand.remainingDemandKg} kg to {demand.marketName} →
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}

          {/* 3. CUSTOM QUANTITY ALLOCATION FORM */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>
              3. MAGPADALA NG ALOK SA PAMILIHAN (SUBMIT SUPPLY OFFER)
            </Text>
            <Text style={styles.subtitle}>
              Target na Pamilihan (Target Market):{" "}
              {activeDemand
                ? `${activeDemand.marketName} (${activeDemand.remainingDemandKg} ${unitLabel(activeDemand.unit)} ${activeDemand.crop} kailangan @ ${activeDemand.buyingType === "bulk_lot" ? `₱${activeDemand.totalPricePhp ?? activeDemand.offeredPricePerKg} pakyawan` : `₱${activeDemand.unitPricePhp ?? activeDemand.offeredPricePerKg}/${unitLabel(activeDemand.unit)}`})`
                : "Pumili ng Pamilihan sa itaas"}
            </Text>
            <Field
              label={`Dami na Iaalok (${unitLabel(activeDemand?.unit)})`}
              helper={`Ilagay ang dami sa ${unitLabel(activeDemand?.unit)}. Hindi lalampas sa iyong natitirang ani.`}
              placeholder="Hal. 40"
              keyboardType="decimal-pad"
              value={allocateQty}
              onChangeText={setAllocateQty}
            />
            {activeHarvest &&
              activeDemand &&
              (activeHarvest.unit ?? "kg") !== (activeDemand.unit ?? "kg") && (
                <Field
                  label={`Napagkasunduang Conversion (kg bawat ${unitLabel(activeDemand.unit === "kg" ? activeHarvest.unit : activeDemand.unit)})`}
                  helper="Ilang kilo ang katumbas bawat yunit upang maikaltas nang wasto sa iyong imbentaryo."
                  placeholder="Hal. 50"
                  keyboardType="decimal-pad"
                  value={conversionRatioInput}
                  onChangeText={setConversionRatioInput}
                />
              )}
            <Field
              label="Mensahe / Paalala sa Paghahatid (opsyonal)"
              placeholder="Hal. Ihahatid bukas ng umaga gamit ang traysikel"
              value={offerNotes}
              onChangeText={setOfferNotes}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy || !activeHarvest || !activeDemand}
              onPress={() => void handleAllocateSubmit()}
              style={[
                styles.button,
                {
                  opacity: busy || !activeHarvest || !activeDemand ? 0.5 : 1,
                },
              ]}
            >
              <Text style={styles.buttonText}>
                {busy ? "Ipinapasa…" : "Magpadala ng Alok (Send Supply Offer)"}
              </Text>
            </Pressable>
          </View>

          {/* 4. ACTIVE OFFERS, RESERVATIONS & DELIVERY HISTORY */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>
              4. AKING MGA PAGHAHATID AT RESERBASYON (MY DELIVERIES:{" "}
              {allocations.length})
            </Text>
            {allocations.length === 0 ? (
              <Text style={styles.subtitle}>
                Wala pang alok sa pamilihan. Piliin ang iyong ani at mag-alok sa isa
                o higit pang mga pamilihan sa itaas.
              </Text>
            ) : (
              allocations.map((alloc) => {
                const pInput =
                  partialReceiptInputs[alloc.id] ??
                  String(alloc.outstandingQuantityKg);
                return (
                  <View
                    key={alloc.id}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      padding: 14,
                      gap: 8,
                      backgroundColor: colors.surfaceSoft,
                    }}
                  >
                    <View style={styles.row}>
                      <View>
                        <Text style={styles.heading}>
                          {alloc.crop} · {alloc.allocatedQuantityKg}{" "}
                          {unitLabel(alloc.unit)} → {alloc.marketName}
                        </Text>
                        <Text style={styles.subtitle}>
                          Presyo:{" "}
                          {alloc.buyingType === "bulk_lot"
                            ? `₱${alloc.totalAgreedPrice ?? alloc.agreedPricePerKg} pakyawan (bulk lot)`
                            : `₱${alloc.agreedPricePerKg}/${unitLabel(alloc.unit)}`}
                        </Text>
                      </View>
                      <Text style={styles.badge}>
                        Katayuan: {alloc.status.toUpperCase()}
                      </Text>
                    </View>

                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.bush,
                        fontWeight: "700",
                      }}
                    >
                      Allocated: {alloc.allocatedQuantityKg} kg | Delivered:{" "}
                      {alloc.deliveredQuantityKg} kg | Released:{" "}
                      {alloc.releasedQuantityKg} kg | Outstanding Committed:{" "}
                      {alloc.outstandingQuantityKg} kg
                    </Text>

                    {!!alloc.responseNotes && (
                      <Text style={{ fontSize: 12, color: colors.muted }}>
                        Note: {alloc.responseNotes}
                      </Text>
                    )}

                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                    >
                      {alloc.status === "reserved" && (
                        <Pressable
                          accessibilityRole="button"
                          disabled={busy}
                          onPress={() =>
                            void handleStatusAction(async () => {
                              await markInDelivery(
                                alloc.id,
                                "Dispatched from farm",
                              );
                              setNotice(
                                `Marked ${alloc.allocatedQuantityKg} kg for ${alloc.marketName} as In Delivery.`,
                              );
                            })
                          }
                          style={{
                            backgroundColor: colors.brightNori,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.white,
                              fontWeight: "700",
                              fontSize: 12,
                            }}
                          >
                            Mark In Delivery
                          </Text>
                        </Pressable>
                      )}

                      {(alloc.status === "pending_acceptance" ||
                        alloc.status === "proposed" ||
                        alloc.status === "reserved") && (
                        <Pressable
                          accessibilityRole="button"
                          disabled={busy}
                          onPress={() =>
                            void handleStatusAction(async () => {
                              await cancelAllocation(
                                alloc.id,
                                "Cancelled by farmer; restoring unfulfilled quantity.",
                              );
                              setNotice(
                                `Cancelled allocation and restored ${alloc.outstandingQuantityKg} kg back to your remaining harvest.`,
                              );
                            })
                          }
                          style={{
                            backgroundColor: colors.white,
                            borderWidth: 1,
                            borderColor: colors.dangerText,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.dangerText,
                              fontWeight: "700",
                              fontSize: 12,
                            }}
                          >
                            Cancel & Restore Stock
                          </Text>
                        </Pressable>
                      )}

                      {/* DEMO MODE SIMULATION ACTIONS FOR TESTING */}
                      {mode === "demo" &&
                        (alloc.status === "pending_acceptance" ||
                          alloc.status === "proposed") && (
                          <>
                            <Pressable
                              accessibilityRole="button"
                              disabled={busy}
                              onPress={() =>
                                void handleStatusAction(async () => {
                                  await demoRespondToAllocation(
                                    alloc.id,
                                    "reserved",
                                    "Accepted by Market (Demo Simulation)",
                                  );
                                  setNotice(
                                    `${alloc.marketName} accepted & reserved ${alloc.allocatedQuantityKg} kg.`,
                                  );
                                })
                              }
                              style={{
                                backgroundColor: colors.softCelery,
                                borderWidth: 1,
                                borderColor: colors.brightNori,
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.bush,
                                  fontWeight: "800",
                                  fontSize: 12,
                                }}
                              >
                                [Demo Market] ✓ Accept & Reserve
                              </Text>
                            </Pressable>

                            <Pressable
                              accessibilityRole="button"
                              disabled={busy}
                              onPress={() =>
                                void handleStatusAction(async () => {
                                  await demoRespondToAllocation(
                                    alloc.id,
                                    "rejected",
                                    "Rejected by Market (Demo Simulation)",
                                  );
                                  setNotice(
                                    `${alloc.marketName} rejected offer; ${alloc.allocatedQuantityKg} kg restored to your available stock.`,
                                  );
                                })
                              }
                              style={{
                                backgroundColor: colors.white,
                                borderWidth: 1,
                                borderColor: colors.border,
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.bush,
                                  fontWeight: "700",
                                  fontSize: 12,
                                }}
                              >
                                [Demo Market] ✕ Reject Offer
                              </Text>
                            </Pressable>
                          </>
                        )}
                    </View>

                    {mode === "demo" &&
                      (alloc.status === "reserved" ||
                        alloc.status === "in_delivery" ||
                        alloc.status === "partially_delivered") && (
                        <View
                          style={{
                            marginTop: 6,
                            paddingTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                            gap: 8,
                          }}
                        >
                          <Field
                            label={`[Demo Market Receipt] Actual received kg (max ${alloc.outstandingQuantityKg} kg)`}
                            value={pInput}
                            keyboardType="decimal-pad"
                            onChangeText={(val) =>
                              setPartialReceiptInputs((prev) => ({
                                ...prev,
                                [alloc.id]: val,
                              }))
                            }
                          />
                          <View
                            style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            <Pressable
                              accessibilityRole="button"
                              disabled={busy}
                              onPress={() =>
                                void handleStatusAction(async () => {
                                  const rec = Number(pInput);
                                  await demoConfirmDelivery(
                                    alloc.id,
                                    rec,
                                    false,
                                    "Market confirmed actual receipt",
                                  );
                                  setNotice(
                                    `Confirmed receipt of ${rec} kg at ${alloc.marketName}.`,
                                  );
                                })
                              }
                              style={{
                                backgroundColor: colors.brightNori,
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.white,
                                  fontWeight: "800",
                                  fontSize: 12,
                                }}
                              >
                                [Demo Market] ✓ Confirm Delivery Receipt
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      )}
                  </View>
                );
              })
            )}
          </View>
        </>
      )}

      {/* TAB 2: PROCESSING FACILITIES DIRECTORY ACROSS 6 MUNICIPALITIES (SAMPLE DEMO) */}
      {activeTab === "facilities" && (
        <>
          {/* EXPLICIT DEMO NOTICE BANNER */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: "#FEF7E6",
                borderColor: "#FEDF89",
                borderLeftWidth: 5,
                borderLeftColor: "#B54708",
                gap: 6,
              },
            ]}
          >
            <Text
              style={{
                color: "#B54708",
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 1,
              }}
            >
              ⚠️ SAMPLE / DEMONSTRATION DATA (6 MUNICIPALITIES)
            </Text>
            <Text
              style={{
                color: "#7A2E0E",
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              Ang direktoryong ito ay naglalaman ng mga sample / demonstration fixture para sa 6 na bayan ng Marinduque. Ang mga kontak, bayad sa pagproseso, at kagamitan ay mga halimbawa para sa pagpapakita ng UI/UX sa hackathon at HINDI opisyal na beripikadong pasilidad ng gobyerno o DTI.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceSoft,
                borderColor: colors.brightNori,
              },
            ]}
          >
            <View style={styles.row}>
              <View>
                <Text style={styles.sectionLabel}>
                  MARINDUQUE PROCESSING DIRECTORY (DEMO FIXTURES)
                </Text>
                <Text style={styles.heading}>
                  Sample Directory ng mga Pasilidad (6 Bayan)
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: "#B54708",
                  backgroundColor: "#FEF7E6",
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "#FEDF89",
                }}
              >
                SAMPLE / DEMO DATA
              </Text>
            </View>
            <Text style={styles.subtitle}>
              Pumili ng bayan upang makita ang mga halimbawang sentro sa Boac, Mogpog, Santa Cruz, Torrijos, Buenavista, at Gasan.
            </Text>
            <Choices
              label="Piliin ang Bayan (Filter Municipality)"
              values={["All", ...MUNICIPALITIES]}
              value={facilityTownFilter}
              onChange={setFacilityTownFilter}
            />
          </View>

          {filteredFacilities.map((fac) => (
            <View
              key={fac.id}
              style={[
                styles.card,
                {
                  borderLeftWidth: 5,
                  borderLeftColor: colors.brightNori,
                  gap: 10,
                },
              ]}
            >
              <View style={styles.row}>
                <View style={{ gap: 2 }}>
                  <Text style={styles.heading}>{fac.name}</Text>
                  <Text style={styles.subtitle}>
                    {fac.barangay}, {fac.municipality} · {fac.address}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color: "#B54708",
                    backgroundColor: "#FEF7E6",
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: "#FEDF89",
                  }}
                >
                  SAMPLE DEMO FIXTURE
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: colors.surfaceSoft,
                  padding: 10,
                  borderRadius: 8,
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: colors.bush,
                  }}
                >
                  Mga Tinatanggap na Ani: {fac.acceptedCrops.join(", ")}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  Bayad sa Pagproseso (Sample Fee): {fac.processingFeeDescription}
                </Text>
              </View>

              <View style={{ gap: 2 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: colors.brightNori,
                    letterSpacing: 0.5,
                  }}
                >
                  KAGAMITAN AT MAKINARYA (EQUIPMENT):
                </Text>
                {fac.capabilities.map((cap, i) => (
                  <Text key={i} style={{ fontSize: 12, color: colors.bush }}>
                    • {cap}
                  </Text>
                ))}
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: 8,
                }}
              >
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  👤 Kontak: <Text style={{ fontWeight: "700" }}>{fac.contactPerson}</Text> ({fac.contactPhone})
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  🕒 {fac.operatingHours} · 📍 {fac.latitude.toFixed(4)}°N, {fac.longitude.toFixed(4)}°E
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* TAB 3: SMS FALLBACK SIMULATOR (DEMO) */}
      {activeTab === "sms" && (
        <>
          <View
            style={[
              styles.card,
              {
                backgroundColor: "#FEF7E6",
                borderColor: "#FEDF89",
                borderLeftWidth: 5,
                borderLeftColor: "#B54708",
                gap: 6,
              },
            ]}
          >
            <Text
              style={{
                color: "#B54708",
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 1,
              }}
            >
              ⚠️ DEMONSTRATION SIMULATOR ONLY
            </Text>
            <Text
              style={{
                color: "#7A2E0E",
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              Ang console na ito ay isang interactive simulation ng deterministic SMS routing. Hindi ito nagpapadala ng totoong cellular SMS dahil walang live telecom gateway o GSM modem na konektado. Sa live deployment, ito ay ikinakabit sa Semaphore Philippines o Twilio Webhook.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceSoft,
                borderColor: colors.brightNori,
              },
            ]}
          >
            <Text style={styles.sectionLabel}>
              SMS FALLBACK SIMULATOR (WEBHOOK COMPATIBLE)
            </Text>
            <Text style={styles.heading}>
              Simulator ng Pag-uulat ng Ani Gamit ang SMS
            </Text>
            <Text style={styles.subtitle}>
              Subukan ang deterministic command routing para sa mga barangay na walang cellular data. Sumusuporta sa ANI, PRESYO, DEMAND, at TULONG syntax.
            </Text>

            <View style={{ gap: 6, marginTop: 4 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: colors.brightNori,
                  letterSpacing: 0.5,
                }}
              >
                MABILISANG UTOS (QUICK SMS PRESETS):
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  {
                    label: "ANI BANANA (Santa Cruz)",
                    cmd: "ANI BANANA 100 KG 25 SANTACRUZ ALOBO",
                  },
                  {
                    label: "PRESYO SABA",
                    cmd: "PRESYO BANANA SANTACRUZ",
                  },
                  {
                    label: "DEMAND SABA",
                    cmd: "DEMAND BANANA",
                  },
                  {
                    label: "TULONG (Syntax Help)",
                    cmd: "TULONG",
                  },
                ].map((item) => (
                  <Pressable
                    key={item.label}
                    onPress={() => {
                      setSmsInput(item.cmd);
                      handleSendSmsSimulated(item.cmd);
                    }}
                    style={{
                      backgroundColor: colors.white,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: colors.bush,
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>SIMULATED SMS DISPATCHER</Text>
            <Field
              label="SMS Text Message (Syntax)"
              placeholder="Hal. ANI BANANA 100 KG 25 SANTACRUZ ALOBO"
              value={smsInput}
              onChangeText={setSmsInput}
              helper="Syntax: ANI <PANANIM> <DAMI> <YUNIT> <PRESYO> <BAYAN> <BARANGAY>"
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => handleSendSmsSimulated()}
              style={[
                styles.button,
                {
                  backgroundColor: colors.brightNori,
                  opacity: smsInput.trim() ? 1 : 0.6,
                },
              ]}
            >
              <Text style={styles.buttonText}>
                Subukan ang SMS Command (Simulate Gateway)
              </Text>
            </Pressable>
          </View>

          {/* SMS TERMINAL LOG */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.bush,
                borderColor: colors.brightNori,
                gap: 12,
              },
            ]}
          >
            <View style={styles.row}>
              <Text
                style={{
                  color: colors.softCelery,
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 1.2,
                }}
              >
                SMS SIMULATOR AUDIT & REPLY LOG
              </Text>
              <Text
                style={{
                  color: colors.softCelery,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {smsLog.length} messages
              </Text>
            </View>

            {smsLog.map((log, idx) => (
              <View
                key={idx}
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: colors.softCelery,
                  paddingLeft: 12,
                  gap: 4,
                }}
              >
                <View style={styles.row}>
                  <Text
                    style={{
                      color: colors.white,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    OUTGOING: &quot;{log.command}&quot;
                  </Text>
                  <Text style={{ color: colors.softCelery, fontSize: 10 }}>
                    {log.timestamp}
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.softCelery,
                    fontSize: 12,
                    lineHeight: 18,
                    fontFamily: "monospace",
                  }}
                >
                  {log.reply}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* TAB 4: RULE-BASED DECISION SUPPORT & VALUE-ADD PROFIT CALCULATOR */}
      {activeTab === "guide" && (
        <>
          {/* RULE-BASED DISCLOSURE BANNER */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceSoft,
                borderColor: colors.brightNori,
                borderLeftWidth: 5,
                borderLeftColor: colors.bush,
                gap: 6,
              },
            ]}
          >
            <Text
              style={{
                color: colors.bush,
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 1,
              }}
            >
              🧠 RULE-BASED EXPERT DECISION SUPPORT ENGINE
            </Text>
            <Text
              style={{
                color: colors.bush,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              Ang mga sumusunod na gabay at kalkulasyon ay pinapagana ng deterministic agricultural decision rules (hango sa mga pananaliksik ng DA-BAR at PCARRD). Dinisenyo ito para sa 100% offline access sa bukid at hindi nangangailangan ng live generative AI cloud API.
            </Text>
          </View>

          {/* ADVISORY DISCLAIMER BANNER */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.softCelery,
                borderColor: colors.brightNori,
                borderLeftWidth: 5,
                borderLeftColor: colors.bush,
                gap: 6,
              },
            ]}
          >
            <Text
              style={{
                color: colors.bush,
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 1,
              }}
            >
              ⚠️ MAHALAGANG PAALALA UKOL SA FRESHNESS AT KALIGTASAN SA PAGKAIN
            </Text>
            <Text
              style={{
                color: colors.bush,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              Ang mga pagtatantya ng natitirang panahon bago masira ay mga payo lamang upang makatulong sa mabilisang pamamahagi. HINDI ito garantiya ng food safety expiration date. Laging suriin ang amoy, kulay, at kalidad ng produkto bago kainin o iproseso.
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={() => {
                  setOfflineCached((c) => !c);
                  setNotice(
                    offlineCached
                      ? "Nai-clear ang offline package cache."
                      : "Matagumpay na na-download at naka-cache ang Gabay, Pasilidad, at Presyo sa mobile storage!",
                  );
                }}
                style={{
                  backgroundColor: colors.white,
                  borderWidth: 1,
                  borderColor: colors.brightNori,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: colors.bush,
                  }}
                >
                  {offlineCached
                    ? "✓ Offline Package Na-download Na"
                    : "⬇ I-download ang Offline Package"}
                </Text>
              </Pressable>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                100% Offline-ready sa sakahan
              </Text>
            </View>
          </View>

          {/* 1. VALUE-ADD PROFIT CALCULATOR */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>
              PROCESSED-PRODUCT PROFIT CALCULATOR (4 PATHWAYS)
            </Text>
            <Text style={styles.heading}>
              Kalkulador ng Tubo sa Pagpoproseso ng Ani
            </Text>
            <Text style={styles.subtitle}>
              Pumili ng isa sa apat na produkto upang makita ang projected net incremental profit kumpara sa pagbebenta ng hilaw na ani.
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {VALUE_ADD_OPPORTUNITIES.map((opp) => {
                const selected = opp.id === selectedVaId;
                return (
                  <Pressable
                    key={opp.id}
                    onPress={() => {
                      setSelectedVaId(opp.id);
                      setVaBatchInput(String(opp.standardInputKg));
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: selected ? colors.brightNori : colors.border,
                      backgroundColor: selected
                        ? colors.softCelery
                        : colors.white,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: colors.bush,
                      }}
                    >
                      {selected ? "✓ " : ""}
                      {opp.productName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Field
              label={`Dami ng Hilaw na Pananim (${activeVaOpportunity.crop} sa ${activeVaOpportunity.inputUnit})`}
              value={vaBatchInput}
              keyboardType="decimal-pad"
              onChangeText={setVaBatchInput}
              helper={`Standard batch: ${activeVaOpportunity.standardInputKg} kg. Sample raw price: ₱${activeVaOpportunity.rawPricePerKg}/kg.`}
            />

            <View
              style={{
                backgroundColor: colors.surfaceSoft,
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: colors.bush,
                }}
              >
                PROYEKSIYON: {activeVaOpportunity.productName} ({parsedVaInput} {activeVaOpportunity.inputUnit})
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    Hilaw na Halaga (Raw Value):
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: colors.bush,
                    }}
                  >
                    ₱{vaRawCost.toLocaleString()}
                  </Text>
                </View>

                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    Inaasahang Ani (Yield):
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: colors.brightNori,
                    }}
                  >
                    {vaProductOutput.toFixed(2)} {activeVaOpportunity.outputUnit}
                  </Text>
                  {!!activeVaOpportunity.densityKgPerLiter && (
                    <Text style={{ fontSize: 10, color: colors.muted }}>
                      *Mass: {vaOutputMassKg.toFixed(1)} kg langis @ {activeVaOpportunity.densityKgPerLiter} kg/L
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    Kabuuang Benta (Gross Rev):
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: colors.bush,
                    }}
                  >
                    ₱{vaGrossRev.toLocaleString()}
                  </Text>
                </View>

                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    Gastos sa Pagproseso:
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: colors.dangerText,
                    }}
                  >
                    ₱{vaProcessingCost.toLocaleString()}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: colors.white,
                  padding: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.brightNori,
                }}
              >
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  Net Added Profit (Karagdagang Tubo Higit sa Hilaw na Benta):
                </Text>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "900",
                    color: colors.brightNori,
                  }}
                >
                  +₱{vaNetProfit.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                  Makinarya: {activeVaOpportunity.primaryEquipment}
                </Text>
                {!!activeVaOpportunity.byProducts && (
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    By-products: {activeVaOpportunity.byProducts}
                  </Text>
                )}
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Kondisyon: {activeVaOpportunity.assumptions}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: "#B54708",
                    fontStyle: "italic",
                    marginTop: 2,
                  }}
                >
                  *{activeVaOpportunity.sampleDisclosure}
                </Text>
              </View>
            </View>
          </View>

          {/* 2. CROP STORAGE GUIDELINES */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>
              GABAY SA PAG-IMBAK AT PAG-IWAS SA PAGKASIRA
            </Text>
            <Text style={styles.heading}>
              Rekomendadong Kondisyon sa Imbakan
            </Text>

            {FARMING_GUIDES.map((guide, idx) => (
              <View
                key={idx}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  padding: 12,
                  gap: 4,
                  backgroundColor: colors.surfaceSoft,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: colors.bush,
                  }}
                >
                  🌾 {guide.crop}
                </Text>
                <Text style={{ fontSize: 12, color: colors.bush }}>
                  • <Text style={{ fontWeight: "700" }}>Tamang Panahon ng Ani:</Text>{" "}
                  {guide.harvestTiming}
                </Text>
                <Text style={{ fontSize: 12, color: colors.bush }}>
                  • <Text style={{ fontWeight: "700" }}>Pang-imbak:</Text>{" "}
                  {guide.storageGuidance}
                </Text>
                <Text style={{ fontSize: 12, color: colors.bush }}>
                  • <Text style={{ fontWeight: "700" }}>Pagproseso:</Text>{" "}
                  {guide.valueAddPath}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  ⚠️ Shelf-life / Tanda: {guide.shelfLifeDays}
                </Text>
              </View>
            ))}
          </View>

          {/* 3. SMALLHOLDER OFFLINE FAQS */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>MGA MADALAS ITANONG (OFFLINE FAQS)</Text>
            <Text style={styles.heading}>Gabay para sa Magsasaka</Text>

            {OFFLINE_FAQS.map((faq, idx) => (
              <View
                key={idx}
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: colors.brightNori,
                  paddingLeft: 12,
                  gap: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: colors.bush,
                  }}
                >
                  {faq.question}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
                  {faq.answer}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Page>
  );
}
