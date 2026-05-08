/**
 * AIChatBubble — Floating AI assistant chat bubble.
 *
 * Renders a small circular button in the bottom-left corner of the screen.
 * Tapping it opens a chat modal where the user can converse with the AI.
 * The AI is context-aware: it knows which screen the user is on and can
 * perform actions (create job sites, estimates, etc.) via function calling.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAIChat, ChatMessage, AIAction } from "../api/hooks/useAI";

interface AIChatBubbleProps {
  screenName: string;
  screenParams: Record<string, unknown>;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: AIAction[];
}

export default function AIChatBubble({ screenName, screenParams }: AIChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const queryClient = useQueryClient();

  const { mutate: sendChat, isPending } = useAIChat();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isPending) return;

    const userMsg: DisplayMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");

    // Build the messages array for the API (just role + content)
    const apiMessages: ChatMessage[] = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    sendChat(
      {
        messages: apiMessages,
        screen_context: {
          screen: screenName,
          params: screenParams,
        },
      },
      {
        onSuccess: (data) => {
          const assistantMsg: DisplayMessage = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.response,
            actions: data.actions,
          };
          setMessages((prev) => [...prev, assistantMsg]);

          // Invalidate relevant queries if actions were taken
          if (data.actions && data.actions.length > 0) {
            // Broad invalidation to refresh any affected data
            queryClient.invalidateQueries({ queryKey: ["jobSites"] });
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
            queryClient.invalidateQueries({ queryKey: ["estimates"] });
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            queryClient.invalidateQueries({ queryKey: ["notes"] });
            queryClient.invalidateQueries({ queryKey: ["savedItems"] });
          }
        },
        onError: (error: any) => {
          const errorMsg: DisplayMessage = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              error?.response?.status === 503
                ? "AI features aren't configured yet. Ask your admin to set the OPENAI_API_KEY."
                : "Sorry, I ran into an error. Please try again.",
          };
          setMessages((prev) => [...prev, errorMsg]);
        },
      }
    );
  }, [input, isPending, messages, screenName, screenParams, sendChat, queryClient]);

  const renderMessage = ({ item }: { item: DisplayMessage }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text style={[styles.messageText, isUser && styles.userText]}>
          {item.content}
        </Text>
        {item.actions && item.actions.length > 0 && (
          <View style={styles.actionsContainer}>
            {item.actions.map((action, idx) => (
              <View key={idx} style={styles.actionChip}>
                <Text style={styles.actionText}>
                  ✓ {action.result?.message || action.tool}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      {/* Floating bubble button */}
      <TouchableOpacity
        style={styles.bubble}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.8}
        accessibilityLabel="Open AI assistant"
        accessibilityRole="button"
      >
        <Text style={styles.bubbleIcon}>✦</Text>
      </TouchableOpacity>

      {/* Chat modal */}
      <Modal
        visible={isOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.chatContainer}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>SiteKeeper AI</Text>
              <Text style={styles.headerSubtitle}>
                On: {screenName}
              </Text>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                style={styles.closeButton}
                accessibilityLabel="Close AI chat"
                accessibilityRole="button"
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContent}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>✦</Text>
                  <Text style={styles.emptyTitle}>Hi! I'm your AI assistant.</Text>
                  <Text style={styles.emptyText}>
                    I can help you create job sites, jobs, estimates, invoices, and notes.
                    I'm aware of which screen you're on and can use that context.
                  </Text>
                  <Text style={styles.emptyHint}>
                    Try: "Create a job site at 123 Main St with a job for roof repair"
                  </Text>
                </View>
              }
            />

            {/* Loading indicator */}
            {isPending && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.loadingText}>Thinking...</Text>
              </View>
            )}

            {/* Input */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Ask me anything..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={2000}
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
                editable={!isPending}
                accessibilityLabel="Chat message input"
              />
              <TouchableOpacity
                style={[styles.sendButton, (!input.trim() || isPending) && styles.sendDisabled]}
                onPress={handleSend}
                disabled={!input.trim() || isPending}
                accessibilityLabel="Send message"
                accessibilityRole="button"
              >
                <Text style={styles.sendIcon}>↑</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const styles = StyleSheet.create({
  // Floating bubble
  bubble: {
    position: "absolute",
    bottom: 24,
    left: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 1000,
  },
  bubbleIcon: {
    fontSize: 22,
    color: "#fff",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  chatContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.75,
    maxHeight: 700,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginLeft: 12,
  },
  closeButton: {
    marginLeft: "auto",
    padding: 4,
  },
  closeText: {
    fontSize: 20,
    color: "#6b7280",
    fontWeight: "600",
  },

  // Messages
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: "#2563eb",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#f3f4f6",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    color: "#111827",
  },
  userText: {
    color: "#fff",
  },

  // Actions
  actionsContainer: {
    marginTop: 8,
    gap: 4,
  },
  actionChip: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "500",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 36,
    color: "#2563eb",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyHint: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    fontStyle: "italic",
  },

  // Loading
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#6b7280",
  },

  // Input
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    color: "#111827",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: {
    backgroundColor: "#d1d5db",
  },
  sendIcon: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "700",
  },
});
