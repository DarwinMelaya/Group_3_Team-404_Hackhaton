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
  const {
    harvests,
    offlineDrafts,
    syncOfflineDraft,
    ready,
    error,
    mode,
    session,
    refreshHarvests,
  } = useHarvests();
  const { saved, draft } = useLocalSearchParams<{
    saved?: string;
    draft?: string;
  }>();
  const [filter, setFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState("");
  const [syncError, setSyncError] = useState("");

  const filtered = harvests.filter(
    (harvest) => filter === "All" || harvest.priority === "Priority",
  );
  const filteredKg = filtered.reduce(
    (sum, harvest) => sum + harvest.quantity,
    0,
  );
  const filteredRemainingKg = filtered.reduce(
    (sum, harvest) => sum + (harvest.remainingKg ?? harvest.quantity),
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

  async function handleSyncDraft(draftId: string) {
    if (syncingId) return;
    setSyncingId(draftId);
    setSyncError("");
    setSyncNotice("");
    try {
      const synced = await syncOfflineDraft(draftId);
      setSyncNotice(
        `Synchronized offline draft: ${synced.crop} (${synced.quantity} kg in ${synced.municipality}).`,
      );
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Could not synchronize draft.",
      );
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <Page>
      <Heading
        title="My harvests"
        description={
          mode === "live"
            ? "Track your Supabase Agri harvest listings, Admin verification status, and remaining available stock per listing."
            : "Track your harvest inventory, allocated/reserved kilograms, confirmed deliveries, and remaining available stock."
        }
      />
      {saved === "1" && (
        <Text role="status" style={styles.badge}>
          {mode === "live"
            ? "Harvest submitted to Supabase Agri with status: Pending Verification."
            : "Harvest saved to this browser’s SMART-ANI demo workspace."}
        </Text>
      )}
      {draft === "1" && (
        <Text role="status" style={styles.badgePriority}>
          Offline draft saved locally with idempotency protection. Sync below
          when ready.
        </Text>
      )}
      {!!syncNotice && (
        <Text role="status" style={styles.badge}>
          {syncNotice}
        </Text>
      )}
      {!!syncError && (
        <Text
          role="alert"
          style={{
            color: colors.dangerText,
            backgroundColor: colors.dangerBg,
            borderColor: colors.dangerBorder,
            borderWidth: 1,
            padding: 12,
            borderRadius: 12,
          }}
        >
          {syncError}
        </Text>
      )}

      <View style={styles.row}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Action href="/add-harvest">+ Add a harvest</Action>
          <Action href="/transactions">Allocate to Markets →</Action>
        </View>
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
            <Text
              style={{ color: colors.bush, fontWeight: "700", fontSize: 13 }}
            >
              {refreshing ? "Refreshing…" : "↻ Refresh status"}
            </Text>
          </Pressable>
        )}
        {ready && (
          <Text style={styles.subtitle}>
            Showing {filtered.length} listing{filtered.length === 1 ? "" : "s"}{" "}
            ({filteredRemainingKg.toLocaleString()} kg remaining of{" "}
            {filteredKg.toLocaleString()} kg total)
          </Text>
        )}
      </View>

      {offlineDrafts.length > 0 && (
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
            OFFLINE HARVEST DRAFTS · PENDING SYNC ({offlineDrafts.length})
          </Text>
          <Text style={styles.subtitle}>
            These listings were saved offline with idempotency keys to prevent
            duplicate submissions.
          </Text>
          {offlineDrafts.map((item) => (
            <View
              key={item.id}
              style={{
                backgroundColor: colors.white,
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <View>
                <Text style={{ fontWeight: "700", color: colors.bush }}>
                  {item.crop} · {item.quantity} kg @ ₱{item.price}/kg
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {item.barangay}, {item.municipality} · {item.qualityGrade}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={syncingId === item.id}
                onPress={() => void handleSyncDraft(item.id)}
                style={{
                  backgroundColor: colors.brightNori,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
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
                  {syncingId === item.id ? "Syncing…" : "↑ Sync Draft Now"}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

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
            and Admin verification results.
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
