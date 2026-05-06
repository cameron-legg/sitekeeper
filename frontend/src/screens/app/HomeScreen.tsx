import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Modal,
  SafeAreaView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useAuthStore } from "../../store/authStore";
import {
  useJobSites,
  useCreateJobSite,
  useDeleteJobSite,
} from "../../api/hooks/useJobSites";
import type { JobSite } from "../../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { data: sites, isLoading, isError } = useJobSites();
  const createSite = useCreateJobSite();
  const deleteSite = useDeleteJobSite();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmDeleteSite, setConfirmDeleteSite] = useState<JobSite | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Sort sites: those with active jobs first, then by creation date (newest first)
  const sortedSites = useMemo(() => {
    if (!sites) return [];
    return [...sites].sort((a, b) => {
      // Sites with active jobs come first
      const aActive = a.active_job_count > 0 ? 1 : 0;
      const bActive = b.active_job_count > 0 ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;
      // Within same group, newest first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [sites]);

  function handleLogout() {
    setShowLogoutConfirm(true);
  }

  function handleCreateSite() {
    const name = newSiteName.trim();
    if (!name) {
      setCreateError("Site name is required.");
      return;
    }
    setCreateError(null);
    createSite.mutate(
      { name },
      {
        onSuccess: () => {
          setShowCreateModal(false);
          setNewSiteName("");
        },
        onError: () => {
          setCreateError("Failed to create job site. Please try again.");
        },
      }
    );
  }

  function handleDelete(site: JobSite) {
    setConfirmDeleteSite(site);
  }

  function renderItem({ item }: { item: JobSite }) {
    return (
      <TouchableOpacity
        style={styles.siteRow}
        onPress={() =>
          navigation.navigate("JobSiteDetail", {
            siteId: item.id,
            siteName: item.name,
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.siteInfo}>
          <Text style={styles.siteName}>{item.name}</Text>
          <View style={styles.siteMetaRow}>
            <Text style={styles.jobCount}>
              {item.job_count} {item.job_count === 1 ? "job" : "jobs"}
            </Text>
            {item.active_job_count > 0 && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>
                  {item.active_job_count} active
                </Text>
              </View>
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
    <SafeAreaView style={styles.flex}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SiteKeeper</Text>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setShowMenu(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load job sites.</Text>
        </View>
      ) : (
        <FlatList
          data={sortedSites}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            sortedSites.length === 0 ? styles.emptyContainer : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No job sites yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the button below to create your first job site.
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setNewSiteName("");
          setCreateError(null);
          setShowCreateModal(true);
        }}
      >
        <Text style={styles.fabText}>+ New Job Site</Text>
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Job Site</Text>

            {createError && (
              <Text style={styles.inlineError}>{createError}</Text>
            )}

            <TextInput
              style={styles.modalInput}
              value={newSiteName}
              onChangeText={setNewSiteName}
              placeholder="Site name"
              autoFocus
              onSubmitEditing={handleCreateSite}
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
                  createSite.isPending && styles.buttonDisabled,
                ]}
                onPress={handleCreateSite}
                disabled={createSite.isPending}
              >
                {createSite.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete job site confirmation */}
      <Modal visible={!!confirmDeleteSite} transparent animationType="fade" onRequestClose={() => setConfirmDeleteSite(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Job Site</Text>
            <Text style={styles.confirmBody}>
              Delete "{confirmDeleteSite?.name}"? This will remove all jobs, notes, estimates, and invoices within it.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmDeleteSite(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, deleteSite.isPending && styles.buttonDisabled]}
                onPress={() => {
                  if (!confirmDeleteSite) return;
                  deleteSite.mutate(confirmDeleteSite.id, {
                    onSuccess: () => setConfirmDeleteSite(null),
                    onError: () => setConfirmDeleteSite(null),
                  });
                }}
                disabled={deleteSite.isPending}
              >
                {deleteSite.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.deleteConfirmText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hamburger menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); navigation.navigate("ProfileSettings"); }}
            >
              <Text style={styles.menuItemText}>⚙️  Profile</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); navigation.navigate("SavedItems", {}); }}
            >
              <Text style={styles.menuItemText}>📚  Item Library</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); navigation.navigate("MaterialsLibrary"); }}
            >
              <Text style={styles.menuItemText}>🧱  Materials</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); handleLogout(); }}
            >
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Logout confirmation */}
      <Modal visible={showLogoutConfirm} transparent animationType="fade" onRequestClose={() => setShowLogoutConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log out</Text>
            <Text style={styles.confirmBody}>Are you sure you want to log out?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowLogoutConfirm(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() => { setShowLogoutConfirm(false); clearAuth(); }}
              >
                <Text style={styles.deleteConfirmText}>Log out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f3f4f6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  menuBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  menuIcon: {
    fontSize: 22,
    color: "#374151",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 70,
    paddingRight: 16,
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 180,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  menuItem: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 15,
    color: "#1a1a1a",
  },
  menuItemDanger: {
    color: "#dc2626",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginHorizontal: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 15,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  emptyContainer: {
    flex: 1,
    padding: 16,
  },
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
  siteRow: {
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
  siteInfo: {
    flex: 1,
  },
  siteName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  jobCount: {
    fontSize: 13,
    color: "#6b7280",
  },
  siteMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activeBadge: {
    backgroundColor: "#dbeafe",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
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
  fabText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
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
  inlineError: {
    color: "#dc2626",
    fontSize: 13,
    marginBottom: 8,
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
  modalCancelText: {
    fontSize: 14,
    color: "#374151",
  },
  modalConfirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    minWidth: 80,
    alignItems: "center",
  },
  modalConfirmText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  confirmBody: { fontSize: 14, color: "#374151", marginBottom: 20, lineHeight: 20 },
  deleteConfirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#dc2626", minWidth: 80, alignItems: "center" },
  deleteConfirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
