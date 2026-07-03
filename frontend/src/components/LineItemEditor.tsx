/**
 * LineItemEditor — full editor for a single LineItem and its entries.
 *
 * Shows:
 *  - Line item name, notes, hourly rate
 *  - List of entries (materials + hours)
 *  - Per-entry: name, notes, url, unit_price/quantity (material) or hours (hours)
 *  - Computed total_cost and total_hours
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type { LineItem, LineItemEntry, SavedItem, SavedItemEntry } from "../api/types";

/**
 * Generate a fingerprint string for an entry based on its key fields.
 * Used to check if a line item entry already exists in the saved library.
 */
function entryFingerprint(e: { entry_type: string; name: string; unit_price?: string | null; quantity?: string | null; hours?: string | null }): string {
  return `${e.entry_type}|${e.name}|${e.unit_price ?? ""}|${e.quantity ?? ""}|${e.hours ?? ""}`;
}

// ── Entry form modal ──────────────────────────────────────────────────────────

interface EntryFormValues {
  entry_type: "material" | "hours" | "fee";
  name: string;
  notes: string;
  url: string;
  unit_price: string;
  quantity: string;
  hours: string;
}

const EMPTY_ENTRY: EntryFormValues = {
  entry_type: "material",
  name: "",
  notes: "",
  url: "",
  unit_price: "",
  quantity: "",
  hours: "",
};

interface EntryModalProps {
  visible: boolean;
  initial?: Partial<EntryFormValues>;
  onClose: () => void;
  onSave: (values: EntryFormValues) => void;
  isSaving?: boolean;
  lineItemName?: string;
}

function EntryModal({ visible, initial, onClose, onSave, isSaving, lineItemName }: EntryModalProps) {
  const [values, setValues] = useState<EntryFormValues>({ ...EMPTY_ENTRY, ...initial });
  const [errors, setErrors] = useState<Partial<Record<keyof EntryFormValues, string>>>({});

  React.useEffect(() => {
    if (visible) {
      setValues({ ...EMPTY_ENTRY, ...initial });
      setErrors({});
    }
  }, [visible]);

  function set(field: keyof EntryFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleSave() {
    const errs: Partial<Record<keyof EntryFormValues, string>> = {};
    if ((values.entry_type === "material" || values.entry_type === "fee") && !values.name.trim()) errs.name = "Name is required.";
    if (values.entry_type === "material" || values.entry_type === "fee") {
      if (!values.unit_price.trim()) errs.unit_price = values.entry_type === "fee" ? "Amount is required." : "Unit price is required.";
      else if (isNaN(parseFloat(values.unit_price))) errs.unit_price = "Must be a number.";
      if (values.quantity.trim() && isNaN(parseFloat(values.quantity)))
        errs.quantity = "Must be a number.";
    } else {
      if (!values.hours.trim()) errs.hours = "Hours is required.";
      else if (isNaN(parseFloat(values.hours))) errs.hours = "Must be a number.";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    // Default quantity to "1" if left blank; default hours name to "{lineItemName} Labor"
    const finalValues: EntryFormValues = {
      ...values,
      name: values.entry_type === "hours" && !values.name.trim()
        ? `${lineItemName ?? "Item"} Labor`
        : values.name,
      quantity: (values.entry_type === "material" || values.entry_type === "fee") && !values.quantity.trim() ? "1" : values.quantity,
    };
    onSave(finalValues);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.fullScreenOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.fullSheet}>
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>
              {initial?.name ? "Edit Entry" : "Add Entry"}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving
                ? <ActivityIndicator size="small" color="#2563eb" />
                : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
            {/* Type toggle */}
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {(["material", "hours", "fee"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, values.entry_type === t && styles.typeBtnActive]}
                  onPress={() => set("entry_type", t)}
                >
                  <Text style={[styles.typeBtnText, values.entry_type === t && styles.typeBtnTextActive]}>
                    {t === "material" ? "Material" : t === "hours" ? "Hours" : "Fee"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Name {(values.entry_type === "material" || values.entry_type === "fee") && <Text style={styles.req}>*</Text>}{values.entry_type === "hours" && <Text style={styles.optional}>(default: {lineItemName ?? "Item"} Labor)</Text>}</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={values.name}
              onChangeText={(v) => set("name", v)}
              placeholder={values.entry_type === "material" ? "e.g. Toilet" : values.entry_type === "fee" ? "e.g. Disposal Fee" : `${lineItemName ?? "Item"} Labor`}
            />
            {errors.name && <Text style={styles.fieldError}>{errors.name}</Text>}

            {values.entry_type === "material" ? (
              <>
                <Text style={styles.fieldLabel}>Unit Price <Text style={styles.req}>*</Text></Text>
                <TextInput
                  style={[styles.input, errors.unit_price && styles.inputError]}
                  value={values.unit_price}
                  onChangeText={(v) => set("unit_price", v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
                {errors.unit_price && <Text style={styles.fieldError}>{errors.unit_price}</Text>}

                <Text style={styles.fieldLabel}>Quantity <Text style={styles.optional}>(default: 1)</Text></Text>
                <TextInput
                  style={[styles.input, errors.quantity && styles.inputError]}
                  value={values.quantity}
                  onChangeText={(v) => set("quantity", v)}
                  placeholder="1"
                  keyboardType="decimal-pad"
                />
                {errors.quantity && <Text style={styles.fieldError}>{errors.quantity}</Text>}
              </>
            ) : values.entry_type === "fee" ? (
              <>
                <Text style={styles.fieldLabel}>Amount <Text style={styles.req}>*</Text></Text>
                <TextInput
                  style={[styles.input, errors.unit_price && styles.inputError]}
                  value={values.unit_price}
                  onChangeText={(v) => set("unit_price", v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
                {errors.unit_price && <Text style={styles.fieldError}>{errors.unit_price}</Text>}

                <Text style={styles.fieldLabel}>Quantity <Text style={styles.optional}>(default: 1)</Text></Text>
                <TextInput
                  style={[styles.input, errors.quantity && styles.inputError]}
                  value={values.quantity}
                  onChangeText={(v) => set("quantity", v)}
                  placeholder="1"
                  keyboardType="decimal-pad"
                />
                {errors.quantity && <Text style={styles.fieldError}>{errors.quantity}</Text>}
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Hours <Text style={styles.req}>*</Text></Text>
                <TextInput
                  style={[styles.input, errors.hours && styles.inputError]}
                  value={values.hours}
                  onChangeText={(v) => set("hours", v)}
                  placeholder="e.g. 2.5"
                  keyboardType="decimal-pad"
                />
                {errors.hours && <Text style={styles.fieldError}>{errors.hours}</Text>}
              </>
            )}

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={values.notes}
              onChangeText={(v) => set("notes", v)}
              placeholder="Optional notes"
              multiline
              numberOfLines={2}
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
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── LineItemEditor ────────────────────────────────────────────────────────────

interface LineItemEditorProps {
  item: LineItem;
  onUpdateItem: (data: { name?: string; notes?: string; hourly_rate?: string }) => void;
  onDeleteItem: () => void;
  onAddEntry: (values: EntryFormValues) => void;
  onUpdateEntry: (entryId: string, values: Partial<EntryFormValues>) => void;
  onDeleteEntry: (entryId: string) => void;
  onSaveToLibrary?: () => void;
  onSaveEntryToLibrary?: (entry: LineItemEntry) => void;
  onAddEntryFromLibrary?: () => void;
  savedItems?: SavedItem[];
  onPickSavedEntry?: (entry: SavedItemEntry) => void;
  allSavedEntries?: SavedItemEntry[];
  isSavingEntry?: boolean;
}

export default function LineItemEditor({
  item,
  onUpdateItem,
  onDeleteItem,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onSaveToLibrary,
  onSaveEntryToLibrary,
  onAddEntryFromLibrary,
  savedItems,
  onPickSavedEntry,
  allSavedEntries,
  isSavingEntry,
}: LineItemEditorProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(item.name);
  const [hourlyRateVal, setHourlyRateVal] = useState(item.hourly_rate ?? "");
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LineItemEntry | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

  // Confirm modals
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<LineItemEntry | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(false);
  const [confirmSaveToLibrary, setConfirmSaveToLibrary] = useState(false);
  const [confirmSaveEntry, setConfirmSaveEntry] = useState<LineItemEntry | null>(null);

  /** Check if a LineItemEntry already exists in the Materials Library (by fingerprint). */
  function entryExistsInLibrary(entry: LineItemEntry): boolean {
    if (!allSavedEntries) return false;
    const fp = entryFingerprint(entry);
    return allSavedEntries.some((saved) => entryFingerprint(saved) === fp);
  }

  /** Check if the whole LineItem already exists in the Item Library (by name). */
  function itemExistsInLibrary(): boolean {
    if (!savedItems) return false;
    return savedItems.some((saved) => saved.name === item.name);
  }

  function handleSaveName() {
    if (nameVal.trim()) {
      onUpdateItem({ name: nameVal.trim(), hourly_rate: hourlyRateVal.trim() || undefined });
    }
    setEditingName(false);
  }

  function handleSaveEntry(values: EntryFormValues) {
    if (editingEntry) {
      onUpdateEntry(editingEntry.id, values);
    } else {
      onAddEntry(values);
    }
    setEntryModalVisible(false);
    setEditingEntry(null);
  }

  function openAddEntry() {
    setEditingEntry(null);
    setEntryModalVisible(true);
  }

  function openEditEntry(entry: LineItemEntry) {
    setEditingEntry(entry);
    setEntryModalVisible(true);
  }

  function confirmDeleteEntryFn(entry: LineItemEntry) {
    setConfirmDeleteEntry(entry);
  }

  function confirmDeleteItemFn() {
    setConfirmDeleteItem(true);
  }

  function entryTotal(entry: LineItemEntry): string {
    if (entry.entry_type === "material" || entry.entry_type === "fee") {
      const up = parseFloat(entry.unit_price ?? "0");
      const qty = parseFloat(entry.quantity ?? "1");
      return isNaN(up) || isNaN(qty) ? "—" : `$${(up * qty).toFixed(2)}`;
    } else {
      const hrs = parseFloat(entry.hours ?? "0");
      const rate = parseFloat(item.hourly_rate ?? "0");
      return isNaN(hrs) || isNaN(rate) ? "—" : `$${(hrs * rate).toFixed(2)}`;
    }
  }

  const entryInitial: Partial<EntryFormValues> | undefined = editingEntry
    ? {
        entry_type: editingEntry.entry_type,
        name: editingEntry.name,
        notes: editingEntry.notes ?? "",
        url: editingEntry.url ?? "",
        unit_price: editingEntry.unit_price ?? "",
        quantity: editingEntry.quantity ?? "",
        hours: editingEntry.hours ?? "",
      }
    : undefined;

  return (
    <View style={styles.itemCard}>
      {/* Header row */}
      <TouchableOpacity style={styles.itemHeader} onPress={() => setExpanded((e) => !e)} activeOpacity={0.7}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.itemHeaderRight}>
          <Text style={styles.itemTotal}>${parseFloat(item.total_cost).toFixed(2)}</Text>
          {parseFloat(item.total_hours) > 0 && (
            <Text style={styles.itemHours}>{parseFloat(item.total_hours).toFixed(2)}h</Text>
          )}
          <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.itemBody}>
          {/* Editable name + hourly rate */}
          {editingName ? (
            <View style={styles.editNameRow}>
              <TextInput
                style={[styles.input, styles.flex1]}
                value={nameVal}
                onChangeText={setNameVal}
                placeholder="Line item name"
                autoFocus
              />
              <TextInput
                style={[styles.input, styles.rateInput]}
                value={hourlyRateVal}
                onChangeText={setHourlyRateVal}
                placeholder="$/hr"
                keyboardType="decimal-pad"
              />
              <TouchableOpacity style={styles.saveNameBtn} onPress={handleSaveName}>
                <Text style={styles.saveNameBtnText}>✓</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.itemMetaRow}>
              <TouchableOpacity onPress={() => { setNameVal(item.name); setHourlyRateVal(item.hourly_rate ?? ""); setEditingName(true); }}>
                <Text style={styles.editHint}>
                  {item.hourly_rate ? `$${item.hourly_rate}/hr  ` : "Set hourly rate  "}
                  <Text style={styles.editLink}>Edit</Text>
                </Text>
              </TouchableOpacity>
              <View style={styles.itemActions}>
                {onSaveToLibrary && !itemExistsInLibrary() && (
                  <TouchableOpacity style={styles.saveLibBtn} onPress={() => setConfirmSaveToLibrary(true)}>
                    <Text style={styles.saveLibText}>📚 Save</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={confirmDeleteItemFn}>
                  <Text style={styles.deleteItemText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}

          {/* Entries */}
          {item.entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <View style={styles.entryInfo}>
                <View style={styles.entryTypeTag}>
                  <Text style={styles.entryTypeText}>
                    {entry.entry_type === "material" ? "MAT" : entry.entry_type === "hours" ? "HRS" : "FEE"}
                  </Text>
                </View>
                <View style={styles.entryDetails}>
                  <Text style={styles.entryName}>{entry.name}</Text>
                  {entry.entry_type === "material" ? (
                    <Text style={styles.entrySub}>
                      {entry.quantity} × ${entry.unit_price}
                    </Text>
                  ) : entry.entry_type === "fee" ? (
                    <Text style={styles.entrySub}>
                      {parseFloat(entry.quantity || "1") > 1 ? `${entry.quantity} × $${entry.unit_price}` : `$${entry.unit_price}`}
                    </Text>
                  ) : (
                    <Text style={styles.entrySub}>{entry.hours}h</Text>
                  )}
                </View>
              </View>
              <Text style={styles.entryTotal}>{entryTotal(entry)}</Text>
              {onSaveEntryToLibrary && !entryExistsInLibrary(entry) && (
                <TouchableOpacity style={styles.entrySaveBtn} onPress={() => setConfirmSaveEntry(entry)}>
                  <Text style={styles.entrySaveText}>📚</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.entryEditBtn} onPress={() => openEditEntry(entry)}>
                <Text style={styles.entryEditText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.entryDeleteBtn} onPress={() => confirmDeleteEntryFn(entry)}>
                <Text style={styles.entryDeleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.addEntryRow}>
            <TouchableOpacity style={styles.addEntryBtn} onPress={openAddEntry}>
              <Text style={styles.addEntryText}>+ Add Entry</Text>
            </TouchableOpacity>
            {onPickSavedEntry && savedItems && savedItems.length > 0 && (
              <TouchableOpacity style={styles.addFromLibBtn} onPress={() => setShowLibraryPicker(true)}>
                <Text style={styles.addFromLibText}>📚 From Library</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <EntryModal
        visible={entryModalVisible}
        initial={entryInitial}
        onClose={() => { setEntryModalVisible(false); setEditingEntry(null); }}
        onSave={handleSaveEntry}
        isSaving={isSavingEntry}
        lineItemName={item.name}
      />

      {/* Save to library confirmation */}
      <Modal visible={confirmSaveToLibrary} transparent animationType="fade" onRequestClose={() => setConfirmSaveToLibrary(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Save to Library</Text>
            <Text style={styles.confirmBody}>Save "{item.name}" to your item library for reuse?</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmSaveToLibrary(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmOkBtn}
                onPress={() => { setConfirmSaveToLibrary(false); onSaveToLibrary?.(); }}
              >
                <Text style={styles.confirmOkText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete entry confirmation */}
      <Modal visible={!!confirmDeleteEntry} transparent animationType="fade" onRequestClose={() => setConfirmDeleteEntry(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete Entry</Text>
            <Text style={styles.confirmBody}>Delete "{confirmDeleteEntry?.name}"?</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmDeleteEntry(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmOkBtn, styles.confirmOkBtnDanger]}
                onPress={() => { if (confirmDeleteEntry) { onDeleteEntry(confirmDeleteEntry.id); } setConfirmDeleteEntry(null); }}
              >
                <Text style={styles.confirmOkText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete line item confirmation */}
      <Modal visible={confirmDeleteItem} transparent animationType="fade" onRequestClose={() => setConfirmDeleteItem(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete Line Item</Text>
            <Text style={styles.confirmBody}>Delete "{item.name}" and all its entries?</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmDeleteItem(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmOkBtn, styles.confirmOkBtnDanger]}
                onPress={() => { setConfirmDeleteItem(false); onDeleteItem(); }}
              >
                <Text style={styles.confirmOkText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Save entry to library confirmation */}
      <Modal visible={!!confirmSaveEntry} transparent animationType="fade" onRequestClose={() => setConfirmSaveEntry(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Save Entry to Library</Text>
            <Text style={styles.confirmBody}>Save "{confirmSaveEntry?.name}" to your library for reuse in other line items?</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmSaveEntry(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmOkBtn}
                onPress={() => { if (confirmSaveEntry) { onSaveEntryToLibrary?.(confirmSaveEntry); } setConfirmSaveEntry(null); }}
              >
                <Text style={styles.confirmOkText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Library entry picker */}
      <Modal visible={showLibraryPicker} transparent animationType="fade" onRequestClose={() => setShowLibraryPicker(false)}>
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, styles.pickerCard]}>
            <Text style={styles.confirmTitle}>Add Entry from Library</Text>
            <ScrollView style={styles.pickerScroll}>
              {(savedItems ?? []).map((savedItem) =>
                savedItem.entries.map((entry) => (
                  <TouchableOpacity
                    key={entry.id}
                    style={styles.pickerRow}
                    onPress={() => { onPickSavedEntry?.(entry); setShowLibraryPicker(false); }}
                  >
                    <View style={styles.pickerEntryInfo}>
                      <View style={styles.entryTypeTag}>
                        <Text style={styles.entryTypeText}>
                          {entry.entry_type === "material" ? "MAT" : entry.entry_type === "hours" ? "HRS" : "FEE"}
                        </Text>
                      </View>
                      <View style={styles.pickerEntryDetails}>
                        <Text style={styles.entryName}>{entry.name}</Text>
                        {entry.entry_type === "material" ? (
                          <Text style={styles.entrySub}>
                            {entry.quantity ?? "1"} × ${entry.unit_price ?? "0"}
                          </Text>
                        ) : entry.entry_type === "fee" ? (
                          <Text style={styles.entrySub}>
                            ${entry.unit_price ?? "0"}
                          </Text>
                        ) : (
                          <Text style={styles.entrySub}>{entry.hours}h</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.pickerAddText}>Add →</Text>
                  </TouchableOpacity>
                ))
              )}
              {(savedItems ?? []).every((si) => si.entries.length === 0) && (
                <Text style={styles.pickerEmptyText}>No saved entries in your library yet.</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setShowLibraryPicker(false)}>
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    overflow: "hidden",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  itemName: { fontSize: 15, fontWeight: "700", color: "#1a1a1a", flex: 1 },
  itemHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemTotal: { fontSize: 15, fontWeight: "700", color: "#2563eb" },
  itemHours: { fontSize: 12, color: "#6b7280", backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  chevron: { fontSize: 12, color: "#9ca3af", marginLeft: 4 },
  itemBody: { padding: 12 },
  editNameRow: { flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 8 },
  flex1: { flex: 1 },
  rateInput: { width: 80 },
  saveNameBtn: { backgroundColor: "#2563eb", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  saveNameBtnText: { color: "#fff", fontWeight: "700" },
  itemMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  editHint: { fontSize: 13, color: "#6b7280" },
  editLink: { color: "#2563eb", fontWeight: "600" },
  deleteItemText: { fontSize: 13, color: "#dc2626", fontWeight: "500" },
  itemActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  saveLibBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0" },
  saveLibText: { fontSize: 12, color: "#15803d", fontWeight: "600" },
  itemNotes: { fontSize: 13, color: "#6b7280", marginBottom: 8 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    gap: 6,
  },
  entryInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  entryTypeTag: {
    backgroundColor: "#eff6ff",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  entryTypeText: { fontSize: 10, fontWeight: "700", color: "#2563eb" },
  entryDetails: { flex: 1 },
  entryName: { fontSize: 13, fontWeight: "600", color: "#1a1a1a" },
  entrySub: { fontSize: 11, color: "#6b7280" },
  entryTotal: { fontSize: 13, fontWeight: "600", color: "#374151", minWidth: 56, textAlign: "right" },
  entryEditBtn: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: "#eff6ff" },
  entryEditText: { fontSize: 11, color: "#2563eb" },
  entryDeleteBtn: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: "#fef2f2" },
  entryDeleteText: { fontSize: 11, color: "#dc2626" },
  addEntryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  addEntryText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  addEntryRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  addFromLibBtn: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    backgroundColor: "#f0fdf4",
  },
  addFromLibText: { fontSize: 13, color: "#15803d", fontWeight: "600" },
  entrySaveBtn: { paddingHorizontal: 5, paddingVertical: 4, borderRadius: 5, backgroundColor: "#f0fdf4" },
  entrySaveText: { fontSize: 11 },
  pickerCard: { maxHeight: "70%" },
  pickerScroll: { maxHeight: 300, marginBottom: 12 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  pickerEntryInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  pickerEntryDetails: { flex: 1 },
  pickerAddText: { fontSize: 14, color: "#2563eb", fontWeight: "600" },
  pickerEmptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 16 },
  // Entry modal styles
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  fullScreenOverlay: { flex: 1, backgroundColor: "#fff" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: "60%", maxHeight: "92%" },
  fullSheet: { flex: 1, backgroundColor: "#fff" },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#e5e7eb",
  },
  cancelText: { fontSize: 16, color: "#6b7280" },
  sheetTitle: { fontSize: 17, fontWeight: "600", color: "#1a1a1a" },
  saveText: { fontSize: 16, color: "#2563eb", fontWeight: "600" },
  form: { flex: 1, minHeight: 0 },
  formContent: { padding: 16 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db", alignItems: "center" },
  typeBtnActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  typeBtnText: { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  typeBtnTextActive: { color: "#2563eb", fontWeight: "700" },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 4, marginTop: 12 },
  req: { color: "#dc2626" },
  optional: { fontSize: 12, fontWeight: "400", color: "#9ca3af" },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 15,
    color: "#1a1a1a", backgroundColor: "#f9fafb",
  },
  inputError: { borderColor: "#dc2626" },
  multiline: { minHeight: 60 },
  fieldError: { color: "#dc2626", fontSize: 12, marginTop: 2 },
  // Confirm modal styles
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  confirmCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360 },
  confirmTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  confirmBody: { fontSize: 14, color: "#374151", marginBottom: 20, lineHeight: 20 },
  confirmActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  confirmCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  confirmCancelText: { fontSize: 14, color: "#374151" },
  confirmOkBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#2563eb", minWidth: 72, alignItems: "center" },
  confirmOkBtnDanger: { backgroundColor: "#dc2626" },
  confirmOkText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
