import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import Markdown from "react-native-markdown-display";

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

export default function MarkdownEditor({ value, onChange, placeholder }: Props) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  return (
    <View style={styles.container}>
      {/* Toggle bar */}
      <View style={styles.toggleBar}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === "edit" && styles.toggleActive]}
          onPress={() => setMode("edit")}
        >
          <Text
            style={[
              styles.toggleText,
              mode === "edit" && styles.toggleTextActive,
            ]}
          >
            Edit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === "preview" && styles.toggleActive]}
          onPress={() => setMode("preview")}
        >
          <Text
            style={[
              styles.toggleText,
              mode === "preview" && styles.toggleTextActive,
            ]}
          >
            Preview
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {mode === "edit" ? (
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? "Write in markdown…"}
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
        />
      ) : (
        <ScrollView style={styles.preview} contentContainerStyle={styles.previewContent}>
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <Text style={styles.previewEmpty}>Nothing to preview yet.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  toggleBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: "#fff",
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
  },
  toggleTextActive: {
    color: "#2563eb",
  },
  textInput: {
    minHeight: 160,
    padding: 12,
    fontSize: 15,
    color: "#1a1a1a",
    lineHeight: 22,
  },
  preview: {
    minHeight: 160,
    maxHeight: 320,
  },
  previewContent: {
    padding: 12,
  },
  previewEmpty: {
    color: "#9ca3af",
    fontSize: 14,
    fontStyle: "italic",
  },
});
