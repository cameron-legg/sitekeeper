import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Alert,
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

  const { data: job, isLoading, isError } = useJob(jobId);
  const updateJob = useUpdateJob();

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: jobName });
  }, [navigation, jobName]);

  function handleStatusChange(status: Job["status"]) {
    updateJob.mutate({ jobId, status });
  }

  function handleSetFinishedNow() {
    const now = new Date().toISOString();
    updateJob.mutate({ jobId, finished_at: now });
  }

  function handleClearFinished() {
    Alert.alert(
      "Clear Finished Date",
      "Remove the finished date from this job?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          onPress: () => updateJob.mutate({ jobId, finished_at: null }),
        },
      ]
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
        <Text style={styles.jobName}>{job.name}</Text>

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
});
