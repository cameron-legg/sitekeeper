import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  StyleSheet,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useJob, useUpdateJob } from "../../api/hooks/useJobs";
import type { Job } from "../../api/types";
import NotesTab from "../../components/NotesTab";
import ContactsTab from "../../components/ContactsTab";
import EstimatesTab from "../../components/EstimatesTab";
import InvoicesTab from "../../components/InvoicesTab";

type Props = NativeStackScreenProps<RootStackParamList, "JobDetail">;

type TabKey = "notes" | "contacts" | "estimates" | "invoices";

const TABS: { key: TabKey; label: string }[] = [
  { key: "notes", label: "Notes" },
  { key: "contacts", label: "Contacts" },
  { key: "estimates", label: "Estimates" },
  { key: "invoices", label: "Invoices" },
];

const STATUS_OPTIONS: Job["status"][] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];

const STATUS_LABELS: Record<Job["status"], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<Job["status"], string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  completed: "#10b981",
  cancelled: "#6b7280",
};

export default function JobDetailScreen({ route, navigation }: Props) {
  const { jobId, jobName } = route.params;
  const [activeTab, setActiveTab] = useState<TabKey>("notes");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [showJobInfoModal, setShowJobInfoModal] = useState(false);
  const [jobInfoRate, setJobInfoRate] = useState("");
  const [jobInfoError, setJobInfoError] = useState<string | null>(null);

  const { data: job, isLoading, isError } = useJob(jobId);
  const updateJob = useUpdateJob();

  const displayName = job?.name ?? jobName;

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: displayName });
  }, [navigation, displayName]);

  function openRenameModal() {
    setRenameValue(job?.name ?? jobName);
    setRenameError(null);
    setShowRenameModal(true);
  }

  function handleRename() {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError("Name cannot be empty.");
      return;
    }
    updateJob.mutate(
      { jobId, name: trimmed },
      {
        onSuccess: () => setShowRenameModal(false),
        onError: () => setRenameError("Failed to rename job. Please try again."),
      }
    );
  }

  function handleStatusChange(status: Job["status"]) {
    updateJob.mutate({ jobId, status });
  }

  function handleSetFinishedNow() {
    const now = new Date().toISOString();
    updateJob.mutate({ jobId, finished_at: now });
  }

  function handleClearFinished() {
    setShowClearConfirm(true);
  }

  function openJobInfoModal() {
    setJobInfoRate(job?.default_hourly_rate ?? "");
    setJobInfoError(null);
    setShowJobInfoModal(true);
  }

  function handleSaveJobInfo() {
    setJobInfoError(null);
    updateJob.mutate(
      { jobId, default_hourly_rate: jobInfoRate.trim() || null },
      {
        onSuccess: () => setShowJobInfoModal(false),
        onError: () => setJobInfoError("Failed to update job info. Please try again."),
      }
    );
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (isError || !job) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load job.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {/* Job header section */}
      <View style={styles.jobHeader}>
        <TouchableOpacity style={styles.jobNameRow} onPress={openRenameModal} accessibilityRole="button" accessibilityLabel="Rename job">
          <Text style={styles.jobName}>{job.name}</Text>
          <Text style={styles.editIcon}>✎</Text>
        </TouchableOpacity>

        {/* Status picker */}
        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.statusChip,
                job.status === s && {
                  backgroundColor: STATUS_COLORS[s] + "22",
                  borderColor: STATUS_COLORS[s],
                },
              ]}
              onPress={() => handleStatusChange(s)}
            >
              <Text
                style={[
                  styles.statusChipText,
                  job.status === s && { color: STATUS_COLORS[s], fontWeight: "700" },
                ]}
              >
                {STATUS_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Finished at */}
        <Text style={styles.sectionLabel}>Finished</Text>
        <View style={styles.finishedRow}>
          {job.finished_at ? (
            <>
              <Text style={styles.finishedDate}>
                {formatDate(job.finished_at)}
              </Text>
              <TouchableOpacity
                style={styles.finishedBtn}
                onPress={handleClearFinished}
              >
                <Text style={styles.finishedBtnText}>Clear</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.finishedNone}>Not set</Text>
              <TouchableOpacity
                style={styles.finishedBtn}
                onPress={handleSetFinishedNow}
              >
                <Text style={styles.finishedBtnText}>Set to now</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Job Info button */}
        <TouchableOpacity style={styles.jobInfoBtn} onPress={openJobInfoModal}>
          <Text style={styles.jobInfoBtnText}>⚙️ Job Information</Text>
          {job.default_hourly_rate && (
            <Text style={styles.jobInfoRate}>${job.default_hourly_rate}/hr</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={styles.tabContent}>
        {activeTab === "notes" && <NotesTab jobId={jobId} />}
        {activeTab === "contacts" && <ContactsTab jobId={jobId} />}
        {activeTab === "estimates" && <EstimatesTab jobId={jobId} />}
        {activeTab === "invoices" && <InvoicesTab jobId={jobId} />}
      </View>

      {/* Clear finished date confirmation */}
      <Modal visible={showClearConfirm} transparent animationType="fade" onRequestClose={() => setShowClearConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Clear Finished Date</Text>
            <Text style={styles.modalBody}>Remove the finished date from this job?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowClearConfirm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.clearBtn, updateJob.isPending && styles.btnDisabled]}
                onPress={() => {
                  updateJob.mutate({ jobId, finished_at: null }, {
                    onSuccess: () => setShowClearConfirm(false),
                    onError: () => setShowClearConfirm(false),
                  });
                }}
                disabled={updateJob.isPending}
              >
                {updateJob.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.clearBtnText}>Clear</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename job modal */}
      <Modal visible={showRenameModal} transparent animationType="fade" onRequestClose={() => setShowRenameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename Job</Text>
            <TextInput
              style={styles.renameInput}
              value={renameValue}
              onChangeText={(t) => { setRenameValue(t); setRenameError(null); }}
              placeholder="Job name"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRename}
            />
            {renameError && <Text style={styles.renameError}>{renameError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRenameModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.clearBtn, updateJob.isPending && styles.btnDisabled]}
                onPress={handleRename}
                disabled={updateJob.isPending}
              >
                {updateJob.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.clearBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Job Information modal */}
      <Modal visible={showJobInfoModal} transparent animationType="fade" onRequestClose={() => setShowJobInfoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Job Information</Text>
            {jobInfoError && <Text style={styles.renameError}>{jobInfoError}</Text>}
            <Text style={styles.jobInfoLabel}>Default Hourly Rate</Text>
            <TextInput
              style={styles.renameInput}
              value={jobInfoRate}
              onChangeText={setJobInfoRate}
              placeholder="e.g. 75.00"
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.jobInfoHint}>
              New line items on estimates/invoices for this job will use this rate.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowJobInfoModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.clearBtn, updateJob.isPending && styles.btnDisabled]}
                onPress={handleSaveJobInfo}
                disabled={updateJob.isPending}
              >
                {updateJob.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.clearBtnText}>Save</Text>}
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#dc2626", fontSize: 15 },
  jobHeader: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  jobName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 14,
    flex: 1,
  },
  jobNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  editIcon: {
    fontSize: 18,
    color: "#9ca3af",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  statusChipText: {
    fontSize: 13,
    color: "#6b7280",
  },
  finishedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  finishedDate: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  finishedNone: {
    fontSize: 14,
    color: "#9ca3af",
    flex: 1,
  },
  finishedBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#eff6ff",
  },
  finishedBtnText: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "500",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#2563eb",
  },
  tabText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#2563eb",
    fontWeight: "700",
  },
  tabContent: {
    flex: 1,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  modalBody: { fontSize: 14, color: "#374151", marginBottom: 20, lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  cancelText: { fontSize: 14, color: "#374151" },
  clearBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#2563eb", minWidth: 72, alignItems: "center" },
  clearBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
  renameInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1a1a1a",
    marginBottom: 12,
  },
  renameError: {
    color: "#dc2626",
    fontSize: 13,
    marginBottom: 12,
  },
  jobInfoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  jobInfoBtnText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  jobInfoRate: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "600",
  },
  jobInfoLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  jobInfoHint: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
    marginBottom: 12,
  },
});
