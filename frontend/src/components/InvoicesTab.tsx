import React, { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, StyleSheet, Platform, ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import {
  useInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice,
} from "../api/hooks/useInvoices";
import type { Invoice } from "../api/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props { jobId: string; }

export default function InvoicesTab({ jobId }: Props) {
  const navigation = useNavigation<Nav>();
  const { data: invoices, isLoading, isError } = useInvoices(jobId);
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();

  // Bottom sheet
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null);

  function openSheet(invoice: Invoice) { setSelectedInvoice(invoice); }
  function closeSheet() { setSelectedInvoice(null); }

  function openNew() {
    setTitle(""); setTaxRate(""); setTitleError(null); setShowCreateModal(true);
  }

  function handleCreate() {
    const t = title.trim();
    if (!t) { setTitleError("Title is required."); return; }
    setTitleError(null);
    createInvoice.mutate(
      { jobId, title: t, tax_rate: taxRate.trim() || undefined },
      {
        onSuccess: (inv) => {
          setShowCreateModal(false);
          navigation.navigate("InvoiceEditor", { invoiceId: inv.id, jobId });
        },
        onError: () => setTitleError("Failed to create invoice."),
      }
    );
  }

  function handleEdit(invoice: Invoice) {
    closeSheet();
    navigation.navigate("InvoiceEditor", { invoiceId: invoice.id, jobId });
  }

  function handleToggleDelivered(invoice: Invoice) {
    closeSheet();
    updateInvoice.mutate({ invoiceId: invoice.id, delivered: !invoice.delivered });
  }

  function handleDelete(invoice: Invoice) {
    closeSheet();
    setConfirmDelete(invoice);
  }

  if (isLoading) return <View style={styles.centered}><ActivityIndicator color="#2563eb" /></View>;
  if (isError) return <View style={styles.centered}><Text style={styles.errorText}>Failed to load invoices.</Text></View>;

  return (
    <View style={styles.flex}>
      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={(invoices?.length ?? 0) === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No invoices yet</Text>
            <Text style={styles.emptySubtitle}>Tap "New Invoice" to create one, or convert an estimate.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openSheet(item)} activeOpacity={0.7}>
            <View style={styles.cardMain}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <View style={styles.cardBadgeRow}>
                  <View style={[styles.badge, item.delivered ? styles.badgeGreen : styles.badgeGrey]}>
                    <Text style={[styles.badgeText, item.delivered ? styles.badgeTextGreen : styles.badgeTextGrey]}>
                      {item.delivered ? "Delivered" : "Draft"}
                    </Text>
                  </View>
                  {item.source_estimate_id && (
                    <View style={styles.badgePurple}>
                      <Text style={styles.badgePurpleText}>From estimate</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardTotal}>${parseFloat(item.total || "0").toFixed(2)}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </View>
            {item.tax_rate && parseFloat(item.tax_rate) > 0 && (
              <Text style={styles.cardSub}>
                Subtotal ${parseFloat(item.subtotal || "0").toFixed(2)} + tax ${parseFloat(item.tax_amount || "0").toFixed(2)}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.addBtn} onPress={openNew}>
        <Text style={styles.addBtnText}>+ New Invoice</Text>
      </TouchableOpacity>

      {/* ── Detail bottom sheet ── */}
      <Modal
        visible={!!selectedInvoice}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closeSheet} />
        {selectedInvoice && (
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {/* Title + badges */}
              <Text style={styles.sheetTitle}>{selectedInvoice.title}</Text>
              <View style={styles.sheetBadgeRow}>
                <View style={[styles.badge, selectedInvoice.delivered ? styles.badgeGreen : styles.badgeGrey]}>
                  <Text style={[styles.badgeText, selectedInvoice.delivered ? styles.badgeTextGreen : styles.badgeTextGrey]}>
                    {selectedInvoice.delivered ? "Delivered" : "Draft"}
                  </Text>
                </View>
                {selectedInvoice.source_estimate_id && (
                  <View style={styles.badgePurple}>
                    <Text style={styles.badgePurpleText}>Converted from estimate</Text>
                  </View>
                )}
              </View>

              {/* Totals breakdown */}
              <View style={styles.totalsBlock}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>${parseFloat(selectedInvoice.subtotal || "0").toFixed(2)}</Text>
                </View>
                {selectedInvoice.tax_rate && parseFloat(selectedInvoice.tax_rate) > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Tax ({selectedInvoice.tax_rate}% on materials)</Text>
                    <Text style={styles.totalValue}>${parseFloat(selectedInvoice.tax_amount || "0").toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.totalRow, styles.grandRow]}>
                  <Text style={styles.grandLabel}>Total</Text>
                  <Text style={styles.grandValue}>${parseFloat(selectedInvoice.total || "0").toFixed(2)}</Text>
                </View>
              </View>

              {/* Actions menu */}
              <View style={styles.menuSection}>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleEdit(selectedInvoice)}>
                  <Text style={styles.menuItemText}>✏️  Edit Line Items</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity style={styles.menuItem} onPress={() => handleToggleDelivered(selectedInvoice)}>
                  <Text style={styles.menuItemText}>
                    {selectedInvoice.delivered ? "↩️  Mark as Draft" : "✅  Mark Delivered"}
                  </Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity style={styles.menuItem} onPress={() => handleDelete(selectedInvoice)}>
                  <Text style={[styles.menuItemText, styles.menuItemDanger]}>🗑️  Delete Invoice</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={closeSheet}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ── Create modal ── */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Invoice</Text>
            {titleError && <Text style={styles.inlineError}>{titleError}</Text>}
            <Text style={styles.fieldLabel}>Title <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.modalInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Invoice title"
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
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, createInvoice.isPending && styles.btnDisabled]}
                onPress={handleCreate}
                disabled={createInvoice.isPending}
              >
                {createInvoice.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete confirmation ── */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Invoice</Text>
            <Text style={styles.confirmBody}>Delete "{confirmDelete?.title}"? This cannot be undone.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmDelete(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnDanger, deleteInvoice.isPending && styles.btnDisabled]}
                onPress={() => {
                  if (!confirmDelete) return;
                  deleteInvoice.mutate(
                    { invoiceId: confirmDelete.id, jobId },
                    { onSuccess: () => setConfirmDelete(null), onError: () => setConfirmDelete(null) }
                  );
                }}
                disabled={deleteInvoice.isPending}
              >
                {deleteInvoice.isPending
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
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1, padding: 16 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#9ca3af", textAlign: "center" },

  // Card (list row)
  card: {
    backgroundColor: "#fff", borderRadius: 10, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  cardMain: { flexDirection: "row", alignItems: "center" },
  cardLeft: { flex: 1, gap: 5 },
  cardRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  cardTotal: { fontSize: 16, fontWeight: "700", color: "#2563eb" },
  cardSub: { fontSize: 12, color: "#9ca3af", marginTop: 6 },
  cardBadgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chevron: { fontSize: 22, color: "#d1d5db" },
  badge: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeGreen: { backgroundColor: "#d1fae5" },
  badgeGrey: { backgroundColor: "#f3f4f6" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  badgeTextGreen: { color: "#065f46" },
  badgeTextGrey: { color: "#6b7280" },
  badgePurple: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "#f3e8ff" },
  badgePurpleText: { fontSize: 11, fontWeight: "600", color: "#7c3aed" },

  // Add button
  addBtn: { margin: 16, backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // Bottom sheet
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: 12,
    maxHeight: "80%",
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: "#d1d5db",
    borderRadius: 2, alignSelf: "center", marginBottom: 16,
  },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  sheetBadgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 16 },

  // Totals
  totalsBlock: { backgroundColor: "#f9fafb", borderRadius: 10, padding: 14, marginBottom: 16 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalLabel: { fontSize: 14, color: "#6b7280" },
  totalValue: { fontSize: 14, color: "#374151" },
  grandRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 6, paddingTop: 6, marginBottom: 0 },
  grandLabel: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  grandValue: { fontSize: 15, fontWeight: "700", color: "#2563eb" },

  // Menu
  menuSection: { backgroundColor: "#f9fafb", borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  menuItem: { paddingVertical: 14, paddingHorizontal: 16 },
  menuItemText: { fontSize: 15, color: "#1a1a1a" },
  menuItemDanger: { color: "#dc2626" },
  menuDivider: { height: 1, backgroundColor: "#e5e7eb", marginHorizontal: 16 },
  cancelBtn: { backgroundColor: "#f3f4f6", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },

  // Create / confirm modals
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 4, marginTop: 10 },
  req: { color: "#dc2626" },
  inlineError: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: "#1a1a1a", backgroundColor: "#f9fafb" },
  taxHint: { fontSize: 12, color: "#9ca3af", marginTop: 4, marginBottom: 4 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 16 },
  modalCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  modalCancelText: { fontSize: 14, color: "#374151" },
  confirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#2563eb", minWidth: 80, alignItems: "center" },
  confirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  confirmBtnDanger: { backgroundColor: "#dc2626" },
  btnDisabled: { opacity: 0.6 },
  confirmBody: { fontSize: 14, color: "#374151", marginBottom: 16, lineHeight: 20 },
});
