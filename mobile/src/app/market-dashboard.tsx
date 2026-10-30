import { Link, useRouter, type Href } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Page, colors } from "../components/ui";
import {
  CROPS,
  MEASUREMENT_UNITS,
  PRIORITY_CROPS,
  addDaysInMarinduque,
  isPriorityCrop,
  todayInMarinduque,
  unitLabel,
  type BuyingType,
  type MeasurementUnit,
} from "../lib/harvest";
import { useHarvests } from "../lib/harvest-store";

export default function MarketDashboardScreen() {
  const router = useRouter();
  const {
    activeMarket,
    marketDemands,
    harvests,
    allocations,
    addMarketDemand,
    demoRespondToAllocation,
    demoConfirmDelivery,
    signOut,
  } = useHarvests();

  // Active section tab
  const [activeTab, setActiveTab] = useState<
    "overview" | "post_demand" | "farmer_supplies" | "offers" | "history"
  >("overview");

  // Crop filter for supplies
  const [cropFilter, setCropFilter] = useState<string>("All");

  // Post Demand Form state
  const [demandCrop, setDemandCrop] = useState<string>("Arrowroot (uraro)");
  const [demandBuyingType, setDemandBuyingType] = useState<BuyingType>("per_unit");
  const [demandUnit, setDemandUnit] = useState<MeasurementUnit>("kg");
  const [demandQty, setDemandQty] = useState<string>("100");
  const [demandPrice, setDemandPrice] = useState<string>("35");
  const [demandMun, setDemandMun] = useState<string>(activeMarket?.municipality ?? "Boac");
  const [demandBrgy, setDemandBrgy] = useState<string>("Poblacion");
  const [demandDueDate, setDemandDueDate] = useState<string>(
    addDaysInMarinduque(5, todayInMarinduque()),
  );
  const [acceptPartial, setAcceptPartial] = useState<boolean>(true);
  const [qualityNotes, setQualityNotes] = useState<string>("");
  const [demandLoading, setDemandLoading] = useState<boolean>(false);
  const [demandSuccess, setDemandSuccess] = useState<string>("");
  const [demandError, setDemandError] = useState<string>("");

  // Filtered lists
  const myDemands = marketDemands.filter(
    (d) => d.marketId === activeMarket?.id || activeMarket?.name?.includes(d.marketName),
  );

  const myAllocations = allocations.filter(
    (a) =>
      a.marketId === activeMarket?.id ||
      a.marketName === activeMarket?.name ||
      marketDemands.some((d) => d.id === a.marketDemandId && d.marketId === activeMarket?.id),
  );

  const pendingOffers = myAllocations.filter(
    (a) => a.status === "proposed" || a.status === "pending_acceptance",
  );

  const activeDeliveries = myAllocations.filter(
    (a) => a.status === "reserved" || a.status === "in_delivery" || a.status === "partially_delivered",
  );

  const completedPurchases = myAllocations.filter((a) => a.status === "delivered");

  const filteredHarvests = harvests.filter((h) => {
    if (cropFilter === "All") return true;
    if (cropFilter === "Priority") return isPriorityCrop(h.crop);
    return h.crop === cropFilter;
  });

  const handleCreateDemand = async () => {
    setDemandError("");
    setDemandSuccess("");

    const qty = Number(demandQty);
    const price = Number(demandPrice);

    if (!Number.isFinite(qty) || qty <= 0) {
      setDemandError("Enter a valid quantity greater than 0.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setDemandError("Enter a valid price greater than 0.");
      return;
    }

    setDemandLoading(true);
    try {
      await addMarketDemand({
        crop: demandCrop,
        requiredQuantityKg: qty,
        unit: demandUnit,
        buyingType: demandBuyingType,
        unitPricePhp: demandBuyingType === "per_unit" ? price : undefined,
        totalPricePhp: demandBuyingType === "bulk_lot" ? price : undefined,
        municipality: demandMun,
        barangay: demandBrgy,
        requiredBy: demandDueDate,
        acceptPartial,
        qualityNotes:
          qualityNotes.trim() ||
          `${qty} ${demandUnit} ${demandCrop} requested by ${activeMarket?.name ?? "Market"}`,
      });

      setDemandSuccess(
        `Demand for ${qty} ${demandUnit} ${demandCrop} successfully posted to the Marinduque B2B board!`,
      );
      setDemandQty("");
      setQualityNotes("");
      setActiveTab("overview");
    } catch (err) {
      setDemandError(err instanceof Error ? err.message : "Failed to post demand.");
    } finally {
      setDemandLoading(false);
    }
  };

  const handleAcceptOffer = async (allocId: string) => {
    try {
      await demoRespondToAllocation(allocId, "reserved", "Accepted by Market Buyer");
      Alert.alert(
        "Offer Accepted",
        "The farmer's allocation has been confirmed and reserved. Remaining harvest inventory has been adjusted with zero double-counting.",
      );
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to accept offer.");
    }
  };

  const handleRejectOffer = async (allocId: string) => {
    try {
      await demoRespondToAllocation(allocId, "rejected", "Rejected by Market Buyer");
      Alert.alert("Offer Rejected", "The allocation has been rejected and released back to the farmer.");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to reject offer.");
    }
  };

  const handleConfirmDelivery = async (allocId: string, qtyKg: number) => {
    try {
      await demoConfirmDelivery(allocId, qtyKg, true, "Verified and received produce in full.");
      Alert.alert(
        "Delivery Confirmed",
        `Confirmed receipt of ${qtyKg.toFixed(1)} kg. Marked as delivered and recorded in transaction history.`,
      );
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to confirm delivery.");
    }
  };

  return (
    <Page>
      {/* Top Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={styles.marketName}>{activeMarket?.name ?? "Boac Central Public Market"}</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>✓ VERIFIED BUYER</Text>
              </View>
            </View>
            <Text style={styles.marketSub}>
              {activeMarket?.businessType ?? "Public Market Buyer"} · {activeMarket?.municipality ?? "Boac"}, Marinduque
            </Text>
          </View>

          <Link href={"/welcome" as Href} asChild>
            <Pressable style={styles.switchButton}>
              <Text style={styles.switchButtonText}>⇄ Switch Role</Text>
            </Pressable>
          </Link>
        </View>

        {/* Priority crops banner */}
        <View style={styles.priorityCropBar}>
          <Text style={styles.priorityCropLabel}>Marinduque Priority Crops:</Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {PRIORITY_CROPS.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  setDemandCrop(c);
                  setActiveTab("post_demand");
                }}
                style={styles.priorityPill}
              >
                <Text style={styles.priorityPillText}>+ {c}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Navigation Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabNavRow}
      >
        <Pressable
          onPress={() => setActiveTab("overview")}
          style={[styles.tabNavBtn, activeTab === "overview" && styles.tabNavBtnActive]}
        >
          <Text style={[styles.tabNavText, activeTab === "overview" && styles.tabNavTextActive]}>
            📊 Overview
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("post_demand")}
          style={[styles.tabNavBtn, activeTab === "post_demand" && styles.tabNavBtnActive]}
        >
          <Text style={[styles.tabNavText, activeTab === "post_demand" && styles.tabNavTextActive]}>
            ➕ Post Demand
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("farmer_supplies")}
          style={[styles.tabNavBtn, activeTab === "farmer_supplies" && styles.tabNavBtnActive]}
        >
          <Text style={[styles.tabNavText, activeTab === "farmer_supplies" && styles.tabNavTextActive]}>
            🌾 Farmer Supply ({filteredHarvests.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("offers")}
          style={[styles.tabNavBtn, activeTab === "offers" && styles.tabNavBtnActive]}
        >
          <Text style={[styles.tabNavText, activeTab === "offers" && styles.tabNavTextActive]}>
            📥 Offers & Deliveries ({pendingOffers.length + activeDeliveries.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("history")}
          style={[styles.tabNavBtn, activeTab === "history" && styles.tabNavBtnActive]}
        >
          <Text style={[styles.tabNavText, activeTab === "history" && styles.tabNavTextActive]}>
            📜 Purchase History ({completedPurchases.length})
          </Text>
        </Pressable>
      </ScrollView>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <View style={{ gap: 14 }}>
          {/* Quick Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{myDemands.length}</Text>
              <Text style={styles.statLabel}>Active Demands</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: "#D97706" }]}>{pendingOffers.length}</Text>
              <Text style={styles.statLabel}>Pending Offers</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: colors.brightNori }]}>{activeDeliveries.length}</Text>
              <Text style={styles.statLabel}>Deliveries In Transit</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: colors.bush }]}>{completedPurchases.length}</Text>
              <Text style={styles.statLabel}>Fulfilled Lots</Text>
            </View>
          </View>

          {/* Pending Offers Action Alert */}
          {pendingOffers.length > 0 && (
            <View style={styles.urgentAlert}>
              <Text style={styles.urgentAlertTitle}>⚠️ INCOMING FARMER ALLOCATIONS AWAITING ACCEPTANCE</Text>
              <Text style={styles.urgentAlertBody}>
                You have {pendingOffers.length} farmer allocation(s) proposed to your buying demands. Review
                and accept or reject them to secure crop supply.
              </Text>
              <Pressable
                onPress={() => setActiveTab("offers")}
                style={styles.alertActionBtn}
              >
                <Text style={styles.alertActionBtnText}>Review Offers Now →</Text>
              </Pressable>
            </View>
          )}

          {/* Active Demands List */}
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.sectionTitle}>MY POSTED BUYING DEMANDS</Text>
              <Pressable
                onPress={() => setActiveTab("post_demand")}
                style={styles.smallActionBtn}
              >
                <Text style={styles.smallActionBtnText}>+ Add Demand</Text>
              </Pressable>
            </View>

            {myDemands.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No posted demands yet.</Text>
                <Pressable
                  onPress={() => setActiveTab("post_demand")}
                  style={styles.createFirstBtn}
                >
                  <Text style={styles.createFirstBtnText}>Post First Demand Request</Text>
                </Pressable>
              </View>
            ) : (
              myDemands.map((demand) => (
                <View key={demand.id} style={styles.demandItemCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.demandCrop}>{demand.crop}</Text>
                        {isPriorityCrop(demand.crop) && (
                          <View style={styles.priorityMiniBadge}>
                            <Text style={styles.priorityMiniText}>PRIORITY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.demandSpecs}>
                        Required: {demand.requiredQuantityKg} {unitLabel(demand.unit)} · Due by {demand.requiredBy}
                      </Text>
                    </View>
                    <View style={styles.pricePill}>
                      <Text style={styles.pricePillText}>
                        ₱{demand.offeredPricePerKg ?? demand.unitPricePhp ?? 0}/kg
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressRow}>
                    <View style={styles.progressStat}>
                      <Text style={styles.progressLabel}>Reserved</Text>
                      <Text style={styles.progressVal}>{demand.reservedQuantityKg} kg</Text>
                    </View>
                    <View style={styles.progressStat}>
                      <Text style={styles.progressLabel}>Delivered</Text>
                      <Text style={styles.progressVal}>{demand.fulfilledQuantityKg} kg</Text>
                    </View>
                    <View style={styles.progressStat}>
                      <Text style={styles.progressLabel}>Remaining Need</Text>
                      <Text style={[styles.progressVal, { color: colors.brightNori }]}>
                        {demand.remainingDemandKg} kg
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* TAB 2: POST DEMAND */}
      {activeTab === "post_demand" && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>POST COMMERCIAL BUYING DEMAND</Text>
          <Text style={styles.sectionSub}>
            Broadcast your crop purchase requirements to Marinduque farmers. Choose per-kilo or bulk lot pricing.
          </Text>

          {!!demandError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {demandError}</Text>
            </View>
          )}
          {!!demandSuccess && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>✅ {demandSuccess}</Text>
            </View>
          )}

          {/* Priority Crop Selection */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Crop / Pananim *</Text>
            <View style={styles.cropGrid}>
              {CROPS.map((c) => {
                const active = demandCrop === c;
                const isPrio = isPriorityCrop(c);
                return (
                  <Pressable
                    key={c}
                    onPress={() => setDemandCrop(c)}
                    style={[styles.cropChip, active && styles.cropChipActive]}
                  >
                    <Text style={[styles.cropChipText, active && styles.cropChipTextActive]}>
                      {c}
                    </Text>
                    {isPrio && <Text style={styles.prioDot}>★</Text>}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Pricing Model: Per-Unit vs Bulk Lot */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Buying Model / Pricing Scheme *</Text>
            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => setDemandBuyingType("per_unit")}
                style={[styles.toggleBtn, demandBuyingType === "per_unit" && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleBtnText, demandBuyingType === "per_unit" && styles.toggleBtnTextActive]}>
                  Per-Unit Pricing (per kg/sack/crate)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDemandBuyingType("bulk_lot")}
                style={[styles.toggleBtn, demandBuyingType === "bulk_lot" && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleBtnText, demandBuyingType === "bulk_lot" && styles.toggleBtnTextActive]}>
                  Bulk Lot / Fixed Total Price
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Unit selection */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Measurement Unit *</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {MEASUREMENT_UNITS.map((u) => {
                const active = demandUnit === u;
                return (
                  <Pressable
                    key={u}
                    onPress={() => setDemandUnit(u)}
                    style={[styles.unitChip, active && styles.unitChipActive]}
                  >
                    <Text style={[styles.unitChipText, active && styles.unitChipTextActive]}>
                      {unitLabel(u)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Quantity & Price */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.fieldLabel}>Quantity ({demandUnit}) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="hal. 100"
                placeholderTextColor="#7D8D80"
                value={demandQty}
                onChangeText={setDemandQty}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.fieldLabel}>
                {demandBuyingType === "per_unit" ? `Price per ${demandUnit} (₱) *` : "Total Lot Price (₱) *"}
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="hal. 30"
                placeholderTextColor="#7D8D80"
                value={demandPrice}
                onChangeText={setDemandPrice}
              />
            </View>
          </View>

          {/* Municipality & Due Date */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.fieldLabel}>Delivery Bayan *</Text>
              <TextInput
                style={styles.input}
                placeholder="Boac, Mogpog, etc."
                placeholderTextColor="#7D8D80"
                value={demandMun}
                onChangeText={setDemandMun}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.fieldLabel}>Required By (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#7D8D80"
                value={demandDueDate}
                onChangeText={setDemandDueDate}
              />
            </View>
          </View>

          {/* Barangay & Partial Fulfillment */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.fieldLabel}>Receiving Barangay</Text>
              <TextInput
                style={styles.input}
                placeholder="Poblacion, Murallon, etc."
                placeholderTextColor="#7D8D80"
                value={demandBrgy}
                onChangeText={setDemandBrgy}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.fieldLabel}>Accept Partial Delivery?</Text>
              <Pressable
                onPress={() => setAcceptPartial(!acceptPartial)}
                style={[styles.toggleBtn, acceptPartial && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleBtnText, acceptPartial && styles.toggleBtnTextActive]}>
                  {acceptPartial ? "✓ Yes (Partial OK)" : "✕ Full Only"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Quality Notes */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Quality Grade / Notes</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Firm mature Saba for processing, unwashed rhizomes, clean crates"
              placeholderTextColor="#7D8D80"
              value={qualityNotes}
              onChangeText={setQualityNotes}
            />
          </View>

          <Pressable
            onPress={handleCreateDemand}
            disabled={demandLoading}
            style={[styles.submitButton, demandLoading && { opacity: 0.7 }]}
          >
            <Text style={styles.submitButtonText}>
              {demandLoading ? "Posting Demand..." : "Broadcast Demand to Farmers →"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* TAB 3: FARMER SUPPLIES */}
      {activeTab === "farmer_supplies" && (
        <View style={{ gap: 12 }}>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>AVAILABLE FARMER HARVESTS IN MARINDUQUE</Text>
            <Text style={styles.sectionSub}>
              Browse registered harvests across all 6 municipalities. Priority crops are tagged for rapid procurement.
            </Text>

            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
              {["All", "Priority", ...CROPS].map((f) => {
                const active = cropFilter === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setCropFilter(f)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {f}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {filteredHarvests.map((h) => (
            <View key={h.id} style={styles.supplyCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.supplyCrop}>{h.crop}</Text>
                    {isPriorityCrop(h.crop) && (
                      <View style={styles.priorityMiniBadge}>
                        <Text style={styles.priorityMiniText}>MARINDUQUE PRIORITY</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.supplyFarmer}>
                    📍 {h.barangay}, {h.municipality} · Harvested: {h.harvestDate}
                  </Text>
                </View>
                <View style={styles.pricePill}>
                  <Text style={styles.pricePillText}>₱{h.price}/kg</Text>
                </View>
              </View>

              <View style={styles.supplyStatsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Total Harvested</Text>
                  <Text style={styles.statBoxVal}>{h.quantity} {unitLabel(h.unit)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Remaining Available</Text>
                  <Text style={[styles.statBoxVal, { color: colors.brightNori }]}>
                    {h.remainingKg ?? h.quantity} kg
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Quality Grade</Text>
                  <Text style={styles.statBoxVal}>{h.qualityGrade ?? "Standard"}</Text>
                </View>
              </View>

              {h.photoRef && (
                <Text style={styles.supplyNotes}>📝 Lot details: {h.photoRef}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* TAB 4: OFFERS & DELIVERIES */}
      {activeTab === "offers" && (
        <View style={{ gap: 14 }}>
          {/* Section: Pending Offers */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>PENDING FARMER ALLOCATION OFFERS</Text>
            <Text style={styles.sectionSub}>
              Accept or reject supply allocations proposed by farmers against your buying demands.
            </Text>

            {pendingOffers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No pending farmer offers right now.</Text>
              </View>
            ) : (
              pendingOffers.map((alloc) => (
                <View key={alloc.id} style={styles.allocCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View>
                      <Text style={styles.allocTitle}>
                        {alloc.crop} · {alloc.allocatedQuantityKg} kg offered
                      </Text>
                      <Text style={styles.allocSub}>
                        Agreed Price: ₱{alloc.agreedPricePerKg}/kg · Total: ₱
                        {(alloc.allocatedQuantityKg * alloc.agreedPricePerKg).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.statusProposedTag}>
                      <Text style={styles.statusProposedText}>{alloc.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  {alloc.offerNotes && (
                    <Text style={styles.allocNotes}>Farmer note: &quot;{alloc.offerNotes}&quot;</Text>
                  )}

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                    <Pressable
                      onPress={() => handleAcceptOffer(alloc.id)}
                      style={styles.acceptBtn}
                    >
                      <Text style={styles.acceptBtnText}>✓ Accept Allocation</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleRejectOffer(alloc.id)}
                      style={styles.rejectBtn}
                    >
                      <Text style={styles.rejectBtnText}>✕ Reject</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Section: Active Deliveries to Confirm */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>ACTIVE DELIVERIES (CONFIRM PRODUCE RECEIPT)</Text>
            <Text style={styles.sectionSub}>
              Produce reserved or in delivery. Click &quot;Confirm Receipt&quot; once physical inspection is complete.
            </Text>

            {activeDeliveries.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No active deliveries in transit.</Text>
              </View>
            ) : (
              activeDeliveries.map((alloc) => (
                <View key={alloc.id} style={styles.deliveryCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <View>
                      <Text style={styles.allocTitle}>
                        {alloc.crop} · {alloc.allocatedQuantityKg} kg
                      </Text>
                      <Text style={styles.allocSub}>
                        Market: {alloc.marketName} ({alloc.marketMunicipality})
                      </Text>
                    </View>
                    <View style={styles.statusInTransitTag}>
                      <Text style={styles.statusInTransitText}>{alloc.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => handleConfirmDelivery(alloc.id, alloc.allocatedQuantityKg)}
                    style={styles.confirmDeliveryBtn}
                  >
                    <Text style={styles.confirmDeliveryBtnText}>
                      📦 Confirm Receipt ({alloc.allocatedQuantityKg} kg) →
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* TAB 5: PURCHASE HISTORY */}
      {activeTab === "history" && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>PURCHASE & DELIVERY TRANSACTION HISTORY</Text>
          <Text style={styles.sectionSub}>
            Complete record of fulfilled farmer allocations with zero double-counting.
          </Text>

          {completedPurchases.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No completed transactions yet.</Text>
            </View>
          ) : (
            completedPurchases.map((alloc) => {
              const totalPrice =
                alloc.totalAgreedPrice ??
                alloc.deliveredQuantityKg * alloc.agreedPricePerKg;
              return (
                <View key={alloc.id} style={styles.historyCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.historyTitle}>{alloc.crop}</Text>
                    <View style={styles.deliveredTag}>
                      <Text style={styles.deliveredTagText}>✓ DELIVERED</Text>
                    </View>
                  </View>

                  <View style={styles.historyStatsRow}>
                    <View>
                      <Text style={styles.histLabel}>Delivered Quantity</Text>
                      <Text style={styles.histVal}>{alloc.deliveredQuantityKg} kg</Text>
                    </View>
                    <View>
                      <Text style={styles.histLabel}>Agreed Unit Price</Text>
                      <Text style={styles.histVal}>₱{alloc.agreedPricePerKg}/kg</Text>
                    </View>
                    <View>
                      <Text style={styles.histLabel}>Total Amount Paid</Text>
                      <Text style={[styles.histVal, { color: colors.brightNori }]}>
                        ₱{totalPrice.toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.histTimestamp}>
                    Transaction ID: {alloc.id.slice(0, 18)}... · Completed: {alloc.completedAt ?? alloc.offeredAt}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Footer Profile Details */}
      <View style={styles.profileFooter}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={styles.profName}>{activeMarket?.name}</Text>
            <Text style={styles.profSub}>
              Contact: {activeMarket?.contactPerson} ({activeMarket?.email})
            </Text>
          </View>
          <Pressable
            onPress={async () => {
              await signOut();
              router.replace("/welcome" as Href);
            }}
            style={styles.signOutBtn}
          >
            <Text style={styles.signOutBtnText}>Log Out</Text>
          </Pressable>
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.bush,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  marketName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.bush,
  },
  verifiedBadge: {
    backgroundColor: colors.softCelery,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.venusFlytrap,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.bush,
  },
  marketSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    fontWeight: "600",
  },
  switchButton: {
    backgroundColor: colors.surfaceCelery,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.venusFlytrap,
  },
  switchButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.bush,
  },
  priorityCropBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 6,
  },
  priorityCropLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
  },
  priorityPill: {
    backgroundColor: colors.cream,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.bush,
  },
  tabNavRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  tabNavBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabNavBtnActive: {
    backgroundColor: colors.softCelery,
    borderColor: colors.bush,
    borderWidth: 1.5,
  },
  tabNavText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  tabNavTextActive: {
    fontWeight: "800",
    color: colors.bush,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.bush,
  },
  statLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "600",
    marginTop: 2,
  },
  urgentAlert: {
    backgroundColor: "#FEFCE8",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EAB308",
    gap: 6,
  },
  urgentAlertTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#854D0E",
  },
  urgentAlertBody: {
    fontSize: 12,
    color: "#713F12",
    lineHeight: 17,
  },
  alertActionBtn: {
    backgroundColor: "#EAB308",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 4,
  },
  alertActionBtnText: {
    color: "#422006",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.bush,
    letterSpacing: 0.8,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    marginTop: -6,
  },
  smallActionBtn: {
    backgroundColor: colors.brightNori,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  smallActionBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.white,
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
  },
  createFirstBtn: {
    backgroundColor: colors.softCelery,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.brightNori,
  },
  createFirstBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.bush,
  },
  demandItemCard: {
    backgroundColor: colors.cream,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  demandCrop: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.bush,
  },
  priorityMiniBadge: {
    backgroundColor: colors.softCelery,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityMiniText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.brightNori,
  },
  demandSpecs: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  pricePill: {
    backgroundColor: colors.softCelery,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.venusFlytrap,
  },
  pricePillText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.bush,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  progressStat: {
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: "600",
  },
  progressVal: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.bush,
    marginTop: 1,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.bush,
  },
  cropGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cropChip: {
    backgroundColor: colors.cream,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cropChipActive: {
    backgroundColor: colors.softCelery,
    borderColor: colors.bush,
    borderWidth: 1.5,
  },
  cropChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  cropChipTextActive: {
    fontWeight: "800",
    color: colors.bush,
  },
  prioDot: {
    color: "#D97706",
    fontSize: 12,
    fontWeight: "800",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: colors.softCelery,
    borderColor: colors.bush,
    borderWidth: 1.5,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
  },
  toggleBtnTextActive: {
    fontWeight: "800",
    color: colors.bush,
  },
  unitChip: {
    backgroundColor: colors.cream,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitChipActive: {
    backgroundColor: colors.softCelery,
    borderColor: colors.bush,
    borderWidth: 1.5,
  },
  unitChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  unitChipTextActive: {
    fontWeight: "800",
    color: colors.bush,
  },
  input: {
    backgroundColor: "#FAFCF8",
    borderWidth: 1.5,
    borderColor: colors.maximumGreen,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.bush,
  },
  submitButton: {
    backgroundColor: colors.bush,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "600",
  },
  successBox: {
    backgroundColor: "#DCFCE7",
    borderRadius: 8,
    padding: 10,
  },
  successText: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "600",
  },
  filterChip: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.bush,
    borderColor: colors.bush,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: "800",
  },
  supplyCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  supplyCrop: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.bush,
  },
  supplyFarmer: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  supplyStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.cream,
    borderRadius: 8,
    padding: 10,
  },
  statBox: {
    alignItems: "center",
  },
  statBoxLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: "600",
  },
  statBoxVal: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.bush,
    marginTop: 2,
  },
  supplyNotes: {
    fontSize: 11,
    color: colors.muted,
    fontStyle: "italic",
  },
  allocCard: {
    backgroundColor: colors.cream,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  allocTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.bush,
  },
  allocSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  statusProposedTag: {
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusProposedText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#854D0E",
  },
  allocNotes: {
    fontSize: 12,
    color: colors.bush,
    fontStyle: "italic",
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.brightNori,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  acceptBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  rejectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
  },
  rejectBtnText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "700",
  },
  deliveryCard: {
    backgroundColor: colors.cream,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  statusInTransitTag: {
    backgroundColor: colors.softCelery,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusInTransitText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.brightNori,
  },
  confirmDeliveryBtn: {
    backgroundColor: colors.bush,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  confirmDeliveryBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  historyCard: {
    backgroundColor: colors.cream,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.bush,
  },
  deliveredTag: {
    backgroundColor: colors.softCelery,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  deliveredTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.brightNori,
  },
  historyStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  histLabel: {
    fontSize: 10,
    color: colors.muted,
  },
  histVal: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.bush,
    marginTop: 1,
  },
  histTimestamp: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 4,
  },
  profileFooter: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.bush,
  },
  profSub: {
    fontSize: 11,
    color: colors.muted,
  },
  signOutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#FEE2E2",
  },
  signOutBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },
});
