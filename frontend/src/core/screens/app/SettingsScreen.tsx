import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useAuthStore } from "../../store/authStore";
import { useIsUtilityEnabled } from "../../../utilities";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation }: Props) {
  const role = useAuthStore((s) => s.role);
  const estimatesEnabled = useIsUtilityEnabled("estimates");
  const invoicesEnabled = useIsUtilityEnabled("invoices");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionHeader}>Account</Text>

      <View style={styles.group}>
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("ProfileSettings")} activeOpacity={0.7}>
          <Text style={styles.rowIcon}>⚙️</Text>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Profile</Text>
            <Text style={styles.rowSubtitle}>Name, email, phone</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("BusinessInfo")} activeOpacity={0.7}>
          <Text style={styles.rowIcon}>🏢</Text>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Business Info</Text>
            <Text style={styles.rowSubtitle}>Business name, address, payment method</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {(estimatesEnabled || invoicesEnabled) && (
      <>
      <Text style={styles.sectionHeader}>Documents</Text>

      <View style={styles.group}>
        {estimatesEnabled && (
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("EstimateSettings")} activeOpacity={0.7}>
          <Text style={styles.rowIcon}>📋</Text>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Estimate Settings</Text>
            <Text style={styles.rowSubtitle}>Configure estimate editor fields</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        )}

        {estimatesEnabled && invoicesEnabled && <View style={styles.divider} />}

        {invoicesEnabled && (
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("InvoiceSettings")} activeOpacity={0.7}>
          <Text style={styles.rowIcon}>🧾</Text>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Invoice Settings</Text>
            <Text style={styles.rowSubtitle}>Configure invoice editor fields</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        )}
      </View>
      </>
      )}

      {role === "admin" && (
        <>
          <Text style={styles.sectionHeader}>Administration</Text>

          <View style={styles.group}>
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("AdminUsers")} activeOpacity={0.7}>
              <Text style={styles.rowIcon}>👥</Text>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Manage Users</Text>
                <Text style={styles.rowSubtitle}>Approve and manage team members</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 16, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  group: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowIcon: { fontSize: 18, marginRight: 12 },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "600", color: "#1a1a1a", marginBottom: 1 },
  rowSubtitle: { fontSize: 13, color: "#6b7280" },
  chevron: { fontSize: 22, color: "#d1d5db" },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginLeft: 46 },
});
