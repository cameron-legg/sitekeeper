import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import {
  useAllSavedEntries,
  useUpdateSavedItemEntry,
  useDeleteSavedItemEntry,
  useSaveEntryToLibrary,
} from "../../api/hooks/useSavedItems";
import type { SavedItemEntry } from "../../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "MaterialsLibrary">;

interface EntryForm {
  entry_type: "material" | "hours";
  name: string;
  notes: string;
  url: string;
  unit_price: string;
  quantity: string;
  hours: string;
}

const EMPTY_ENTRY: EntryForm = {
  entry_type: "material",
  name: "",
  notes: "",
  url: "",
  unit_price: "",
  quantity: "",
  hours: "",
};

export default function MaterialsLibraryScreen({ navigation }: Props) {
  const { data: entries, isLoading, isError } = useAllSavedEntries();
  const updateEntry = useUpdateSavedItemEntry();
  const deleteEntry = useDeleteSavedItemEntry();
  const createEntry = useSaveEntryToLibrary();

  const [search, setSearch] = useState("");
  const [editingEntry, setEditingEntry] = useState<SavedItemEntry | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>(EMPTY_ENTRY);
  const [entryErrors, setEntryErrors] = useState<Partial<Record<keyof EntryForm, string>>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SavedItemEntry | null>(null);

  const filtered = (entries ?? []).filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  function openEdit(entry: SavedItemEntry) {
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
  }

  function openCreate() {
    setEditingEntry(null);
    setEntryForm(EMPTY_ENTRY);
    setEntryErrors({});
    setShowCreateModal(true);
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof EntryForm, string>> = {};
    if (!entryForm.name.trim()) errs.name = "Name is required.";
    if (entryForm.entry_type === "material") {
      if (!entryForm.unit_price.trim()) errs.unit_price = "Required.";
      else if (isNaN(parseFloat(entryForm.unit_price))) errs.unit_price = "Must be a number.";
    } else {
      if (!entryForm.hours.trim()) errs.hours = "Required.";
      else if (isNaN(parseFloat(entryForm.hours))) errs.hours = "Must be a number.";
    }
    if (Object.keys(errs).length > 0) {
      setEntryErrors(errs);
      return false;
    }
    return true;
  }

  function handleSaveEdit() {
    if (!validate() || !editingEntry) return;
    updateEntry.mutate(
      {
        itemId: editingEntry.saved_item_id,
        entryId: editingEntry.id,
        name: entryForm.name.trim(),
        notes: entryForm.notes.trim() || undefined,
        url: entryForm.url.trim() || undefined,
        unit_price: entryForm.entry_type === "material" ? entryForm.unit_price.trim() : undefined,
        quantity: entryForm.entry_type === "material" ? (entryForm.quantity.trim() || "1") : undefined,
        hours: entryForm.entry_type === "hours" ? entryForm.hours.trim() : undefined,
      },
      { onSuccess: () => setEditingEntry(null) }
    );
  }

  function handleCreate() {
    if (!validate()) return;
    createEntry.mutate(
      {
        entry_type: entryForm.entry_type,
        name: entryForm.name.trim(),
        notes: entryForm.notes.trim() || undefined,
        url: entryForm.url.trim() || undefined,
        unit_price: entryForm.entry_type === "material" ? entryForm.unit_price.trim() : undefined,
        quantity: entryForm.entry_type === "material" ? (entryForm.quantity.trim() || "1") : undefined,
        hours: entryForm.entry_type === "hours" ? entryForm.hours.trim() : undefined,
      },
      { onSuccess: () => setShowCreateModal(false) }
    );
  }

  function handleDelete() {
    if (!confirmDelete) return;
    deleteEntry.mutate(
      { itemId: confirmDelete.saved_item_id, entryId: confirmDelete.id },
      { onSuccess: () => setConfirmDelete(null) }
    );
  }

  function renderEntry({ item }: { item: SavedItemEntry }) {
    return (
      <View style={styles.entryCard}>
        <View style={styles.entryMain}>
          <View style={styles.entryTypeTag}>
            <Text style={styles.entryTypeText}>
              {item.entry_type === "material" ? "MAT" : "HRS"}
            </Text>
          </View>
          <View style={styles.entryInfo}>
            <Text style={styles.entryName}>{item.name}</Text>
            {item.entry_type === "material" ? (
              <Text style={styles.entrySub}>
                {item.quantity ?? "1"} × ${item.unit_price ?? "0"}
                {" = $"}
                {(parseFloat(item.quantity ?? "1") * parseFloat(item.unit_price ?? "0")).toFixed(2)}
              </Text>
            ) : (
              <Text style={styles.entrySub}>{item.hours}h</Text>
            )}
            {item.notes ? (
              <Text style={styles.entryNotes} numberOfLines={1}>{item.notes}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.entryActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmDelete(item)}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  if (isError) {
    return <View style={styles.centered}><Text style={styles.errorText}>Failed to load entries.</Text></View>;
  }

  return (
    <View style={styles.flex}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search materials & hours…"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
        contentContainerStyle={
          filtered.length === 0 ? styles.emptyContainer : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {search ? "No matching entries" : "No saved entries yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? "Try a different search term."
                : "Save entries from your estimates using the 📚 button, or tap \"+ New Entry\" below."}
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreate}>
        <Text style={styles.fabText}>+ New Entry</Text>
      </TouchableOpacity>

      {/* Edit modal */}
      <Modal visible={!!editingEntry} transparent animationType="slide" onRequestClose={() => setEditingEntry(null)}>
        <KeyboardAvoidingView style={styles.formOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.formSheet}>
            <View style={styles.formHeader}>
              <TouchableOpacity onPress={() => setEditingEntry(null)}>
                <Text style={styles.formCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.formTitle}>Edit Entry</Text>
              <TouchableOpacity onPress={handleSaveEdit} disabled={updateEntry.isPending}>
                {updateEntry.isPending
                  ? <ActivityIndicator size="small" color="#2563eb" />
                  : <Text style={styles.formSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.formBody} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formBodyContent}>
              {renderFormFields()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create modal */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <KeyboardAvoidingView style={styles.formOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.formSheet}>
            <View style={styles.formHeader}>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={styles.formCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.formTitle}>New Entry</Text>
              <TouchableOpacity onPress={handleCreate} disabled={createEntry.isPending}>
                {createEntry.isPending
                  ? <ActivityIndicator size="small" color="#2563eb" />
                  : <Text style={styles.formSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.formBody} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formBodyContent}>
              {renderFormFields()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete confirmation */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Entry</Text>
            <Text style={styles.modalBody}>Delete "{confirmDelete?.name}" from your library?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDelete(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, deleteEntry.isPending && styles.btnDisabled]}
                onPress={handleDelete}
                disabled={deleteEntry.isPending}
              >
                {deleteEntry.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.deleteConfirmText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  function renderFormFields() {
    return (
      <>
        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.typeRow}>
          {(["material", "hours"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, entryForm.entry_type === t && styles.typeBtnActive]}
              onPress={() => setEntryForm((v) => ({ ...v, entry_type: t }))}
            >
              <Text style={[styles.typeBtnText, entryForm.entry_type === t && styles.typeBtnTextActive]}>
                {t === "material" ? "Material" : "Hours"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Name <Text style={styles.req}>*</Text></Text>
        <TextInput
          style={[styles.input, entryErrors.name && styles.inputError]}
          value={entryForm.name}
          onChangeText={(v) => { setEntryForm((f) => ({ ...f, name: v })); setEntryErrors((e) => ({ ...e, name: undefined })); }}
          placeholder={entryForm.entry_type === "material" ? "e.g. Toilet" : "e.g. Installation labour"}
          autoFocus
        />
        {entryErrors.name && <Text style={styles.fieldError}>{entryErrors.name}</Text>}

        {entryForm.entry_type === "material" ? (
          <>
            <Text style={styles.fieldLabel}>Unit Price <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={[styles.input, entryErrors.unit_price && styles.inputError]}
              value={entryForm.unit_price}
              onChangeText={(v) => { setEntryForm((f) => ({ ...f, unit_price: v })); setEntryErrors((e) => ({ ...e, unit_price: undefined })); }}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            {entryErrors.unit_price && <Text style={styles.fieldError}>{entryErrors.unit_price}</Text>}

            <Text style={styles.fieldLabel}>Quantity (default: 1)</Text>
            <TextInput
              style={styles.input}
              value={entryForm.quantity}
              onChangeText={(v) => setEntryForm((f) => ({ ...f, quantity: v }))}
              placeholder="1"
              keyboardType="decimal-pad"
            />
          </>
        ) : (
          <>
            <Text style={styles.fieldLabel}>Hours <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={[styles.input, entryErrors.hours && styles.inputError]}
              value={entryForm.hours}
              onChangeText={(v) => { setEntryForm((f) => ({ ...f, hours: v })); setEntryErrors((e) => ({ ...e, hours: undefined })); }}
              placeholder="e.g. 2.5"
              keyboardType="decimal-pad"
            />
            {entryErrors.hours && <Text style={styles.fieldError}>{entryErrors.hours}</Text>}
          </>
        )}

        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={entryForm.notes}
          onChangeText={(v) => setEntryForm((f) => ({ ...f, notes: v }))}
          placeholder="Optional notes"
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        <Text style={styles.fieldLabel}>URL</Text>
        <TextInput
          style={styles.input}
          value={entryForm.url}
          onChangeText={(v) => setEntryForm((f) => ({ ...f, url: v }))}
          placeholder="https://…"
          keyboardType="url"
          autoCapitalize="none"
        />
      </>
    );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f3f4f6" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#dc2626", fontSize: 15 },
  // Search
  searchBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchInput: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: "#1a1a1a",
  },
  // List
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1, padding: 16 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#374151", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingHorizontal: 24 },
  // Entry card
  entryCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  entryMain: { flexDirection: "row", alignItems: "center", gap: 10 },
  entryTypeTag: { backgroundColor: "#eff6ff", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  entryTypeText: { fontSize: 10, fontWeight: "700", color: "#2563eb" },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  entrySub: { fontSize: 13, color: "#6b7280", marginTop: 1 },
  entryNotes: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  entryActions: { flexDirection: "row", gap: 8, marginTop: 10, justifyContent: "flex-end" },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: "#eff6ff" },
  editBtnText: { fontSize: 13, color: "#2563eb", fontWeight: "500" },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: "#fef2f2" },
  deleteBtnText: { fontSize: 13, color: "#dc2626", fontWeight: "500" },
  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    backgroundColor: "#2563eb",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: "#2563eb",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  // Form modal
  formOverlay: { flex: 1, backgroundColor: "#fff" },
  formSheet: { flex: 1, backgroundColor: "#fff" },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  formCancelText: { fontSize: 16, color: "#6b7280" },
  formTitle: { fontSize: 17, fontWeight: "600", color: "#1a1a1a" },
  formSaveText: { fontSize: 16, color: "#2563eb", fontWeight: "600" },
  formBody: { flex: 1, minHeight: 0 },
  formBodyContent: { padding: 16 },
  // Form fields
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 4, marginTop: 12 },
  req: { color: "#dc2626" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1a1a1a",
    backgroundColor: "#f9fafb",
  },
  inputError: { borderColor: "#dc2626" },
  multiline: { minHeight: 60 },
  fieldError: { color: "#dc2626", fontSize: 12, marginTop: 2 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db", alignItems: "center" },
  typeBtnActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  typeBtnText: { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  typeBtnTextActive: { color: "#2563eb", fontWeight: "700" },
  // Delete modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  modalBody: { fontSize: 14, color: "#374151", marginBottom: 20, lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  cancelBtnText: { fontSize: 14, color: "#374151" },
  deleteConfirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#dc2626", minWidth: 72, alignItems: "center" },
  deleteConfirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
});
