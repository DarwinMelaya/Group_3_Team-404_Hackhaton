import { Link, useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Page, colors } from "../components/ui";
import { useHarvests } from "../lib/harvest-store";

export default function WelcomeScreen() {
  const router = useRouter();
  const { mode, signInDemoFarmer, signInDemoMarket, activeRole } = useHarvests();
  const isLive = mode === "live";

  const handleQuickDemoFarmer = () => {
    signInDemoFarmer();
    router.replace("/" as Href);
  };

  const handleQuickDemoMarketVerified = () => {
    signInDemoMarket("market-boac-01");
    router.replace("/market-dashboard" as Href);
  };

  const handleQuickDemoMarketPending = () => {
    signInDemoMarket("market-gasan-unverified");
    router.replace("/market-pending" as Href);
  };

  return (
    <Page>
      {/* Brand Hero */}
      <View style={welcomeStyles.heroCard}>
        <View style={welcomeStyles.badgeRow}>
          <View style={welcomeStyles.pillBadge}>
            <Text style={welcomeStyles.pillBadgeText}>🌿 SMART-ANI MARINDUQUE</Text>
          </View>
          <View
            style={[
              welcomeStyles.modeBadge,
              { backgroundColor: isLive ? colors.surfaceSoft : colors.surfaceCelery },
            ]}
          >
            <Text style={welcomeStyles.modeBadgeText}>
              {isLive ? "LIVE SUPABASE MODE" : "DEMO / OFFLINE MODE"}
            </Text>
          </View>
        </View>

        <Text style={welcomeStyles.heroTitle}>SMART-ANI</Text>
        <Text style={welcomeStyles.heroTagline}>
          Connecting Farmers to Markets. Reducing Crop Waste.
        </Text>
        <Text style={welcomeStyles.heroDescription}>
          Marinduque&apos;s demand-driven agricultural harvest distribution and post-harvest
          spoilage prevention platform. Helping farmers distribute crops across multiple
          verified municipal markets.
        </Text>

        <View style={welcomeStyles.cropPillRow}>
          <Text style={welcomeStyles.cropPillLabel}>Priority Crops:</Text>
          <View style={welcomeStyles.cropPill}><Text style={welcomeStyles.cropPillText}>Arrowroot (Uraro)</Text></View>
          <View style={welcomeStyles.cropPill}><Text style={welcomeStyles.cropPillText}>Cassava</Text></View>
          <View style={welcomeStyles.cropPill}><Text style={welcomeStyles.cropPillText}>Banana</Text></View>
          <View style={welcomeStyles.cropPill}><Text style={welcomeStyles.cropPillText}>Coconut</Text></View>
        </View>
      </View>

      {/* Role Selection Section */}
      <View style={{ gap: 14 }}>
        <Text style={welcomeStyles.sectionHeader}>PUMILI NG IYONG PAPEL (CHOOSE YOUR ROLE)</Text>
        <Text style={welcomeStyles.sectionSub}>
          Select your account type to proceed with dedicated authentication.
        </Text>

        {/* Farmer Card */}
        <View style={welcomeStyles.roleCard}>
          <View style={welcomeStyles.roleHeader}>
            <View style={welcomeStyles.roleIconBox}>
              <Text style={{ fontSize: 28 }}>🌾</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={welcomeStyles.roleTitle}>I&apos;m a Farmer</Text>
              <Text style={welcomeStyles.roleSubtitle}>Magsasaka / Smallholder Producer</Text>
            </View>
          </View>

          <Text style={welcomeStyles.roleBody}>
            • Register harvest inventory (kg, sacks, crates, bunches, or lots)
            {"\n"}• View live market demand and asking prices across Marinduque
            {"\n"}• Allocate surplus supply across multiple buyers to avoid waste
            {"\n"}• Monitor spoilage urgency windows and shelf-life advisories
          </Text>

          <Link href={"/farmer-login" as Href} asChild>
            <Pressable
              accessibilityLabel="I'm a Farmer"
              style={[welcomeStyles.roleButton, { backgroundColor: colors.brightNori }]}
            >
              <Text style={welcomeStyles.roleButtonText}>I&apos;m a Farmer →</Text>
            </Pressable>
          </Link>
        </View>

        {/* Market Buyer Card */}
        <View style={welcomeStyles.roleCard}>
          <View style={welcomeStyles.roleHeader}>
            <View style={welcomeStyles.roleIconBox}>
              <Text style={{ fontSize: 28 }}>🏪</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={welcomeStyles.roleTitle}>I&apos;m a Market Buyer</Text>
              <Text style={welcomeStyles.roleSubtitle}>
                Public Market · Cooperative · Processor · Wholesaler
              </Text>
            </View>
          </View>

          <Text style={welcomeStyles.roleBody}>
            • Post commercial demand requests (per-kilo or bulk lot pricing)
            {"\n"}• Browse verified farmer supplies and incoming harvests
            {"\n"}• Review and accept farmer supply allocations with zero double-counting
            {"\n"}• Confirm delivered produce and build verified trading history
          </Text>

          <Link href={"/market-login" as Href} asChild>
            <Pressable
              accessibilityLabel="I'm a Market Buyer"
              style={[welcomeStyles.roleButton, { backgroundColor: colors.bush }]}
            >
              <Text style={welcomeStyles.roleButtonText}>I&apos;m a Market Buyer →</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {/* Admin Web Notice */}
      <View style={welcomeStyles.adminNoticeCard}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 22 }}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={welcomeStyles.adminNoticeTitle}>Municipal Admin & Coordinator Notice</Text>
            <Text style={welcomeStyles.adminNoticeBody}>
              Admin functionality (account verification, municipal aggregation, and fraud prevention)
              is strictly managed via the <Text style={{ fontWeight: "700" }}>SMART-ANI Web Portal</Text>.
              There is no Admin login on this mobile application.
            </Text>
          </View>
        </View>
      </View>

      {/* Fast Evaluator Demo Shortcuts */}
      <View style={welcomeStyles.demoAccessCard}>
        <Text style={welcomeStyles.demoAccessTitle}>⚡ FAST EVALUATOR DEMO ACCESS</Text>
        <Text style={welcomeStyles.demoAccessSub}>
          Click below for instant one-click login to test any user experience without manual typing:
        </Text>

        <View style={{ gap: 8, marginTop: 4 }}>
          <Pressable
            onPress={handleQuickDemoFarmer}
            style={welcomeStyles.demoButton}
            accessibilityLabel="Instant Demo Farmer Login"
          >
            <Text style={welcomeStyles.demoButtonRole}>🌾 DEMO FARMER</Text>
            <Text style={welcomeStyles.demoButtonName}>Kuya Dante · Santa Cruz Smallholder (Alobo)</Text>
          </Pressable>

          <Pressable
            onPress={handleQuickDemoMarketVerified}
            style={welcomeStyles.demoButton}
            accessibilityLabel="Instant Demo Verified Market Login"
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={welcomeStyles.demoButtonRole}>🏪 DEMO MARKET (VERIFIED)</Text>
              <Text style={welcomeStyles.statusVerified}>VERIFIED</Text>
            </View>
            <Text style={welcomeStyles.demoButtonName}>Boac Public Market Stall 12 (Aling Nena)</Text>
          </Pressable>

          <Pressable
            onPress={handleQuickDemoMarketPending}
            style={welcomeStyles.demoButton}
            accessibilityLabel="Instant Demo Pending Market Login"
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={welcomeStyles.demoButtonRole}>🏪 DEMO MARKET (PENDING)</Text>
              <Text style={welcomeStyles.statusPending}>PENDING REVIEW</Text>
            </View>
            <Text style={welcomeStyles.demoButtonName}>Gasan Coastal Retail Stall (Jun Reyes)</Text>
          </Pressable>
        </View>
      </View>

      {/* Footer Info */}
      <View style={{ alignItems: "center", paddingVertical: 12, gap: 4 }}>
        <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600" }}>
          SMART-ANI v2.0 · Team 404: Sleep Not Found · Marinduque, Philippines
        </Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>
          Active Session Role: <Text style={{ fontWeight: "700", textTransform: "capitalize" }}>{activeRole}</Text>
        </Text>
      </View>
    </Page>
  );
}

const welcomeStyles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: colors.brightNori,
    gap: 12,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  pillBadge: {
    backgroundColor: colors.softCelery,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.venusFlytrap,
  },
  pillBadgeText: {
    color: colors.bush,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  modeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.maximumGreen,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.bush,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: colors.bush,
    letterSpacing: 1.5,
  },
  heroTagline: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brightNori,
    lineHeight: 24,
  },
  heroDescription: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
  },
  cropPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cropPillLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.bush,
  },
  cropPill: {
    backgroundColor: colors.cream,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cropPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.brightNori,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brightNori,
    letterSpacing: 1.2,
  },
  sectionSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: -8,
  },
  roleCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 12,
  },
  roleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  roleIconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.softCelery,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.venusFlytrap,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.bush,
  },
  roleSubtitle: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
    marginTop: 2,
  },
  roleBody: {
    fontSize: 13,
    color: "#3F4F42",
    lineHeight: 20,
  },
  roleButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  roleButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  adminNoticeCard: {
    backgroundColor: "#F0F4EC",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.venusFlytrap,
  },
  adminNoticeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.bush,
  },
  adminNoticeBody: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginTop: 4,
  },
  demoAccessCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.venusFlytrap,
    gap: 10,
  },
  demoAccessTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.bush,
    letterSpacing: 1.2,
  },
  demoAccessSub: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
  demoButton: {
    backgroundColor: colors.cream,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  demoButtonRole: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brightNori,
    letterSpacing: 0.5,
  },
  demoButtonName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.bush,
  },
  statusVerified: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.brightNori,
    backgroundColor: colors.softCelery,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPending: {
    fontSize: 10,
    fontWeight: "800",
    color: "#854D0E",
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

