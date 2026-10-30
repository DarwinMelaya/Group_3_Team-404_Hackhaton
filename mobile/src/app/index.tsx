import { Text, View } from "react-native";
import {
  Action,
  colors,
  HarvestCard,
  Heading,
  Page,
  styles,
} from "../components/ui";
import { evaluateSpoilageUrgency } from "../lib/harvest";
import { useHarvests } from "../lib/harvest-store";

export default function Dashboard() {
  const { harvests, marketDemands, allocations, offlineDrafts, ready, error } =
    useHarvests();

  const totalHarvestKg = harvests.reduce(
    (sum, harvest) => sum + harvest.quantity,
    0,
  );
  const remainingAvailableKg = harvests.reduce(
    (sum, harvest) => sum + (harvest.remainingKg ?? harvest.quantity),
    0,
  );
  const allocatedCommittedKg = harvests.reduce(
    (sum, harvest) => sum + (harvest.allocatedKg ?? 0),
    0,
  );
  const deliveredConfirmedKg = harvests.reduce(
    (sum, harvest) => sum + (harvest.deliveredKg ?? 0),
    0,
  );
  const urgentHarvests = harvests.filter(
    (harvest) =>
      (harvest.remainingKg ?? harvest.quantity) > 0 &&
      evaluateSpoilageUrgency(harvest).level === "high",
  );
  const openDemands = marketDemands.filter(
    (d) =>
      (d.status === "open" || d.status === "partially_fulfilled") &&
      d.remainingDemandKg > 0,
  );

  return (
    <Page>
      <Heading
        title="A good day to grow."
        description="See how many kilograms of crops Marinduque markets need and distribute your harvest across multiple markets to prevent spoilage."
      />

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bush,
            borderColor: colors.brightNori,
            padding: 22,
            gap: 14,
          },
        ]}
      >
        <Text
          style={{
            color: colors.softCelery,
            letterSpacing: 1.6,
            fontSize: 11,
            fontWeight: "800",
          }}
        >
          SMART-ANI · DEMAND-DRIVEN HARVEST DISTRIBUTION
        </Text>
        <Text
          style={{
            color: colors.white,
            fontSize: 26,
            fontWeight: "800",
            lineHeight: 33,
          }}
        >
          Match your harvest{"\n"}with real market demand.
        </Text>
        <Text style={{ color: colors.softCelery, fontSize: 14, lineHeight: 22 }}>
          Divide a single harvest across multiple public markets, cooperatives,
          and food processors (e.g., 100 kg Banana → 40 kg Market 1 + 35 kg
          Market 2 + 25 kg Market 3).
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Action href="/add-harvest">+ I-rehistro ang Ani (Add Harvest)</Action>
          <Action href="/transactions">Mga Pamilihan (Market Demands) →</Action>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <View style={[styles.card, { flex: 1, minWidth: 145 }]}>
          <Text style={styles.subtitle}>Natitirang Ani (Remaining Crops)</Text>
          <Text style={styles.title}>
            {ready ? remainingAvailableKg.toLocaleString() : "—"}
            <Text style={{ fontSize: 15, fontWeight: "600" }}> kg</Text>
          </Text>
          <Text style={styles.eyebrow}>
            OF {ready ? totalHarvestKg.toLocaleString() : "—"} KG TOTAL HARVEST
          </Text>
        </View>
        <View style={[styles.card, { flex: 1, minWidth: 145 }]}>
          <Text style={styles.subtitle}>Offered & reserved</Text>
          <Text style={styles.title}>
            {ready ? allocatedCommittedKg.toLocaleString() : "—"}
            <Text style={{ fontSize: 15, fontWeight: "600" }}> kg</Text>
          </Text>
          <Text style={styles.eyebrow}>
            {allocations.length} ACTIVE MARKET ALLOCATION
            {allocations.length === 1 ? "" : "S"}
          </Text>
        </View>
        <View style={[styles.card, { flex: 1, minWidth: 145 }]}>
          <Text style={styles.subtitle}>Confirmed delivered</Text>
          <Text style={styles.title}>
            {ready ? deliveredConfirmedKg.toLocaleString() : "—"}
            <Text style={{ fontSize: 15, fontWeight: "600" }}> kg</Text>
          </Text>
          <Text style={styles.eyebrow}>VERIFIED MARKET RECEIPTS</Text>
        </View>
        <View
          style={[
            styles.card,
            {
              flex: 1,
              minWidth: 145,
              backgroundColor: colors.softCelery,
              borderColor: colors.venusFlytrap,
            },
          ]}
        >
          <Text
            style={[
              styles.subtitle,
              { color: colors.bush, fontWeight: "600" },
            ]}
          >
            Spoilage urgency
          </Text>
          <Text style={styles.title}>{ready ? urgentHarvests.length : "—"}</Text>
          <Text style={styles.eyebrow}>
            {offlineDrafts.length > 0
              ? `${offlineDrafts.length} OFFLINE DRAFT PENDING`
              : "ADVISORY ALERTS"}
          </Text>
        </View>
      </View>

      {urgentHarvests.length > 0 && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.softCelery,
              borderColor: colors.brightNori,
            },
          ]}
        >
          <Text style={styles.sectionLabel}>
            SPOILAGE URGENCY NOTIFICATIONS · ADVISORY
          </Text>
          <Text style={styles.heading}>
            {urgentHarvests.length} harvest listing
            {urgentHarvests.length === 1 ? " has" : "s have"} unallocated stock
            needing priority market distribution
          </Text>
          {urgentHarvests.map((item) => (
            <Text key={item.id} style={{ fontSize: 13, color: colors.bush }}>
              • {item.crop} ({item.municipality}):{" "}
              {item.remainingKg ?? item.quantity} kg unallocated · Harvested{" "}
              {item.harvestDate} ({item.storage})
            </Text>
          ))}
          <Action href="/transactions">Allocate to Matching Markets →</Action>
        </View>
      )}

      <View style={styles.row}>
        <Text style={styles.heading}>
          Active Market Demands ({openDemands.length})
        </Text>
        <Action href="/transactions">Open Demand Board →</Action>
      </View>

      <View style={{ gap: 10 }}>
        {openDemands.slice(0, 3).map((demand) => (
          <View key={demand.id} style={styles.card}>
            <View style={styles.row}>
              <View>
                <Text style={styles.heading}>
                  {demand.crop} · {demand.remainingDemandKg.toLocaleString()} kg
                  needed
                </Text>
                <Text style={styles.subtitle}>
                  {demand.marketName} · {demand.municipality}
                </Text>
              </View>
              <Text style={styles.badge}>
                ₱{demand.offeredPricePerKg}/kg · Due {demand.requiredBy}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Required: {demand.requiredQuantityKg} kg | Reserved:{" "}
              {demand.reservedQuantityKg} kg | Fulfilled:{" "}
              {demand.fulfilledQuantityKg} kg | Remaining:{" "}
              {demand.remainingDemandKg} kg
            </Text>
          </View>
        ))}
      </View>

      {/* VALUE-ADD, DIRECTORY & OFFLINE SHORTCUTS */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surfaceSoft,
            borderColor: colors.maximumGreen,
            gap: 12,
          },
        ]}
      >
        <Text style={styles.sectionLabel}>
          HALAGA AT KONEKSIYON SA MARINDUQUE (VALUE-ADD & OFFLINE)
        </Text>
        <Text style={styles.heading}>
          Mga Sentro ng Pagproseso, Kalkulador ng Tubo, at SMS Fallback
        </Text>
        <Text style={styles.subtitle}>
          Direktoryo ng mga pasilidad sa 6 bayan, transparent na kalkulador ng tubo para sa banana chips, uraro flour, cassava starch, at VCO, at offline SMS fallback console.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Action href="/transactions?tab=facilities">
            Pasilidad sa 6 Bayan →
          </Action>
          <Action href="/transactions?tab=guide">
            AI Gabay at Kalkulador →
          </Action>
          <Action href="/transactions?tab=sms">
            SMS Console (Offline) →
          </Action>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.heading}>Your latest harvests</Text>
        <Action href="/harvests">View all →</Action>
      </View>

      {!!error && (
        <Text
          role="alert"
          style={{
            color: colors.dangerText,
            backgroundColor: colors.dangerBg,
            borderColor: colors.dangerBorder,
            borderWidth: 1,
            padding: 14,
            borderRadius: 12,
            lineHeight: 21,
          }}
        >
          {error}
        </Text>
      )}
      {!ready && !error && (
        <Text style={styles.subtitle}>Loading local harvests…</Text>
      )}
      {harvests.slice(0, 2).map((harvest) => (
        <HarvestCard key={harvest.id} harvest={harvest} />
      ))}
    </Page>
  );
}
