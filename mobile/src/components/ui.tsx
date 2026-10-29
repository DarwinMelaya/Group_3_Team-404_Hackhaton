import { Link, type Href } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInputProps,
  TextInput,
} from "react-native";
import type { ReactNode } from "react";
import type { Harvest } from "../lib/harvest";
import { colors, radii, spacing } from "../lib/theme";

export { colors };

export const styles = StyleSheet.create({
  page: {
    padding: spacing.lg,
    paddingBottom: 42,
    gap: 18,
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
  },
  eyebrow: {
    color: colors.brightNori,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "800",
  },
  title: {
    color: colors.bush,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  heading: {
    color: colors.bush,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  card: {
    padding: 20,
    borderRadius: radii.lg,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.white,
    gap: 12,
  },
  sectionLabel: {
    color: colors.brightNori,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
  },
  button: {
    backgroundColor: colors.brightNori,
    borderColor: colors.bush,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  badge: {
    color: colors.bush,
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.maximumGreen,
    borderWidth: 1,
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: radii.sm,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  badgePriority: {
    color: colors.bush,
    backgroundColor: colors.softCelery,
    borderColor: colors.venusFlytrap,
    borderWidth: 1,
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: radii.sm,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  field: {
    borderWidth: 1.5,
    borderColor: colors.maximumGreen,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    backgroundColor: colors.white,
    color: colors.bush,
  },
  label: {
    color: colors.bush,
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 6,
  },
  helperText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
});

export function Page({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Heading({
  title,
  description,
  eyebrow = "SMART-ANI · MARINDUQUE FARMER WORKSPACE",
}: {
  title: string;
  description: string;
  eyebrow?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text role="heading" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.subtitle}>{description}</Text>
    </View>
  );
}

export function Action({ href, children }: { href: Href; children: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>{children}</Text>
      </Pressable>
    </Link>
  );
}

export function Field({
  label,
  helper,
  ...props
}: TextInputProps & { label: string; helper?: string }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {!!helper && <Text style={styles.helperText}>{helper}</Text>}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#5C705E"
        style={styles.field}
        {...props}
      />
    </View>
  );
}

export function Choices({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {values.map((item) => {
          const selected = item === value;
          return (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${label}: ${item}`}
              onPress={() => onChange(item)}
              style={{
                paddingVertical: 11,
                paddingHorizontal: 14,
                borderWidth: 1.5,
                borderRadius: radii.sm,
                borderColor: selected ? colors.brightNori : colors.border,
                backgroundColor: selected ? colors.softCelery : colors.white,
              }}
            >
              <Text
                style={{
                  color: colors.bush,
                  fontSize: 13,
                  fontWeight: selected ? "800" : "500",
                }}
              >
                {selected ? `✓ ${item}` : item}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function HarvestCard({ harvest }: { harvest: Harvest }) {
  const isPriority = harvest.priority === "Priority";
  const statusLabel =
    harvest.status === "available"
      ? "✓ Verified & Published"
      : harvest.status === "pending_verification"
        ? "◷ Pending Coordinator Verification"
        : harvest.status === "rejected"
          ? "✕ Rejected by Coordinator"
          : harvest.status === "draft"
            ? "Draft"
            : harvest.status === "closed"
              ? "Closed"
              : "Coordinator verification: Planned";

  return (
    <View
      style={[
        styles.card,
        {
          borderLeftWidth: 5,
          borderLeftColor:
            harvest.status === "rejected"
              ? colors.dangerText
              : isPriority
                ? colors.venusFlytrap
                : colors.maximumGreen,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={{ gap: 2 }}>
          <Text style={styles.heading}>{harvest.crop}</Text>
          <Text style={styles.subtitle}>
            {harvest.barangay} · {harvest.municipality}
          </Text>
        </View>
        <Text style={isPriority ? styles.badgePriority : styles.badge}>
          {isPriority ? "Priority · farmer selected" : "Standard priority"}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.surfaceSoft,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.md,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "800", color: colors.bush }}>
          {harvest.quantity.toLocaleString()}{" "}
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.muted }}>
            kg available
          </Text>
        </Text>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            color: colors.brightNori,
          }}
        >
          ₱{harvest.price.toLocaleString()}/kg
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.subtitle}>
          Harvested {harvest.harvestDate} · {harvest.storage}
        </Text>
      </View>

      {!!harvest.reviewNotes && (
        <View
          style={{
            backgroundColor:
              harvest.status === "rejected" ? colors.dangerBg : colors.surfaceSoft,
            borderColor:
              harvest.status === "rejected"
                ? colors.dangerBorder
                : colors.maximumGreen,
            borderWidth: 1,
            borderRadius: radii.sm,
            padding: 10,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color:
                harvest.status === "rejected" ? colors.dangerText : colors.bush,
            }}
          >
            Coordinator review note: {harvest.reviewNotes}
          </Text>
        </View>
      )}

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 10,
          flexDirection: "row",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <Text style={styles.eyebrow}>
          {harvest.status
            ? "LIVE SUPABASE RECORD · PROJECT AGRI"
            : "DEMO RECORD · SAVED ON THIS BROWSER"}
        </Text>
        <Text
          style={{
            fontSize: 11,
            color:
              harvest.status === "rejected"
                ? colors.dangerText
                : harvest.status === "available"
                  ? colors.brightNori
                  : colors.muted,
            fontWeight: "700",
          }}
        >
          {statusLabel}
        </Text>
      </View>
    </View>
  );
}
