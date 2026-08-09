import React, { useState, useMemo } from "react";
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
import { useJobSite, useUpdateJobSite } from "../../api/hooks/useJobSites";
import type { Job } from "../../api/types";
import { useIsUtilityEnabled } from "../../../utilities";

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
  const invoicesEnabled = useIsUtilityEnabled("invoices");

  const { data: site } = useJobSite(siteId);
  const { data: jobs, isLoading, isError } = useJobs(siteId);
  const createJob = useCreateJob();
  const deleteJob = useDeleteJob();
  const updateSite = useUpdateJobSite();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Job | null>(null);

  // Edit site modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(siteName);
  const [editAddress, setEditAddress] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Keep header title in sync with latest site data
  const displayName = site?.name ?? siteName;

  // Sort jobs: in_progress first, then pending, completed, cancelled
  const STATUS_ORDER: Record<Job["status"], number> = {
    in_progress: 0,
    pending: 1,
    completed: 2,
    cancelled: 3,
  };

  const sortedJobs = useMemo(() => {
    if (!jobs) return [];
    return [...jobs].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [jobs]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: displayName,
      headerRight: () => (
        <TouchableOpacity
          onPress={openEditModal}
          style={styles.headerEditBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.headerEditText}>Edit</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, displayName, site]);

  function openEditModal() {
    setEditName(site?.name ?? siteName);
    setEditAddress(site?.address ?? "");
    setEditHourlyRate(site?.default_hourly_rate ?? "");
    setEditError(null);
    setShowEditModal(true);
  }

  function handleSaveEdit() {
    const name = editName.trim();
    if (!name) {
      setEditError("Site name is required.");
      return;
    }
    setEditError(null);
    updateSite.mutate(
      { siteId, name, address: editAddress.trim() || "", default_hourly_rate: editHourlyRate.trim() || null },
      {
        onSuccess: (updated) => {
          setShowEditModal(false);
          navigation.setParams({ siteName: updated.name });
        },
        onError: () => {
          setEditError("Failed to update job site. Please try again.");
        },
      }
    );
  }

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
    const c = item.invoice_status_counts;
    const invoiceParts: string[] = [];
    if (c) {
      if (c.drafting > 0) invoiceParts.push(`${c.drafting} drafting`);
      if (c.waiting_to_send > 0) invoiceParts.push(`${c.waiting_to_send} waiting to send`);
      if (c.sent_awaiting_payment > 0) invoiceParts.push(`${c.sent_awaiting_payment} sent`);
      if (c.paid > 0) invoiceParts.push(`${c.paid} paid`);
    }
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
          {invoicesEnabled && invoiceParts.length > 0 && (
            <Text style={styles.invoiceStatusText}>
              Invoices: {invoiceParts.join(", ")}
            </Text>
          )}
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

  const siteAddress = site?.address;

  return (
    <View style={styles.flex}>
      {/* Address banner */}
      {siteAddress ? (
        <TouchableOpacity style={styles.addressBanner} onPress={openEditModal} activeOpacity={0.7}>
          <Text style={styles.addressLabel}>📍 Address</Text>
          <Text style={styles.addressText}>{siteAddress}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.addAddressBanner} onPress={openEditModal} activeOpacity={0.7}>
          <Text style={styles.addAddressText}>+ Add address</Text>
        </TouchableOpacity>
      )}

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
          data={sortedJobs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            sortedJobs.length === 0 ? styles.emptyContainer : styles.listContent
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

      {/* Create job modal */}
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

      {/* Edit job site modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Site Information</Text>

            {editError && (
              <Text style={styles.inlineError}>{editError}</Text>
            )}

            <Text style={styles.fieldLabel}>Site Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Site name"
              autoFocus
            />

            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={[styles.modalInput, styles.addressInput]}
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder="Street address, city, state, zip"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Default Hourly Rate</Text>
            <TextInput
              style={styles.modalInput}
              value={editHourlyRate}
              onChangeText={setEditHourlyRate}
              placeholder="e.g. 75.00"
              keyboardType="decimal-pad"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  updateSite.isPending && styles.buttonDisabled,
                ]}
                onPress={handleSaveEdit}
                disabled={updateSite.isPending}
              >
                {updateSite.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save</Text>
                )}
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
  listContent: { padding: 16, paddingTop: 8, gap: 10 },
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
  addressBanner: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  addAddressBanner: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  addAddressText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "500",
  },
  headerEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerEditText: {
    fontSize: 15,
    color: "#2563eb",
    fontWeight: "600",
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
  invoiceStatusText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
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
  addressInput: {
    minHeight: 72,
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
