import { Text, View } from "react-native";
import {
  Action,
  colors,
  HarvestCard,
  Heading,
  Page,
  styles,
} from "../components/ui";
import { useHarvests } from "../lib/harvest-store";

export default function Dashboard() {
  const { harvests, ready, error } = useHarvests();
  const total = harvests.reduce((sum, harvest) => sum + harvest.quantity, 0);
  const priorityCount = harvests.filter(
    (harvest) => harvest.priority === "Priority",
  ).length;

  return (
    <Page>
      <Heading
        title="A good day to grow."
        description="Log your surplus crops in Marinduque so barangay coordinators and local processors can help prevent post-harvest waste."
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
          SMART-ANI · POST-HARVEST EXCHANGE
        </Text>
        <Text
          style={{
            color: colors.white,
            fontSize: 26,
            fontWeight: "800",
            lineHeight: 33,
          }}
        >
          Turn your surplus harvest{"\n"}into local opportunity.
        </Text>
        <Text style={{ color: colors.softCelery, fontSize: 14, lineHeight: 22 }}>
          Record your available crops in kilograms. Your demo entries stay
          safely on this browser while live municipal pooling is in preparation.
        </Text>
        <Action href="/add-harvest">+ Add a harvest</Action>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <View style={[styles.card, { flex: 1, minWidth: 145 }]}>
          <Text style={styles.subtitle}>My listings</Text>
          <Text style={styles.title}>{ready ? harvests.length : "—"}</Text>
          <Text style={styles.eyebrow}>LOCAL DEMO RECORDS</Text>
        </View>
        <View style={[styles.card, { flex: 1, minWidth: 145 }]}>
          <Text style={styles.subtitle}>Available harvest</Text>
          <Text style={styles.title}>
            {ready ? total.toLocaleString() : "—"}
            <Text style={{ fontSize: 15, fontWeight: "600" }}> kg</Text>
          </Text>
          <Text style={styles.eyebrow}>TOTAL SURPLUS VOLUME</Text>
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
          <Text style={[styles.subtitle, { color: colors.bush, fontWeight: "600" }]}>
            Priority outreach
          </Text>
          <Text style={styles.title}>{ready ? priorityCount : "—"}</Text>
          <Text style={styles.eyebrow}>FARMER-FLAGGED</Text>
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

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surfaceSoft,
            borderColor: colors.maximumGreen,
          },
        ]}
      >
        <Text style={styles.sectionLabel}>HOW SMART-ANI WORKS</Text>
        <Text style={styles.heading}>Simple steps for Marinduque farmers</Text>
        <Text style={styles.subtitle}>
          1. Log your surplus crop (Uraro/Arrowroot, Cassava, Camote, Banana,
          Coconut, or Vegetables).{"\n"}
          2. Mark Priority if you want quicker coordinator outreach.{"\n"}
          3. Barangay coordinator review, supply pooling, and processor matching
          will connect in the next phase.
        </Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>
          Note: Priority is farmer-selected outreach preference, not a
          food-safety or shelf-life guarantee.
        </Text>
      </View>
    </Page>
  );
}
