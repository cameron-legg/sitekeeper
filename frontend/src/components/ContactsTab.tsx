import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import {
  useJobContacts,
  useEffectivePrimaryContact,
  useSetPrimaryForJob,
  useRemoveContactFromJob,
} from "../api/hooks/useContacts";
import type { Contact } from "../api/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  jobId: string;
}

export default function ContactsTab({ jobId }: Props) {
  const navigation = useNavigation<Nav>();

  const {
    data: effectivePrimary,
    isLoading: loadingPrimary,
  } = useEffectivePrimaryContact(jobId);
  const { data: contacts, isLoading: loadingContacts, isError } = useJobContacts(jobId);
  const setPrimary = useSetPrimaryForJob();
  const removeContact = useRemoveContactFromJob();

  function handleSetPrimary(contactId: string) {
    setPrimary.mutate({ jobId, contactId });
  }

  function handleRemove(contact: Contact) {
    Alert.alert(
      "Remove Contact",
      `Remove "${contact.name}" from this job?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            removeContact.mutate({ jobId, contactId: contact.id }),
        },
      ]
    );
  }

  if (loadingContacts || loadingPrimary) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load contacts.</Text>
      </View>
    );
  }

  const primaryContact = effectivePrimary?.contact;
  const source = effectivePrimary?.source;

  return (
    <View style={styles.flex}>
      {/* Effective primary contact banner */}
      {primaryContact && (
        <View style={styles.primaryBanner}>
          <View style={styles.primaryBannerTop}>
            <Text style={styles.primaryLabel}>Primary Contact</Text>
            <View
              style={[
                styles.sourceBadge,
                source === "inherited"
                  ? styles.sourceBadgeInherited
                  : styles.sourceBadgeDirect,
              ]}
            >
              <Text
                style={[
                  styles.sourceBadgeText,
                  source === "inherited"
                    ? styles.sourceBadgeTextInherited
                    : styles.sourceBadgeTextDirect,
                ]}
              >
                {source === "inherited"
                  ? "Inherited from job site"
                  : "Directly assigned"}
              </Text>
            </View>
          </View>
          <Text style={styles.primaryName}>{primaryContact.name}</Text>
          {primaryContact.phone && (
            <Text style={styles.primaryDetail}>{primaryContact.phone}</Text>
          )}
          {primaryContact.email && (
            <Text style={styles.primaryDetail}>{primaryContact.email}</Text>
          )}
        </View>
      )}

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          (contacts?.length ?? 0) === 0
            ? styles.emptyContainer
            : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No contacts assigned</Text>
            <Text style={styles.emptySubtitle}>
              Tap "Add Contact" to assign a contact to this job.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.contactCard}>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.name}</Text>
              {item.phone && (
                <Text style={styles.contactDetail}>{item.phone}</Text>
              )}
              {item.email && (
                <Text style={styles.contactDetail}>{item.email}</Text>
              )}
              {item.mailing_address && (
                <Text style={styles.contactDetail}>{item.mailing_address}</Text>
              )}
            </View>
            <View style={styles.contactActions}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => handleSetPrimary(item.id)}
              >
                <Text style={styles.primaryBtnText}>Set Primary</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemove(item)}
              >
                <Text style={styles.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() =>
          navigation.navigate("ContactEditor", {
            parentId: jobId,
            parentType: "job",
          })
        }
      >
        <Text style={styles.addBtnText}>+ Add Contact</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#dc2626", fontSize: 15 },
  primaryBanner: {
    backgroundColor: "#eff6ff",
    borderBottomWidth: 1,
    borderBottomColor: "#bfdbfe",
    padding: 16,
  },
  primaryBannerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  primaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1d4ed8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sourceBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sourceBadgeInherited: { backgroundColor: "#e5e7eb" },
  sourceBadgeDirect: { backgroundColor: "#dbeafe" },
  sourceBadgeText: { fontSize: 11, fontWeight: "500" },
  sourceBadgeTextInherited: { color: "#6b7280" },
  sourceBadgeTextDirect: { color: "#1d4ed8" },
  primaryName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  primaryDetail: { fontSize: 13, color: "#374151", marginTop: 1 },
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1, padding: 16 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  emptySubtitle: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
  contactCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  contactInfo: { flex: 1 },
  contactName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  contactDetail: { fontSize: 13, color: "#6b7280", marginTop: 1 },
  contactActions: { gap: 6, alignItems: "flex-end" },
  primaryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#dbeafe",
  },
  primaryBtnText: { fontSize: 12, color: "#1d4ed8", fontWeight: "500" },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#fef2f2",
  },
  removeBtnText: { fontSize: 12, color: "#dc2626", fontWeight: "500" },
  addBtn: {
    margin: 16,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
