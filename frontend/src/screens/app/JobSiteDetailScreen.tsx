import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Modal,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useJobs, useCreateJob, useDeleteJob } from "../../api/hooks/useJobs";
import type { Job } from "../../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "JobSiteDetail">;

const STATUS_COLORS: Record<Job["status"], string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  completed: "#10b981",
  cancelled: "#6b7280",
};

const STATUS_LABELS: Record<Job["status"], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function JobSiteDetailScreen({ route, navigation }: Props) {
  const { siteId, siteName } = route.params;

  const { data: jobs, isLoading, isError } = useJobs(siteId);
  const createJob = useCreateJob();
  const deleteJob = useDeleteJob();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Job | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: siteName });
  }, [navigation, siteName]);

  function handleCreateJob() {
    const name = newJobName.trim();
    if (!name) {
      setCreateError("Job name is required.");
      return;
    }
    setCreateError(null);
    createJob.mutate(
      { siteId, name },
      {
        onSuccess: () => {
          setShowCreateModal(false);
          setNewJobName("");
        },
        onError: () => {
          setCreateError("Failed to create job. Please try again.");
        },
      }
    );
  }

  function handleDelete(job: Job) {
    setConfirmDelete(job);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function renderItem({ item }: { item: Job }) {
    const color = STATUS_COLORS[item.status];
    return (
      <TouchableOpacity
        style={styles.jobRow}
        onPress={() =>
          navigation.navigate("JobDetail", {
            jobId: item.id,
            jobName: item.name,
            siteId,
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.jobInfo}>
          <Text style={styles.jobName}>{item.name}</Text>
          <View style={styles.jobMeta}>
            <View style={[styles.statusBadge, { backgroundColor: color + "22" }]}>
              <Text style={[styles.statusText, { color }]}>
                {STATUS_LABELS[item.status]}
              </Text>
            </View>
            {item.finished_at && (
              <Text style={styles.finishedAt}>
                Finished {formatDate(item.finished_at)}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.flex}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load jobs.</Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            jobs?.length === 0 ? styles.emptyContainer : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No jobs yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the button below to add a job to this site.
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setNewJobName("");
          setCreateError(null);
          setShowCreateModal(true);
        }}
      >
        <Text style={styles.fabText}>+ New Job</Text>
      </TouchableOpacity>

      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Job</Text>

            {createError && (
              <Text style={styles.inlineError}>{createError}</Text>
            )}

            <TextInput
              style={styles.modalInput}
              value={newJobName}
              onChangeText={setNewJobName}
              placeholder="Job name"
              autoFocus
              onSubmitEditing={handleCreateJob}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  createJob.isPending && styles.buttonDisabled,
                ]}
                onPress={handleCreateJob}
                disabled={createJob.isPending}
              >
                {createJob.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete job confirmation */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Job</Text>
            <Text style={styles.confirmBody}>
              Delete "{confirmDelete?.name}"? This will remove all notes, estimates, and invoices for this job.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmDelete(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, deleteJob.isPending && styles.buttonDisabled]}
                onPress={() => {
                  if (!confirmDelete) return;
                  deleteJob.mutate(
                    { jobId: confirmDelete.id, siteId },
                    { onSuccess: () => setConfirmDelete(null), onError: () => setConfirmDelete(null) }
                  );
                }}
                disabled={deleteJob.isPending}
              >
                {deleteJob.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.deleteConfirmText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f3f4f6" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
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
  },
  jobRow: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  jobInfo: { flex: 1 },
  jobName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  jobMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  finishedAt: {
    fontSize: 12,
    color: "#6b7280",
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#fef2f2",
  },
  deleteBtnText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "500",
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  inlineError: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1a1a1a",
    backgroundColor: "#f9fafb",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  modalCancelText: { fontSize: 14, color: "#374151" },
  modalConfirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    minWidth: 80,
    alignItems: "center",
  },
  modalConfirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  buttonDisabled: { opacity: 0.6 },
  confirmBody: { fontSize: 14, color: "#374151", marginBottom: 20, lineHeight: 20 },
  deleteConfirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#dc2626", minWidth: 80, alignItems: "center" },
  deleteConfirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
