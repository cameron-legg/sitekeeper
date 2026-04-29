import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useSavedItems, useDeleteSavedItem } from "../../api/hooks/useSavedItems";
import type { SavedItem } from "../../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "SavedItems">;

export default function SavedItemsScreen({ route, navigation }: Props) {
  const pickerMode = route.params?.pickerMode ?? false;
  const onSelect = route.params?.onSelect;

  const { data: items, isLoading, isError } = useSavedItems();
  const deleteItem = useDeleteSavedItem();

  const [confirmDelete, setConfirmDelete] = useState<SavedItem | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: pickerMode ? "Pick from Library" : "Item Library",
    });
  }, [navigation, pickerMode]);

  function handleSelect(item: SavedItem) {
    if (pickerMode && onSelect) {
      onSelect({
        id: item.id,
        name: item.name,
        notes: item.notes,
        url: item.url,
        hours: item.hours,
        price: item.price,
      });
    }
  }

  function handleDelete(item: SavedItem) {
    setConfirmDelete(item);
  }

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
        <Text style={styles.errorText}>Failed to load saved items.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          (items?.length ?? 0) === 0 ? styles.emptyContainer : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No saved items yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "New Item" to add items to your library.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => pickerMode ? handleSelect(item) : undefined}
            activeOpacity={pickerMode ? 0.7 : 1}
          >
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.price != null && (
                <Text style={styles.itemPrice}>
                  ${parseFloat(item.price).toFixed(2)}
                </Text>
              )}
              {item.notes && (
                <Text style={styles.itemNotes} numberOfLines={1}>
                  {item.notes}
                </Text>
              )}
            </View>
            {pickerMode ? (
              <Text style={styles.selectText}>Select</Text>
            ) : (
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() =>
                    navigation.navigate("SavedItemEditor", { itemId: item.id })
                  }
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item)}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {!pickerMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate("SavedItemEditor", {})}
        >
          <Text style={styles.fabText}>+ New Item</Text>
        </TouchableOpacity>
      )}

      {/* Delete confirmation */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Saved Item</Text>
            <Text style={styles.modalBody}>Delete "{confirmDelete?.name}" from your library?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDelete(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, deleteItem.isPending && styles.btnDisabled]}
                onPress={() => {
                  if (!confirmDelete) return;
                  deleteItem.mutate(confirmDelete.id, {
                    onSuccess: () => setConfirmDelete(null),
                    onError: () => setConfirmDelete(null),
                  });
                }}
                disabled={deleteItem.isPending}
              >
                {deleteItem.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.deleteConfirmText}>Delete</Text>}
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
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1, padding: 16 },
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
  itemRow: {
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
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  itemNotes: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  selectText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "600",
  },
  itemActions: {
    flexDirection: "row",
    gap: 6,
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#eff6ff",
  },
  editBtnText: { fontSize: 12, color: "#2563eb", fontWeight: "500" },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#fef2f2",
  },
  deleteBtnText: { fontSize: 12, color: "#dc2626", fontWeight: "500" },
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
  fabText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  modalBody: { fontSize: 14, color: "#374151", marginBottom: 20, lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  cancelText: { fontSize: 14, color: "#374151" },
  deleteConfirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#dc2626", minWidth: 72, alignItems: "center" },
  deleteConfirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
});
