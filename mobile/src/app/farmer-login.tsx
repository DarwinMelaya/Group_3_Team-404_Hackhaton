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
import { MUNICIPALITIES } from "../lib/harvest";
import { useHarvests } from "../lib/harvest-store";

export default function FarmerLoginScreen() {
  const router = useRouter();
  const {
    signInFarmer,
    signUpFarmer,
    signInDemoFarmer,
    activeFarmer,
  } = useHarvests();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Login form state
  const [loginEmail, setLoginEmail] = useState(activeFarmer?.email ?? "farmer.dante@marinduque.ph");
  const [loginPassword, setLoginPassword] = useState("farmer123456");

  // Registration form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regMunicipality, setRegMunicipality] = useState<string>("Boac");
  const [regBarangay, setRegBarangay] = useState("");
  const [regFarmInfo, setRegFarmInfo] = useState("");

  const handleLogin = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    if (!loginEmail.trim() || !loginEmail.includes("@")) {
      setErrorMessage("Maglagay ng wastong email address.");
      return;
    }
    if (!loginPassword || loginPassword.length < 6) {
      setErrorMessage("Ang password ay dapat hindi bababa sa 6 na karakter.");
      return;
    }

    setLoading(true);
    try {
      await signInFarmer(loginEmail.trim(), loginPassword);
      router.replace("/" as Href);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Hindi makapag-log in.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!regName.trim()) {
      setErrorMessage("Ilagay ang iyong buong pangalan.");
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@")) {
      setErrorMessage("Maglagay ng wastong email address.");
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
    if (!regBarangay.trim()) {
      setErrorMessage("Ilagay ang iyong barangay.");
      return;
    }

    setLoading(true);
    try {
      const res = await signUpFarmer({
        displayName: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        municipality: regMunicipality,
        contactNumber: regPhone.trim(),
        barangay: regBarangay.trim(),
        farmInfo: regFarmInfo.trim(),
      });

      if (res.confirmationRequired) {
        setSuccessMessage(
          "Account created! Please check your email inbox to confirm your account before logging in.",
        );
        setTab("login");
      } else {
        router.replace("/" as Href);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Hindi matagumpay ang pagpaparehistro.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInstantDemoFarmer = () => {
    signInDemoFarmer();
    Alert.alert(
      "Demo Farmer Active",
      "Naka-log in na bilang Kuya Dante (Santa Cruz Smallholder). Papunta na sa Farmer Home.",
      [{ text: "OK", onPress: () => router.replace("/" as Href) }],
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
          <Text style={styles.roleBadgeText}>🌾 FARMER PORTAL</Text>
        </View>
      </View>

      {/* Hero card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Magsasaka / Farmer Portal</Text>
        <Text style={styles.heroSubtitle}>
          I-manage ang iyong ani, maiwasan ang pagka-panis ng pananim, at mag-alok sa mga
          beripikadong mamimili sa Marinduque.
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
            Magrehistro (New Farmer)
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

      {/* FORM: LOGIN */}
      {tab === "login" ? (
        <View style={styles.formCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email Address ng Magsasaka</Text>
            <TextInput
              style={styles.input}
              placeholder="hal. kuya.dante@marinduque.ph"
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
              {loading ? "Nag-ve-verify..." : "Pumasok bilang Farmer →"}
            </Text>
          </Pressable>

          {/* Quick Demo Access */}
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>MABILIS NA PAGSUBOK (DEMO ACCESS)</Text>
            <Text style={styles.demoDesc}>
              Hindi na kailangang mag-type. I-click upang agad pumasok bilang beripikadong magsasaka.
            </Text>
            <Pressable
              onPress={handleInstantDemoFarmer}
              style={styles.quickDemoButton}
            >
              <Text style={styles.quickDemoButtonText}>
                ⚡ Pumasok bilang Kuya Dante (Boac / Santa Cruz Smallholder)
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* FORM: REGISTRATION */
        <View style={styles.formCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Buong Pangalan ng Magsasaka *</Text>
            <TextInput
              style={styles.input}
              placeholder="hal. Dante Marquez"
              placeholderTextColor="#7D8D80"
              value={regName}
              onChangeText={setRegName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="hal. dante@marinduque.ph"
              placeholderTextColor="#7D8D80"
              keyboardType="email-address"
              autoCapitalize="none"
              value={regEmail}
              onChangeText={setRegEmail}
            />
          </View>

          <View style={styles.fieldGroup}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.fieldLabel}>Password (Hindi bababa sa 6 na karakter) *</Text>
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.showHideToggle}>
                  {showPassword ? "Itago" : "Ipakita"}
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Gumawa ng password"
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

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Numero ng Telepono / Mobile</Text>
            <TextInput
              style={styles.input}
              placeholder="hal. 0917-123-4567"
              placeholderTextColor="#7D8D80"
              keyboardType="phone-pad"
              value={regPhone}
              onChangeText={setRegPhone}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Bayan sa Marinduque (Municipality) *</Text>
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
            <Text style={styles.fieldLabel}>Barangay *</Text>
            <TextInput
              style={styles.input}
              placeholder="hal. Alobo, Balimbing, Murallon"
              placeholderTextColor="#7D8D80"
              value={regBarangay}
              onChangeText={setRegBarangay}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Impormasyon sa Sakahan / Pangunahing Pananim</Text>
            <TextInput
              style={styles.input}
              placeholder="hal. 1.5 ektarya ng Uraro at Saging Saba"
              placeholderTextColor="#7D8D80"
              value={regFarmInfo}
              onChangeText={setRegFarmInfo}
            />
          </View>

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={[styles.submitButton, loading && { opacity: 0.7 }]}
          >
            <Text style={styles.submitButtonText}>
              {loading ? "Nirerehistro..." : "Kumpletuhin ang Pagpaparehistro →"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Safe architecture note */}
      <View style={styles.infoFooter}>
        <Text style={styles.infoFooterText}>
          🌿 SMART-ANI Farmer Protocol: Ang lahat ng bagong magsasaka ay protektado ng
          Role-Based Access Control (RLS). Hindi magagalaw ang sariling imbentaryo maliban
          sa may-ari.
        </Text>
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
  roleBadge: {
    backgroundColor: colors.softCelery,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.venusFlytrap,
  },
  roleBadgeText: {
    color: colors.bush,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: colors.brightNori,
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
    borderColor: colors.brightNori,
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
  submitButton: {
    backgroundColor: colors.brightNori,
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.brightNori,
    alignItems: "center",
    marginTop: 4,
  },
  quickDemoButtonText: {
    color: colors.brightNori,
    fontSize: 12,
    fontWeight: "800",
  },
  infoFooter: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.maximumGreen,
  },
  infoFooterText: {
    fontSize: 11,
    color: colors.bush,
    lineHeight: 16,
  },
});
