import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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

  function handleLogout() {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: clearAuth },
    ]);
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
    Alert.alert(
      "Delete Job Site",
      `Delete "${site.name}"? This will remove all jobs, notes, estimates, and invoices within it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteSite.mutate(site.id),
        },
      ]
    );
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
          <Text style={styles.jobCount}>
            {item.job_count} {item.job_count === 1 ? "job" : "jobs"}
          </Text>
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
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.libraryBtn}
            onPress={() => navigation.navigate("SavedItems", {})}
          >
            <Text style={styles.libraryBtnText}>📚 Library</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
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
          data={sites}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            sites?.length === 0 ? styles.emptyContainer : styles.listContent
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  libraryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  libraryBtnText: {
    fontSize: 13,
    color: "#15803d",
    fontWeight: "600",
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  logoutText: {
    fontSize: 14,
    color: "#374151",
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
});
