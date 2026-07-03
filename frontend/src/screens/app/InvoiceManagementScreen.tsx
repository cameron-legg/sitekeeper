import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  ScrollView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useAllInvoices, useUpdateInvoice } from "../../api/hooks/useInvoices";
import type { InvoiceWithContext, InvoiceStatus } from "../../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "InvoiceManagement">;

type FilterStatus = "all" | InvoiceStatus;

type TimePeriod = "ytd" | "past_year" | "mtd" | "past_30" | "wtd" | "past_7" | "all_time";

const STATUS_OPTIONS: { value: InvoiceStatus; label: string; shortLabel: string; color: string; bg: string }[] = [
  { value: "drafting", label: "Drafting", shortLabel: "Drafting", color: "#6b7280", bg: "#f3f4f6" },
  { value: "waiting_to_send", label: "Waiting to be Sent", shortLabel: "Waiting", color: "#d97706", bg: "#fef3c7" },
  { value: "sent_awaiting_payment", label: "Sent & Awaiting Payment", shortLabel: "Sent", color: "#2563eb", bg: "#dbeafe" },
  { value: "paid", label: "Paid", shortLabel: "Paid", color: "#065f46", bg: "#d1fae5" },
];

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: "wtd", label: "Week to Date" },
  { value: "past_7", label: "Past 7 Days" },
  { value: "mtd", label: "Month to Date" },
  { value: "past_30", label: "Past 30 Days" },
  { value: "ytd", label: "Year to Date" },
  { value: "past_year", label: "Past Year" },
  { value: "all_time", label: "All Time" },
];

function getStatusDisplay(status: InvoiceStatus) {
  return STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

function getStartDate(period: TimePeriod): Date | null {
  const now = new Date();
  switch (period) {
    case "wtd": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "past_7": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "mtd": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return d;
    }
    case "past_30": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "ytd": {
      return new Date(now.getFullYear(), 0, 1);
    }
    case "past_year": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "all_time":
      return null;
  }
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor(ms / 60000);
  return `${mins}m`;
}

function formatMoney(amount: number): string {
  return "$" + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvoiceManagementScreen({ navigation }: Props) {
  const { data: invoices, isLoading, isError } = useAllInvoices();
  const updateInvoice = useUpdateInvoice();

  const [filter, setFilter] = useState<FilterStatus>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithContext | null>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [statusTarget, setStatusTarget] = useState<InvoiceWithContext | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryPeriod, setSummaryPeriod] = useState<TimePeriod>("mtd");

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    if (filter === "all") return invoices;
    return invoices.filter((inv) => inv.status === filter);
  }, [invoices, filter]);

  // Summary counts
  const counts = useMemo(() => {
    if (!invoices) return { drafting: 0, waiting_to_send: 0, sent_awaiting_payment: 0, paid: 0, total: 0 };
    const c = { drafting: 0, waiting_to_send: 0, sent_awaiting_payment: 0, paid: 0, total: invoices.length };
    for (const inv of invoices) {
      if (inv.status in c) (c as any)[inv.status]++;
    }
    return c;
  }, [invoices]);

  // Summary report metrics
  const summaryMetrics = useMemo(() => {
    if (!invoices) return null;
    const startDate = getStartDate(summaryPeriod);

    // Filter invoices by creation date within the period
    const periodInvoices = startDate
      ? invoices.filter((inv) => new Date(inv.created_at) >= startDate)
      : invoices;

    // Dollar amounts by status
    const byStatus = { drafting: 0, waiting_to_send: 0, sent_awaiting_payment: 0, paid: 0 };
    const countByStatus = { drafting: 0, waiting_to_send: 0, sent_awaiting_payment: 0, paid: 0 };
    // Per-status revenue breakdown
    const materialsByStatus = { drafting: 0, waiting_to_send: 0, sent_awaiting_payment: 0, paid: 0 };
    const taxByStatus = { drafting: 0, waiting_to_send: 0, sent_awaiting_payment: 0, paid: 0 };
    const laborByStatus = { drafting: 0, waiting_to_send: 0, sent_awaiting_payment: 0, paid: 0 };
    const feesByStatus = { drafting: 0, waiting_to_send: 0, sent_awaiting_payment: 0, paid: 0 };
    let totalAmount = 0;
    let totalMaterials = 0;
    let totalTax = 0;
    let totalLabor = 0;
    let totalFees = 0;

    for (const inv of periodInvoices) {
      const amount = parseFloat(inv.total || "0");
      const materials = parseFloat(inv.materials_cost || "0");
      const tax = parseFloat(inv.tax_amount || "0");
      const labor = parseFloat(inv.labor_cost || "0");
      const fees = parseFloat(inv.fee_cost || "0");
      totalAmount += amount;
      totalMaterials += materials;
      totalTax += tax;
      totalLabor += labor;
      totalFees += fees;
      if (inv.status in byStatus) {
        (byStatus as any)[inv.status] += amount;
        (countByStatus as any)[inv.status]++;
        (materialsByStatus as any)[inv.status] += materials;
        (taxByStatus as any)[inv.status] += tax;
        (laborByStatus as any)[inv.status] += labor;
        (feesByStatus as any)[inv.status] += fees;
      }
    }

    // Average time in each status (from status history)
    // Calculate time spent in each status by looking at consecutive history entries
    const statusDurations: Record<InvoiceStatus, number[]> = {
      drafting: [],
      waiting_to_send: [],
      sent_awaiting_payment: [],
      paid: [],
    };

    for (const inv of periodInvoices) {
      const history = inv.status_history || [];
      if (history.length === 0) continue;
      for (let i = 0; i < history.length; i++) {
        const entry = history[i];
        const nextEntry = history[i + 1];
        const start = new Date(entry.changed_at).getTime();
        const end = nextEntry ? new Date(nextEntry.changed_at).getTime() : Date.now();
        const duration = end - start;
        if (entry.status in statusDurations) {
          statusDurations[entry.status].push(duration);
        }
      }
    }

    const avgDurations: Record<InvoiceStatus, number | null> = {
      drafting: null,
      waiting_to_send: null,
      sent_awaiting_payment: null,
      paid: null,
    };
    for (const s of Object.keys(statusDurations) as InvoiceStatus[]) {
      const durations = statusDurations[s];
      if (durations.length > 0) {
        avgDurations[s] = durations.reduce((a, b) => a + b, 0) / durations.length;
      }
    }

    // Average time from creation to paid
    const paidInvoices = periodInvoices.filter((inv) => inv.status === "paid");
    let avgTimeToPaid: number | null = null;
    if (paidInvoices.length > 0) {
      const times = paidInvoices
        .filter((inv) => inv.status_changed_at)
        .map((inv) => new Date(inv.status_changed_at!).getTime() - new Date(inv.created_at).getTime());
      if (times.length > 0) {
        avgTimeToPaid = times.reduce((a, b) => a + b, 0) / times.length;
      }
    }

    // Outstanding amount (sent + waiting)
    const outstandingAmount = byStatus.sent_awaiting_payment + byStatus.waiting_to_send;

    // Revenue breakdown: materials + tax is pass-through cost, labor + fees is profit
    const materialsPlusTax = totalMaterials + totalTax;
    const laborAndFees = totalLabor + totalFees;

    return {
      periodInvoiceCount: periodInvoices.length,
      totalAmount,
      byStatus,
      countByStatus,
      avgDurations,
      avgTimeToPaid,
      outstandingAmount,
      collectedAmount: byStatus.paid,
      totalMaterials,
      totalTax,
      materialsPlusTax,
      totalLabor,
      totalFees,
      laborAndFees,
      materialsByStatus,
      taxByStatus,
      laborByStatus,
      feesByStatus,
    };
  }, [invoices, summaryPeriod]);

  function openDetail(invoice: InvoiceWithContext) {
    setSelectedInvoice(invoice);
  }

  function openStatusPicker(invoice: InvoiceWithContext) {
    setStatusTarget(invoice);
    setShowStatusPicker(true);
  }

  function handleStatusChange(newStatus: InvoiceStatus) {
    if (statusTarget) {
      updateInvoice.mutate({ invoiceId: statusTarget.id, status: newStatus });
    }
    setShowStatusPicker(false);
    setStatusTarget(null);
  }

  function navigateToJob(invoice: InvoiceWithContext) {
    setSelectedInvoice(null);
    navigation.navigate("JobDetail", {
      jobId: invoice.job_id,
      jobName: invoice.job_name || "Job",
      siteId: invoice.job_site_id || "",
    });
  }

  // Keep selectedInvoice in sync
  React.useEffect(() => {
    if (selectedInvoice && invoices) {
      const fresh = invoices.find((i) => i.id === selectedInvoice.id);
      if (fresh) setSelectedInvoice(fresh);
    }
  }, [invoices]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load invoices.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <TouchableOpacity
          style={[styles.summaryCard, filter === "all" && styles.summaryCardActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[styles.summaryCount, filter === "all" && styles.summaryCountActive]}>{counts.total}</Text>
          <Text style={[styles.summaryLabel, filter === "all" && styles.summaryLabelActive]}>All</Text>
        </TouchableOpacity>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.summaryCard, filter === opt.value && { backgroundColor: opt.bg, borderColor: opt.color }]}
            onPress={() => setFilter(opt.value)}
          >
            <Text style={[styles.summaryCount, filter === opt.value && { color: opt.color }]}>
              {(counts as any)[opt.value]}
            </Text>
            <Text style={[styles.summaryLabel, filter === opt.value && { color: opt.color }]}>
              {opt.shortLabel}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary button */}
      <TouchableOpacity style={styles.summaryBtn} onPress={() => setShowSummary(true)}>
        <Text style={styles.summaryBtnText}>📊  Summary</Text>
      </TouchableOpacity>

      {/* Invoice list */}
      <FlatList
        data={filteredInvoices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={filteredInvoices.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No invoices</Text>
            <Text style={styles.emptySubtitle}>
              {filter === "all" ? "No invoices have been created yet." : "No invoices with this status."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const si = getStatusDisplay(item.status);
          return (
            <TouchableOpacity style={styles.card} onPress={() => openDetail(item)} activeOpacity={0.7}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardContext} numberOfLines={1}>
                    {item.job_site_name} › {item.job_name}
                  </Text>
                </View>
                <Text style={styles.cardTotal}>{formatMoney(parseFloat(item.total || "0"))}</Text>
              </View>
              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={[styles.statusBadge, { backgroundColor: si.bg }]}
                  onPress={() => openStatusPicker(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusDot, { backgroundColor: si.color }]} />
                  <Text style={[styles.statusBadgeText, { color: si.color }]}>{si.label}</Text>
                </TouchableOpacity>
                {item.status_changed_at && (
                  <Text style={styles.cardTimeAgo}>{timeAgo(item.status_changed_at)}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Summary modal ── */}
      <Modal visible={showSummary} transparent animationType="slide" onRequestClose={() => setShowSummary(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowSummary(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetTitle}>Invoice Summary</Text>

            {/* Period selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll} contentContainerStyle={styles.periodScrollContent}>
              {TIME_PERIODS.map((tp) => (
                <TouchableOpacity
                  key={tp.value}
                  style={[styles.periodChip, summaryPeriod === tp.value && styles.periodChipActive]}
                  onPress={() => setSummaryPeriod(tp.value)}
                >
                  <Text style={[styles.periodChipText, summaryPeriod === tp.value && styles.periodChipTextActive]}>
                    {tp.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {summaryMetrics && (
              <>
                {/* Overview */}
                <View style={styles.reportSection}>
                  <Text style={styles.reportSectionTitle}>Overview</Text>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Total invoices</Text>
                    <Text style={styles.reportValue}>{summaryMetrics.periodInvoiceCount}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Total value</Text>
                    <Text style={styles.reportValueBold}>{formatMoney(summaryMetrics.totalAmount)}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Collected (paid)</Text>
                    <Text style={[styles.reportValueBold, { color: "#065f46" }]}>{formatMoney(summaryMetrics.collectedAmount)}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Outstanding</Text>
                    <Text style={[styles.reportValueBold, { color: "#2563eb" }]}>{formatMoney(summaryMetrics.outstandingAmount)}</Text>
                  </View>
                </View>

                {/* Revenue Breakdown */}
                <View style={styles.reportSection}>
                  <Text style={styles.reportSectionTitle}>Revenue Breakdown</Text>
                  {/* All invoices totals */}
                  <View style={styles.breakdownGroup}>
                    <View style={styles.breakdownHeader}>
                      <Text style={styles.breakdownHeaderText}>All Invoices</Text>
                      <Text style={styles.breakdownHeaderCount}>({summaryMetrics.periodInvoiceCount})</Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Materials + tax</Text>
                      <Text style={styles.reportValue}>{formatMoney(summaryMetrics.materialsPlusTax)}</Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Labor</Text>
                      <Text style={styles.reportValue}>{formatMoney(summaryMetrics.totalLabor)}</Text>
                    </View>
                    {summaryMetrics.totalFees > 0 && (
                      <View style={styles.reportRow}>
                        <Text style={styles.reportLabel}>Fees</Text>
                        <Text style={styles.reportValue}>{formatMoney(summaryMetrics.totalFees)}</Text>
                      </View>
                    )}
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Labor & Fees (Profit)</Text>
                      <Text style={[styles.reportValue, { color: "#065f46", fontWeight: "600" }]}>{formatMoney(summaryMetrics.laborAndFees)}</Text>
                    </View>
                    <View style={[styles.reportRow, { paddingTop: 6, borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 4 }]}>
                      <Text style={[styles.reportLabel, { fontWeight: "600" }]}>Total</Text>
                      <Text style={styles.reportValueBold}>{formatMoney(summaryMetrics.totalAmount)}</Text>
                    </View>
                  </View>

                  {/* Per-status breakdowns */}
                  {STATUS_OPTIONS.map((opt) => {
                    const count = (summaryMetrics.countByStatus as any)[opt.value] || 0;
                    if (count === 0) return null;
                    const materials = (summaryMetrics.materialsByStatus as any)[opt.value] || 0;
                    const tax = (summaryMetrics.taxByStatus as any)[opt.value] || 0;
                    const labor = (summaryMetrics.laborByStatus as any)[opt.value] || 0;
                    const fees = (summaryMetrics.feesByStatus as any)[opt.value] || 0;
                    const total = (summaryMetrics.byStatus as any)[opt.value] || 0;
                    return (
                      <View key={opt.value} style={styles.breakdownGroup}>
                        <View style={styles.breakdownHeader}>
                          <View style={[styles.reportDot, { backgroundColor: opt.color }]} />
                          <Text style={[styles.breakdownHeaderText, { color: opt.color }]}>{opt.label}</Text>
                          <Text style={styles.breakdownHeaderCount}>({count})</Text>
                        </View>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Materials + tax</Text>
                          <Text style={styles.reportValue}>{formatMoney(materials + tax)}</Text>
                        </View>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Labor</Text>
                          <Text style={styles.reportValue}>{formatMoney(labor)}</Text>
                        </View>
                        {fees > 0 && (
                          <View style={styles.reportRow}>
                            <Text style={styles.reportLabel}>Fees</Text>
                            <Text style={styles.reportValue}>{formatMoney(fees)}</Text>
                          </View>
                        )}
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>Labor & Fees (Profit)</Text>
                          <Text style={[styles.reportValue, { color: "#065f46", fontWeight: "600" }]}>{formatMoney(labor + fees)}</Text>
                        </View>
                        <View style={[styles.reportRow, { paddingTop: 6, borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 4 }]}>
                          <Text style={[styles.reportLabel, { fontWeight: "600" }]}>Total</Text>
                          <Text style={[styles.reportValueBold, { color: opt.color }]}>{formatMoney(total)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Breakdown by status */}
                <View style={styles.reportSection}>
                  <Text style={styles.reportSectionTitle}>By Status</Text>
                  {STATUS_OPTIONS.map((opt) => {
                    const amount = (summaryMetrics.byStatus as any)[opt.value] || 0;
                    const count = (summaryMetrics.countByStatus as any)[opt.value] || 0;
                    return (
                      <View key={opt.value} style={styles.reportRow}>
                        <View style={styles.reportLabelRow}>
                          <View style={[styles.reportDot, { backgroundColor: opt.color }]} />
                          <Text style={styles.reportLabel}>{opt.label}</Text>
                          <Text style={styles.reportCount}>({count})</Text>
                        </View>
                        <Text style={[styles.reportValueBold, { color: opt.color }]}>{formatMoney(amount)}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Timing metrics */}
                <View style={styles.reportSection}>
                  <Text style={styles.reportSectionTitle}>Average Time in Status</Text>
                  {STATUS_OPTIONS.filter((opt) => opt.value !== "paid").map((opt) => {
                    const avg = summaryMetrics.avgDurations[opt.value];
                    return (
                      <View key={opt.value} style={styles.reportRow}>
                        <View style={styles.reportLabelRow}>
                          <View style={[styles.reportDot, { backgroundColor: opt.color }]} />
                          <Text style={styles.reportLabel}>{opt.label}</Text>
                        </View>
                        <Text style={styles.reportValue}>{avg ? formatDuration(avg) : "—"}</Text>
                      </View>
                    );
                  })}
                  <View style={[styles.reportRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb" }]}>
                    <Text style={styles.reportLabel}>Avg. time to get paid</Text>
                    <Text style={styles.reportValueBold}>
                      {summaryMetrics.avgTimeToPaid ? formatDuration(summaryMetrics.avgTimeToPaid) : "—"}
                    </Text>
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowSummary(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Invoice detail modal ── */}
      <Modal visible={!!selectedInvoice} transparent animationType="slide" onRequestClose={() => setSelectedInvoice(null)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setSelectedInvoice(null)} />
        {selectedInvoice && (
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>{selectedInvoice.title}</Text>
              <Text style={styles.sheetContext}>
                {selectedInvoice.job_site_name} › {selectedInvoice.job_name}
              </Text>

              {/* Current status */}
              <View style={styles.currentStatusRow}>
                {(() => {
                  const si = getStatusDisplay(selectedInvoice.status);
                  return (
                    <View style={[styles.statusBadgeLg, { backgroundColor: si.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: si.color }]} />
                      <Text style={[styles.statusBadgeLgText, { color: si.color }]}>{si.label}</Text>
                    </View>
                  );
                })()}
                {selectedInvoice.status_changed_at && (
                  <Text style={styles.statusSince}>
                    since {formatDateTime(selectedInvoice.status_changed_at)}
                  </Text>
                )}
              </View>

              {/* Totals */}
              <View style={styles.totalsBlock}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Materials</Text>
                  <Text style={styles.totalValue}>{formatMoney(parseFloat(selectedInvoice.materials_cost || "0"))}</Text>
                </View>
                {selectedInvoice.tax_rate && parseFloat(selectedInvoice.tax_rate) > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Tax ({selectedInvoice.tax_rate}%)</Text>
                    <Text style={styles.totalValue}>{formatMoney(parseFloat(selectedInvoice.tax_amount || "0"))}</Text>
                  </View>
                )}
                {selectedInvoice.tax_rate && parseFloat(selectedInvoice.tax_rate) > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Materials + Tax</Text>
                    <Text style={styles.totalValue}>{formatMoney(parseFloat(selectedInvoice.materials_cost || "0") + parseFloat(selectedInvoice.tax_amount || "0"))}</Text>
                  </View>
                )}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Labor ({parseFloat(selectedInvoice.labor_hours || "0").toFixed(2)}h)</Text>
                  <Text style={styles.totalValue}>{formatMoney(parseFloat(selectedInvoice.labor_cost || "0"))}</Text>
                </View>
                {parseFloat(selectedInvoice.fee_cost || "0") > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Fees</Text>
                    <Text style={styles.totalValue}>{formatMoney(parseFloat(selectedInvoice.fee_cost || "0"))}</Text>
                  </View>
                )}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Labor & Fees (Profit)</Text>
                  <Text style={[styles.totalValue, { color: "#065f46", fontWeight: "600" }]}>{formatMoney(parseFloat(selectedInvoice.labor_and_fees || "0"))}</Text>
                </View>
                <View style={[styles.totalRow, styles.grandRow]}>
                  <Text style={styles.grandLabel}>Total</Text>
                  <Text style={styles.grandValue}>{formatMoney(parseFloat(selectedInvoice.total || "0"))}</Text>
                </View>
              </View>

              {/* Status history */}
              {selectedInvoice.status_history && selectedInvoice.status_history.length > 0 && (
                <View style={styles.historySection}>
                  <Text style={styles.historySectionTitle}>Status History</Text>
                  {selectedInvoice.status_history.map((entry, idx) => {
                    const si = getStatusDisplay(entry.status);
                    const nextEntry = selectedInvoice.status_history[idx + 1];
                    const start = new Date(entry.changed_at).getTime();
                    const end = nextEntry ? new Date(nextEntry.changed_at).getTime() : Date.now();
                    const duration = end - start;
                    return (
                      <View key={idx} style={styles.historyRow}>
                        <View style={[styles.historyDot, { backgroundColor: si.color }]} />
                        <View style={styles.historyInfo}>
                          <Text style={styles.historyStatus}>{si.label}</Text>
                          <Text style={styles.historyDate}>
                            {formatDateTime(entry.changed_at)}
                            {!nextEntry ? " (current)" : ` · ${formatDuration(duration)}`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Actions */}
              <View style={styles.actionsSection}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openStatusPicker(selectedInvoice)}>
                  <Text style={styles.actionBtnText}>📋  Change Status</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigateToJob(selectedInvoice)}>
                  <Text style={styles.actionBtnText}>🔗  Open Job</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedInvoice(null)}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ── Status picker modal ── */}
      <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invoice Status</Text>
            <Text style={styles.statusPickerHint}>Select the current status:</Text>
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = statusTarget?.status === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.statusOption, isSelected && { backgroundColor: opt.bg, borderColor: opt.color }]}
                  onPress={() => handleStatusChange(opt.value)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f3f4f6" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#dc2626", fontSize: 15 },

  // Summary row
  summaryRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  summaryCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  summaryCardActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  summaryCount: { fontSize: 18, fontWeight: "700", color: "#374151" },
  summaryCountActive: { color: "#2563eb" },
  summaryLabel: { fontSize: 10, fontWeight: "600", color: "#6b7280", marginTop: 2 },
  summaryLabelActive: { color: "#2563eb" },

  // Summary button
  summaryBtn: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  summaryBtnText: { fontSize: 15, fontWeight: "600", color: "#2563eb" },

  // List
  listContent: { padding: 12, gap: 8 },
  emptyContainer: { flex: 1, padding: 16 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#9ca3af", textAlign: "center" },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  cardHeaderLeft: { flex: 1, marginRight: 10 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#1a1a1a", marginBottom: 2 },
  cardContext: { fontSize: 12, color: "#6b7280" },
  cardTotal: { fontSize: 16, fontWeight: "700", color: "#2563eb" },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTimeAgo: { fontSize: 12, color: "#9ca3af" },

  // Status badge (small, tappable)
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: "600" },

  // Bottom sheet
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 36,
    paddingTop: 12,
    maxHeight: "85%",
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: "#d1d5db",
    borderRadius: 2, alignSelf: "center", marginBottom: 16,
  },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  sheetContext: { fontSize: 14, color: "#6b7280", marginBottom: 16 },

  // Current status
  currentStatusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  statusBadgeLg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusBadgeLgText: { fontSize: 14, fontWeight: "700" },
  statusSince: { fontSize: 12, color: "#9ca3af" },

  // Totals
  totalsBlock: { backgroundColor: "#f9fafb", borderRadius: 10, padding: 14, marginBottom: 16 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalLabel: { fontSize: 14, color: "#6b7280" },
  totalValue: { fontSize: 14, color: "#374151" },
  grandRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 6, paddingTop: 6, marginBottom: 0 },
  grandLabel: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  grandValue: { fontSize: 15, fontWeight: "700", color: "#2563eb" },

  // History
  historySection: { marginBottom: 16 },
  historySectionTitle: { fontSize: 13, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  historyRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  historyInfo: { flex: 1 },
  historyStatus: { fontSize: 14, fontWeight: "600", color: "#374151" },
  historyDate: { fontSize: 12, color: "#9ca3af", marginTop: 1 },

  // Actions
  actionsSection: { backgroundColor: "#f9fafb", borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  actionBtn: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  actionBtnText: { fontSize: 15, color: "#1a1a1a" },
  closeBtn: { backgroundColor: "#f3f4f6", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
  closeBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },

  // Period selector
  periodScroll: { marginBottom: 16 },
  periodScrollContent: { gap: 8, paddingRight: 8 },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  periodChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  periodChipText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  periodChipTextActive: { color: "#fff", fontWeight: "600" },

  // Report sections
  reportSection: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  reportSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reportLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  reportDot: { width: 8, height: 8, borderRadius: 4 },
  reportLabel: { fontSize: 14, color: "#374151" },
  reportCount: { fontSize: 12, color: "#9ca3af" },
  reportValue: { fontSize: 14, color: "#374151" },
  reportValueBold: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },

  // Breakdown groups (per-status)
  breakdownGroup: {
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  breakdownHeaderText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  breakdownHeaderCount: { fontSize: 12, color: "#9ca3af" },

  // Status picker modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },
  statusPickerHint: { fontSize: 13, color: "#6b7280", marginBottom: 12 },
  statusOption: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 8,
  },
  statusOptionText: { fontSize: 15, color: "#374151", flex: 1 },
  statusCheck: { fontSize: 16, color: "#2563eb", fontWeight: "700" },
  statusPickerCancel: { marginTop: 4, paddingVertical: 12, alignItems: "center" },
  statusPickerCancelText: { fontSize: 15, color: "#6b7280", fontWeight: "500" },
});
