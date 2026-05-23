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
  Modal,
  FlatList,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useBusinessInfo, useUpdateBusinessInfo, useBusinessInfoUsers } from "../../api/hooks/useBusinessInfo";
import type { BusinessInfoUser } from "../../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "BusinessInfo">;

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  "DC",
];

export default function BusinessInfoScreen({ navigation }: Props) {
  const { data: info, isLoading, isError } = useBusinessInfo();
  const { data: users } = useBusinessInfoUsers();
  const updateInfo = useUpdateBusinessInfo();

  const [businessName, setBusinessName] = useState("");
  const [state, setState] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);

  useEffect(() => {
    if (info) {
      setBusinessName(info.business_name ?? "");
      setState(info.state ?? "");
      setPaymentMethod(info.payment_method ?? "");
      setBusinessAddress(info.business_address ?? "");
      setBusinessPhone(info.business_phone ?? "");
      setBusinessEmail(info.business_email ?? "");
      setOwnerUserId(info.owner_user_id);
    }
  }, [info]);

  const selectedOwner = users?.find((u) => u.id === ownerUserId);
  const ownerDisplayName = selectedOwner?.name || selectedOwner?.email || info?.owner_name;

  function handleSave() {
    setSaveError(null);
    setSaved(false);

    const trimmedState = state.trim().toUpperCase();
    if (trimmedState && !US_STATES.includes(trimmedState)) {
      setSaveError("Please enter a valid 2-letter US state code (e.g. CA, TX).");
      return;
    }

    updateInfo.mutate(
      {
        business_name: businessName.trim() || null,
        state: trimmedState || null,
        payment_method: paymentMethod.trim() || null,
        business_address: businessAddress.trim() || null,
        business_phone: businessPhone.trim() || null,
        business_email: businessEmail.trim() || null,
        owner_user_id: ownerUserId,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        },
        onError: () => {
          setSaveError("Failed to save business information. Please try again.");
        },
      }
    );
  }

  function renderUserItem({ item }: { item: BusinessInfoUser }) {
    const isSelected = item.id === ownerUserId;
    return (
      <TouchableOpacity
        style={[styles.pickerRow, isSelected && styles.pickerRowSelected]}
        onPress={() => { setOwnerUserId(item.id); setShowOwnerPicker(false); }}
      >
        <Text style={[styles.pickerRowText, isSelected && styles.pickerRowTextSelected]}>
          {item.name || "(No name)"} — {item.email}
        </Text>
        {isSelected && <Text style={styles.pickerCheck}>✓</Text>}
      </TouchableOpacity>
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
          <Text style={styles.errorText}>Failed to load business information.</Text>
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
        <Text style={styles.sectionHeader}>
          These settings are shared across all users in this workspace and appear as defaults on new estimates and invoices.
        </Text>

        {/* Business Name */}
        <Text style={styles.label}>Business Name</Text>
        <TextInput
          style={styles.input}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Your company name"
          autoCapitalize="words"
          autoComplete="organization"
        />

        {/* Business Owner */}
        <Text style={styles.label}>Business Owner</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowOwnerPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={ownerDisplayName ? styles.inputText : styles.placeholderText}>
            {ownerDisplayName || "Select business owner"}
          </Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          This person's name will appear on estimates and invoices by default.
        </Text>

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

        {/* Business Phone */}
        <Text style={styles.label}>Business Phone Number</Text>
        <TextInput
          style={styles.input}
          value={businessPhone}
          onChangeText={setBusinessPhone}
          placeholder="(555) 123-4567"
          keyboardType="phone-pad"
          autoComplete="tel"
        />

        {/* Business Email */}
        <Text style={styles.label}>Business Email</Text>
        <TextInput
          style={styles.input}
          value={businessEmail}
          onChangeText={setBusinessEmail}
          placeholder="contact@yourcompany.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        {/* Business Address */}
        <Text style={styles.label}>Business Address</Text>
        <TextInput
          style={styles.input}
          value={businessAddress}
          onChangeText={setBusinessAddress}
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
        {saved && <Text style={styles.saveSuccess}>Business information saved!</Text>}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, updateInfo.isPending && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={updateInfo.isPending}
        >
          {updateInfo.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Owner picker modal */}
      <Modal visible={showOwnerPicker} transparent animationType="fade" onRequestClose={() => setShowOwnerPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Business Owner</Text>
            <FlatList
              data={users ?? []}
              keyExtractor={(item) => item.id}
              renderItem={renderUserItem}
              style={styles.pickerList}
              ListEmptyComponent={<Text style={styles.pickerEmpty}>No approved users found.</Text>}
            />
            {ownerUserId && (
              <TouchableOpacity
                style={styles.clearOwnerBtn}
                onPress={() => { setOwnerUserId(null); setShowOwnerPicker(false); }}
              >
                <Text style={styles.clearOwnerText}>Clear Selection</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowOwnerPicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  sectionHeader: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8,
    lineHeight: 18,
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
  // Owner picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerRowSelected: {
    backgroundColor: "#eff6ff",
    borderRadius: 8,
  },
  pickerRowText: {
    fontSize: 15,
    color: "#374151",
    flex: 1,
  },
  pickerRowTextSelected: {
    color: "#2563eb",
    fontWeight: "600",
  },
  pickerCheck: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "700",
    marginLeft: 8,
  },
  pickerEmpty: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 20,
  },
  clearOwnerBtn: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  clearOwnerText: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "500",
  },
  modalCancelBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    color: "#6b7280",
  },
});
