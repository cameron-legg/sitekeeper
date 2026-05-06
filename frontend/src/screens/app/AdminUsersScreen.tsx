import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useAdminUsers, useUpdateUser } from "../../api/hooks/useAdmin";
import { useAuthStore } from "../../store/authStore";
import type { TenantUser } from "../../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "AdminUsers">;

export default function AdminUsersScreen({ navigation }: Props) {
  const currentUserId = useAuthStore((s) => s.userId);
  const { data: users, isLoading, isError } = useAdminUsers();
  const updateUser = useUpdateUser();

  function handleToggleApproval(user: TenantUser) {
    const newApproved = !user.is_approved;
    const action = newApproved ? "approve" : "revoke access for";

    if (Platform.OS === "web") {
      if (!window.confirm(`Are you sure you want to ${action} ${user.email}?`)) return;
      updateUser.mutate({ userId: user.id, data: { is_approved: newApproved } });
    } else {
      Alert.alert(
        newApproved ? "Approve User" : "Revoke Access",
        `Are you sure you want to ${action} ${user.email}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: newApproved ? "Approve" : "Revoke",
            style: newApproved ? "default" : "destructive",
            onPress: () =>
              updateUser.mutate({ userId: user.id, data: { is_approved: newApproved } }),
          },
        ]
      );
    }
  }

  function renderUser({ item }: { item: TenantUser }) {
    const isCurrentUser = item.id === currentUserId;

    return (
      <View style={styles.userRow}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {item.name || item.email}
            {isCurrentUser && <Text style={styles.youBadge}> (you)</Text>}
          </Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, item.role === "admin" ? styles.adminBadge : styles.memberBadge]}>
              <Text style={styles.badgeText}>{item.role}</Text>
            </View>
            <View style={[styles.badge, item.is_approved ? styles.approvedBadge : styles.pendingBadge]}>
              <Text style={styles.badgeText}>
                {item.is_approved ? "approved" : "pending"}
              </Text>
            </View>
          </View>
        </View>
        {!isCurrentUser && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              item.is_approved ? styles.revokeBtn : styles.approveBtn,
            ]}
            onPress={() => handleToggleApproval(item)}
            disabled={updateUser.isPending}
          >
            <Text
              style={[
                styles.actionBtnText,
                item.is_approved ? styles.revokeBtnText : styles.approveBtnText,
              ]}
            >
              {item.is_approved ? "Revoke" : "Approve"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Users</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load users.</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No users found.</Text>
            </View>
          }
          ListHeaderComponent={
            <Text style={styles.description}>
              Approved users can view and edit all data in this workspace.
              Pending users cannot access any data until approved.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: { fontSize: 16, color: "#2563eb" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { color: "#dc2626", fontSize: 15 },
  emptyText: { color: "#64748b", fontSize: 15 },
  description: {
    fontSize: 14,
    color: "#64748b",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    lineHeight: 20,
  },
  listContent: { paddingBottom: 32 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  userInfo: { flex: 1, marginRight: 12 },
  userName: { fontSize: 16, fontWeight: "600", color: "#1e293b" },
  youBadge: { fontSize: 13, fontWeight: "400", color: "#64748b" },
  userEmail: { fontSize: 13, color: "#64748b", marginTop: 2 },
  badgeRow: { flexDirection: "row", marginTop: 6, gap: 6 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  adminBadge: { backgroundColor: "#dbeafe" },
  memberBadge: { backgroundColor: "#f1f5f9" },
  approvedBadge: { backgroundColor: "#dcfce7" },
  pendingBadge: { backgroundColor: "#fef3c7" },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  approveBtn: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  revokeBtn: { backgroundColor: "#fee2e2", borderColor: "#fca5a5" },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  approveBtnText: { color: "#166534" },
  revokeBtnText: { color: "#991b1b" },
});
