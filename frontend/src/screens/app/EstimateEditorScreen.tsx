import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, StyleSheet,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import {
  useEstimate, useCreateEstimate, useUpdateEstimate,
  useEstimateLineItems, useAddEstimateLineItem, useUpdateEstimateLineItem,
  useDeleteEstimateLineItem, useAddEstimateEntry, useUpdateEstimateEntry,
  useDeleteEstimateEntry, useSaveEstimateLineItemToLibrary,
} from "../../api/hooks/useEstimates";
import { useSavedItems, usePopulateSavedItem } from "../../api/hooks/useSavedItems";
import LineItemEditor from "../../components/LineItemEditor";
import type { SavedItem } from "../../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "EstimateEditor">;

export default function EstimateEditorScreen({ route, navigation }: Props) {
  const { estimateId, jobId } = route.params;
  const isNew = !estimateId;

  const { data: estimate, isLoading: loadingEst } = useEstimate(estimateId ?? "");
  const { data: lineItems, isLoading: loadingItems } = useEstimateLineItems(estimateId ?? "");

  const createEstimate = useCreateEstimate();
  const updateEstimate = useUpdateEstimate();
  const addLineItem = useAddEstimateLineItem();
  const updateLineItem = useUpdateEstimateLineItem();
  const deleteLineItem = useDeleteEstimateLineItem();
  const addEntry = useAddEstimateEntry();
  const updateEntry = useUpdateEstimateEntry();
  const deleteEntry = useDeleteEstimateEntry();

  const [title, setTitle] = useState(estimate?.title ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  const saveToLibrary = useSaveEstimateLineItemToLibrary();
  const populateSaved = usePopulateSavedItem();
  const { data: savedItems } = useSavedItems();

  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemMode, setAddItemMode] = useState<"new" | "library">("new");
  const [newItemName, setNewItemName] = useState("");
  const [newItemRate, setNewItemRate] = useState("");
  const [newItemError, setNewItemError] = useState<string | null>(null);

  React.useEffect(() => {
    if (estimate && !title) setTitle(estimate.title);
  }, [estimate]);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: isNew ? "New Estimate" : "Edit Estimate" });
  }, [navigation, isNew]);

  function handleSaveTitle() {
    const t = title.trim();
    if (!t) { setTitleError("Title is required."); return; }
    setTitleError(null);
    if (isNew) {
      setIsSavingTitle(true);
      createEstimate.mutate({ jobId, title: t }, {
        onSuccess: (est) => { setIsSavingTitle(false); navigation.setParams({ estimateId: est.id } as any); },
        onError: () => { setIsSavingTitle(false); setTitleError("Failed to create estimate."); },
      });
    } else {
      updateEstimate.mutate({ estimateId: estimateId!, title: t }, {
        onError: () => setTitleError("Failed to update title."),
      });
    }
  }

  function handleAddLineItem() {
    const name = newItemName.trim();
    if (!name) { setNewItemError("Name is required."); return; }
    if (!estimateId) return;
    setNewItemError(null);
    addLineItem.mutate({
      estimateId,
      name,
      hourly_rate: newItemRate.trim() || undefined,
    }, {
      onSuccess: () => { setShowAddItem(false); setNewItemName(""); setNewItemRate(""); },
      onError: () => setNewItemError("Failed to add line item."),
    });
  }

  function handlePickFromLibrary(saved: SavedItem) {
    if (!estimateId) return;
    populateSaved.mutate({ itemId: saved.id, parentId: estimateId, parentType: "estimate" }, {
      onSuccess: () => setShowAddItem(false),
      onError: () => setNewItemError("Failed to add from library."),
    });
  }

  const grandTotal = (lineItems ?? []).reduce((sum, item) => sum + parseFloat(item.total_cost || "0"), 0);
  const grandHours = (lineItems ?? []).reduce((sum, item) => sum + parseFloat(item.total_hours || "0"), 0);

  if (!isNew && (loadingEst || loadingItems)) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <Text style={styles.sectionLabel}>Title</Text>
        {titleError && <Text style={styles.fieldError}>{titleError}</Text>}
        <View style={styles.titleRow}>
          <TextInput
            style={[styles.input, styles.flex1]}
            value={title}
            onChangeText={(v) => { setTitle(v); setTitleError(null); }}
            placeholder="Estimate title"
          />
          <TouchableOpacity
            style={[styles.saveBtn, isSavingTitle && styles.btnDisabled]}
            onPress={handleSaveTitle}
            disabled={isSavingTitle}
          >
            {isSavingTitle ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>

        {/* Line items */}
        {estimateId && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Line Items</Text>

            {(lineItems ?? []).map((item) => (
              <LineItemEditor
                key={item.id}
                item={item}
                onUpdateItem={(data) => updateLineItem.mutate({ estimateId, itemId: item.id, ...data })}
                onDeleteItem={() => deleteLineItem.mutate({ estimateId, itemId: item.id })}
                onAddEntry={(values) => addEntry.mutate({ estimateId, itemId: item.id, ...values })}
                onUpdateEntry={(entryId, values) => updateEntry.mutate({ estimateId, itemId: item.id, entryId, ...values })}
                onDeleteEntry={(entryId) => deleteEntry.mutate({ estimateId, itemId: item.id, entryId })}
                onSaveToLibrary={() => saveToLibrary.mutate({ estimateId, itemId: item.id })}
                isSavingEntry={addEntry.isPending || updateEntry.isPending}
              />
            ))}

            {(lineItems ?? []).length === 0 && (
              <Text style={styles.emptyText}>No line items yet. Tap "Add Line Item" to start.</Text>
            )}

            {/* Grand total */}
            {(lineItems ?? []).length > 0 && (
              <View style={styles.grandTotalRow}>
                <View>
                  <Text style={styles.grandTotalLabel}>Grand Total</Text>
                  {grandHours > 0 && (
                    <Text style={styles.grandHours}>{grandHours.toFixed(2)} total hours</Text>
                  )}
                </View>
                <Text style={styles.grandTotalValue}>${grandTotal.toFixed(2)}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.addItemBtn} onPress={() => { setNewItemName(""); setNewItemRate(""); setNewItemError(null); setAddItemMode("new"); setShowAddItem(true); }}>
              <Text style={styles.addItemBtnText}>+ Add Line Item</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Add line item modal */}
      <Modal visible={showAddItem} transparent animationType="fade" onRequestClose={() => setShowAddItem(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Line Item</Text>

            {/* Mode tabs */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, addItemMode === "new" && styles.modeTabActive]}
                onPress={() => setAddItemMode("new")}
              >
                <Text style={[styles.modeTabText, addItemMode === "new" && styles.modeTabTextActive]}>New Item</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, addItemMode === "library" && styles.modeTabActive]}
                onPress={() => setAddItemMode("library")}
              >
                <Text style={[styles.modeTabText, addItemMode === "library" && styles.modeTabTextActive]}>From Library</Text>
              </TouchableOpacity>
            </View>

            {newItemError && <Text style={styles.fieldError}>{newItemError}</Text>}

            {addItemMode === "new" ? (
              <>
                <Text style={styles.fieldLabel}>Name <Text style={styles.req}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  placeholder="e.g. Toilet Replacement"
                  autoFocus
                />
                <Text style={styles.fieldLabel}>Hourly Rate (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={newItemRate}
                  onChangeText={setNewItemRate}
                  placeholder="e.g. 85.00"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.rateHint}>Used to calculate cost of hours entries under this item.</Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddItem(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, addLineItem.isPending && styles.btnDisabled]}
                    onPress={handleAddLineItem}
                    disabled={addLineItem.isPending}
                  >
                    {addLineItem.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.confirmText}>Add</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {(savedItems ?? []).length === 0 ? (
                  <Text style={styles.emptyLibText}>No saved items yet. Create one from a line item using "📚 Save".</Text>
                ) : (
                  (savedItems ?? []).map((saved) => (
                    <TouchableOpacity
                      key={saved.id}
                      style={styles.savedItemRow}
                      onPress={() => handlePickFromLibrary(saved)}
                      disabled={populateSaved.isPending}
                    >
                      <View style={styles.savedItemInfo}>
                        <Text style={styles.savedItemName}>{saved.name}</Text>
                        {saved.hourly_rate && (
                          <Text style={styles.savedItemMeta}>${saved.hourly_rate}/hr</Text>
                        )}
                        <Text style={styles.savedItemMeta}>{saved.entries.length} entries</Text>
                      </View>
                      <Text style={styles.pickText}>Add →</Text>
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddItem(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f3f4f6" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  fieldError: { color: "#dc2626", fontSize: 13, marginBottom: 4 },
  titleRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#1a1a1a", backgroundColor: "#fff" },
  flex1: { flex: 1 },
  saveBtn: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", minWidth: 64 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 20 },
  grandTotalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, borderTopWidth: 2, borderTopColor: "#e5e7eb", marginTop: 8,
  },
  grandTotalLabel: { fontSize: 15, fontWeight: "700", color: "#374151" },
  grandHours: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  grandTotalValue: { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  addItemBtn: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  addItemBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 4, marginTop: 12 },
  req: { color: "#dc2626" },
  rateHint: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 20 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  cancelText: { fontSize: 14, color: "#374151" },
  confirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#2563eb", minWidth: 80, alignItems: "center" },
  confirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  modeTabs: { flexDirection: "row", borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden", marginBottom: 12 },
  modeTab: { flex: 1, paddingVertical: 9, alignItems: "center", backgroundColor: "#f9fafb" },
  modeTabActive: { backgroundColor: "#2563eb" },
  modeTabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  modeTabTextActive: { color: "#fff" },
  emptyLibText: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 16 },
  savedItemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  savedItemInfo: { flex: 1 },
  savedItemName: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  savedItemMeta: { fontSize: 12, color: "#6b7280" },
  pickText: { fontSize: 14, color: "#2563eb", fontWeight: "600" },
});
