import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from "react-native";
import {
  useDocumentFieldSettings,
  useUpdateDocumentFieldSettings,
  type DocumentFieldSetting,
  type FieldVisibility,
} from "../../api/hooks/useDocumentSettings";

const VISIBILITY_OPTIONS: { value: FieldVisibility; label: string }[] = [
  { value: "always_show", label: "Always Show" },
  { value: "additional", label: "Additional Option" },
  { value: "disabled", label: "Disabled" },
];

function getVisibilityLabel(v: FieldVisibility): string {
  return VISIBILITY_OPTIONS.find((o) => o.value === v)?.label ?? "Always Show";
}

function getVisibilityColor(v: FieldVisibility): string {
  switch (v) {
    case "always_show": return "#065f46";
    case "additional": return "#d97706";
    case "disabled": return "#dc2626";
  }
}

function getVisibilityBg(v: FieldVisibility): string {
  switch (v) {
    case "always_show": return "#d1fae5";
    case "additional": return "#fef3c7";
    case "disabled": return "#fef2f2";
  }
}

interface Props {
  documentType: "estimate" | "invoice";
}

export default function EditDocumentOptionsScreen({ documentType }: Props) {
  const { data: settings, isLoading } = useDocumentFieldSettings(documentType);
  const updateSettings = useUpdateDocumentFieldSettings();

  const [localSettings, setLocalSettings] = useState<DocumentFieldSetting[]>([]);
  const [pickerField, setPickerField] = useState<DocumentFieldSetting | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      setHasChanges(false);
    }
  }, [settings]);

  function handleVisibilityChange(key: string, visibility: FieldVisibility) {
    setLocalSettings((prev) =>
      prev.map((f) => (f.key === key ? { ...f, visibility } : f))
    );
    setHasChanges(true);
    setPickerField(null);
  }

  function handlePdfToggle(key: string, pdf_visible: boolean) {
    setLocalSettings((prev) =>
      prev.map((f) => (f.key === key ? { ...f, pdf_visible } : f))
    );
    setHasChanges(true);
  }

  function handleSave() {
    updateSettings.mutate({
      documentType,
      fields: localSettings.map((f) => ({
        key: f.key,
        visibility: f.visibility,
        pdf_visible: f.pdf_visible,
      })),
    });
    setHasChanges(false);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Configure how each field appears in the {documentType} editor. "Always Show" fields are
          visible immediately. "Additional Option" fields are hidden in a collapsible section.
          "Disabled" fields are never shown.
        </Text>

        {localSettings.map((field) => (
          <View key={field.key} style={styles.fieldRow}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <View style={styles.fieldControls}>
                <Text style={styles.pdfLabel}>PDF</Text>
                <Switch
                  value={field.pdf_visible}
                  onValueChange={(v) => handlePdfToggle(field.key, v)}
                  trackColor={{ true: "#2563eb" }}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.visibilityBtn, { backgroundColor: getVisibilityBg(field.visibility) }]}
              onPress={() => setPickerField(field)}
              activeOpacity={0.7}
            >
              <Text style={[styles.visibilityText, { color: getVisibilityColor(field.visibility) }]}>
                {getVisibilityLabel(field.visibility)}
              </Text>
              <Text style={styles.visibilityChevron}>▼</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {hasChanges && (
        <View style={styles.saveBar}>
          <TouchableOpacity
            style={[styles.saveBtn, updateSettings.isPending && styles.btnDisabled]}
            onPress={handleSave}
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Visibility picker modal */}
      <Modal
        visible={!!pickerField}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerField(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{pickerField?.label}</Text>
            <Text style={styles.modalHint}>Choose how this field appears in the editor:</Text>
            {VISIBILITY_OPTIONS.map((opt) => {
              const isSelected = pickerField?.visibility === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionRow,
                    isSelected && { backgroundColor: getVisibilityBg(opt.value), borderColor: getVisibilityColor(opt.value) },
                  ]}
                  onPress={() => pickerField && handleVisibilityChange(pickerField.key, opt.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && { color: getVisibilityColor(opt.value), fontWeight: "700" },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && <Text style={styles.optionCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPickerField(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f3f4f6" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 100 },
  description: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    marginBottom: 20,
  },
  fieldRow: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fieldLabel: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  fieldControls: { flexDirection: "row", alignItems: "center", gap: 6 },
  pdfLabel: { fontSize: 11, color: "#6b7280" },
  visibilityBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  visibilityText: { fontSize: 14, fontWeight: "600" },
  visibilityChevron: { fontSize: 10, color: "#9ca3af", marginLeft: 8 },
  saveBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  saveBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 360,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  modalHint: { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 8,
  },
  optionText: { fontSize: 15, color: "#374151", flex: 1 },
  optionCheck: { fontSize: 16, color: "#2563eb", fontWeight: "700" },
  cancelBtn: { marginTop: 4, paddingVertical: 12, alignItems: "center" },
  cancelText: { fontSize: 15, color: "#6b7280", fontWeight: "500" },
});
