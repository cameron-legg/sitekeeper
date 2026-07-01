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
import { useGenerateInvoicePdf, downloadInvoicePdf } from "../api/hooks/usePdf";
import type { Invoice, InvoiceStatus } from "../api/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props { jobId: string; }

const INVOICE_STATUS_OPTIONS: { value: InvoiceStatus; label: string; color: string; bg: string }[] = [
  { value: "drafting", label: "Drafting", color: "#6b7280", bg: "#f3f4f6" },
  { value: "waiting_to_send", label: "Waiting to be Sent", color: "#d97706", bg: "#fef3c7" },
  { value: "sent_awaiting_payment", label: "Sent & Awaiting Payment", color: "#2563eb", bg: "#dbeafe" },
  { value: "paid", label: "Paid", color: "#065f46", bg: "#d1fae5" },
];

function getStatusDisplay(status: InvoiceStatus) {
  return INVOICE_STATUS_OPTIONS.find((o) => o.value === status) ?? INVOICE_STATUS_OPTIONS[0];
}

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

  // Status picker
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // PDF
  const generatePdf = useGenerateInvoicePdf();
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Keep selectedInvoice in sync when list data refreshes
  React.useEffect(() => {
    if (selectedInvoice && invoices) {
      const fresh = invoices.find((i) => i.id === selectedInvoice.id);
      if (fresh && (fresh.pdf_status !== selectedInvoice.pdf_status || fresh.status !== selectedInvoice.status)) {
        setSelectedInvoice(fresh);
      }
    }
  }, [invoices]);

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

  function handleStatusChange(invoice: Invoice, newStatus: InvoiceStatus) {
    setShowStatusPicker(false);
    updateInvoice.mutate({ invoiceId: invoice.id, status: newStatus });
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
        renderItem={({ item }) => {
          const statusInfo = getStatusDisplay(item.status);
          return (
            <TouchableOpacity style={styles.card} onPress={() => openSheet(item)} activeOpacity={0.7}>
              <View style={styles.cardMain}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.cardBadgeRow}>
                    <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
                      <Text style={[styles.badgeText, { color: statusInfo.color }]}>
                        {statusInfo.label}
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
          );
        }}
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
                {(() => {
                  const si = getStatusDisplay(selectedInvoice.status);
                  return (
                    <View style={[styles.badge, { backgroundColor: si.bg }]}>
                      <Text style={[styles.badgeText, { color: si.color }]}>
                        {si.label}
                      </Text>
                    </View>
                  );
                })()}
                {selectedInvoice.source_estimate_id && (
                  <View style={styles.badgePurple}>
                    <Text style={styles.badgePurpleText}>Converted from estimate</Text>
                  </View>
                )}
              </View>

              {/* Totals breakdown */}
              <View style={styles.totalsBlock}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Materials</Text>
                  <Text style={styles.totalValue}>${parseFloat(selectedInvoice.materials_cost || "0").toFixed(2)}</Text>
                </View>
                {selectedInvoice.tax_rate && parseFloat(selectedInvoice.tax_rate) > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Tax ({selectedInvoice.tax_rate}%)</Text>
                    <Text style={styles.totalValue}>${parseFloat(selectedInvoice.tax_amount || "0").toFixed(2)}</Text>
                  </View>
                )}
                {selectedInvoice.tax_rate && parseFloat(selectedInvoice.tax_rate) > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Materials + Tax</Text>
                    <Text style={styles.totalValue}>${(parseFloat(selectedInvoice.materials_cost || "0") + parseFloat(selectedInvoice.tax_amount || "0")).toFixed(2)}</Text>
                  </View>
                )}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Labor ({parseFloat(selectedInvoice.labor_hours || "0").toFixed(2)}h)</Text>
                  <Text style={styles.totalValue}>${parseFloat(selectedInvoice.labor_cost || "0").toFixed(2)}</Text>
                </View>
                <View style={[styles.totalRow, styles.grandRow]}>
                  <Text style={styles.grandLabel}>Total</Text>
                  <Text style={styles.grandValue}>${parseFloat(selectedInvoice.total || "0").toFixed(2)}</Text>
                </View>
              </View>

              {/* Actions menu */}
              <View style={styles.menuSection}>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleEdit(selectedInvoice)}>
                  <Text style={styles.menuItemText}>✏️  Edit Invoice</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity style={styles.menuItem} onPress={() => setShowStatusPicker(true)}>
                  <Text style={styles.menuItemText}>📋  Invoice Status</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                {/* PDF actions */}
                {(selectedInvoice.pdf_status === "none" || selectedInvoice.pdf_status === "stale") && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setPdfError(null);
                      generatePdf.mutate({ invoiceId: selectedInvoice.id }, {
                        onError: () => setPdfError("Failed to generate PDF."),
                      });
                    }}
                    disabled={generatePdf.isPending}
                  >
                    <Text style={styles.menuItemText}>
                      {generatePdf.isPending ? "⏳  Generating PDF…" : "📄  Generate PDF"}
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedInvoice.pdf_status === "stale" && (
                  <View style={styles.pdfStaleHint}>
                    <Text style={styles.pdfStaleHintText}>⚠ PDF is outdated — regenerate to get the latest version</Text>
                  </View>
                )}

                {selectedInvoice.pdf_status === "current" && (
                  <>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={async () => {
                        setPdfError(null);
                        setIsDownloading(true);
                        try {
                          await downloadInvoicePdf(selectedInvoice.id);
                        } catch {
                          setPdfError("Failed to download PDF.");
                        } finally {
                          setIsDownloading(false);
                        }
                      }}
                      disabled={isDownloading}
                    >
                      <Text style={styles.menuItemText}>
                        {isDownloading ? "⏳  Downloading…" : "⬇️  Download PDF"}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.menuDivider} />

                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        setPdfError(null);
                        generatePdf.mutate({ invoiceId: selectedInvoice.id }, {
                          onError: () => setPdfError("Failed to generate PDF."),
                        });
                      }}
                      disabled={generatePdf.isPending}
                    >
                      <Text style={styles.menuItemText}>
                        {generatePdf.isPending ? "⏳  Regenerating…" : "🔄  Regenerate PDF"}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {pdfError && <Text style={styles.pdfErrorText}>{pdfError}</Text>}

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

      {/* ── Status picker modal ── */}
      <Modal visible={showStatusPicker && !!selectedInvoice} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invoice Status</Text>
            <Text style={styles.statusPickerHint}>Select the current status of this invoice:</Text>
            {INVOICE_STATUS_OPTIONS.map((opt) => {
              const isSelected = selectedInvoice?.status === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.statusOption, isSelected && { backgroundColor: opt.bg, borderColor: opt.color }]}
                  onPress={() => selectedInvoice && handleStatusChange(selectedInvoice, opt.value)}
                >
                  <View style={[styles.statusDot, { backgroundColor: opt.color }]} />
                  <Text style={[styles.statusOptionText, isSelected && { color: opt.color, fontWeight: "700" }]}>
                    {opt.label}
                  </Text>
                  {isSelected && <Text style={styles.statusCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.statusPickerCancel} onPress={() => setShowStatusPicker(false)}>
              <Text style={styles.statusPickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  badgeText: { fontSize: 11, fontWeight: "600" },
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

  // Status picker
  statusPickerHint: { fontSize: 13, color: "#6b7280", marginBottom: 12 },
  statusOption: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 8,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusOptionText: { fontSize: 15, color: "#374151", flex: 1 },
  statusCheck: { fontSize: 16, color: "#2563eb", fontWeight: "700" },
  statusPickerCancel: { marginTop: 4, paddingVertical: 12, alignItems: "center" },
  statusPickerCancelText: { fontSize: 15, color: "#6b7280", fontWeight: "500" },

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
  pdfStaleHint: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fef3c7" },
  pdfStaleHintText: { fontSize: 13, color: "#92400e" },
  pdfErrorText: { fontSize: 13, color: "#dc2626", paddingHorizontal: 16, paddingVertical: 8 },
});
