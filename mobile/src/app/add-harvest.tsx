import { useRef, useState } from "react";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import {
  Action,
  Choices,
  colors,
  Field,
  Heading,
  Page,
  styles,
} from "../components/ui";
import {
  CROPS,
  MUNICIPALITIES,
  STORAGE,
  todayInMarinduque,
  validateHarvest,
  type HarvestInput,
} from "../lib/harvest";
import { useHarvests } from "../lib/harvest-store";

export default function AddHarvest() {
  const {
    add,
    ready,
    error: storageError,
    mode,
    session,
    profile,
  } = useHarvests();
  const [form, setForm] = useState<HarvestInput>({
    crop: "Banana",
    quantity: "",
    price: "",
    harvestDate: todayInMarinduque(),
    municipality: profile?.municipality ?? "Boac",
    barangay: "",
    storage: STORAGE[0],
    priority: "Standard",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const update = (key: keyof HarvestInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    if (inFlight.current) return;
    const validation = validateHarvest(form);
    if (validation) {
      setError(validation);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      await add({
        ...form,
        barangay: form.barangay.trim(),
        quantity: Number(form.quantity),
        price: Number(form.price),
      });
      router.replace("/harvests?saved=1");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save harvest. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Page>
      <Heading
        title="Share your harvest"
        description="Enter your available surplus in kilograms (kg) and your asking price in Philippine pesos (₱/kg)."
      />

      {mode === "live" && !session && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceSoft,
              borderColor: colors.maximumGreen,
            },
          ]}
        >
          <Text style={styles.badge}>FARMER SIGN-IN REQUIRED FOR LIVE POSTING</Text>
          <Text style={styles.heading}>
            Sign in before submitting a live harvest
          </Text>
          <Text style={styles.subtitle}>
            Live Supabase Mode requires an authenticated farmer account so your
            listing is tied to your verified farmer ID with status{" "}
            pending_verification.
          </Text>
          <Action href="/profile">Sign in on Profile →</Action>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>1. Crop & Quantity</Text>
        <Choices
          label="Crop"
          values={CROPS}
          value={form.crop}
          onChange={(value) => update("crop", value)}
        />
        <Field
          label="Quantity (kg)"
          helper="Enter a positive weight up to 1,000,000 kg."
          placeholder="e.g. 150"
          keyboardType="decimal-pad"
          value={form.quantity}
          onChangeText={(value) => update("quantity", value)}
        />
        <Field
          label="Asking price (PHP / kg)"
          helper="Your farmgate asking price per kilogram in pesos."
          placeholder="e.g. 25"
          keyboardType="decimal-pad"
          value={form.price}
          onChangeText={(value) => update("price", value)}
        />
        <Field
          label="Harvest date (YYYY-MM-DD)"
          helper="Must be today or an earlier date in Philippine time."
          placeholder="YYYY-MM-DD"
          value={form.harvestDate}
          onChangeText={(value) => update("harvestDate", value)}
          maxLength={10}
        />

        <Text style={styles.sectionLabel}>2. Farm Location in Marinduque</Text>
        <Choices
          label="Municipality"
          values={MUNICIPALITIES}
          value={form.municipality}
          onChange={(value) => update("municipality", value)}
        />
        <Field
          label="Barangay"
          helper="Barangay where the harvest is stored or ready for pickup."
          placeholder="Enter your barangay"
          value={form.barangay}
          onChangeText={(value) => update("barangay", value)}
          maxLength={100}
        />

        <Text style={styles.sectionLabel}>3. Storage & Outreach Priority</Text>
        <Choices
          label="Storage condition"
          values={STORAGE}
          value={form.storage}
          onChange={(value) => update("storage", value)}
        />
        <Choices
          label="Outreach priority"
          values={["Standard", "Priority"]}
          value={form.priority}
          onChange={(value) => update("priority", value)}
        />
        <Text style={styles.subtitle}>
          Choose Priority if you want coordinator outreach sooner. This is a
          farmer preference, not an expiration date or food-safety guarantee.
        </Text>

        {!!(error || storageError) && (
          <Text
            role="alert"
            style={{
              color: colors.dangerText,
              backgroundColor: colors.dangerBg,
              borderColor: colors.dangerBorder,
              borderWidth: 1,
              padding: 13,
              borderRadius: 12,
              lineHeight: 21,
              fontWeight: "600",
            }}
          >
            {error || storageError}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={saving || !ready || (mode === "live" && !session)}
          onPress={() => void submit()}
          style={[
            styles.button,
            {
              opacity:
                saving || !ready || (mode === "live" && !session) ? 0.5 : 1,
            },
          ]}
        >
          <Text style={styles.buttonText}>
            {saving
              ? "Saving…"
              : mode === "live"
                ? "Submit for coordinator verification"
                : "Save demo harvest"}
          </Text>
        </Pressable>
        <Text style={styles.subtitle}>
          {mode === "live"
            ? "Submitted to Supabase Agri as pending_verification. Barangay coordinator approval is required before processors can view this listing."
            : "Saved on this browser only in Phase 1 demo mode. No live buyers or SMS gateways are notified yet."}
        </Text>
      </View>
    </Page>
  );
}
