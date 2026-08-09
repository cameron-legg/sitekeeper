import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Modal,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../core/navigation/types";
import {
  useSavedItem, useCreateSavedItem, useUpdateSavedItem,
  useAddSavedItemEntry, useUpdateSavedItemEntry, useDeleteSavedItemEntry,
  useAllSavedEntries, useAssignEntryToItem,
} from "../../saved_items/hooks/useSavedItems";
import type { SavedItemEntry } from "../../../core/api/types";

type Props = NativeStackScreenProps<RootStackParamList, "SavedItemEditor">;

interface EntryForm {
  entry_type: "material" | "hours" | "fee";
  name: string;
  notes: string;
  url: string;
  unit_price: string;
  quantity: string;
  hours: string;
}

const EMPTY_ENTRY: EntryForm = { entry_type: "material", name: "", notes: "", url: "", unit_price: "", quantity: "", hours: "" };

export default function SavedItemEditorScreen({ route, navigation }: Props) {
  const itemId = route.params?.itemId;
  const isNew = !itemId;

  const { data: existing, isLoading } = useSavedItem(itemId ?? "");
  const createItem = useCreateSavedItem();
  const updateItem = useUpdateSavedItem();
  const addEntry = useAddSavedItemEntry();
  const updateEntry = useUpdateSavedItemEntry();
  const deleteEntry = useDeleteSavedItemEntry();
  const assignEntry = useAssignEntryToItem();

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [entryModal, setEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SavedItemEntry | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>(EMPTY_ENTRY);
  const [entryErrors, setEntryErrors] = useState<Partial<Record<keyof EntryForm, string>>>({});
  const [confirmDeleteEntryItem, setConfirmDeleteEntryItem] = useState<SavedItemEntry | null>(null);
  const [showMaterialsPicker, setShowMaterialsPicker] = useState(false);
  const [materialsSearch, setMaterialsSearch] = useState("");

  const { data: allEntries } = useAllSavedEntries();

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setNotes(existing.notes ?? "");
      setHourlyRate(existing.hourly_rate ?? "");
    }
  }, [existing]);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: isNew ? "New Saved Item" : "Edit Saved Item" });
  }, [navigation, isNew]);

  function handleSave() {
    const n = name.trim();
    if (!n) { setNameError("Name is required."); return; }
    setNameError(null); setSaveError(null);
    const payload = { name: n, notes: notes.trim() || undefined, hourly_rate: hourlyRate.trim() || undefined };
    if (isNew) {
      createItem.mutate(payload, {
        onSuccess: () => navigation.goBack(),
        onError: () => setSaveError("Failed to save item."),
      });
    } else {
      updateItem.mutate({ itemId: itemId!, ...payload }, {
        onSuccess: () => navigation.goBack(),
        onError: () => setSaveError("Failed to save item."),
      });
    }
  }

  function openAddEntry() {
    setEditingEntry(null);
    setEntryForm(EMPTY_ENTRY);
    setEntryErrors({});
    setEntryModal(true);
  }

  function openEditEntry(entry: SavedItemEntry) {
    setEditingEntry(entry);
    setEntryForm({
      entry_type: entry.entry_type,
      name: entry.name,
      notes: entry.notes ?? "",
      url: entry.url ?? "",
      unit_price: entry.unit_price ?? "",
      quantity: entry.quantity ?? "",
      hours: entry.hours ?? "",
    });
    setEntryErrors({});
    setEntryModal(true);
  }

  function handleSaveEntry() {
    const errs: Partial<Record<keyof EntryForm, string>> = {};
    if (!entryForm.name.trim()) errs.name = "Name is required.";
    if (entryForm.entry_type === "material") {
      if (!entryForm.unit_price.trim()) errs.unit_price = "Required.";
      if (!entryForm.quantity.trim()) errs.quantity = "Required.";
    } else {
      if (!entryForm.hours.trim()) errs.hours = "Required.";
    }
    if (Object.keys(errs).length > 0) { setEntryErrors(errs); return; }
    if (!itemId) return;

    const payload = {
      entry_type: entryForm.entry_type,
      name: entryForm.name.trim(),
      notes: entryForm.notes.trim() || undefined,
      url: entryForm.url.trim() || undefined,
      unit_price: entryForm.unit_price.trim() || undefined,
      quantity: entryForm.quantity.trim() || undefined,
      hours: entryForm.hours.trim() || undefined,
    };

    if (editingEntry) {
      updateEntry.mutate({ itemId, entryId: editingEntry.id, ...payload }, {
        onSuccess: () => setEntryModal(false),
      });
    } else {
      addEntry.mutate({ itemId, ...payload }, {
        onSuccess: () => setEntryModal(false),
      });
    }
  }

  function confirmDeleteEntry(entry: SavedItemEntry) {
    setConfirmDeleteEntryItem(entry);
  }

  function handlePickMaterial(entry: SavedItemEntry) {
    if (!itemId) return;
    assignEntry.mutate({
      itemId,
      entryId: entry.id,
    }, {
      onSuccess: () => setShowMaterialsPicker(false),
    });
  }

  // Filter materials for the picker — only show entries not already in this item
  const existingEntryIds = new Set(existing?.entries.map((e) => e.id) ?? []);
  const filteredMaterials = (allEntries ?? []).filter((e) => {
    if (existingEntryIds.has(e.id)) return false;
    if (materialsSearch && !e.name.toLowerCase().includes(materialsSearch.toLowerCase())) return false;
    return true;
  });

  const isSaving = createItem.isPending || updateItem.isPending;

  if (!isNew && isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {saveError && <Text style={styles.errorBanner}>{saveError}</Text>}

        <Text style={styles.fieldLabel}>Name <Text style={styles.req}>*</Text></Text>
        <TextInput style={[styles.input, nameError && styles.inputError]} value={name} onChangeText={(v) => { setName(v); setNameError(null); }} placeholder="Item name" />
        {nameError && <Text style={styles.fieldError}>{nameError}</Text>}

        <Text style={styles.fieldLabel}>Hourly Rate</Text>
        <TextInput style={styles.input} value={hourlyRate} onChangeText={setHourlyRate} placeholder="e.g. 85.00" keyboardType="decimal-pad" />
        <Text style={styles.hint}>Used to calculate cost of hours entries.</Text>

        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline numberOfLines={3} textAlignVertical="top" />

        <TouchableOpacity style={[styles.saveBtn, isSaving && styles.btnDisabled]} onPress={handleSave} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{isNew ? "Create Item" : "Save Changes"}</Text>}
        </TouchableOpacity>

        {/* Entries (only shown for existing items) */}
        {!isNew && existing && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Saved Entries</Text>
            {existing.entries.map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <View style={styles.entryTypeTag}>
                  <Text style={styles.entryTypeText}>{entry.entry_type === "material" ? "MAT" : "HRS"}</Text>
                </View>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryName}>{entry.name}</Text>
                  {entry.entry_type === "material"
                    ? <Text style={styles.entrySub}>{entry.quantity} × ${entry.unit_price}</Text>
                    : <Text style={styles.entrySub}>{entry.hours}h</Text>}
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEditEntry(entry)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDeleteEntry(entry)}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addEntryBtn} onPress={openAddEntry}>
              <Text style={styles.addEntryText}>+ Add Entry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fromLibraryBtn} onPress={() => { setMaterialsSearch(""); setShowMaterialsPicker(true); }}>
              <Text style={styles.fromLibraryText}>📚 From Materials Library</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Entry modal */}
      <Modal visible={entryModal} transparent animationType="slide" onRequestClose={() => setEntryModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setEntryModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <Text style={styles.sheetTitle}>{editingEntry ? "Edit Entry" : "Add Entry"}</Text>
              <TouchableOpacity onPress={handleSaveEntry} disabled={addEntry.isPending || updateEntry.isPending}>
                {addEntry.isPending || updateEntry.isPending
                  ? <ActivityIndicator size="small" color="#2563eb" />
                  : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.typeRow}>
                {(["material", "hours"] as const).map((t) => (
                  <TouchableOpacity key={t} style={[styles.typeBtn, entryForm.entry_type === t && styles.typeBtnActive]}
                    onPress={() => setEntryForm((v) => ({ ...v, entry_type: t }))}>
                    <Text style={[styles.typeBtnText, entryForm.entry_type === t && styles.typeBtnTextActive]}>
                      {t === "material" ? "Material" : t === "hours" ? "Hours" : "Fee"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Name <Text style={styles.req}>*</Text></Text>
              <TextInput style={[styles.input, entryErrors.name && styles.inputError]} value={entryForm.name}
                onChangeText={(v) => setEntryForm((f) => ({ ...f, name: v }))} placeholder="Entry name" />
              {entryErrors.name && <Text style={styles.fieldError}>{entryErrors.name}</Text>}
              {entryForm.entry_type === "material" ? (
                <>
                  <Text style={styles.fieldLabel}>Unit Price <Text style={styles.req}>*</Text></Text>
                  <TextInput style={[styles.input, entryErrors.unit_price && styles.inputError]} value={entryForm.unit_price}
                    onChangeText={(v) => setEntryForm((f) => ({ ...f, unit_price: v }))} placeholder="0.00" keyboardType="decimal-pad" />
                  {entryErrors.unit_price && <Text style={styles.fieldError}>{entryErrors.unit_price}</Text>}
                  <Text style={styles.fieldLabel}>Quantity <Text style={styles.req}>*</Text></Text>
                  <TextInput style={[styles.input, entryErrors.quantity && styles.inputError]} value={entryForm.quantity}
                    onChangeText={(v) => setEntryForm((f) => ({ ...f, quantity: v }))} placeholder="1" keyboardType="decimal-pad" />
                  {entryErrors.quantity && <Text style={styles.fieldError}>{entryErrors.quantity}</Text>}
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Hours <Text style={styles.req}>*</Text></Text>
                  <TextInput style={[styles.input, entryErrors.hours && styles.inputError]} value={entryForm.hours}
                    onChangeText={(v) => setEntryForm((f) => ({ ...f, hours: v }))} placeholder="e.g. 2.5" keyboardType="decimal-pad" />
                  {entryErrors.hours && <Text style={styles.fieldError}>{entryErrors.hours}</Text>}
                </>
              )}
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput style={[styles.input, styles.multiline]} value={entryForm.notes}
                onChangeText={(v) => setEntryForm((f) => ({ ...f, notes: v }))} placeholder="Optional" multiline numberOfLines={2} textAlignVertical="top" />
              <Text style={styles.fieldLabel}>URL</Text>
              <TextInput style={styles.input} value={entryForm.url}
                onChangeText={(v) => setEntryForm((f) => ({ ...f, url: v }))} placeholder="https://…" keyboardType="url" autoCapitalize="none" />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete entry confirmation */}
      <Modal visible={!!confirmDeleteEntryItem} transparent animationType="fade" onRequestClose={() => setConfirmDeleteEntryItem(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete Entry</Text>
            <Text style={styles.confirmBody}>Delete "{confirmDeleteEntryItem?.name}"?</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmDeleteEntryItem(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={() => {
                  if (!confirmDeleteEntryItem || !itemId) return;
                  deleteEntry.mutate({ itemId, entryId: confirmDeleteEntryItem.id });
                  setConfirmDeleteEntryItem(null);
                }}
              >
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Materials Library picker */}
      <Modal visible={showMaterialsPicker} transparent animationType="slide" onRequestClose={() => setShowMaterialsPicker(false)}>
        <View style={styles.overlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setShowMaterialsPicker(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Pick from Materials</Text>
              <View style={{ width: 50 }} />
            </View>
            <View style={styles.pickerSearchBar}>
              <TextInput
                style={styles.pickerSearchInput}
                value={materialsSearch}
                onChangeText={setMaterialsSearch}
                placeholder="Search materials…"
                clearButtonMode="while-editing"
              />
            </View>
            <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
              {filteredMaterials.length === 0 && (
                <Text style={styles.pickerEmpty}>
                  {materialsSearch ? "No matching materials." : "No materials in your library yet."}
                </Text>
              )}
              {filteredMaterials.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.pickerRow}
                  onPress={() => handlePickMaterial(entry)}
                >
                  <View style={styles.pickerEntryInfo}>
                    <View style={styles.entryTypeTag}>
                      <Text style={styles.entryTypeText}>
                        {entry.entry_type === "material" ? "MAT" : "HRS"}
                      </Text>
                    </View>
                    <View style={styles.pickerEntryDetails}>
                      <Text style={styles.entryName}>{entry.name}</Text>
                      {entry.entry_type === "material" ? (
                        <Text style={styles.entrySub}>
                          {entry.quantity ?? "1"} × ${entry.unit_price ?? "0"}
                        </Text>
                      ) : (
                        <Text style={styles.entrySub}>{entry.hours}h</Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.pickerAddText}>Add →</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f3f4f6" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16 },
  errorBanner: { backgroundColor: "#fef2f2", color: "#dc2626", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 14 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 12 },
  req: { color: "#dc2626" },
  hint: { fontSize: 12, color: "#9ca3af", marginTop: 3 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#1a1a1a", backgroundColor: "#fff" },
  inputError: { borderColor: "#dc2626" },
  multiline: { minHeight: 72 },
  fieldError: { color: "#dc2626", fontSize: 12, marginTop: 3 },
  saveBtn: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
  entryRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 8, padding: 12, marginBottom: 8, gap: 8 },
  entryTypeTag: { backgroundColor: "#eff6ff", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  entryTypeText: { fontSize: 10, fontWeight: "700", color: "#2563eb" },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 13, fontWeight: "600", color: "#1a1a1a" },
  entrySub: { fontSize: 11, color: "#6b7280" },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: "#eff6ff" },
  editBtnText: { fontSize: 11, color: "#2563eb" },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: "#fef2f2" },
  deleteBtnText: { fontSize: 11, color: "#dc2626" },
  addEntryBtn: { borderWidth: 1, borderColor: "#d1d5db", borderStyle: "dashed", borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 4 },
  addEntryText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  fromLibraryBtn: { borderWidth: 1, borderColor: "#2563eb", borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 8, backgroundColor: "#eff6ff" },
  fromLibraryText: { fontSize: 13, color: "#2563eb", fontWeight: "500" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: "60%", maxHeight: "92%" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  cancelText: { fontSize: 16, color: "#6b7280" },
  sheetTitle: { fontSize: 17, fontWeight: "600", color: "#1a1a1a" },
  saveText: { fontSize: 16, color: "#2563eb", fontWeight: "600" },
  formScroll: { flex: 1, minHeight: 0 },
  formContent: { padding: 16 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db", alignItems: "center" },
  typeBtnActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  typeBtnText: { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  typeBtnTextActive: { color: "#2563eb", fontWeight: "700" },
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  confirmCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360 },
  confirmTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  confirmBody: { fontSize: 14, color: "#374151", marginBottom: 20, lineHeight: 20 },
  confirmActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  confirmCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  confirmCancelText: { fontSize: 14, color: "#374151" },
  confirmDeleteBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#dc2626", minWidth: 72, alignItems: "center" },
  confirmDeleteText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  // Materials picker
  pickerSheet: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: "60%", maxHeight: "92%" },
  pickerSearchBar: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  pickerSearchInput: { backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: "#1a1a1a" },
  pickerScroll: { flex: 1, paddingHorizontal: 16 },
  pickerEmpty: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 32 },
  pickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  pickerEntryInfo: { flexDirection: "row", alignItems: "center", flex: 1, gap: 8 },
  pickerEntryDetails: { flex: 1 },
  pickerAddText: { fontSize: 13, color: "#2563eb", fontWeight: "600" },
});
