import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  StyleSheet,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useJob, useUpdateJob, useSetJobEmployees } from "../../api/hooks/useJobs";
import { useBusinessInfoUsers } from "../../api/hooks/useBusinessInfo";
import {
  useClockStatus,
  useClockIn,
  useClockOut,
  useAddManualTime,
  useTimeEntries,
  useDeleteTimeEntry,
} from "../../../utilities/time_tracking/hooks/useTimeEntries";
import type { Job } from "../../api/types";
import { useEnabledUtilityManifests, useIsUtilityEnabled } from "../../../utilities";

// Conditionally import DateTimePicker only on native
let DateTimePicker: any = null;
if (Platform.OS !== "web") {
  DateTimePicker = require("@react-native-community/datetimepicker").default;
}

type Props = NativeStackScreenProps<RootStackParamList, "JobDetail">;

type TabKey = string;

// TABS are now dynamically built from enabled utilities in the component

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
  const enabledUtilities = useEnabledUtilityManifests();
  const timeTrackingEnabled = useIsUtilityEnabled("time_tracking");
  const TABS = enabledUtilities.flatMap((u) =>
    u.jobDetailTabs.map((tab) => ({ key: tab.key, label: tab.label, component: tab.component }))
  );
  const [activeTab, setActiveTab] = useState<TabKey>(TABS[0]?.key ?? "");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [showJobInfoModal, setShowJobInfoModal] = useState(false);
  const [jobInfoRate, setJobInfoRate] = useState("");
  const [jobInfoError, setJobInfoError] = useState<string | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [showManualTimeModal, setShowManualTimeModal] = useState(false);
  const [manualHours, setManualHours] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualWorkedAt, setManualWorkedAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const { data: job, isLoading, isError } = useJob(jobId);
  const updateJob = useUpdateJob();
  const setJobEmployees = useSetJobEmployees();
  const { data: approvedUsers } = useBusinessInfoUsers();
  const { data: clockStatus } = useClockStatus(jobId);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const addManualTime = useAddManualTime();
  const { data: timeEntries } = useTimeEntries(jobId);
  const deleteTimeEntry = useDeleteTimeEntry();

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
    setSelectedEmployeeIds(job?.employees?.map((e) => e.id) ?? []);
    setJobInfoError(null);
    setShowJobInfoModal(true);
  }

  function handleSaveJobInfo() {
    setJobInfoError(null);
    const ratePayload = jobInfoRate.trim() || null;
    const currentEmployeeIds = job?.employees?.map((e) => e.id) ?? [];
    const employeesChanged =
      JSON.stringify([...selectedEmployeeIds].sort()) !==
      JSON.stringify([...currentEmployeeIds].sort());

    // Save hourly rate
    updateJob.mutate(
      { jobId, default_hourly_rate: ratePayload },
      {
        onSuccess: () => {
          // Save employees if changed
          if (employeesChanged) {
            setJobEmployees.mutate(
              { jobId, employeeIds: selectedEmployeeIds },
              {
                onSuccess: () => setShowJobInfoModal(false),
                onError: () =>
                  setJobInfoError("Failed to update employees. Please try again."),
              }
            );
          } else {
            setShowJobInfoModal(false);
          }
        },
        onError: () =>
          setJobInfoError("Failed to update job info. Please try again."),
      }
    );
  }

  function toggleEmployee(userId: string) {
    setSelectedEmployeeIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  function handleClockIn() {
    clockIn.mutate({ jobId });
  }

  function handleClockOut() {
    clockOut.mutate({ jobId });
  }

  function openManualTimeModal() {
    setManualHours("");
    setManualNote("");
    setManualWorkedAt(new Date());
    setShowDatePicker(false);
    setShowTimePicker(false);
    setManualError(null);
    setShowManualTimeModal(true);
  }

  function handleAddManualTime() {
    const trimmed = manualHours.trim();
    if (!trimmed || isNaN(Number(trimmed)) || Number(trimmed) <= 0) {
      setManualError("Enter a valid number of hours.");
      return;
    }

    addManualTime.mutate(
      {
        jobId,
        hours: trimmed,
        note: manualNote.trim() || undefined,
        worked_at: manualWorkedAt.toISOString(),
      },
      {
        onSuccess: () => setShowManualTimeModal(false),
        onError: () => setManualError("Failed to add time entry."),
      }
    );
  }

  function onDateChange(_event: any, selectedDate?: Date) {
    if (Platform.OS !== "web") setShowDatePicker(false);
    if (selectedDate) {
      const updated = new Date(manualWorkedAt);
      updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setManualWorkedAt(updated);
    }
  }

  function onTimeChange(_event: any, selectedTime?: Date) {
    if (Platform.OS !== "web") setShowTimePicker(false);
    if (selectedTime) {
      const updated = new Date(manualWorkedAt);
      updated.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      setManualWorkedAt(updated);
    }
  }

  function formatDateShort(date: Date) {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatTimeShort(date: Date) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function handleDeleteTimeEntry(entryId: string) {
    deleteTimeEntry.mutate({ entryId, jobId });
  }

  /** Group time entries by user and sum hours */
  function getHoursByUser() {
    if (!timeEntries) return [];
    const map: Record<string, { userId: string; name: string; email: string; totalHours: number; entries: typeof timeEntries }> = {};
    for (const entry of timeEntries) {
      if (!map[entry.user_id]) {
        map[entry.user_id] = {
          userId: entry.user_id,
          name: entry.user_name || "",
          email: entry.user_email || "",
          totalHours: 0,
          entries: [],
        };
      }
      map[entry.user_id].totalHours += entry.hours ? parseFloat(entry.hours) : 0;
      map[entry.user_id].entries.push(entry);
    }
    return Object.values(map);
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

        {/* Invoice status counts */}
        {(() => {
          const c = job.invoice_status_counts;
          if (!c) return null;
          const total = c.drafting + c.waiting_to_send + c.sent_awaiting_payment + c.paid;
          if (total === 0) return null;
          const parts: string[] = [];
          if (c.drafting > 0) parts.push(`${c.drafting} drafting`);
          if (c.waiting_to_send > 0) parts.push(`${c.waiting_to_send} waiting to send`);
          if (c.sent_awaiting_payment > 0) parts.push(`${c.sent_awaiting_payment} sent`);
          if (c.paid > 0) parts.push(`${c.paid} paid`);
          return (
            <Text style={styles.invoiceStatusSummary}>
              Invoices: {parts.join(", ")}
            </Text>
          );
        })()}

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

        {/* Clock In/Out */}
        {timeTrackingEnabled && (
        <>
        <Text style={styles.sectionLabel}>Time Tracking</Text>
        <View style={styles.clockRow}>
          {clockStatus?.clocked_in ? (
            <TouchableOpacity
              style={[styles.clockBtn, styles.clockOutBtn, clockOut.isPending && styles.btnDisabled]}
              onPress={handleClockOut}
              disabled={clockOut.isPending}
            >
              {clockOut.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.clockOutBtnText}>⏹ Clock Out</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.clockBtn, styles.clockInBtn, clockIn.isPending && styles.btnDisabled]}
              onPress={handleClockIn}
              disabled={clockIn.isPending}
            >
              {clockIn.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.clockInBtnText}>▶ Clock In</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.manualTimeBtn} onPress={openManualTimeModal}>
            <Text style={styles.manualTimeBtnText}>+ Add Hours</Text>
          </TouchableOpacity>
        </View>
        {clockStatus?.clocked_in && clockStatus.entry?.clock_in && (
          <Text style={styles.clockedSince}>
            Clocked in since {formatDate(clockStatus.entry.clock_in)}
          </Text>
        )}
        </>
        )}

        {/* Job Info button */}
        <TouchableOpacity style={styles.jobInfoBtn} onPress={openJobInfoModal}>
          <Text style={styles.jobInfoBtnText}>⚙️ Job Information</Text>
          <View style={styles.jobInfoMeta}>
            {job.employees && job.employees.length > 0 && (
              <Text style={styles.jobInfoEmployees}>
                {job.employees.length} employee{job.employees.length !== 1 ? "s" : ""}
              </Text>
            )}
            {job.default_hourly_rate && (
              <Text style={styles.jobInfoRate}>${job.default_hourly_rate}/hr</Text>
            )}
          </View>
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
        {activeTab && TABS.map((tab) => {
          if (tab.key !== activeTab) return null;
          const TabComponent = tab.component;
          return <TabComponent key={tab.key} jobId={jobId} />;
        })}
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
            <ScrollView style={styles.jobInfoScroll} keyboardShouldPersistTaps="handled">
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

              <Text style={styles.jobInfoLabel}>Assigned Employees</Text>
              <Text style={styles.jobInfoHint}>
                Select employees responsible for working this job.
              </Text>
              {approvedUsers && approvedUsers.length > 0 ? (
                <View style={styles.employeeList}>
                  {approvedUsers.map((user) => {
                    const isSelected = selectedEmployeeIds.includes(user.id);
                    return (
                      <TouchableOpacity
                        key={user.id}
                        style={[
                          styles.employeeRow,
                          isSelected && styles.employeeRowSelected,
                        ]}
                        onPress={() => toggleEmployee(user.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <View style={styles.employeeInfo}>
                          <Text style={styles.employeeName}>
                            {user.name || user.email}
                          </Text>
                          {user.name && (
                            <Text style={styles.employeeEmail}>{user.email}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.noEmployeesText}>No approved users available.</Text>
              )}

              {/* Time tracking summary */}
              {timeTrackingEnabled && (
              <>
              <Text style={[styles.jobInfoLabel, { marginTop: 16 }]}>Hours Tracked</Text>
              {(() => {
                const hoursByUser = getHoursByUser();
                if (hoursByUser.length === 0) {
                  return <Text style={styles.noEmployeesText}>No hours tracked yet.</Text>;
                }
                return (
                  <View style={styles.employeeList}>
                    {hoursByUser.map((u) => (
                      <View key={u.userId} style={styles.hoursUserRow}>
                        <View style={styles.hoursUserHeader}>
                          <Text style={styles.employeeName}>{u.name || u.email}</Text>
                          <Text style={styles.hoursBadge}>{u.totalHours.toFixed(2)} hrs</Text>
                        </View>
                        {u.entries.map((entry) => (
                          <View key={entry.id} style={styles.hoursEntryRow}>
                            <View style={styles.hoursEntryInfo}>
                              {entry.clock_in ? (
                                <Text style={styles.hoursEntryText}>
                                  {formatDate(entry.clock_in)}
                                  {entry.clock_out ? ` → ${formatDate(entry.clock_out)}` : " (active)"}
                                </Text>
                              ) : (
                                <Text style={styles.hoursEntryText}>
                                  {entry.worked_at ? formatDate(entry.worked_at) : formatDate(entry.created_at)} (manual)
                                </Text>
                              )}
                              <Text style={styles.hoursEntryHours}>
                                {entry.hours ? `${parseFloat(entry.hours).toFixed(2)} hrs` : "—"}
                              </Text>
                              {entry.note && (
                                <Text style={styles.hoursEntryNote}>{entry.note}</Text>
                              )}
                            </View>
                            <TouchableOpacity
                              onPress={() => handleDeleteTimeEntry(entry.id)}
                              style={styles.deleteEntryBtn}
                              accessibilityLabel="Delete time entry"
                            >
                              <Text style={styles.deleteEntryText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })()}
              </>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowJobInfoModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.clearBtn, (updateJob.isPending || setJobEmployees.isPending) && styles.btnDisabled]}
                onPress={handleSaveJobInfo}
                disabled={updateJob.isPending || setJobEmployees.isPending}
              >
                {(updateJob.isPending || setJobEmployees.isPending)
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.clearBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual time entry modal */}
      <Modal visible={showManualTimeModal} transparent animationType="fade" onRequestClose={() => setShowManualTimeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Hours</Text>
            {manualError && <Text style={styles.renameError}>{manualError}</Text>}
            <Text style={styles.jobInfoLabel}>Hours Worked</Text>
            <TextInput
              style={styles.renameInput}
              value={manualHours}
              onChangeText={(t) => { setManualHours(t); setManualError(null); }}
              placeholder="e.g. 2.5"
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.jobInfoLabel}>Date Worked</Text>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={`${manualWorkedAt.getFullYear()}-${String(manualWorkedAt.getMonth() + 1).padStart(2, "0")}-${String(manualWorkedAt.getDate()).padStart(2, "0")}`}
                onChange={(e: any) => {
                  const val = e.target.value;
                  if (val) {
                    const [y, m, d] = val.split("-").map(Number);
                    const updated = new Date(manualWorkedAt);
                    updated.setFullYear(y, m - 1, d);
                    setManualWorkedAt(updated);
                  }
                }}
                style={{ fontSize: 16, padding: 10, borderRadius: 8, border: "1px solid #d1d5db", width: "100%", marginBottom: 12, boxSizing: "border-box" } as any}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.pickerBtnText}>{formatDateShort(manualWorkedAt)}</Text>
                </TouchableOpacity>
                {showDatePicker && DateTimePicker && (
                  <DateTimePicker
                    value={manualWorkedAt}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                  />
                )}
              </>
            )}
            <Text style={[styles.jobInfoLabel, { marginTop: 12 }]}>Time</Text>
            {Platform.OS === "web" ? (
              <input
                type="time"
                value={`${String(manualWorkedAt.getHours()).padStart(2, "0")}:${String(manualWorkedAt.getMinutes()).padStart(2, "0")}`}
                onChange={(e: any) => {
                  const val = e.target.value;
                  if (val) {
                    const [h, m] = val.split(":").map(Number);
                    const updated = new Date(manualWorkedAt);
                    updated.setHours(h, m, 0, 0);
                    setManualWorkedAt(updated);
                  }
                }}
                style={{ fontSize: 16, padding: 10, borderRadius: 8, border: "1px solid #d1d5db", width: "100%", marginBottom: 12, boxSizing: "border-box" } as any}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={styles.pickerBtnText}>{formatTimeShort(manualWorkedAt)}</Text>
                </TouchableOpacity>
                {showTimePicker && DateTimePicker && (
                  <DateTimePicker
                    value={manualWorkedAt}
                    mode="time"
                    display="default"
                    onChange={onTimeChange}
                  />
                )}
              </>
            )}
            <Text style={[styles.jobInfoLabel, { marginTop: 12 }]}>Note (optional)</Text>
            <TextInput
              style={[styles.renameInput, { height: 60, textAlignVertical: "top" }]}
              value={manualNote}
              onChangeText={setManualNote}
              placeholder="What did you work on?"
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowManualTimeModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.clearBtn, addManualTime.isPending && styles.btnDisabled]}
                onPress={handleAddManualTime}
                disabled={addManualTime.isPending}
              >
                {addManualTime.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.clearBtnText}>Add</Text>}
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
  invoiceStatusSummary: {
    fontSize: 13,
    color: "#6b7280",
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
  jobInfoMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  jobInfoRate: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "600",
  },
  jobInfoEmployees: {
    fontSize: 12,
    color: "#6b7280",
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
  jobInfoScroll: {
    maxHeight: 400,
    marginBottom: 16,
  },
  employeeList: {
    gap: 6,
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  employeeRowSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxChecked: {
    borderColor: "#2563eb",
    backgroundColor: "#2563eb",
  },
  checkmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 14,
    color: "#1a1a1a",
    fontWeight: "500",
  },
  employeeEmail: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 1,
  },
  noEmployeesText: {
    fontSize: 13,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  clockRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  clockBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 110,
    alignItems: "center",
  },
  clockInBtn: {
    backgroundColor: "#10b981",
  },
  clockOutBtn: {
    backgroundColor: "#ef4444",
  },
  clockInBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  clockOutBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  manualTimeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  manualTimeBtnText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "600",
  },
  clockedSince: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 8,
  },
  hoursUserRow: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#f9fafb",
  },
  hoursUserHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  hoursBadge: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  hoursEntryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
    paddingLeft: 4,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  hoursEntryInfo: {
    flex: 1,
  },
  hoursEntryText: {
    fontSize: 12,
    color: "#6b7280",
  },
  hoursEntryHours: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  hoursEntryNote: {
    fontSize: 11,
    color: "#9ca3af",
    fontStyle: "italic",
    marginTop: 2,
  },
  deleteEntryBtn: {
    padding: 4,
    marginLeft: 6,
  },
  deleteEntryText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  pickerBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f9fafb",
    marginBottom: 4,
  },
  pickerBtnText: {
    fontSize: 15,
    color: "#1a1a1a",
  },
});
