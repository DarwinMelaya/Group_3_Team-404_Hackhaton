import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Choices,
  colors,
  Field,
  Heading,
  Page,
  styles,
} from "../components/ui";
import { MUNICIPALITIES } from "../lib/harvest";
import { useHarvests } from "../lib/harvest-store";
import { supabaseConfig } from "../lib/supabase-config";

export default function Profile() {
  const {
    mode,
    setMode,
    session,
    profile,
    authReady,
    authError,
    activeRole,
    activeMarket,
    activeFarmer,
    signIn,
    signUp,
    signOut,
  } = useHarvests();

  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [municipality, setMunicipality] = useState<string>("Santa Cruz");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const isConfigured = supabaseConfig.status === "configured";

  async function handleAuthSubmit() {
    if (busy) return;
    setFormError("");
    setNotice("");
    setBusy(true);
    try {
      if (authTab === "signin") {
        await signIn(email, password);
        setPassword("");
        setNotice("Signed in to SMART-ANI (Supabase Agri).");
      } else {
        const res = await signUp({
          email,
          password,
          displayName,
          municipality,
        });
        setPassword("");
        if (res.confirmationRequired) {
          setNotice(
            "Farmer account created! Check your email if confirmation is enabled, then sign in.",
          );
          setAuthTab("signin");
        } else {
          setNotice(
            "Farmer account created and signed in with default role: farmer.",
          );
        }
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    setFormError("");
    setNotice("");
    try {
      await signOut();
      setNotice("Signed out of Supabase Agri.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Heading
        title="My profile"
        description="SMART-ANI authentication & workspace settings for Marinduque agricultural exchange."
      />

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>CURRENT APP ROLE & IDENTITY</Text>
        <View style={{ gap: 10 }}>
          <View>
            <Text style={styles.heading}>
              {activeRole === "market" ? "🏪 Market Buyer Role" : "🌾 Farmer Role"}
            </Text>
            <Text style={styles.subtitle}>
              {activeRole === "market"
                ? `Active account: ${activeMarket?.name ?? "Market Buyer"} (${activeMarket?.verificationStatus ?? "verified"})`
                : `Active account: ${activeFarmer?.name ?? "Kuya Dante"} (${activeFarmer?.municipality ?? "Santa Cruz"})`}
            </Text>
          </View>
          <Link href={"/welcome" as Href} asChild>
            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor: colors.surfaceCelery,
                  borderColor: colors.venusFlytrap,
                  paddingVertical: 10,
                },
              ]}
            >
              <Text style={{ color: colors.bush, fontWeight: "800", fontSize: 13 }}>
                ⇄ Switch Role / Choose Account
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {isConfigured && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>WORKSPACE MODE</Text>
          <Choices
            label="Active data source"
            values={["LIVE SUPABASE MODE", "DEMO MODE"]}
            value={mode === "live" ? "LIVE SUPABASE MODE" : "DEMO MODE"}
            onChange={(val) =>
              setMode(val === "LIVE SUPABASE MODE" ? "live" : "demo")
            }
          />
          <Text style={styles.subtitle}>
            {mode === "live"
              ? "Connected to Supabase Agri. Demo records are never mixed with live database listings."
              : "Isolated browser demo mode. Records stay on this browser only."}
          </Text>
        </View>
      )}

      {isConfigured && session && profile ? (
        <View style={styles.card}>
          <Text style={styles.badge}>
            AUTHENTICATED · {profile.role.toUpperCase()}
          </Text>
          <Text style={styles.heading}>{profile.display_name}</Text>
          <Text style={styles.subtitle}>
            Email: {session.user.email}{"\n"}
            Municipality: {profile.municipality}, Marinduque{"\n"}
            Database Role: {profile.role} (verified from public.profiles)
          </Text>
          {!!notice && (
            <Text role="status" style={styles.badge}>
              {notice}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void handleSignOut()}
            style={[
              styles.button,
              {
                backgroundColor: colors.bush,
                opacity: busy ? 0.5 : 1,
              },
            ]}
          >
            <Text style={styles.buttonText}>
              {busy ? "Signing out…" : "Sign out"}
            </Text>
          </Pressable>
        </View>
      ) : isConfigured ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>
            SUPABASE AGRI FARMER AUTHENTICATION
          </Text>
          <Choices
            label="Account action"
            values={["Sign In", "Create Farmer Account"]}
            value={authTab === "signin" ? "Sign In" : "Create Farmer Account"}
            onChange={(val) => {
              setAuthTab(val === "Sign In" ? "signin" : "signup");
              setFormError("");
              setNotice("");
            }}
          />

          {authTab === "signup" && (
            <>
              <Field
                label="Farmer display name"
                helper="Your full name or farm name in Marinduque (1–100 characters)."
                placeholder="e.g. Juan dela Cruz"
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={100}
              />
              <Choices
                label="Home municipality"
                values={MUNICIPALITIES}
                value={municipality}
                onChange={setMunicipality}
              />
            </>
          )}

          <Field
            label="Email address"
            placeholder="farmer@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="Password"
            helper="Minimum 6 characters."
            placeholder="Enter password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {!!(formError || authError) && (
            <Text
              role="alert"
              style={{
                color: colors.dangerText,
                backgroundColor: colors.dangerBg,
                borderColor: colors.dangerBorder,
                borderWidth: 1,
                padding: 13,
                borderRadius: 12,
                fontWeight: "600",
              }}
            >
              {formError || authError}
            </Text>
          )}

          {!!notice && (
            <Text role="status" style={styles.badge}>
              {notice}
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={busy || !authReady}
            onPress={() => void handleAuthSubmit()}
            style={[
              styles.button,
              { opacity: busy || !authReady ? 0.5 : 1 },
            ]}
          >
            <Text style={styles.buttonText}>
              {busy
                ? "Please wait…"
                : authTab === "signin"
                  ? "Sign in to SMART-ANI"
                  : "Create farmer account"}
            </Text>
          </Pressable>
          <Text style={styles.subtitle}>
            New Farmer accounts automatically receive the database-enforced
            default role (farmer). Market accounts register on the Market Web
            Portal and require Admin verification.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.badge}>DEMO PROFILE · FARMER ROLE</Text>
          <Text style={styles.heading}>Marinduque smallholder farmer</Text>
          <Text style={styles.subtitle}>
            Platform: SMART-ANI (Team 404: Sleep Not Found){"\n"}
            Official Roles: Farmer, Market (Public Markets, Cooperatives,
            Processors), Admin{"\n"}
            Coverage: Boac, Mogpog, Santa Cruz, Torrijos, Buenavista, Gasan{"\n"}
            Supported Crops: Banana, Arrowroot (uraro), Cassava, Camote,
            Coconut, Vegetables
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.heading}>Backend connection</Text>
        <Text style={styles.badge}>
          {supabaseConfig.status === "configured"
            ? session
              ? "LIVE SUPABASE CONNECTED · AUTHENTICATED"
              : "SUPABASE CONFIGURED · SIGN IN ABOVE"
            : supabaseConfig.status === "invalid"
              ? "CONFIGURATION ERROR"
              : "DEMO MODE · NOT CONFIGURED"}
        </Text>
        <Text
          role={supabaseConfig.status === "invalid" ? "alert" : undefined}
          style={styles.subtitle}
        >
          {supabaseConfig.message}
        </Text>
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
        <Text style={styles.sectionLabel}>3-ROLE SECURITY & GOVERNANCE</Text>
        <Text style={styles.heading}>
          Farmer, Market & Admin protection boundaries
        </Text>
        <Text style={styles.subtitle}>
          SMART-ANI enforces three roles: Farmer, Market, and Admin. Farmers
          can divide a single harvest across multiple verified Markets without
          over-allocating, while Markets confirm actual received quantities.
        </Text>
      </View>
    </Page>
  );
}
