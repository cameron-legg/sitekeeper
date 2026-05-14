import React, { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, StyleSheet, Platform, ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import {
  useEstimates, useCreateEstimate, useUpdateEstimate,
  useDeleteEstimate, useConvertEstimate,
} from "../api/hooks/useEstimates";
import { useGenerateEstimatePdf, downloadEstimatePdf } from "../api/hooks/usePdf";
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

  // Bottom sheet
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  // Confirm modals
  const [confirmConvert, setConfirmConvert] = useState<Estimate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Estimate | null>(null);

  // PDF
  const generatePdf = useGenerateEstimatePdf();
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Keep selectedEstimate in sync when list data refreshes (e.g. after PDF generation)
  React.useEffect(() => {
    if (selectedEstimate && estimates) {
      const fresh = estimates.find((e) => e.id === selectedEstimate.id);
      if (fresh && fresh.pdf_status !== selectedEstimate.pdf_status) {
        setSelectedEstimate(fresh);
      }
    }
  }, [estimates]);

  function openSheet(estimate: Estimate) { setSelectedEstimate(estimate); }
  function closeSheet() { setSelectedEstimate(null); }

  function openNew() {
    setTitle(""); setTaxRate(""); setTitleError(null); setShowCreateModal(true);
  }

  function handleCreate() {
    const t = title.trim();
    if (!t) { setTitleError("Title is required."); return; }
    setTitleError(null);
    createEstimate.mutate(
      { jobId, title: t, tax_rate: taxRate.trim() || undefined },
      {
        onSuccess: (est) => {
          setShowCreateModal(false);
          navigation.navigate("EstimateEditor", { estimateId: est.id, jobId });
        },
        onError: () => setTitleError("Failed to create estimate."),
      }
    );
  }

  function handleEdit(estimate: Estimate) {
    closeSheet();
    navigation.navigate("EstimateEditor", { estimateId: estimate.id, jobId });
  }

  function handleToggleDelivered(estimate: Estimate) {
    closeSheet();
    updateEstimate.mutate({ estimateId: estimate.id, delivered: !estimate.delivered });
  }

  function handleConvert(estimate: Estimate) {
    closeSheet();
    setConfirmConvert(estimate);
  }

  function handleDelete(estimate: Estimate) {
    closeSheet();
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
          <TouchableOpacity style={styles.card} onPress={() => openSheet(item)} activeOpacity={0.7}>
            <View style={styles.cardMain}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <View style={[styles.badge, item.delivered ? styles.badgeGreen : styles.badgeGrey]}>
                  <Text style={[styles.badgeText, item.delivered ? styles.badgeTextGreen : styles.badgeTextGrey]}>
                    {item.delivered ? "Delivered" : "Draft"}
                  </Text>
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
        <Text style={styles.addBtnText}>+ New Estimate</Text>
      </TouchableOpacity>

      {/* ── Detail bottom sheet ── */}
      <Modal
        visible={!!selectedEstimate}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closeSheet} />
        {selectedEstimate && (
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {/* Title + badge */}
              <Text style={styles.sheetTitle}>{selectedEstimate.title}</Text>
              <View style={styles.sheetBadgeRow}>
                <View style={[styles.badge, selectedEstimate.delivered ? styles.badgeGreen : styles.badgeGrey]}>
                  <Text style={[styles.badgeText, selectedEstimate.delivered ? styles.badgeTextGreen : styles.badgeTextGrey]}>
                    {selectedEstimate.delivered ? "Delivered" : "Draft"}
                  </Text>
                </View>
              </View>

              {/* Totals breakdown */}
              <View style={styles.totalsBlock}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>${parseFloat(selectedEstimate.subtotal || "0").toFixed(2)}</Text>
                </View>
                {selectedEstimate.tax_rate && parseFloat(selectedEstimate.tax_rate) > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Tax ({selectedEstimate.tax_rate}% on materials)</Text>
                    <Text style={styles.totalValue}>${parseFloat(selectedEstimate.tax_amount || "0").toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.totalRow, styles.grandRow]}>
                  <Text style={styles.grandLabel}>Total</Text>
                  <Text style={styles.grandValue}>${parseFloat(selectedEstimate.total || "0").toFixed(2)}</Text>
                </View>
              </View>

              {/* Actions menu */}
              <View style={styles.menuSection}>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleEdit(selectedEstimate)}>
                  <Text style={styles.menuItemText}>✏️  Edit Estimate</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity style={styles.menuItem} onPress={() => handleToggleDelivered(selectedEstimate)}>
                  <Text style={styles.menuItemText}>
                    {selectedEstimate.delivered ? "↩️  Mark as Draft" : "✅  Mark Delivered"}
                  </Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity style={styles.menuItem} onPress={() => handleConvert(selectedEstimate)}>
                  <Text style={styles.menuItemText}>🧾  Convert to Invoice</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                {/* PDF actions */}
                {(selectedEstimate.pdf_status === "none" || selectedEstimate.pdf_status === "stale") && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setPdfError(null);
                      generatePdf.mutate({ estimateId: selectedEstimate.id }, {
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

                {selectedEstimate.pdf_status === "stale" && (
                  <View style={styles.pdfStaleHint}>
                    <Text style={styles.pdfStaleHintText}>⚠ PDF is outdated — regenerate to get the latest version</Text>
                  </View>
                )}

                {selectedEstimate.pdf_status === "current" && (
                  <>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={async () => {
                        setPdfError(null);
                        setIsDownloading(true);
                        try {
                          await downloadEstimatePdf(selectedEstimate.id);
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
                        generatePdf.mutate({ estimateId: selectedEstimate.id }, {
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

                <TouchableOpacity style={styles.menuItem} onPress={() => handleDelete(selectedEstimate)}>
                  <Text style={[styles.menuItemText, styles.menuItemDanger]}>🗑️  Delete Estimate</Text>
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
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
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

      {/* ── Convert confirmation ── */}
      <Modal visible={!!confirmConvert} transparent animationType="fade" onRequestClose={() => setConfirmConvert(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Convert to Invoice</Text>
            <Text style={styles.confirmBody}>Convert "{confirmConvert?.title}" to an invoice?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmConvert(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
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

      {/* ── Delete confirmation ── */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Estimate</Text>
            <Text style={styles.confirmBody}>Delete "{confirmDelete?.title}"? This cannot be undone.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmDelete(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
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
  chevron: { fontSize: 22, color: "#d1d5db" },
  badge: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeGreen: { backgroundColor: "#d1fae5" },
  badgeGrey: { backgroundColor: "#f3f4f6" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  badgeTextGreen: { color: "#065f46" },
  badgeTextGrey: { color: "#6b7280" },

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
  sheetBadgeRow: { marginBottom: 16 },

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
  pdfStaleHint: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fef3c7" },
  pdfStaleHintText: { fontSize: 13, color: "#92400e" },
  pdfErrorText: { fontSize: 13, color: "#dc2626", paddingHorizontal: 16, paddingVertical: 8 },
});
