import React, { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import {
  useEstimates, useCreateEstimate, useUpdateEstimate,
  useDeleteEstimate, useConvertEstimate,
} from "../api/hooks/useEstimates";
import type { Estimate } from "../api/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props { jobId: string; }

export default function EstimatesTab({ jobId }: Props) {
  const navigation = useNavigation<Nav>();
  const { data: estimates, isLoading, isError } = useEstimates(jobId);
  const createEstimate = useCreateEstimate();
  const updateEstimate = useUpdateEstimate();
  const deleteEstimate = useDeleteEstimate();
  const convertEstimate = useConvertEstimate();

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  // Confirm modals
  const [confirmConvert, setConfirmConvert] = useState<Estimate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Estimate | null>(null);

  function openNew() {
    setTitle(""); setTaxRate(""); setTitleError(null); setShowModal(true);
  }

  function handleCreate() {
    const t = title.trim();
    if (!t) { setTitleError("Title is required."); return; }
    setTitleError(null);
    createEstimate.mutate(
      { jobId, title: t, tax_rate: taxRate.trim() || undefined },
      {
        onSuccess: (est) => { setShowModal(false); navigation.navigate("EstimateEditor", { estimateId: est.id, jobId }); },
        onError: () => setTitleError("Failed to create estimate."),
      }
    );
  }

  function handleToggleDelivered(estimate: Estimate) {
    updateEstimate.mutate({ estimateId: estimate.id, delivered: !estimate.delivered });
  }

  function handleConvert(estimate: Estimate) {
    setConfirmConvert(estimate);
  }

  function handleDelete(estimate: Estimate) {
    setConfirmDelete(estimate);
  }

  if (isLoading) return <View style={styles.centered}><ActivityIndicator color="#2563eb" /></View>;
  if (isError) return <View style={styles.centered}><Text style={styles.errorText}>Failed to load estimates.</Text></View>;

  return (
    <View style={styles.flex}>
      <FlatList
        data={estimates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={(estimates?.length ?? 0) === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No estimates yet</Text>
            <Text style={styles.emptySubtitle}>Tap "New Estimate" to create one.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <View style={[styles.badge, item.delivered ? styles.badgeGreen : styles.badgeGrey]}>
                <Text style={[styles.badgeText, item.delivered ? styles.badgeTextGreen : styles.badgeTextGrey]}>
                  {item.delivered ? "Delivered" : "Not delivered"}
                </Text>
              </View>
            </View>

            {/* Tax breakdown */}
            <View style={styles.totalsBlock}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>${parseFloat(item.subtotal || "0").toFixed(2)}</Text>
              </View>
              {item.tax_rate && parseFloat(item.tax_rate) > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tax ({item.tax_rate}% on materials)</Text>
                  <Text style={styles.totalValue}>${parseFloat(item.tax_amount || "0").toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.grandRow]}>
                <Text style={styles.grandLabel}>Total</Text>
                <Text style={styles.grandValue}>${parseFloat(item.total || "0").toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("EstimateEditor", { estimateId: item.id, jobId })}>
                <Text style={styles.actionBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggleDelivered(item)}>
                <Text style={styles.actionBtnText}>{item.delivered ? "Mark Undelivered" : "Mark Delivered"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleConvert(item)}>
                <Text style={styles.actionBtnText}>→ Invoice</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.addBtn} onPress={openNew}>
        <Text style={styles.addBtnText}>+ New Estimate</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Estimate</Text>
            {titleError && <Text style={styles.inlineError}>{titleError}</Text>}
            <Text style={styles.fieldLabel}>Title <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.modalInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Estimate title"
              autoFocus
            />
            <Text style={styles.fieldLabel}>Sales Tax Rate % (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={taxRate}
              onChangeText={setTaxRate}
              placeholder="e.g. 8.5"
              keyboardType="decimal-pad"
            />
            <Text style={styles.taxHint}>Applies to material items only, not labour hours.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, createEstimate.isPending && styles.btnDisabled]}
                onPress={handleCreate}
                disabled={createEstimate.isPending}
              >
                {createEstimate.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Convert to invoice confirmation */}
      <Modal visible={!!confirmConvert} transparent animationType="fade" onRequestClose={() => setConfirmConvert(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Convert to Invoice</Text>
            <Text style={styles.confirmBody}>
              Convert "{confirmConvert?.title}" to an invoice?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmConvert(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, convertEstimate.isPending && styles.btnDisabled]}
                onPress={() => {
                  if (!confirmConvert) return;
                  convertEstimate.mutate(
                    { estimateId: confirmConvert.id, jobId },
                    { onSuccess: () => setConfirmConvert(null), onError: () => setConfirmConvert(null) }
                  );
                }}
                disabled={convertEstimate.isPending}
              >
                {convertEstimate.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmText}>Convert</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete confirmation */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Estimate</Text>
            <Text style={styles.confirmBody}>
              Delete "{confirmDelete?.title}"? This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDelete(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnDanger, deleteEstimate.isPending && styles.btnDisabled]}
                onPress={() => {
                  if (!confirmDelete) return;
                  deleteEstimate.mutate(
                    { estimateId: confirmDelete.id, jobId },
                    { onSuccess: () => setConfirmDelete(null), onError: () => setConfirmDelete(null) }
                  );
                }}
                disabled={deleteEstimate.isPending}
              >
                {deleteEstimate.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#dc2626", fontSize: 15 },
  listContent: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, padding: 16 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#1a1a1a", flex: 1, marginRight: 8 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeGreen: { backgroundColor: "#d1fae5" },
  badgeGrey: { backgroundColor: "#f3f4f6" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  badgeTextGreen: { color: "#065f46" },
  badgeTextGrey: { color: "#6b7280" },
  totalsBlock: { backgroundColor: "#f9fafb", borderRadius: 8, padding: 10, marginBottom: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  totalLabel: { fontSize: 13, color: "#6b7280" },
  totalValue: { fontSize: 13, color: "#374151" },
  grandRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 4, paddingTop: 4, marginBottom: 0 },
  grandLabel: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  grandValue: { fontSize: 14, fontWeight: "700", color: "#2563eb" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#eff6ff" },
  actionBtnText: { fontSize: 12, color: "#2563eb", fontWeight: "500" },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#fef2f2" },
  deleteBtnText: { fontSize: 12, color: "#dc2626", fontWeight: "500" },
  addBtn: { margin: 16, backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 4, marginTop: 10 },
  req: { color: "#dc2626" },
  inlineError: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: "#1a1a1a", backgroundColor: "#f9fafb" },
  taxHint: { fontSize: 12, color: "#9ca3af", marginTop: 4, marginBottom: 4 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 16 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  cancelText: { fontSize: 14, color: "#374151" },
  confirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#2563eb", minWidth: 80, alignItems: "center" },
  confirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
  confirmBody: { fontSize: 14, color: "#374151", marginBottom: 16, lineHeight: 20 },
  confirmBtnDanger: { backgroundColor: "#dc2626" },
});
