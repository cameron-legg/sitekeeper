import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

export interface LineItemFormValues {
  name: string;
  price: string;
  notes: string;
  url: string;
  hours: string;
}

interface Props {
  visible: boolean;
  initialValues?: Partial<LineItemFormValues>;
  onClose: () => void;
  onSave: (values: LineItemFormValues) => void;
  isSaving?: boolean;
  onPickFromLibrary?: () => void;
}

const EMPTY: LineItemFormValues = {
  name: "",
  price: "",
  notes: "",
  url: "",
  hours: "",
};

export default function LineItemFormModal({
  visible,
  initialValues,
  onClose,
  onSave,
  isSaving,
  onPickFromLibrary,
}: Props) {
  const [values, setValues] = useState<LineItemFormValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<LineItemFormValues>>({});

  useEffect(() => {
    if (visible) {
      setValues({ ...EMPTY, ...initialValues });
      setErrors({});
    }
  }, [visible, initialValues]);

  function set(field: keyof LineItemFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleSave() {
    const newErrors: Partial<LineItemFormValues> = {};
    if (!values.name.trim()) newErrors.name = "Name is required.";
    if (!values.price.trim()) newErrors.price = "Price is required.";
    else if (isNaN(parseFloat(values.price)))
      newErrors.price = "Price must be a number.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSave(values);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Line Item</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.form}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.formContent}
          >
            {onPickFromLibrary && (
              <TouchableOpacity
                style={styles.libraryBtn}
                onPress={onPickFromLibrary}
              >
                <Text style={styles.libraryBtnText}>
                  Add from Library
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.fieldLabel}>
              Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={values.name}
              onChangeText={(v) => set("name", v)}
              placeholder="Item name"
            />
            {errors.name && (
              <Text style={styles.fieldError}>{errors.name}</Text>
            )}

            <Text style={styles.fieldLabel}>
              Price <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.price && styles.inputError]}
              value={values.price}
              onChangeText={(v) => set("price", v)}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            {errors.price && (
              <Text style={styles.fieldError}>{errors.price}</Text>
            )}

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={values.notes}
              onChangeText={(v) => set("notes", v)}
              placeholder="Optional notes"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>URL</Text>
            <TextInput
              style={styles.input}
              value={values.url}
              onChangeText={(v) => set("url", v)}
              placeholder="https://…"
              keyboardType="url"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Hours</Text>
            <TextInput
              style={styles.input}
              value={values.hours}
              onChangeText={(v) => set("hours", v)}
              placeholder="e.g. 2.5"
              keyboardType="decimal-pad"
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: "60%",
    maxHeight: "92%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  cancelText: { fontSize: 16, color: "#6b7280" },
  sheetTitle: { fontSize: 17, fontWeight: "600", color: "#1a1a1a" },
  saveText: { fontSize: 16, color: "#2563eb", fontWeight: "600" },
  form: { flex: 1, minHeight: 0 },
  formContent: { padding: 16, gap: 4 },
  libraryBtn: {
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  libraryBtnText: { color: "#15803d", fontSize: 14, fontWeight: "600" },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
    marginTop: 8,
  },
  required: { color: "#dc2626" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: "#1a1a1a",
    backgroundColor: "#f9fafb",
  },
  inputError: { borderColor: "#dc2626" },
  multiline: { minHeight: 72 },
  fieldError: { color: "#dc2626", fontSize: 12, marginTop: 2 },
});
