/**
 * TanStack Query hook for AI chat.
 */

import { useMutation } from "@tanstack/react-query";
import apiClient from "../../../core/api/client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIAction {
  tool: string;
  args: Record<string, unknown>;
  result: {
    success: boolean;
    message?: string;
    [key: string]: unknown;
  };
}

export interface AIChatResponse {
  response: string;
  actions: AIAction[];
}

interface ChatRequest {
  messages: ChatMessage[];
  screen_context: {
    screen: string;
    params: Record<string, unknown>;
  };
}

export function useAIChat() {
  return useMutation({
    mutationFn: (request: ChatRequest) =>
      apiClient
        .post<AIChatResponse>("/api/v1/ai/chat", request)
        .then((r) => r.data),
  });
}
