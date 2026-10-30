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
  MEASUREMENT_UNITS,
  MUNICIPALITIES,
  QUALITY_GRADES,
  STORAGE,
  todayInMarinduque,
  unitLabel,
  validateHarvest,
  type HarvestInput,
  type MeasurementUnit,
  type QualityGrade,
} from "../lib/harvest";
import { useHarvests } from "../lib/harvest-store";

export default function AddHarvest() {
  const {
    add,
    saveOfflineDraft,
    ready,
    error: storageError,
    mode,
    session,
    profile,
  } = useHarvests();
  const [form, setForm] = useState<HarvestInput>({
    crop: "Banana",
    quantity: "",
    unit: "kg",
    conversionRateKg: "",
    price: "",
    harvestDate: todayInMarinduque(),
    municipality: profile?.municipality ?? "Boac",
    barangay: "",
    storage: STORAGE[0],
    priority: "Standard",
    qualityGrade: "Grade A",
    photoRef: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const update = (key: keyof HarvestInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(asOfflineDraft = false) {
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
      const payload = {
        ...form,
        barangay: form.barangay.trim(),
        quantity: Number(form.quantity),
        unit: (form.unit ?? "kg") as MeasurementUnit,
        conversionRateKg: String(form.conversionRateKg ?? "").trim()
          ? Number(form.conversionRateKg)
          : undefined,
        price: Number(form.price),
        qualityGrade: (form.qualityGrade ?? "Grade A") as QualityGrade,
        photoRef: (form.photoRef ?? "").trim(),
        storageTempC:
          form.storageTempC !== undefined &&
          String(form.storageTempC).trim() !== ""
            ? Number(form.storageTempC)
            : undefined,
      };
      if (asOfflineDraft) {
        await saveOfflineDraft(payload);
        router.replace("/harvests?draft=1");
      } else {
        await add(payload);
        router.replace("/harvests?saved=1");
      }
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
        title="I-rehistro ang Aking Ani (Share Harvest)"
        description="Ilagay ang dami, yunit ng pagsukat (kilo, sako, kahon, buwig, o lote), kalidad, lokasyon, at asking price."
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
          <Text style={styles.badge}>
            FARMER SIGN-IN REQUIRED FOR LIVE POSTING
          </Text>
          <Text style={styles.heading}>
            Sign in before submitting a live harvest
          </Text>
          <Text style={styles.subtitle}>
            Live Supabase Mode requires an authenticated farmer account so your
            listing is tied to your verified farmer ID with status{" "}
            pending_verification, or save an Offline Draft below.
          </Text>
          <Action href="/profile">Sign in on Profile →</Action>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>1. Pananim, Dami at Yunit (Crop, Quantity & Unit)</Text>
        <Text style={[styles.helperText, { marginBottom: 8, color: colors.brightNori, fontWeight: "600" }]}>
          ⭐ 4 Marinduque Priority Crops: Uraro, Cassava, Saging, at Niyog
        </Text>
        <Choices
          label="Pananim (Crop)"
          values={CROPS}
          value={form.crop}
          onChange={(value) => update("crop", value)}
        />
        <Choices
          label="Yunit ng Pagsukat (Measurement Unit)"
          values={MEASUREMENT_UNITS}
          value={form.unit ?? "kg"}
          onChange={(value) => update("unit", value)}
        />
        <Field
          label={`Dami (${unitLabel(form.unit)})`}
          helper={`Ilagay ang kabuuang dami ng ani sa ${unitLabel(form.unit)}.`}
          placeholder="Hal. 100"
          keyboardType="decimal-pad"
          value={form.quantity}
          onChangeText={(value) => update("quantity", value)}
        />
        {form.unit && form.unit !== "kg" && (
          <Field
            label={`Tantiyang timbang sa kilo bawat ${unitLabel(form.unit)} (opsyonal)`}
            helper="Halimbawa: 50 kg bawat sako, o 25 kg bawat kahon."
            placeholder="Hal. 50"
            keyboardType="decimal-pad"
            value={
              form.conversionRateKg !== undefined
                ? String(form.conversionRateKg)
                : ""
            }
            onChangeText={(value) => update("conversionRateKg", value)}
          />
        )}
        <Choices
          label="Quality grade"
          values={QUALITY_GRADES}
          value={form.qualityGrade ?? "Grade A"}
          onChange={(value) => update("qualityGrade", value)}
        />
        <Field
          label={`Asking price (PHP / ${unitLabel(form.unit)})`}
          helper={`Presyo ng ani bawat ${unitLabel(form.unit)} sa piso.`}
          placeholder="Hal. 25"
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
        <Field
          label="GPS Farm Coordinates (opsyonal)"
          helper="Tukuyin ang GPS coordinates para sa mabilis na paghahanap ng pinakamalapit na pasilidad."
          placeholder="Hal. 13.4839, 122.0289"
          value={form.gpsCoordinates ?? ""}
          onChangeText={(value) => update("gpsCoordinates", value)}
          maxLength={50}
        />
        <Choices
          label="Iskedyul ng Pag-aani (Harvesting Schedule)"
          values={[
            "Single harvest (Isang anihan)",
            "Daily picking (Araw-araw)",
            "Twice a week (2x bawat linggo)",
          ]}
          value={form.harvestSchedule ?? "Single harvest (Isang anihan)"}
          onChange={(value) => update("harvestSchedule", value)}
        />

        <Text style={styles.sectionLabel}>
          3. Storage, Freshness & Spoilage Urgency
        </Text>
        <Choices
          label="Storage condition"
          values={STORAGE}
          value={form.storage}
          onChange={(value) => update("storage", value)}
        />
        <Field
          label="Tantiyang Temperatura ng Imbakan (°C, opsyonal)"
          helper="Halimbawa: 24 para sa shaded room, 13 para sa air-conditioned / cool shed."
          placeholder="Hal. 24"
          keyboardType="decimal-pad"
          value={form.storageTempC !== undefined ? String(form.storageTempC) : ""}
          onChangeText={(value) => update("storageTempC", value)}
          maxLength={4}
        />
        <Field
          label="Pangalan ng Village Coordinator (kung tinulungan magtala)"
          helper="Kung tinulungan ng Barangay Coordinator, ilagay ang kanyang pangalan para sa mabilis na verification."
          placeholder="Hal. Maria Santos (Brgy. Coordinator)"
          value={form.coordinatorName ?? ""}
          onChangeText={(value) => update("coordinatorName", value)}
          maxLength={100}
        />
        <Field
          label="Photo reference or crate description (optional)"
          helper="Describe crate photo or batch label (e.g. '4 crates green Saba, Alobo shed')."
          placeholder="e.g. 4 ventilated crates green Saba"
          value={form.photoRef ?? ""}
          onChangeText={(value) => update("photoRef", value)}
          maxLength={200}
        />
        <Choices
          label="Outreach priority"
          values={["Standard", "Priority"]}
          value={form.priority}
          onChange={(value) => update("priority", value)}
        />
        <Text style={styles.subtitle}>
          Choose Priority if your crop needs urgent market allocation. This is
          an advisory preference, not an expiration date or food-safety
          guarantee.
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
          onPress={() => void submit(false)}
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
                ? "Submit for Admin verification"
                : "Save demo harvest"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={saving || !ready}
          onPress={() => void submit(true)}
          style={{
            paddingVertical: 13,
            paddingHorizontal: 18,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.maximumGreen,
            backgroundColor: colors.surfaceSoft,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.bush, fontWeight: "700", fontSize: 14 }}>
            Save as Offline Draft (Sync Later)
          </Text>
        </Pressable>

        <Text style={styles.subtitle}>
          {mode === "live"
            ? "Submitted to Supabase Agri as pending_verification. Admin approval publishes the listing so you can allocate quantities to verified Markets."
            : "Saved in isolated Demo Mode on this browser. Once saved, you can immediately allocate quantities across Market 1, Market 2, and Market 3."}
        </Text>
      </View>
    </Page>
  );
}
