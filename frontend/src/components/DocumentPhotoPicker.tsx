import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useJobPhotos, useDocumentPhotos, useSetDocumentPhotos, getPhotoUrl } from "../api/hooks/usePhotos";
import { useAuthStore } from "../store/authStore";
import type { JobPhoto } from "../api/types";

interface Props {
  documentId: string;
  documentType: "estimate" | "invoice";
  jobId: string;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const THUMB_SIZE = 64;

/**
 * Allows users to attach/detach job photos to an estimate or invoice.
 * Shows currently attached photos and a picker modal to select from all job photos.
 */
export default function DocumentPhotoPicker({ documentId, documentType, jobId }: Props) {
  const token = useAuthStore((s) => s.token);
  const { data: attachedPhotos, isLoading: loadingAttached } = useDocumentPhotos(documentId, documentType);
  const { data: allJobPhotos, isLoading: loadingAll } = useJobPhotos(jobId);
  const setDocumentPhotos = useSetDocumentPhotos();

  const [showPicker, setShowPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const openPicker = useCallback(() => {
    setSelectedIds((attachedPhotos ?? []).map((p) => p.id));
    setShowPicker(true);
  }, [attachedPhotos]);

  const togglePhoto = useCallback((photoId: string) => {
    setSelectedIds((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId]
    );
  }, []);

  const handleSave = useCallback(() => {
    setDocumentPhotos.mutate(
      { documentId, documentType, photoIds: selectedIds },
      { onSuccess: () => setShowPicker(false) }
    );
  }, [documentId, documentType, selectedIds, setDocumentPhotos]);

  const getImageUri = useCallback(
    (photoId: string) => getPhotoUrl(photoId, token),
    [token]
  );

  if (loadingAttached) {
    return (
      <View style={styles.section}>
        <ActivityIndicator size="small" color="#2563eb" />
      </View>
    );
  }

  const hasPhotos = allJobPhotos && allJobPhotos.length > 0;
  const attached = attachedPhotos ?? [];

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionHeader}>Photos</Text>
        {hasPhotos && (
          <TouchableOpacity style={styles.editBtn} onPress={openPicker}>
            <Text style={styles.editBtnText}>
              {attached.length > 0 ? "Edit" : "+ Add"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {attached.length > 0 ? (
        <View style={styles.thumbRow}>
          {attached.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: getImageUri(photo.id) }}
              style={styles.thumb}
              resizeMode="cover"
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>
          {hasPhotos
            ? 'Tap "+ Add" to attach job photos to this PDF.'
            : "Upload photos to this job first (Media tab)."}
        </Text>
      )}

      {/* Picker modal */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Photos for PDF</Text>
            <Text style={styles.modalSubtitle}>
              Selected photos will appear at the bottom of the generated PDF.
            </Text>

            {loadingAll ? (
              <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 24 }} />
            ) : (allJobPhotos ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No photos available. Upload photos to this job first.</Text>
            ) : (
              <FlatList
                data={allJobPhotos}
                keyExtractor={(item) => item.id}
                numColumns={4}
                style={styles.pickerGrid}
                columnWrapperStyle={styles.pickerRow}
                renderItem={({ item }) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.pickerTile, isSelected && styles.pickerTileSelected]}
                      onPress={() => togglePhoto(item.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                    >
                      <Image
                        source={{ uri: getImageUri(item.id) }}
                        style={styles.pickerImage}
                        resizeMode="cover"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Text style={styles.checkText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPicker(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, setDocumentPhotos.isPending && styles.btnDisabled]}
                onPress={handleSave}
                disabled={setDocumentPhotos.isPending}
              >
                {setDocumentPhotos.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    Save ({selectedIds.length} photo{selectedIds.length !== 1 ? "s" : ""})
                  </Text>
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
  section: { marginTop: 16, marginBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionHeader: { fontSize: 14, fontWeight: "700", color: "#374151" },
  editBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  editBtnText: { fontSize: 12, fontWeight: "600", color: "#2563eb" },
  thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 6, backgroundColor: "#e5e7eb" },
  emptyText: { fontSize: 13, color: "#9ca3af", fontStyle: "italic" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 420, maxHeight: "80%" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: "#6b7280", marginBottom: 12 },
  pickerGrid: { maxHeight: 300 },
  pickerRow: { gap: 4, marginBottom: 4 },
  pickerTile: { width: (SCREEN_WIDTH > 420 ? 380 : SCREEN_WIDTH - 80) / 4, aspectRatio: 1, borderRadius: 6, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  pickerTileSelected: { borderColor: "#2563eb" },
  pickerImage: { width: "100%", height: "100%" },
  checkBadge: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  checkText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 16 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  cancelText: { fontSize: 14, color: "#374151" },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#2563eb", minWidth: 100, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
});
