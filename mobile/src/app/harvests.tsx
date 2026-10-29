import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  Action,
  Choices,
  colors,
  HarvestCard,
  Heading,
  Page,
  styles,
} from "../components/ui";
import { useHarvests } from "../lib/harvest-store";

export default function Harvests() {
  const { harvests, ready, error, mode, session, refreshHarvests } =
    useHarvests();
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const [filter, setFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = harvests.filter(
    (harvest) => filter === "All" || harvest.priority === "Priority",
  );
  const filteredKg = filtered.reduce(
    (sum, harvest) => sum + harvest.quantity,
    0,
  );

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshHarvests();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Page>
      <Heading
        title="My harvests"
        description={
          mode === "live"
            ? "Review your actual Supabase Agri harvest submissions and coordinator verification status."
            : "Review and filter the surplus crop listings saved on this browser."
        }
      />
      {saved === "1" && (
        <Text role="status" style={styles.badge}>
          {mode === "live"
            ? "Harvest submitted to Supabase Agri with status: Pending Verification."
            : "Harvest saved to this browser’s SMART-ANI demo workspace."}
        </Text>
      )}

      <View style={styles.row}>
        <Action href="/add-harvest">+ Add a harvest</Action>
        {mode === "live" && session && (
          <Pressable
            accessibilityRole="button"
            disabled={refreshing}
            onPress={() => void handleRefresh()}
            style={{
              paddingVertical: 11,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: colors.maximumGreen,
              backgroundColor: colors.white,
            }}
          >
            <Text style={{ color: colors.bush, fontWeight: "700", fontSize: 13 }}>
              {refreshing ? "Refreshing…" : "↻ Refresh status"}
            </Text>
          </Pressable>
        )}
        {ready && (
          <Text style={styles.subtitle}>
            Showing {filtered.length} listing{filtered.length === 1 ? "" : "s"}{" "}
            ({filteredKg.toLocaleString()} kg)
          </Text>
        )}
      </View>

      {mode === "live" && !session && ready && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceSoft,
              borderColor: colors.maximumGreen,
            },
          ]}
        >
          <Text style={styles.badge}>AUTHENTICATION REQUIRED</Text>
          <Text style={styles.heading}>
            Sign in to view your live Supabase harvests
          </Text>
          <Text style={styles.subtitle}>
            You are in Live Supabase Mode (Project Agri). Sign in with your
            farmer account on the Profile tab to load your submitted harvests
            and coordinator verification results.
          </Text>
          <Action href="/profile">Open Profile & Sign In →</Action>
        </View>
      )}

      <View style={styles.card}>
        <Choices
          label="Filter listings"
          values={["All", "Priority"]}
          value={filter}
          onChange={setFilter}
        />
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
          }}
        >
          {error}
        </Text>
      )}
      {!ready && !error && (
        <Text style={styles.subtitle}>
          {mode === "live"
            ? "Loading your harvests from Supabase Agri…"
            : "Loading local harvests…"}
        </Text>
      )}
      {ready && (mode === "demo" || !!session) && filtered.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.heading}>No harvests match this view</Text>
          <Text style={styles.subtitle}>
            Switch the filter back to All or add a new surplus harvest listing.
          </Text>
        </View>
      )}
      {filtered.map((harvest) => (
        <HarvestCard key={harvest.id} harvest={harvest} />
      ))}
    </Page>
  );
}
