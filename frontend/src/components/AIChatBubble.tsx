/**
 * AIChatBubble — Floating AI assistant chat bubble with a futuristic dark UI.
 *
 * Renders a glowing circular button in the bottom-left corner of the screen.
 * Tapping it opens a sleek dark-themed chat modal where the user can converse
 * with the AI. The AI is context-aware: it knows which screen the user is on
 * and can perform actions (create job sites, estimates, etc.) via function calling.
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
  Animated,
  Easing,
  PanResponder,
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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const orbitAnim = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Draggable position
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const isDragging = useRef(false);
  const dragDistance = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only claim the gesture if the user has moved more than 5px
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        isDragging.current = false;
        dragDistance.current = 0;
        // Set the offset to the current animated value so dragging continues from here
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gestureState) => {
        dragDistance.current = Math.abs(gestureState.dx) + Math.abs(gestureState.dy);
        if (dragDistance.current > 5) {
          isDragging.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        })(_, gestureState);
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        // If it was just a tap (barely moved), open the chat
        if (!isDragging.current || dragDistance.current < 10) {
          setIsOpen(true);
        }
      },
    })
  ).current;

  const { mutate: sendChat, isPending } = useAIChat();

  // Smooth breathing scale + orbital animations on the floating bubble
  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 3000,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ])
    );

    // Continuous rotation — resets to 0 each loop iteration
    const rotate = Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    // Counter-rotation for the orbit ring
    const orbit = Animated.loop(
      Animated.sequence([
        Animated.timing(orbitAnim, {
          toValue: 1,
          duration: 6000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(orbitAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.9,
          duration: 2500,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.4,
          duration: 2500,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ])
    );

    breathe.start();
    rotate.start();
    orbit.start();
    glow.start();
    return () => {
      breathe.stop();
      rotate.stop();
      orbit.stop();
      glow.stop();
    };
  }, [pulseAnim, rotateAnim, orbitAnim, glowOpacity]);

  // Smooth glow animation on the chat container when AI is thinking
  useEffect(() => {
    if (isPending) {
      const thinking = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: false,
          }),
        ])
      );
      thinking.start();
      return () => thinking.stop();
    } else {
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    }
  }, [isPending, glowAnim]);

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

          // Invalidate relevant queries based on which tools were called
          if (data.actions && data.actions.length > 0) {
            for (const action of data.actions) {
              switch (action.tool) {
                case "create_job_site":
                case "list_job_sites":
                  queryClient.invalidateQueries({ queryKey: ["job-sites"] });
                  break;
                case "create_job":
                case "list_jobs":
                  queryClient.invalidateQueries({ queryKey: ["job-sites"] });
                  queryClient.invalidateQueries({ queryKey: ["jobs"] });
                  break;
                case "create_estimate":
                case "list_estimates":
                case "update_estimate":
                case "add_line_item_to_estimate":
                case "update_line_item":
                case "delete_line_item":
                case "add_entry_to_line_item":
                case "update_entry":
                case "delete_entry":
                case "get_estimate_details":
                case "clear_all_line_items":
                  queryClient.invalidateQueries({ queryKey: ["estimates"] });
                  break;
                case "create_invoice":
                case "convert_estimate_to_invoice":
                case "get_invoice_details":
                case "update_invoice":
                  queryClient.invalidateQueries({ queryKey: ["invoices"] });
                  queryClient.invalidateQueries({ queryKey: ["estimates"] });
                  break;
                case "create_note":
                  queryClient.invalidateQueries({ queryKey: ["notes"] });
                  break;
                case "list_saved_items":
                  queryClient.invalidateQueries({ queryKey: ["saved-items"] });
                  break;
                case "create_contact":
                case "list_contacts":
                case "set_primary_contact":
                  queryClient.invalidateQueries({ queryKey: ["contacts"] });
                  queryClient.invalidateQueries({ queryKey: ["job-sites"] });
                  queryClient.invalidateQueries({ queryKey: ["jobs"] });
                  break;
              }
            }
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
        {!isUser && <Text style={styles.aiLabel}>AI</Text>}
        <Text style={[styles.messageText, isUser && styles.userText]}>
          {item.content}
        </Text>
        {item.actions && item.actions.length > 0 && (
          <View style={styles.actionsContainer}>
            {item.actions.map((action, idx) => (
              <View key={idx} style={styles.actionChip}>
                <Text style={styles.actionIcon}>⚡</Text>
                <Text style={styles.actionText}>
                  {action.result?.message || action.tool}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const thinkingBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#1e293b", "#06b6d4"],
  });

  const iconRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const orbitRotation = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-360deg"],
  });

  return (
    <>
      {/* Floating bubble button — draggable */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.bubbleOuter,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: pulseAnim },
            ],
          },
        ]}
      >
        {/* Glow ring behind the bubble */}
        <Animated.View style={[styles.bubbleGlowRing, { opacity: glowOpacity }]} />
        {/* Orbiting ring */}
        <Animated.View
          style={[
            styles.bubbleOrbitRing,
            { transform: [{ rotate: orbitRotation }] },
          ]}
        >
          <View style={styles.orbitDot} />
        </Animated.View>
        <View
          style={styles.bubble}
          accessibilityLabel="Open AI assistant"
          accessibilityRole="button"
        >
          <Animated.View
            style={[
              styles.bubbleInner,
              { transform: [{ rotate: iconRotation }] },
            ]}
          >
            {/* AI "neural node" icon — central dot with radiating lines */}
            <View style={styles.aiIconCenter} />
            <View style={[styles.aiIconRay, styles.aiRay1]} />
            <View style={[styles.aiIconRay, styles.aiRay2]} />
            <View style={[styles.aiIconRay, styles.aiRay3]} />
            <View style={[styles.aiIconRay, styles.aiRay4]} />
            <View style={[styles.aiIconNode, styles.aiNode1]} />
            <View style={[styles.aiIconNode, styles.aiNode2]} />
            <View style={[styles.aiIconNode, styles.aiNode3]} />
            <View style={[styles.aiIconNode, styles.aiNode4]} />
          </Animated.View>
        </View>
      </Animated.View>

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
          <Animated.View
            style={[
              styles.chatContainer,
              isPending && { borderColor: thinkingBorderColor, borderWidth: 1 },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerDot} />
                <Text style={styles.headerTitle}>SiteKeeper AI</Text>
              </View>
              <View style={styles.headerContext}>
                <Text style={styles.headerContextText}>
                  ◈ {screenName}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setMessages([]);
                  setInput("");
                }}
                style={styles.newChatButton}
                accessibilityLabel="Start new chat"
                accessibilityRole="button"
              >
                <Text style={styles.newChatIcon}>+</Text>
              </TouchableOpacity>
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
                  <View style={styles.emptyIconContainer}>
                    <View style={styles.emptyAiCenter} />
                    <View style={[styles.emptyAiRay, { transform: [{ rotate: "0deg" }] }]} />
                    <View style={[styles.emptyAiRay, { transform: [{ rotate: "60deg" }] }]} />
                    <View style={[styles.emptyAiRay, { transform: [{ rotate: "120deg" }] }]} />
                  </View>
                  <Text style={styles.emptyTitle}>SiteKeeper AI</Text>
                  <Text style={styles.emptyText}>
                    Your intelligent assistant for managing job sites, estimates, invoices, contacts, and more.
                  </Text>
                  <View style={styles.emptyChips}>
                    <View style={styles.emptyChip}>
                      <Text style={styles.emptyChipText}>Create job sites</Text>
                    </View>
                    <View style={styles.emptyChip}>
                      <Text style={styles.emptyChipText}>Build estimates</Text>
                    </View>
                    <View style={styles.emptyChip}>
                      <Text style={styles.emptyChipText}>Add contacts</Text>
                    </View>
                    <View style={styles.emptyChip}>
                      <Text style={styles.emptyChipText}>Write notes</Text>
                    </View>
                  </View>
                  <Text style={styles.emptyHint}>
                    Try: "Create a job site at 123 Main St with a job for roof repair"
                  </Text>
                </View>
              }
            />

            {/* Loading indicator */}
            {isPending && (
              <View style={styles.loadingRow}>
                <View style={styles.loadingDots}>
                  <View style={[styles.loadingDot, styles.loadingDot1]} />
                  <View style={[styles.loadingDot, styles.loadingDot2]} />
                  <View style={[styles.loadingDot, styles.loadingDot3]} />
                </View>
                <Text style={styles.loadingText}>Processing...</Text>
              </View>
            )}

            {/* Input */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Message SiteKeeper AI..."
                placeholderTextColor="#64748b"
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
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const styles = StyleSheet.create({
  // Floating bubble
  bubbleOuter: {
    position: "absolute",
    bottom: 24,
    left: 16,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleGlowRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#06b6d4",
    shadowColor: "#06b6d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  bubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#06b6d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: "#06b6d4",
  },
  bubbleInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  // AI neural-node icon
  aiIconCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#06b6d4",
    position: "absolute",
    shadowColor: "#06b6d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  aiIconRay: {
    position: "absolute",
    width: 1.5,
    height: 14,
    backgroundColor: "#06b6d4",
    opacity: 0.7,
  },
  aiRay1: {
    transform: [{ rotate: "0deg" }, { translateY: -3 }],
  },
  aiRay2: {
    transform: [{ rotate: "90deg" }, { translateY: -3 }],
  },
  aiRay3: {
    transform: [{ rotate: "45deg" }, { translateY: -3 }],
  },
  aiRay4: {
    transform: [{ rotate: "-45deg" }, { translateY: -3 }],
  },
  aiIconNode: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#22d3ee",
  },
  aiNode1: {
    top: 6,
    left: "50%",
    marginLeft: -2.5,
  },
  aiNode2: {
    bottom: 6,
    left: "50%",
    marginLeft: -2.5,
  },
  aiNode3: {
    left: 6,
    top: "50%",
    marginTop: -2.5,
  },
  aiNode4: {
    right: 6,
    top: "50%",
    marginTop: -2.5,
  },
  bubbleOrbitRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "transparent",
    borderTopColor: "#06b6d4",
    opacity: 0.5,
  },
  orbitDot: {
    position: "absolute",
    top: -2,
    left: "50%",
    marginLeft: -2.5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#06b6d4",
    shadowColor: "#06b6d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  chatContainer: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.78,
    maxHeight: 750,
    shadowColor: "#06b6d4",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 24,
    borderWidth: 1,
    borderColor: "#1e293b",
    borderBottomWidth: 0,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#06b6d4",
    shadowColor: "#06b6d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f1f5f9",
    letterSpacing: 0.5,
  },
  headerContext: {
    marginLeft: 12,
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerContextText: {
    fontSize: 11,
    color: "#06b6d4",
    fontWeight: "500",
  },
  closeButton: {
    marginLeft: "auto",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    color: "#94a3b8",
    fontWeight: "600",
  },
  newChatButton: {
    marginLeft: "auto",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
    marginRight: 8,
  },
  newChatIcon: {
    fontSize: 18,
    color: "#06b6d4",
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
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: "#0ea5e9",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#1e293b",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#334155",
  },
  aiLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#06b6d4",
    letterSpacing: 1,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#e2e8f0",
  },
  userText: {
    color: "#fff",
  },

  // Actions
  actionsContainer: {
    marginTop: 10,
    gap: 6,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#064e3b",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#065f46",
    gap: 6,
  },
  actionIcon: {
    fontSize: 11,
    color: "#34d399",
  },
  actionText: {
    fontSize: 12,
    color: "#6ee7b7",
    fontWeight: "500",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 28,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#06b6d4",
    shadowColor: "#06b6d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  emptyAiCenter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#06b6d4",
    shadowColor: "#06b6d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  emptyAiRay: {
    position: "absolute",
    width: 2,
    height: 24,
    backgroundColor: "#06b6d4",
    opacity: 0.5,
    borderRadius: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  emptyChip: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  emptyChipText: {
    fontSize: 12,
    color: "#06b6d4",
    fontWeight: "500",
  },
  emptyHint: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    fontStyle: "italic",
  },

  // Loading
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  loadingDots: {
    flexDirection: "row",
    gap: 4,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#06b6d4",
    opacity: 0.6,
  },
  loadingDot1: {
    opacity: 1,
  },
  loadingDot2: {
    opacity: 0.6,
  },
  loadingDot3: {
    opacity: 0.3,
  },
  loadingText: {
    fontSize: 13,
    color: "#06b6d4",
    fontWeight: "500",
    letterSpacing: 0.3,
  },

  // Input
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#334155",
    color: "#f1f5f9",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#06b6d4",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#06b6d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  sendDisabled: {
    backgroundColor: "#334155",
    shadowOpacity: 0,
  },
  sendIcon: {
    fontSize: 20,
    color: "#0f172a",
    fontWeight: "700",
  },
});
