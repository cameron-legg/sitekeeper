import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import Markdown from "react-native-markdown-display";
import MarkdownEditor from "./MarkdownEditor";
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
} from "../api/hooks/useNotes";
import type { Note } from "../api/types";

interface Props {
  jobId: string;
}

export default function NotesTab({ jobId }: Props) {
  const { data: notes, isLoading, isError } = useNotes(jobId);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editorBody, setEditorBody] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);

  function openCreate() {
    setEditingNote(null);
    setEditorBody("");
    setEditorError(null);
    setEditorVisible(true);
  }

  function openEdit(note: Note) {
    setEditingNote(note);
    setEditorBody(note.body);
    setEditorError(null);
    setEditorVisible(true);
  }

  function handleSave() {
    const body = editorBody.trim();
    if (!body) {
      setEditorError("Note body cannot be empty.");
      return;
    }
    setEditorError(null);

    if (editingNote) {
      updateNote.mutate(
        { jobId, noteId: editingNote.id, body },
        {
          onSuccess: () => setEditorVisible(false),
          onError: () => setEditorError("Failed to save note."),
        }
      );
    } else {
      createNote.mutate(
        { jobId, body },
        {
          onSuccess: () => setEditorVisible(false),
          onError: () => setEditorError("Failed to create note."),
        }
      );
    }
  }

  function handleDelete(note: Note) {
    Alert.alert("Delete Note", "Delete this note? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteNote.mutate({ jobId, noteId: note.id }),
      },
    ]);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Sort newest first
  const sorted = notes
    ? [...notes].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    : [];

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load notes.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          sorted.length === 0 ? styles.emptyContainer : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "Add Note" to write your first note.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.noteCard}
            onPress={() => openEdit(item)}
            activeOpacity={0.8}
          >
            <View style={styles.noteHeader}>
              <Text style={styles.noteDate}>{formatDate(item.created_at)}</Text>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
            <Markdown style={markdownStyles}>{item.body}</Markdown>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
        <Text style={styles.addBtnText}>+ Add Note</Text>
      </TouchableOpacity>

      {/* Note editor modal */}
      <Modal
        visible={editorVisible}
        animationType="slide"
        onRequestClose={() => setEditorVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditorVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingNote ? "Edit Note" : "New Note"}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={createNote.isPending || updateNote.isPending}
            >
              {createNote.isPending || updateNote.isPending ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {editorError && (
            <Text style={styles.editorError}>{editorError}</Text>
          )}

          <ScrollView style={styles.editorScroll} keyboardShouldPersistTaps="handled">
            <MarkdownEditor
              value={editorBody}
              onChange={setEditorBody}
              placeholder="Write your note in markdown…"
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#dc2626", fontSize: 15 },
  listContent: { padding: 16, gap: 12 },
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
  noteCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  noteDate: { fontSize: 12, color: "#9ca3af" },
  deleteText: { fontSize: 13, color: "#dc2626", fontWeight: "500" },
  addBtn: {
    margin: 16,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalCancel: { fontSize: 16, color: "#6b7280" },
  modalTitle: { fontSize: 17, fontWeight: "600", color: "#1a1a1a" },
  modalSave: { fontSize: 16, color: "#2563eb", fontWeight: "600" },
  editorError: {
    color: "#dc2626",
    fontSize: 13,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  editorScroll: { flex: 1, padding: 16 },
});

const markdownStyles = {
  body: { fontSize: 15, color: "#1a1a1a", lineHeight: 22 },
};
