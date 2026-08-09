import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Platform,
  Dimensions,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useJobPhotos, useUploadPhoto, useDeletePhoto, getPhotoUrl } from "../hooks/usePhotos";
import { useAuthStore } from "../../../core/store/authStore";
import type { JobPhoto } from "../../../core/api/types";

interface Props {
  jobId: string;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const NUM_COLUMNS = 3;
const TILE_GAP = 2;
const TILE_SIZE = (SCREEN_WIDTH - TILE_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

export default function MediaTab({ jobId }: Props) {
  const { data: photos, isLoading, isError } = useJobPhotos(jobId);
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const token = useAuthStore((s) => s.token);

  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<JobPhoto | null>(null);

  const handlePickImage = useCallback(async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      if (Platform.OS === "web") {
        alert("Permission to access photos is required.");
      } else {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library to upload images."
        );
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      exif: false,
    });

    if (result.canceled) return;

    // Upload each selected image
    for (const asset of result.assets) {
      const uri = asset.uri;
      const filename =
        asset.fileName || uri.split("/").pop() || `photo_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || "image/jpeg";

      uploadPhoto.mutate({ jobId, uri, filename, mimeType });
    }
  }, [jobId, uploadPhoto]);

  const handleDelete = useCallback(
    (photo: JobPhoto) => {
      if (Platform.OS === "web") {
        if (window.confirm(`Delete "${photo.filename}"? This cannot be undone.`)) {
          deletePhoto.mutate({ photoId: photo.id, jobId });
          setSelectedPhoto(null);
        }
      } else {
        setConfirmDelete(photo);
      }
    },
    [deletePhoto, jobId]
  );

  const confirmDeleteAction = useCallback(() => {
    if (confirmDelete) {
      deletePhoto.mutate({ photoId: confirmDelete.id, jobId });
      setConfirmDelete(null);
      setSelectedPhoto(null);
    }
  }, [confirmDelete, deletePhoto, jobId]);

  /** Get image source with token in URL for authenticated endpoints */
  const getImageSource = useCallback(
    (photoId: string) => {
      const url = getPhotoUrl(photoId, token);
      return { uri: url };
    },
    [token]
  );

  const renderPhoto = useCallback(
    ({ item }: { item: JobPhoto }) => (
      <TouchableOpacity
        style={styles.tile}
        onPress={() => setSelectedPhoto(item)}
        accessibilityRole="button"
        accessibilityLabel={`View photo ${item.filename}`}
      >
        <Image
          source={getImageSource(item.id)}
          style={styles.tileImage}
          resizeMode="cover"
        />
      </TouchableOpacity>
    ),
    [getImageSource]
  );

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
        <Text style={styles.errorText}>Failed to load photos.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Upload button */}
      <TouchableOpacity
        style={[styles.uploadBtn, uploadPhoto.isPending && styles.uploadBtnDisabled]}
        onPress={handlePickImage}
        disabled={uploadPhoto.isPending}
        accessibilityRole="button"
        accessibilityLabel="Upload photos"
      >
        {uploadPhoto.isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.uploadBtnText}>📷 Upload Photos</Text>
        )}
      </TouchableOpacity>

      {uploadPhoto.isError && (
        <Text style={styles.uploadError}>
          Upload failed. Please try again.
        </Text>
      )}

      {/* Photo grid */}
      {photos && photos.length > 0 ? (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          renderItem={renderPhoto}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📸</Text>
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap "Upload Photos" to add images to this job.
          </Text>
        </View>
      )}

      {/* Full-screen photo viewer */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity
              onPress={() => setSelectedPhoto(null)}
              style={styles.viewerCloseBtn}
              accessibilityLabel="Close photo viewer"
            >
              <Text style={styles.viewerCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.viewerFilename} numberOfLines={1}>
              {selectedPhoto?.filename}
            </Text>
            <TouchableOpacity
              onPress={() => selectedPhoto && handleDelete(selectedPhoto)}
              style={styles.viewerDeleteBtn}
              accessibilityLabel="Delete photo"
            >
              <Text style={styles.viewerDeleteText}>🗑</Text>
            </TouchableOpacity>
          </View>
          {selectedPhoto && (
            <Image
              source={getImageSource(selectedPhoto.id)}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.viewerFooter}>
            <Text style={styles.viewerMeta}>
              {selectedPhoto &&
                `${(selectedPhoto.file_size / 1024).toFixed(0)} KB • ${new Date(
                  selectedPhoto.created_at
                ).toLocaleDateString()}`}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Delete confirmation modal (native only) */}
      <Modal
        visible={!!confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(null)}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>Delete Photo</Text>
            <Text style={styles.deleteBody}>
              Delete "{confirmDelete?.filename}"? This cannot be undone.
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirmDelete(null)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, deletePhoto.isPending && styles.btnDisabled]}
                onPress={confirmDeleteAction}
                disabled={deletePhoto.isPending}
              >
                {deletePhoto.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.deleteBtnText}>Delete</Text>
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
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#dc2626", fontSize: 15 },

  // Upload button
  uploadBtn: {
    backgroundColor: "#2563eb",
    margin: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  uploadError: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 8,
  },

  // Grid
  grid: { paddingHorizontal: TILE_GAP },
  row: { gap: TILE_GAP, marginBottom: TILE_GAP },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  tileImage: { width: "100%", height: "100%" },

  // Empty state
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#6b7280", textAlign: "center" },

  // Full-screen viewer
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "web" ? 16 : 50,
    paddingBottom: 12,
  },
  viewerCloseBtn: { padding: 8 },
  viewerCloseText: { color: "#fff", fontSize: 22 },
  viewerFilename: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    marginHorizontal: 8,
  },
  viewerDeleteBtn: { padding: 8 },
  viewerDeleteText: { fontSize: 20 },
  viewerImage: { flex: 1, width: "100%" },
  viewerFooter: { paddingVertical: 16, alignItems: "center" },
  viewerMeta: { color: "#9ca3af", fontSize: 13 },

  // Delete confirmation
  deleteOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  deleteCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 24,
    width: "100%",
    maxWidth: 340,
  },
  deleteTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  deleteBody: { fontSize: 14, color: "#4b5563", marginBottom: 20 },
  deleteActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  cancelText: { color: "#6b7280", fontWeight: "600", fontSize: 15 },
  deleteBtn: {
    backgroundColor: "#dc2626",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  deleteBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
