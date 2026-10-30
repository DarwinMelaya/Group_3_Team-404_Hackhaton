import { Link, Slot, usePathname, type Href } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { HarvestProvider, useHarvests } from "../lib/harvest-store";
import { colors } from "../components/ui";

const farmerTabs = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/harvests", label: "My Harvest", icon: "▤" },
  { href: "/add-harvest", label: "+ Mag-ani", icon: "+" },
  { href: "/transactions", label: "Find Markets", icon: "⇄" },
  { href: "/profile", label: "Profile", icon: "○" },
];

const marketTabs = [
  { href: "/market-dashboard", label: "Market Home", icon: "⌂" },
  { href: "/transactions", label: "Farmer Supplies", icon: "⇄" },
  { href: "/profile", label: "Profile", icon: "○" },
];

function ModeBanner() {
  const { mode, profile, session, activeRole, activeMarket } = useHarvests();
  const isLive = mode === "live";

  return (
    <View
      style={{
        paddingVertical: 7,
        paddingHorizontal: 14,
        backgroundColor: isLive ? colors.surfaceSoft : colors.surfaceCelery,
        borderBottomWidth: 1,
        borderColor: isLive ? colors.maximumGreen : colors.venusFlytrap,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          textAlign: "center",
          color: colors.bush,
          fontWeight: "600",
        }}
      >
        {isLive
          ? session && profile
            ? `LIVE SUPABASE MODE (Agri) · Signed in as ${profile.display_name} (${profile.municipality} · ${profile.role})`
            : "LIVE SUPABASE MODE (Agri) · Sign in on Profile to post and allocate live harvests"
          : activeRole === "market"
            ? `DEMO MODE · Signed in as ${activeMarket?.name ?? "Market Buyer"} (${activeMarket?.verificationStatus ?? "verified"})`
            : "DEMO MODE · Local browser records · Demand-driven Farmer → Market allocation active"}
      </Text>
    </View>
  );
}

function MainShell() {
  const pathname = usePathname();
  const { activeRole } = useHarvests();

  const isAuthRoute =
    pathname === "/welcome" ||
    pathname === "/farmer-login" ||
    pathname === "/market-login" ||
    pathname === "/market-pending";

  const currentTabs = activeRole === "market" ? marketTabs : farmerTabs;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <Head>
        <title>
          {activeRole === "market"
            ? "SMART-ANI · Market Buyer Portal (Marinduque)"
            : "SMART-ANI · Farmer Workspace (Marinduque)"}
        </title>
        <meta
          name="description"
          content="SMART-ANI: Demand-Driven Agricultural Harvest Distribution and Spoilage Prevention Platform in Marinduque."
        />
      </Head>
      <StatusBar style="dark" />

      {/* Top Header */}
      <View
        style={{
          backgroundColor: colors.white,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 11,
            flexShrink: 1,
          }}
        >
          <View
            style={{
              backgroundColor: colors.bush,
              borderColor: colors.brightNori,
              borderWidth: 1,
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: colors.softCelery,
                fontWeight: "800",
                fontSize: 13,
                letterSpacing: 1,
              }}
            >
              SA
            </Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text
              style={{
                color: colors.bush,
                fontWeight: "800",
                letterSpacing: 1.5,
                fontSize: 16,
              }}
            >
              SMART-ANI
            </Text>
            <Text
              style={{
                color: colors.brightNori,
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 0.8,
              }}
            >
              {pathname === "/welcome"
                ? "B2B POST-HARVEST PLATFORM"
                : activeRole === "market"
                  ? "MARKET BUYER · MARINDUQUE"
                  : "FARMER WORKSPACE · MARINDUQUE"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {pathname !== "/welcome" && (
            <Link href={"/welcome" as Href} asChild>
              <Pressable
                accessibilityLabel="Switch Role"
                style={{
                  backgroundColor: colors.surfaceCelery,
                  borderColor: colors.venusFlytrap,
                  borderWidth: 1,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    color: colors.bush,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  ⇄ Switch Role
                </Text>
              </Pressable>
            </Link>
          )}

          <View
            style={{
              backgroundColor: colors.softCelery,
              borderColor: colors.venusFlytrap,
              borderWidth: 1,
              paddingHorizontal: 9,
              paddingVertical: 5,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                color: colors.bush,
                fontSize: 11,
                fontWeight: "800",
              }}
            >
              Marinduque
            </Text>
          </View>
        </View>
      </View>

      <ModeBanner />

      <View style={{ flex: 1 }}>
        <Slot />
      </View>

      {/* Bottom Tabs — Hidden on dedicated auth/pending pages */}
      {!isAuthRoute && (
        <View
          role="navigation"
          style={{
            flexDirection: "row",
            backgroundColor: colors.white,
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingTop: 6,
            paddingBottom: 10,
            paddingHorizontal: 6,
            gap: 4,
          }}
        >
          {currentTabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href as Href} asChild>
                <Pressable
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    gap: 3,
                    paddingVertical: 7,
                    backgroundColor: active ? colors.softCelery : colors.white,
                    borderColor: active ? colors.brightNori : "transparent",
                    borderWidth: 1,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 22,
                      lineHeight: 26,
                      color: active ? colors.bush : colors.muted,
                      fontWeight: active ? "800" : "500",
                    }}
                  >
                    {tab.icon}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: active ? "800" : "600",
                      color: active ? colors.bush : colors.muted,
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <HarvestProvider>
        <MainShell />
      </HarvestProvider>
    </SafeAreaProvider>
  );
}
