import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  StyleSheet,
  Platform,
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
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const { data: effectivePrimary, isLoading: loadingPrimary } =
    useEffectivePrimaryContact(jobId);
  const { data: contacts, isLoading: loadingContacts, isError } =
    useJobContacts(jobId);
  const setPrimary = useSetPrimaryForJob();
  const removeContact = useRemoveContactFromJob();

  function openSheet(contact: Contact) {
    setSelectedContact(contact);
  }

  function closeSheet() {
    setSelectedContact(null);
  }

  function handleCall(phone: string) {
    Linking.openURL(`tel:${phone}`);
  }

  function handleEmail(email: string) {
    Linking.openURL(`mailto:${email}`);
  }

  function handleEdit(contact: Contact) {
    closeSheet();
    navigation.navigate("ContactEditor", {
      contactId: contact.id,
      parentId: jobId,
      parentType: "job",
      initialValues: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        mailing_address: contact.mailing_address,
        notes: contact.notes,
      },
    });
  }

  function handleSetPrimary(contact: Contact) {
    closeSheet();
    setPrimary.mutate({ jobId, contactId: contact.id });
  }

  function handleRemove(contact: Contact) {
    closeSheet();
    Alert.alert(
      "Remove Contact",
      `Remove "${contact.name}" from this job?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeContact.mutate({ jobId, contactId: contact.id }),
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
            <TouchableOpacity onPress={() => handleCall(primaryContact.phone!)}>
              <Text style={[styles.primaryDetail, styles.tappableDetail]}>
                📞 {primaryContact.phone}
              </Text>
            </TouchableOpacity>
          )}
          {primaryContact.email && (
            <TouchableOpacity onPress={() => handleEmail(primaryContact.email!)}>
              <Text style={[styles.primaryDetail, styles.tappableDetail]}>
                ✉️ {primaryContact.email}
              </Text>
            </TouchableOpacity>
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
              Tap "+ Add Contact" to assign a contact to this job.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => openSheet(item)}
            activeOpacity={0.7}
          >
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.name}</Text>
              {item.phone && (
                <Text style={styles.contactDetail}>📞 {item.phone}</Text>
              )}
              {item.email && (
                <Text style={styles.contactDetail}>✉️ {item.email}</Text>
              )}
              {item.mailing_address && (
                <Text style={styles.contactDetail}>{item.mailing_address}</Text>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
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

      {/* Contact detail bottom sheet */}
      <Modal
        visible={!!selectedContact}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={closeSheet}
        />
        {selectedContact && (
          <View style={styles.sheet}>
            {/* Handle bar */}
            <View style={styles.sheetHandle} />

            {/* Contact name + address */}
            <Text style={styles.sheetName}>{selectedContact.name}</Text>
            {selectedContact.mailing_address && (
              <Text style={styles.sheetAddress}>
                {selectedContact.mailing_address}
              </Text>
            )}

            {/* Call / Email action buttons */}
            <View style={styles.actionRow}>
              {selectedContact.phone ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleCall(selectedContact.phone!)}
                >
                  <Text style={styles.actionBtnIcon}>📞</Text>
                  <Text style={styles.actionBtnLabel}>Call</Text>
                  <Text style={styles.actionBtnSub} numberOfLines={1}>
                    {selectedContact.phone}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.actionBtn, styles.actionBtnDisabled]}>
                  <Text style={styles.actionBtnIcon}>📞</Text>
                  <Text style={[styles.actionBtnLabel, styles.actionBtnLabelDisabled]}>
                    Call
                  </Text>
                  <Text style={styles.actionBtnSub}>No phone</Text>
                </View>
              )}

              {selectedContact.email ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleEmail(selectedContact.email!)}
                >
                  <Text style={styles.actionBtnIcon}>✉️</Text>
                  <Text style={styles.actionBtnLabel}>Email</Text>
                  <Text style={styles.actionBtnSub} numberOfLines={1}>
                    {selectedContact.email}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.actionBtn, styles.actionBtnDisabled]}>
                  <Text style={styles.actionBtnIcon}>✉️</Text>
                  <Text style={[styles.actionBtnLabel, styles.actionBtnLabelDisabled]}>
                    Email
                  </Text>
                  <Text style={styles.actionBtnSub}>No email</Text>
                </View>
              )}
            </View>

            {/* Management actions */}
            <View style={styles.menuSection}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleEdit(selectedContact)}
              >
                <Text style={styles.menuItemText}>✏️  Edit Contact</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleSetPrimary(selectedContact)}
              >
                <Text style={styles.menuItemText}>⭐  Set as Primary</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleRemove(selectedContact)}
              >
                <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                  🗑️  Remove from Job
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={closeSheet}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#dc2626", fontSize: 15 },

  // Primary banner
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
  sourceBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sourceBadgeInherited: { backgroundColor: "#e5e7eb" },
  sourceBadgeDirect: { backgroundColor: "#dbeafe" },
  sourceBadgeText: { fontSize: 11, fontWeight: "500" },
  sourceBadgeTextInherited: { color: "#6b7280" },
  sourceBadgeTextDirect: { color: "#1d4ed8" },
  primaryName: { fontSize: 16, fontWeight: "600", color: "#1a1a1a", marginBottom: 4 },
  primaryDetail: { fontSize: 13, color: "#374151", marginTop: 2 },
  tappableDetail: { color: "#2563eb" },

  // Contact list
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1, padding: 16 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#9ca3af", textAlign: "center" },

  // Contact card
  contactCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: "600", color: "#1a1a1a", marginBottom: 2 },
  contactDetail: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  chevron: { fontSize: 22, color: "#d1d5db", marginLeft: 8 },

  // Add button
  addBtn: {
    margin: 16,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // Bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 4,
  },
  sheetAddress: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },

  // Call / Email action buttons
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  actionBtnDisabled: {
    backgroundColor: "#f3f4f6",
  },
  actionBtnIcon: { fontSize: 22 },
  actionBtnLabel: { fontSize: 14, fontWeight: "600", color: "#2563eb" },
  actionBtnLabelDisabled: { color: "#9ca3af" },
  actionBtnSub: { fontSize: 11, color: "#6b7280", maxWidth: "90%" },

  // Menu items
  menuSection: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemText: { fontSize: 15, color: "#1a1a1a" },
  menuItemDanger: { color: "#dc2626" },
  menuDivider: { height: 1, backgroundColor: "#e5e7eb", marginHorizontal: 16 },

  // Cancel button
  cancelBtn: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },
});
