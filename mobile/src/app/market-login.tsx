import { Link, useRouter, type Href } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Page, colors } from "../components/ui";
import { MARKET_BUSINESS_TYPES, MUNICIPALITIES } from "../lib/harvest";
import { useHarvests } from "../lib/harvest-store";

export default function MarketLoginScreen() {
  const router = useRouter();
  const {
    signInMarket,
    signUpMarket,
    signInDemoMarket,
    activeMarket,
  } = useHarvests();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Login form state
  const [loginEmail, setLoginEmail] = useState(
    activeMarket?.email ?? "market1.boac@marinduque.ph",
  );
  const [loginPassword, setLoginPassword] = useState("market123456");

  // Registration form state
  const [marketName, setMarketName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regMunicipality, setRegMunicipality] = useState<string>("Boac");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessType, setBusinessType] = useState<string>(
    MARKET_BUSINESS_TYPES[0],
  );
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  const handleLogin = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    if (!loginEmail.trim() || !loginEmail.includes("@")) {
      setErrorMessage("Maglagay ng wastong email address ng Market.");
      return;
    }
    if (!loginPassword || loginPassword.length < 6) {
      setErrorMessage("Ang password ay dapat hindi bababa sa 6 na karakter.");
      return;
    }

    setLoading(true);
    try {
      const result = await signInMarket(loginEmail.trim(), loginPassword);
      if (result.verified) {
        router.replace("/market-dashboard" as Href);
      } else {
        router.replace("/market-pending" as Href);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Hindi makapag-log in bilang Market.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!marketName.trim()) {
      setErrorMessage("Ilagay ang pangalan ng Market o Negosyo.");
      return;
    }
    if (!contactPerson.trim()) {
      setErrorMessage("Ilagay ang pangalan ng Contact Person.");
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@")) {
      setErrorMessage("Maglagay ng wastong email address.");
      return;
    }
    if (!regPhone.trim()) {
      setErrorMessage("Ilagay ang numero ng telepono ng negosyo.");
      return;
    }
    if (!businessAddress.trim()) {
      setErrorMessage("Ilagay ang pisikal na address ng negosyo sa Marinduque.");
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMessage("Ang password ay dapat hindi bababa sa 6 na karakter.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage("Hindi magkatugma ang mga password.");
      return;
    }

    setLoading(true);
    try {
      const result = await signUpMarket({
        marketName: marketName.trim(),
        contactPerson: contactPerson.trim(),
        email: regEmail.trim(),
        contactNumber: regPhone.trim(),
        municipality: regMunicipality,
        businessAddress: businessAddress.trim(),
        businessType,
        password: regPassword,
      });

      if (result.confirmationRequired) {
        setSuccessMessage(
          "Market account registered! Check your email to confirm, then await Admin verification.",
        );
        setTab("login");
      } else {
        Alert.alert(
          "Market Registration Submitted",
          "Your Market account is registered with PENDING VERIFICATION status. An Admin must verify your business permit before active public demands can be posted.",
          [
            {
              text: "Tingnan ang Account Status",
              onPress: () => router.replace("/market-pending" as Href),
            },
          ],
        );
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Hindi matagumpay ang pagpaparehistro.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoVerified = () => {
    signInDemoMarket("market-boac-01");
    Alert.alert(
      "Verified Market Active",
      "Naka-log in bilang Boac Public Market Stall 12 (VERIFIED). Papunta sa Market Dashboard.",
      [{ text: "Pumunta", onPress: () => router.replace("/market-dashboard" as Href) }],
    );
  };

  const handleQuickDemoPending = () => {
    signInDemoMarket("market-gasan-unverified");
    Alert.alert(
      "Pending Market Active",
      "Naka-log in bilang Gasan Coastal Retail Stall (PENDING VERIFICATION). Papunta sa Verification Status screen.",
      [{ text: "Tingnan Status", onPress: () => router.replace("/market-pending" as Href) }],
    );
  };

  return (
    <Page>
      {/* Top back navigation */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Link href={"/welcome" as Href} asChild>
          <Pressable style={styles.backButton}>
            <Text style={styles.backButtonText}>← Bumalik sa Pagpili ng Papel</Text>
          </Pressable>
        </Link>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>🏪 MARKET BUYER PORTAL</Text>
        </View>
      </View>

      {/* Hero card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Mamimili / Market Buyer Portal</Text>
        <Text style={styles.heroSubtitle}>
          Mag-post ng pangangailangan sa pananim (per-kilo o bulto), suriin ang alok ng mga magsasaka,
          at kumpirmahin ang mga natanggap na ani.
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setTab("login")}
          style={[styles.tabButton, tab === "login" && styles.tabButtonActive]}
        >
          <Text style={[styles.tabText, tab === "login" && styles.tabTextActive]}>
            Mag-sign In (Log In)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("register")}
          style={[styles.tabButton, tab === "register" && styles.tabButtonActive]}
        >
          <Text style={[styles.tabText, tab === "register" && styles.tabTextActive]}>
            Magrehistro ng Market
          </Text>
        </Pressable>
      </View>

      {/* Error or Success notification */}
      {!!errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
        </View>
      )}
      {!!successMessage && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>✅ {successMessage}</Text>
        </View>
      )}

      {/* Security alert for Market Accounts */}
      <View style={styles.securityAlert}>
        <Text style={styles.securityAlertTitle}>🔒 MARKET ACCOUNT VERIFICATION SECURITY</Text>
        <Text style={styles.securityAlertBody}>
          Ang lahat ng bagong Market account ay nagsisimula bilang{" "}
          <Text style={{ fontWeight: "800" }}>pending_verification</Text>. Ang mga awtorisadong
          Municipal Admin lamang ang may kapangyarihang mag-apruba ng mga mamimili upang protektahan
          ang mga magsasaka laban sa bogus orders.
        </Text>
      </View>

      {/* FORM: LOGIN */}
      {tab === "login" ? (
        <View style={styles.formCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email Address ng Market / Negosyo</Text>
            <TextInput
              style={styles.input}
              placeholder="hal. market1.boac@marinduque.ph"
              placeholderTextColor="#7D8D80"
              keyboardType="email-address"
              autoCapitalize="none"
              value={loginEmail}
              onChangeText={setLoginEmail}
            />
          </View>

          <View style={styles.fieldGroup}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.fieldLabel}>Password</Text>
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.showHideToggle}>
                  {showPassword ? "Itago (Hide)" : "Ipakita (Show)"}
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Ilagay ang iyong password"
              placeholderTextColor="#7D8D80"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={loginPassword}
              onChangeText={setLoginPassword}
            />
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={[styles.submitButton, loading && { opacity: 0.7 }]}
          >
            <Text style={styles.submitButtonText}>
              {loading ? "Sinisiyasat..." : "Pumasok sa Market Workspace →"}
            </Text>
          </Pressable>

          {/* Quick Demo Access */}
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>MABILIS NA PAGSUBOK (DEMO ACCESS)</Text>
            <Text style={styles.demoDesc}>
              Subukan ang buong karanasan nang hindi nag-aaksaya ng oras sa pag-type:
            </Text>

            <Pressable
              onPress={handleQuickDemoVerified}
              style={styles.quickDemoButton}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.quickDemoRole}>VERIFIED MARKET DEMO</Text>
                <Text style={styles.statusVerified}>VERIFIED</Text>
              </View>
              <Text style={styles.quickDemoName}>Boac Public Market Stall 12 (Aling Nena)</Text>
            </Pressable>

            <Pressable
              onPress={handleQuickDemoPending}
              style={[styles.quickDemoButton, { marginTop: 6 }]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.quickDemoRole}>PENDING MARKET DEMO</Text>
                <Text style={styles.statusPending}>PENDING REVIEW</Text>
              </View>
              <Text style={styles.quickDemoName}>Gasan Coastal Retail Stall (Jun Reyes)</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* FORM: REGISTRATION */
        <View style={styles.formCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Pangalan ng Market o Negosyo *</Text>
            <TextInput
              style={styles.input}
              placeholder="hal. Mogpog Arrowroot Delicacies & Processing"
              placeholderTextColor="#7D8D80"
              value={marketName}
              onChangeText={setMarketName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Contact Person / May-ari o Kinatawan *</Text>
            <TextInput
              style={styles.input}
              placeholder="hal. Maria Santos"
              placeholderTextColor="#7D8D80"
              value={contactPerson}
              onChangeText={setContactPerson}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="hal. contact@mogpog-arrowroot.ph"
              placeholderTextColor="#7D8D80"
              keyboardType="email-address"
              autoCapitalize="none"
              value={regEmail}
              onChangeText={setRegEmail}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Numero ng Telepono / Mobile *</Text>
            <TextInput
              style={styles.input}
              placeholder="hal. 0918-987-6543"
              placeholderTextColor="#7D8D80"
              keyboardType="phone-pad"
              value={regPhone}
              onChangeText={setRegPhone}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Bayan sa Marinduque *</Text>
            <View style={styles.pickerRow}>
              {MUNICIPALITIES.map((mun) => {
                const active = regMunicipality === mun;
                return (
                  <Pressable
                    key={mun}
                    onPress={() => setRegMunicipality(mun)}
                    style={[styles.munChip, active && styles.munChipActive]}
                  >
                    <Text style={[styles.munChipText, active && styles.munChipTextActive]}>
                      {mun}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Address ng Negosyo / Pwesto *</Text>
            <TextInput
              style={styles.input}
              placeholder="hal. Stall 4, Poblacion Public Market, Mogpog"
              placeholderTextColor="#7D8D80"
              value={businessAddress}
              onChangeText={setBusinessAddress}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Uri ng Negosyo (Business Type) *</Text>
            <View style={{ gap: 6 }}>
              {MARKET_BUSINESS_TYPES.map((bType) => {
                const active = businessType === bType;
                return (
                  <Pressable
                    key={bType}
                    onPress={() => setBusinessType(bType)}
                    style={[styles.bTypeChip, active && styles.bTypeChipActive]}
                  >
                    <Text style={[styles.bTypeChipText, active && styles.bTypeChipTextActive]}>
                      {active ? "● " : "○ "}
                      {bType}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.fieldLabel}>Password *</Text>
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.showHideToggle}>
                  {showPassword ? "Itago" : "Ipakita"}
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Gumawa ng password (min. 6 chars)"
              placeholderTextColor="#7D8D80"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={regPassword}
              onChangeText={setRegPassword}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Kumpirmahin ang Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="I-type muli ang password"
              placeholderTextColor="#7D8D80"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={regConfirmPassword}
              onChangeText={setRegConfirmPassword}
            />
          </View>

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={[styles.submitButton, loading && { opacity: 0.7 }]}
          >
            <Text style={styles.submitButtonText}>
              {loading ? "Nirerehistro..." : "Isumite ang Rehistrasyon ng Market →"}
            </Text>
          </Pressable>
        </View>
      )}
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
  roleBadge: {
    backgroundColor: colors.bush,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  roleBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: colors.bush,
    gap: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.bush,
  },
  heroSubtitle: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.surfaceCelery,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.venusFlytrap,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  tabTextActive: {
    fontWeight: "800",
    color: colors.bush,
  },
  securityAlert: {
    backgroundColor: "#FEFCE8",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EAB308",
    gap: 4,
  },
  securityAlertTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#854D0E",
    letterSpacing: 0.8,
  },
  securityAlertBody: {
    fontSize: 12,
    color: "#713F12",
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F87171",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
  },
  successBox: {
    backgroundColor: "#DCFCE7",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#4ADE80",
  },
  successText: {
    color: "#15803D",
    fontSize: 13,
    fontWeight: "600",
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.bush,
  },
  showHideToggle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brightNori,
  },
  input: {
    backgroundColor: "#FAFCF8",
    borderWidth: 1.5,
    borderColor: colors.maximumGreen,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.bush,
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  munChip: {
    backgroundColor: colors.cream,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  munChipActive: {
    backgroundColor: colors.softCelery,
    borderColor: colors.bush,
    borderWidth: 1.5,
  },
  munChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  munChipTextActive: {
    fontWeight: "800",
    color: colors.bush,
  },
  bTypeChip: {
    backgroundColor: colors.cream,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bTypeChipActive: {
    backgroundColor: colors.softCelery,
    borderColor: colors.bush,
    borderWidth: 1.5,
  },
  bTypeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  bTypeChipTextActive: {
    fontWeight: "800",
    color: colors.bush,
  },
  submitButton: {
    backgroundColor: colors.bush,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  demoBox: {
    backgroundColor: colors.surfaceCelery,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.venusFlytrap,
    gap: 6,
    marginTop: 6,
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.bush,
    letterSpacing: 0.8,
  },
  demoDesc: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
  quickDemoButton: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.bush,
    gap: 3,
  },
  quickDemoRole: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.bush,
  },
  quickDemoName: {
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

