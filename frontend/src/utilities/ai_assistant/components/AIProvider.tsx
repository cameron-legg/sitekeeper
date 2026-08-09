/**
 * AIProvider — Wraps the app to provide the floating AI chat bubble
 * with awareness of the current navigation screen.
 *
 * This component listens to navigation state changes and passes the
 * current screen name and params to the AIChatBubble.
 */

import React, { useState, useCallback, useEffect } from "react";
import { navigationRef } from "../../../core/navigation/navigationRef";
import { useAuthStore } from "../../../core/store/authStore";
import { useIsUtilityEnabled } from "../../index";
import AIChatBubble from "./AIChatBubble";

interface ScreenState {
  name: string;
  params: Record<string, unknown>;
}

export default function AIProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const aiEnabled = useIsUtilityEnabled("ai_assistant");
  const [currentScreen, setCurrentScreen] = useState<ScreenState>({
    name: "Home",
    params: {},
  });

  const updateScreen = useCallback(() => {
    if (navigationRef.isReady()) {
      const route = navigationRef.getCurrentRoute();
      if (route) {
        setCurrentScreen({
          name: route.name,
          params: (route.params as Record<string, unknown>) || {},
        });
      }
    }
  }, []);

  useEffect(() => {
    // Poll for navigation readiness, then subscribe to state changes
    const interval = setInterval(() => {
      if (navigationRef.isReady()) {
        clearInterval(interval);
        updateScreen();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [updateScreen]);

  // Listen for navigation state changes via the ref
  useEffect(() => {
    if (!navigationRef.isReady()) return;

    const unsubscribe = navigationRef.addListener("state", () => {
      updateScreen();
    });

    return unsubscribe;
  }, [updateScreen, token]); // re-subscribe when auth changes (navigator remounts)

  return (
    <>
      {children}
      {/* Only show AI bubble when authenticated and utility is enabled */}
      {token && aiEnabled && (
        <AIChatBubble
          screenName={currentScreen.name}
          screenParams={currentScreen.params}
        />
      )}
    </>
  );
}
