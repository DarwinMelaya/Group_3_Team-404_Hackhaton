import { Text, View } from "react-native";
import { Action, colors, Heading, Page, styles } from "../components/ui";

export default function Transactions() {
  return (
    <Page>
      <Heading
        title="Transactions"
        description="Track reservations, pooled batch handoffs, and processor commitments."
      />
      <View style={styles.card}>
        <Text style={styles.badge}>PLANNED · NOT CONNECTED YET</Text>
        <Text style={styles.heading}>
          Coordinator-verified pooling & processor reservations
        </Text>
        <Text style={styles.subtitle}>
          In the full SMART-ANI workflow, barangay coordinators verify surplus
          listings, group compatible harvests into municipal batches, and match
          them with processor requests. No live orders or payments can be placed
          in this preview.
        </Text>
        <Action href="/harvests">Explore my harvests →</Action>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surfaceSoft,
            borderColor: colors.maximumGreen,
          },
        ]}
      >
        <Text style={styles.sectionLabel}>PROPOSED TRANSACTION STAGES</Text>
        <Text style={styles.subtitle}>
          1. Farmer logs surplus harvest (Available in demo now){"\n"}
          2. Barangay coordinator verification (Planned Phase 2){"\n"}
          3. Same-municipality supply pooling (Planned Phase 2){"\n"}
          4. Processor reservation & handoff tracking (Planned Phase 2/3)
        </Text>
      </View>
    </Page>
  );
}
