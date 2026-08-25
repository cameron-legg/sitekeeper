/**
 * PortalDashboardScreen — lists the user's tenants with create/delete actions.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
  Linking,
} from "react-native";
import { BRAND_COLORS } from "../../core/config/app";
import { usePortalAuthStore } from "../store/portalAuthStore";
import {
  usePortalTenants,
  useCreateTenant,
  useDeleteTenant,
  useTenantMetrics,
  type PortalTenant,
} from "../api/hooks/usePortalTenants";

// Sub-component that fetches and displays metrics for a single tenant
function TenantCard({
  tenant,
  onOpen,
  onDelete,
}: {
  tenant: PortalTenant;
  onOpen: (t: PortalTenant) => void;
  onDelete: (slug: string) => void;
}) {
  const { data: metrics } = useTenantMetrics(tenant.slug);

  return (
    <View style={styles.tenantCard}>
      <View style={styles.tenantInfo}>
        <Text style={styles.tenantName}>{tenant.name}</Text>
        <Text style={styles.tenantDomain}>{tenant.domain}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, tenant.status === "active" && styles.badgeActive]}>
            <Text style={styles.badgeText}>{tenant.status}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{tenant.plan}</Text>
          </View>
        </View>
        {metrics && (
          <View style={styles.metricsRow}>
            <Text style={styles.metricItem}>{metrics.users_count} users</Text>
            <Text style={styles.metricDot}>·</Text>
            <Text style={styles.metricItem}>{metrics.job_sites_count} sites</Text>
            <Text style={styles.metricDot}>·</Text>
            <Text style={styles.metricItem}>{metrics.jobs_count} jobs</Text>
            <Text style={styles.metricDot}>·</Text>
            <Text style={styles.metricItem}>{metrics.estimates_count} est.</Text>
            <Text style={styles.metricDot}>·</Text>
            <Text style={styles.metricItem}>{metrics.invoices_count} inv.</Text>
          </View>
        )}
      </View>
      <View style={styles.tenantActions}>
        <TouchableOpacity style={styles.openBtn} onPress={() => onOpen(tenant)}>
          <Text style={styles.openBtnText}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(tenant.slug)}>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PortalDashboardScreen() {
  const { name, email, clearAuth } = usePortalAuthStore();
  const { data: tenants, isLoading } = usePortalTenants();
  const createTenant = useCreateTenant();
  const deleteTenant = useDeleteTenant();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  function handleCreate() {
    setCreateError(null);
    createTenant.mutate(
      { slug: newSlug.trim().toLowerCase(), name: newName.trim() },
      {
        onSuccess: () => {
          setShowCreateModal(false);
          setNewSlug("");
          setNewName("");
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error?.message;
          setCreateError(msg || "Failed to create tenant.");
        },
      }
    );
  }

  function handleDelete(slug: string) {
    if (Platform.OS === "web") {
      if (!window.confirm(`Delete "${slug}"? This cannot be undone easily.`)) return;
    }
    deleteTenant.mutate(slug);
  }

  function openTenant(tenant: PortalTenant) {
    const protocol = Platform.OS === "web" ? window.location.protocol : "https:";
    const url = `${protocol}//${tenant.domain}/login`;
    if (Platform.OS === "web") {
      window.location.href = url;
    } else {
      Linking.openURL(url);
    }
  }

  function renderTenant({ item }: { item: PortalTenant }) {
    return <TenantCard tenant={item} onOpen={openTenant} onDelete={handleDelete} />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            {name || email || "Platform User"}
          </Text>
        </View>
        <TouchableOpacity onPress={clearAuth} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BRAND_COLORS.accent} />
        </View>
      ) : !tenants || tenants.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No organizations yet</Text>
          <Text style={styles.emptySubtitle}>
            Create your first organization to get started.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tenants}
          keyExtractor={(item) => item.id}
          renderItem={renderTenant}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Create button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
      >
        <Text style={styles.fabText}>+ Create Organization</Text>
      </TouchableOpacity>

      {/* Create modal */}
      <Modal
        visible={showCreateModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Organization</Text>

            {createError && (
              <Text style={styles.errorBanner}>{createError}</Text>
            )}

            <Text style={styles.label}>Slug (URL identifier)</Text>
            <TextInput
              style={styles.input}
              value={newSlug}
              onChangeText={setNewSlug}
              placeholder="my-company"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              Your app will be at: {newSlug || "my-company"}.jobsyte.app
            </Text>

            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="My Company LLC"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, createTenant.isPending && styles.buttonDisabled]}
                onPress={handleCreate}
                disabled={createTenant.isPending}
              >
                {createTenant.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.createBtnText}>Create</Text>
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
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#fff" },
  headerSubtitle: { fontSize: 14, color: "#94a3b8", marginTop: 2 },
  logoutBtn: { padding: 8 },
  logoutText: { color: "#ef4444", fontSize: 14, fontWeight: "600" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: "600", color: "#fff", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: "#94a3b8", textAlign: "center" },
  list: { padding: 16 },
  tenantCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tenantInfo: { flex: 1 },
  tenantName: { fontSize: 17, fontWeight: "600", color: "#fff" },
  tenantDomain: { fontSize: 13, color: "#94a3b8", marginTop: 2 },
  badgeRow: { flexDirection: "row", marginTop: 8, gap: 6 },
  badge: {
    backgroundColor: "#334155",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeActive: { backgroundColor: "#065f46" },
  badgeText: { fontSize: 11, color: "#e2e8f0", fontWeight: "500" },
  metricsRow: { flexDirection: "row", marginTop: 8, flexWrap: "wrap", alignItems: "center" },
  metricItem: { fontSize: 12, color: "#94a3b8" },
  metricDot: { fontSize: 12, color: "#475569", marginHorizontal: 4 },
  tenantActions: { gap: 8 },
  openBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  openBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  deleteBtnText: { color: "#ef4444", fontSize: 13, fontWeight: "600" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#e2e8f0", marginBottom: 6 },
  input: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: "#fff",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  hint: { fontSize: 12, color: "#64748b", marginBottom: 16 },
  modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 },
  cancelBtnText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  createBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  createBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  buttonDisabled: { opacity: 0.6 },
  errorBanner: {
    backgroundColor: "#450a0a",
    color: "#fca5a5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
});
