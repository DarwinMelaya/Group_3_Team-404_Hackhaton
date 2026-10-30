import { Link, useRouter, type Href } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Page, colors } from "../components/ui";
import { useHarvests } from "../lib/harvest-store";

export default function MarketPendingScreen() {
  const router = useRouter();
  const { activeMarket, signInDemoMarket, signOut } = useHarvests();

  const handleSwitchToVerified = () => {
    signInDemoMarket("market-boac-01");
    Alert.alert(
      "Switched to Verified Market Demo",
      "Naka-log in na bilang Boac Public Market Stall 12 (VERIFIED). Maaari ka nang mag-post ng demand at tumanggap ng alok.",
      [{ text: "Pumunta sa Dashboard", onPress: () => router.replace("/market-dashboard" as Href) }],
    );
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/welcome" as Href);
  };

  return (
    <Page>
      {/* Top back navigation */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Link href={"/welcome" as Href} asChild>
          <Pressable style={styles.backButton}>
            <Text style={styles.backButtonText}>← Bumalik sa Role Selection</Text>
          </Pressable>
        </Link>
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>⏳ PENDING VERIFICATION</Text>
        </View>
      </View>

      {/* Main Status Hero */}
      <View style={styles.statusHero}>
        <View style={styles.iconCircle}>
          <Text style={{ fontSize: 36 }}>⏳</Text>
        </View>
        <Text style={styles.heroTitle}>Awaiting Municipal Admin Verification</Text>
        <Text style={styles.heroSubtitle}>
          Ang iyong Market Buyer account ay kasalukuyang sinusuri ng Municipal Agricultural Office
          (MAO) ng Marinduque.
        </Text>
      </View>

      {/* Security Explanation Box */}
      <View style={styles.securityExplanationBox}>
        <Text style={styles.secTitle}>🛡️ BAKIT KAILANGAN NG VERIFICATION?</Text>
        <Text style={styles.secBody}>
          Upang protektahan ang mga lokal na magsasaka sa Marinduque laban sa mga pekeng order,
          hindi pagbabayad, at artipisyal na pagbaba ng presyo, ang lahat ng komersyal na mamimili ay
          dapat beripikado bago:
        </Text>
        <View style={styles.secBulletList}>
          <Text style={styles.secBulletItem}>❌ Mag-post ng aktibong commercial demands sa public board</Text>
          <Text style={styles.secBulletItem}>❌ Mag-reserve o tumanggap ng alok mula sa imbentaryo ng magsasaka</Text>
          <Text style={styles.secBulletItem}>❌ Mag-issue ng delivery acceptance certificates</Text>
        </View>
      </View>

      {/* Account Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.cardHeader}>IMPORMASYON NG IYONG ACCOUNT</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Pangalan ng Market:</Text>
          <Text style={styles.infoValue}>{activeMarket?.name ?? "Gasan Coastal Retail Stall"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Contact Person:</Text>
          <Text style={styles.infoValue}>{activeMarket?.contactPerson ?? "Jun Reyes"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email:</Text>
          <Text style={styles.infoValue}>{activeMarket?.email ?? "gasan.retail@marinduque.ph"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Bayan sa Marinduque:</Text>
          <Text style={styles.infoValue}>{activeMarket?.municipality ?? "Gasan"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Uri ng Negosyo:</Text>
          <Text style={styles.infoValue}>{activeMarket?.businessType ?? "Retailer / Grocery"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Katayuan (Status):</Text>
          <View style={styles.amberTag}>
            <Text style={styles.amberTagText}>Pending Admin Review</Text>
          </View>
        </View>
      </View>

      {/* Evaluator Fast-Track actions */}
      <View style={styles.actionsCard}>
        <Text style={styles.actionsTitle}>MGA PINAPAHINTULUTANG AKSYON (ACTIONS)</Text>

        <Link href={"/transactions" as Href} asChild>
          <Pressable style={styles.actionButtonSecondary}>
            <Text style={styles.actionButtonSecondaryText}>
              👁️ Tingnan ang Available Farmer Supply (Read-Only)
            </Text>
          </Pressable>
        </Link>

        {/* Demo switcher */}
        <Pressable
          onPress={handleSwitchToVerified}
          style={styles.actionButtonVerified}
        >
          <Text style={styles.actionButtonVerifiedText}>
            ⚡ Lumipat sa Verified Market Demo (Boac Stall 12)
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSignOut}
          style={styles.actionButtonDanger}
        >
          <Text style={styles.actionButtonDangerText}>Mag-log Out / Pumili ng Ibang Account</Text>
        </Pressable>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.surfaceCelery,
    borderWidth: 1,
    borderColor: colors.venusFlytrap,
  },
  backButtonText: {
    color: colors.bush,
    fontSize: 12,
    fontWeight: "700",
  },
  pendingBadge: {
    backgroundColor: "#FEF9C3",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EAB308",
  },
  pendingBadgeText: {
    color: "#854D0E",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statusHero: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    textAlign: "center",
    borderWidth: 1.5,
    borderColor: "#EAB308",
    gap: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEF9C3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EAB308",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.bush,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
    textAlign: "center",
  },
  securityExplanationBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FCD34D",
    gap: 8,
  },
  secTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400E",
    letterSpacing: 0.6,
  },
  secBody: {
    fontSize: 12,
    color: "#78350F",
    lineHeight: 18,
  },
  secBulletList: {
    gap: 4,
    marginTop: 2,
  },
  secBulletItem: {
    fontSize: 12,
    fontWeight: "600",
    color: "#991B1B",
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 12,
  },
  cardHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brightNori,
    letterSpacing: 1,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 13,
    color: colors.bush,
    fontWeight: "700",
  },
  amberTag: {
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#EAB308",
  },
  amberTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#854D0E",
  },
  actionsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 10,
  },
  actionsTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.bush,
    letterSpacing: 0.8,
  },
  actionButtonSecondary: {
    backgroundColor: colors.surfaceCelery,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.venusFlytrap,
    alignItems: "center",
  },
  actionButtonSecondaryText: {
    color: colors.bush,
    fontSize: 13,
    fontWeight: "700",
  },
  actionButtonVerified: {
    backgroundColor: colors.softCelery,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.brightNori,
    alignItems: "center",
  },
  actionButtonVerifiedText: {
    color: colors.brightNori,
    fontSize: 13,
    fontWeight: "800",
  },
  actionButtonDanger: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    alignItems: "center",
  },
  actionButtonDangerText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
  },
});

