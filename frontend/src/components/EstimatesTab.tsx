import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import {
  useEstimates,
  useCreateEstimate,
  useUpdateEstimate,
  useDeleteEstimate,
  useConvertEstimate,
} from "../api/hooks/useEstimates";
import type { Estimate } from "../api/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  jobId: string;
}

export default function EstimatesTab({ jobId }: Props) {
  const navigation = useNavigation<Nav>();
  const { data: estimates, isLoading, isError } = useEstimates(jobId);
  const createEstimate = useCreateEstimate();
  const updateEstimate = useUpdateEstimate();
  const deleteEstimate = useDeleteEstimate();
  const convertEstimate = useConvertEstimate();

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  function openNew() {
    setTitle("");
    setTitleError(null);
    setShowModal(true);
  }

  function handleCreate() {
    const t = title.trim();
    if (!t) {
      setTitleError("Title is required.");
      return;
    }
    setTitleError(null);
    createEstimate.mutate(
      { jobId, title: t },
      {
        onSuccess: (est) => {
          setShowModal(false);
          navigation.navigate("EstimateEditor", { estimateId: est.id, jobId });
        },
        onError: () => setTitleError("Failed to create estimate."),
      }
    );
  }

  function handleToggleDelivered(estimate: Estimate) {
    updateEstimate.mutate({ estimateId: estimate.id, delivered: !estimate.delivered });
  }

  function handleConvert(estimate: Estimate) {
    Alert.alert(
      "Convert to Invoice",
      `Convert "${estimate.title}" to an invoice?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Convert", onPress: () => convertEstimate.mutate({ estimateId: estimate.id, jobId }) },
      ]
    );
  }

  function handleDelete(estimate: Estimate) {
    Alert.alert(
      "Delete Estimate",
      `Delete "${estimate.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteEstimate.mutate({ estimateId: estimate.id, jobId }) },
      ]
    );
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
            {item.total != null && (
              <Text style={styles.total}>Total: ${parseFloat(item.total).toFixed(2)}</Text>
            )}
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
            <TextInput
              style={styles.modalInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Estimate title"
              autoFocus
              onSubmitEditing={handleCreate}
            />
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
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#1a1a1a", flex: 1, marginRight: 8 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeGreen: { backgroundColor: "#d1fae5" },
  badgeGrey: { backgroundColor: "#f3f4f6" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  badgeTextGreen: { color: "#065f46" },
  badgeTextGrey: { color: "#6b7280" },
  total: { fontSize: 14, color: "#374151", fontWeight: "500", marginBottom: 10 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#eff6ff" },
  actionBtnText: { fontSize: 12, color: "#2563eb", fontWeight: "500" },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#fef2f2" },
  deleteBtnText: { fontSize: 12, color: "#dc2626", fontWeight: "500" },
  addBtn: { margin: 16, backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 16 },
  inlineError: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: "#1a1a1a", backgroundColor: "#f9fafb", marginBottom: 16 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  cancelText: { fontSize: 14, color: "#374151" },
  confirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#2563eb", minWidth: 80, alignItems: "center" },
  confirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
});
