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
  useSavedItems,
  useDeleteSavedItem,
  useAddSavedItemEntry,
  useUpdateSavedItemEntry,
  useDeleteSavedItemEntry,
} from "../../api/hooks/useSavedItems";
import type { SavedItem, SavedItemEntry } from "../../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "SavedItems">;

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

export default function SavedItemsScreen({ route, navigation }: Props) {
  const pickerMode = route.params?.pickerMode ?? false;
  const onSelect = route.params?.onSelect;

  const { data: items, isLoading, isError } = useSavedItems();
  const deleteItem = useDeleteSavedItem();
  const addEntry = useAddSavedItemEntry();
  const updateEntry = useUpdateSavedItemEntry();
  const deleteEntry = useDeleteSavedItemEntry();

  const [confirmDelete, setConfirmDelete] = useState<SavedItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Entry modal state
  const [entryModalItemId, setEntryModalItemId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<SavedItemEntry | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>(EMPTY_ENTRY);
  const [entryErrors, setEntryErrors] = useState<Partial<Record<keyof EntryForm, string>>>({});
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<{ itemId: string; entry: SavedItemEntry } | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: pickerMode ? "Pick from Library" : "Item Library",
    });
  }, [navigation, pickerMode]);

  function handleSelect(item: SavedItem) {
    if (pickerMode && onSelect) {
      onSelect(item);
    }
  }

  function handleDelete(item: SavedItem) {
    setConfirmDelete(item);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function openAddEntry(itemId: string) {
    setEntryModalItemId(itemId);
    setEditingEntry(null);
    setEntryForm(EMPTY_ENTRY);
    setEntryErrors({});
  }

  function openEditEntry(itemId: string, entry: SavedItemEntry) {
    setEntryModalItemId(itemId);
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

  function handleSaveEntry() {
    const errs: Partial<Record<keyof EntryForm, string>> = {};
    if (!entryForm.name.trim()) errs.name = "Name is required.";
    if (entryForm.entry_type === "material") {
      if (!entryForm.unit_price.trim()) errs.unit_price = "Required.";
    } else {
      if (!entryForm.hours.trim()) errs.hours = "Required.";
    }
    if (Object.keys(errs).length > 0) {
      setEntryErrors(errs);
      return;
    }
    if (!entryModalItemId) return;

    const payload = {
      entry_type: entryForm.entry_type as "material" | "hours",
      name: entryForm.name.trim(),
      notes: entryForm.notes.trim() || undefined,
      url: entryForm.url.trim() || undefined,
      unit_price: entryForm.unit_price.trim() || undefined,
      quantity: entryForm.quantity.trim() || "1",
      hours: entryForm.hours.trim() || undefined,
    };

    if (editingEntry) {
      updateEntry.mutate(
        { itemId: entryModalItemId, entryId: editingEntry.id, ...payload },
        { onSuccess: () => { setEntryModalItemId(null); setEditingEntry(null); } }
      );
    } else {
      addEntry.mutate(
        { itemId: entryModalItemId, ...payload },
        { onSuccess: () => { setEntryModalItemId(null); } }
      );
    }
  }

  function handleDeleteEntry() {
    if (!confirmDeleteEntry) return;
    deleteEntry.mutate(
      { itemId: confirmDeleteEntry.itemId, entryId: confirmDeleteEntry.entry.id },
      { onSuccess: () => setConfirmDeleteEntry(null) }
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load saved items.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          (items?.length ?? 0) === 0 ? styles.emptyContainer : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No saved items yet</Text>
            <Text style={styles.emptySubtitle}>
              Save entries from your estimates or invoices using the 📚 button, or tap "New Item" below.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isExpanded = expandedId === item.id;
          return (
            <View style={styles.itemCard}>
              <TouchableOpacity
                style={styles.itemHeader}
                onPress={() => (pickerMode ? handleSelect(item) : toggleExpand(item.id))}
                activeOpacity={0.7}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.entries.length} {item.entries.length === 1 ? "entry" : "entries"}
                    {item.hourly_rate ? `  •  $${item.hourly_rate}/hr` : ""}
                  </Text>
                </View>
                {pickerMode ? (
                  <Text style={styles.selectText}>Select</Text>
                ) : (
                  <View style={styles.headerRight}>
                    <Text style={styles.chevron}>{isExpanded ? "▲" : "▼"}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {!pickerMode && isExpanded && (
                <View style={styles.itemBody}>
                  {item.entries.length === 0 && (
                    <Text style={styles.noEntriesText}>No entries yet.</Text>
                  )}
                  {item.entries.map((entry) => (
                    <View key={entry.id} style={styles.entryRow}>
                      <View style={styles.entryTypeTag}>
                        <Text style={styles.entryTypeText}>
                          {entry.entry_type === "material" ? "MAT" : "HRS"}
                        </Text>
                      </View>
                      <View style={styles.entryInfo}>
                        <Text style={styles.entryName}>{entry.name}</Text>
                        {entry.entry_type === "material" ? (
                          <Text style={styles.entrySub}>
                            {entry.quantity ?? "1"} × ${entry.unit_price ?? "0"}
                          </Text>
                        ) : (
                          <Text style={styles.entrySub}>{entry.hours}h</Text>
                        )}
                        {entry.notes ? (
                          <Text style={styles.entryNotes} numberOfLines={1}>{entry.notes}</Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={styles.entryEditBtn}
                        onPress={() => openEditEntry(item.id, entry)}
                      >
                        <Text style={styles.entryEditText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.entryDeleteBtn}
                        onPress={() => setConfirmDeleteEntry({ itemId: item.id, entry })}
                      >
                        <Text style={styles.entryDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View style={styles.itemFooter}>
                    <TouchableOpacity style={styles.addEntryBtn} onPress={() => openAddEntry(item.id)}>
                      <Text style={styles.addEntryText}>+ Add Entry</Text>
                    </TouchableOpacity>
                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        style={styles.editItemBtn}
                        onPress={() => navigation.navigate("SavedItemEditor", { itemId: item.id })}
                      >
                        <Text style={styles.editItemText}>Edit Item</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteItemBtn}
                        onPress={() => handleDelete(item)}
                      >
                        <Text style={styles.deleteItemText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        }}
      />

      {!pickerMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate("SavedItemEditor", {})}
        >
          <Text style={styles.fabText}>+ New Item</Text>
        </TouchableOpacity>
      )}

      {/* Delete saved item confirmation */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Saved Item</Text>
            <Text style={styles.modalBody}>Delete "{confirmDelete?.name}" and all its entries from your library?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDelete(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, deleteItem.isPending && styles.btnDisabled]}
                onPress={() => {
                  if (!confirmDelete) return;
                  deleteItem.mutate(confirmDelete.id, {
                    onSuccess: () => setConfirmDelete(null),
                    onError: () => setConfirmDelete(null),
                  });
                }}
                disabled={deleteItem.isPending}
              >
                {deleteItem.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.deleteConfirmText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete entry confirmation */}
      <Modal visible={!!confirmDeleteEntry} transparent animationType="fade" onRequestClose={() => setConfirmDeleteEntry(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Entry</Text>
            <Text style={styles.modalBody}>Delete "{confirmDeleteEntry?.entry.name}" from this saved item?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDeleteEntry(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, deleteEntry.isPending && styles.btnDisabled]}
                onPress={handleDeleteEntry}
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

      {/* Entry add/edit modal */}
      <Modal visible={!!entryModalItemId} transparent animationType="slide" onRequestClose={() => setEntryModalItemId(null)}>
        <KeyboardAvoidingView style={styles.entryOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.entrySheet}>
            <View style={styles.entrySheetHeader}>
              <TouchableOpacity onPress={() => setEntryModalItemId(null)}>
                <Text style={styles.entryCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.entrySheetTitle}>
                {editingEntry ? "Edit Entry" : "Add Entry"}
              </Text>
              <TouchableOpacity onPress={handleSaveEntry} disabled={addEntry.isPending || updateEntry.isPending}>
                {addEntry.isPending || updateEntry.isPending
                  ? <ActivityIndicator size="small" color="#2563eb" />
                  : <Text style={styles.entrySaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.entryForm} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.entryFormContent}>
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f3f4f6" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#dc2626", fontSize: 15 },
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1, padding: 16 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  // Item card
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    overflow: "hidden",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 12,
    color: "#6b7280",
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  chevron: { fontSize: 12, color: "#9ca3af" },
  selectText: { fontSize: 14, color: "#2563eb", fontWeight: "600" },
  // Expanded body
  itemBody: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  noEntriesText: { fontSize: 13, color: "#9ca3af", paddingVertical: 10 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 6,
  },
  entryTypeTag: {
    backgroundColor: "#eff6ff",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  entryTypeText: { fontSize: 10, fontWeight: "700", color: "#2563eb" },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 13, fontWeight: "600", color: "#1a1a1a" },
  entrySub: { fontSize: 11, color: "#6b7280" },
  entryNotes: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  entryEditBtn: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: "#eff6ff" },
  entryEditText: { fontSize: 11, color: "#2563eb" },
  entryDeleteBtn: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: "#fef2f2" },
  entryDeleteText: { fontSize: 11, color: "#dc2626" },
  // Footer
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 8,
  },
  addEntryBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  addEntryText: { fontSize: 12, color: "#6b7280", fontWeight: "500" },
  itemActions: { flexDirection: "row", gap: 6 },
  editItemBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#eff6ff",
  },
  editItemText: { fontSize: 12, color: "#2563eb", fontWeight: "500" },
  deleteItemBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#fef2f2",
  },
  deleteItemText: { fontSize: 12, color: "#dc2626", fontWeight: "500" },
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
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  modalBody: { fontSize: 14, color: "#374151", marginBottom: 20, lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  cancelText: { fontSize: 14, color: "#374151" },
  deleteConfirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#dc2626", minWidth: 72, alignItems: "center" },
  deleteConfirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
  // Entry modal
  entryOverlay: { flex: 1, backgroundColor: "#fff" },
  entrySheet: { flex: 1, backgroundColor: "#fff" },
  entrySheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  entryCancelText: { fontSize: 16, color: "#6b7280" },
  entrySheetTitle: { fontSize: 17, fontWeight: "600", color: "#1a1a1a" },
  entrySaveText: { fontSize: 16, color: "#2563eb", fontWeight: "600" },
  entryForm: { flex: 1, minHeight: 0 },
  entryFormContent: { padding: 16 },
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
});
