import { Link, Slot, usePathname, type Href } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { HarvestProvider, useHarvests } from "../lib/harvest-store";
import { colors } from "../components/ui";

const tabs = [
  { href: "/", label: "Dashboard", icon: "⌂" },
  { href: "/harvests", label: "My Harvests", icon: "▤" },
  { href: "/add-harvest", label: "Add Harvest", icon: "+" },
  { href: "/transactions", label: "Transactions", icon: "⇄" },
  { href: "/profile", label: "Profile", icon: "○" },
];

function ModeBanner() {
  const { mode, profile, session } = useHarvests();
  const isLive = mode === "live";

  return (
    <View
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: isLive ? colors.surfaceSoft : colors.surfaceCelery,
        borderBottomWidth: 1,
        borderColor: isLive ? colors.maximumGreen : colors.venusFlytrap,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          textAlign: "center",
          color: colors.bush,
          fontWeight: "600",
        }}
      >
        {isLive
          ? session && profile
            ? `LIVE SUPABASE MODE (Agri) · Signed in as ${profile.display_name} (${profile.municipality} · ${profile.role})`
            : "LIVE SUPABASE MODE (Agri) · Sign in on Profile to post and view your live harvests"
          : "DEMO MODE · Local browser records · Live coordinator & processor sync planned"}
      </Text>
    </View>
  );
}

export default function Layout() {
  const pathname = usePathname();
  return (
    <SafeAreaProvider>
      <HarvestProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
          <Head>
            <title>SMART-ANI · Farmer Workspace (Marinduque)</title>
            <meta
              name="description"
              content="SMART-ANI: An AI-Powered B2B Post-Harvest Exchange and Value-Addition Platform in Marinduque. Farmer workspace preview."
            />
          </Head>
          <StatusBar style="dark" />

          <View
            style={{
              backgroundColor: colors.white,
              paddingHorizontal: 20,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 11 }}
            >
              <View
                style={{
                  backgroundColor: colors.bush,
                  borderColor: colors.brightNori,
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.softCelery,
                    fontWeight: "800",
                    fontSize: 14,
                    letterSpacing: 1,
                  }}
                >
                  SA
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    color: colors.bush,
                    fontWeight: "800",
                    letterSpacing: 1.8,
                    fontSize: 17,
                  }}
                >
                  SMART-ANI
                </Text>
                <Text
                  style={{
                    color: colors.brightNori,
                    fontSize: 10,
                    fontWeight: "700",
                    letterSpacing: 0.9,
                  }}
                >
                  FARMER WORKSPACE · MARINDUQUE
                </Text>
              </View>
            </View>
            <View
              style={{
                backgroundColor: colors.softCelery,
                borderColor: colors.venusFlytrap,
                borderWidth: 1,
                paddingHorizontal: 10,
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
                Marinduque, PH
              </Text>
            </View>
          </View>

          <ModeBanner />

          <View style={{ flex: 1 }}>
            <Slot />
          </View>

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
            {tabs.map((tab) => {
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
                      backgroundColor: active
                        ? colors.softCelery
                        : colors.white,
                      borderColor: active
                        ? colors.brightNori
                        : "transparent",
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
        </SafeAreaView>
      </HarvestProvider>
    </SafeAreaProvider>
  );
}
