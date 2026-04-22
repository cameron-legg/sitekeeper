import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import {
  useAddContactToJobSite,
  useAddContactToJob,
} from "../../api/hooks/useContacts";

type Props = NativeStackScreenProps<RootStackParamList, "ContactEditor">;

interface FormValues {
  name: string;
  phone: string;
  email: string;
  mailing_address: string;
  notes: string;
}

const EMPTY: FormValues = {
  name: "",
  phone: "",
  email: "",
  mailing_address: "",
  notes: "",
};

export default function ContactEditorScreen({ route, navigation }: Props) {
  const { parentId, parentType } = route.params;

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const addToSite = useAddContactToJobSite();
  const addToJob = useAddContactToJob();

  const isSaving = addToSite.isPending || addToJob.isPending;

  function set(field: keyof FormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (field === "name") setNameError(null);
  }

  function handleSave() {
    const name = values.name.trim();
    if (!name) {
      setNameError("Name is required.");
      return;
    }
    setNameError(null);
    setSaveError(null);

    const payload = {
      name,
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
      mailing_address: values.mailing_address.trim() || undefined,
      notes: values.notes.trim() || undefined,
    };

    if (parentType === "job_site") {
      addToSite.mutate(
        { siteId: parentId, ...payload },
        {
          onSuccess: () => navigation.goBack(),
          onError: () => setSaveError("Failed to save contact. Please try again."),
        }
      );
    } else {
      addToJob.mutate(
        { jobId: parentId, ...payload },
        {
          onSuccess: () => navigation.goBack(),
          onError: () => setSaveError("Failed to save contact. Please try again."),
        }
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {saveError && <Text style={styles.errorBanner}>{saveError}</Text>}

        <Text style={styles.fieldLabel}>
          Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, nameError && styles.inputError]}
          value={values.name}
          onChangeText={(v) => set("name", v)}
          placeholder="Full name"
          autoCapitalize="words"
        />
        {nameError && <Text style={styles.fieldError}>{nameError}</Text>}

        <Text style={styles.fieldLabel}>Phone</Text>
        <TextInput
          style={styles.input}
          value={values.phone}
          onChangeText={(v) => set("phone", v)}
          placeholder="Phone number"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
        />

        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          style={styles.input}
          value={values.email}
          onChangeText={(v) => set("email", v)}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
        />

        <Text style={styles.fieldLabel}>Mailing Address</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={values.mailing_address}
          onChangeText={(v) => set("mailing_address", v)}
          placeholder="Street, City, State, ZIP"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          textContentType="fullStreetAddress"
        />

        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={values.notes}
          onChangeText={(v) => set("notes", v)}
          placeholder="Any additional notes"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Contact</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 16 },
  errorBanner: {
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 12,
  },
  required: { color: "#dc2626" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1a1a1a",
    backgroundColor: "#fff",
  },
  inputError: { borderColor: "#dc2626" },
  multiline: { minHeight: 80 },
  fieldError: { color: "#dc2626", fontSize: 12, marginTop: 3 },
  saveBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
});
