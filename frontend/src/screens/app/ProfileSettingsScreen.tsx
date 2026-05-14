import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useProfile, useUpdateProfile } from "../../api/hooks/useProfile";

type Props = NativeStackScreenProps<RootStackParamList, "ProfileSettings">;

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  "DC",
];

export default function ProfileSettingsScreen({ navigation }: Props) {
  const { data: profile, isLoading, isError } = useProfile();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [address, setAddress] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setState(profile.state ?? "");
      setCompanyName(profile.company_name ?? "");
      setPhone(profile.phone ?? "");
      setPaymentMethod(profile.payment_method ?? "");
      setAddress(profile.address ?? "");
    }
  }, [profile]);

  function handleSave() {
    setSaveError(null);
    setSaved(false);

    // Validate state if provided
    const trimmedState = state.trim().toUpperCase();
    if (trimmedState && !US_STATES.includes(trimmedState)) {
      setSaveError("Please enter a valid 2-letter US state code (e.g. CA, TX).");
      return;
    }

    updateProfile.mutate(
      {
        name: name.trim() || null,
        state: trimmedState || null,
        company_name: companyName.trim() || null,
        phone: phone.trim() || null,
        payment_method: paymentMethod.trim() || null,
        address: address.trim() || null,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        },
        onError: () => {
          setSaveError("Failed to save profile. Please try again.");
        },
      }
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.flex}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.flex}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Email (read-only) */}
        <Text style={styles.label}>Email</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{profile?.email}</Text>
        </View>

        {/* Name */}
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          autoCapitalize="words"
          autoComplete="name"
        />

        {/* State */}
        <Text style={styles.label}>State</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowStatePicker(!showStatePicker)}
          activeOpacity={0.7}
        >
          <Text style={state ? styles.inputText : styles.placeholderText}>
            {state ? state.toUpperCase() : "Select state"}
          </Text>
        </TouchableOpacity>
        {showStatePicker && (
          <View style={styles.stateGrid}>
            {US_STATES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.stateChip,
                  state.toUpperCase() === s && styles.stateChipSelected,
                ]}
                onPress={() => {
                  setState(s);
                  setShowStatePicker(false);
                }}
              >
                <Text
                  style={[
                    styles.stateChipText,
                    state.toUpperCase() === s && styles.stateChipTextSelected,
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
            {state ? (
              <TouchableOpacity
                style={styles.clearChip}
                onPress={() => {
                  setState("");
                  setShowStatePicker(false);
                }}
              >
                <Text style={styles.clearChipText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Company Name */}
        <Text style={styles.label}>Company Name</Text>
        <TextInput
          style={styles.input}
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="Your company name"
          autoCapitalize="words"
          autoComplete="organization"
        />

        {/* Phone */}
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="(555) 123-4567"
          keyboardType="phone-pad"
          autoComplete="tel"
        />

        {/* Business Address */}
        <Text style={styles.label}>Business Address</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="123 Main St, City, State ZIP"
          autoCapitalize="words"
        />
        <Text style={styles.hint}>
          This will appear as the default business address on your estimates and invoices.
        </Text>

        {/* Payment Method */}
        <Text style={styles.label}>Payment Method</Text>
        <TextInput
          style={styles.input}
          value={paymentMethod}
          onChangeText={setPaymentMethod}
          placeholder="e.g. @username on Venmo, Zelle, etc."
          autoCapitalize="none"
        />
        <Text style={styles.hint}>
          This will appear on your invoices so clients know how to pay you.
        </Text>

        {/* Error / Success */}
        {saveError && <Text style={styles.saveError}>{saveError}</Text>}
        {saved && <Text style={styles.saveSuccess}>Profile saved!</Text>}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, updateProfile.isPending && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={updateProfile.isPending}
        >
          {updateProfile.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f3f4f6" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#dc2626", fontSize: 15 },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 10 : 12,
    fontSize: 16,
    color: "#1a1a1a",
    backgroundColor: "#fff",
  },
  inputText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  placeholderText: {
    fontSize: 16,
    color: "#9ca3af",
  },
  readOnlyField: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 10 : 12,
    backgroundColor: "#f9fafb",
  },
  readOnlyText: {
    fontSize: 16,
    color: "#6b7280",
  },
  hint: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  stateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  stateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  stateChipSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  stateChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
  },
  stateChipTextSelected: {
    color: "#fff",
  },
  clearChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  clearChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#dc2626",
  },
  saveError: {
    color: "#dc2626",
    fontSize: 13,
    marginTop: 16,
  },
  saveSuccess: {
    color: "#16a34a",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 16,
  },
  saveBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
