/**
 * AIProvider — Wraps the app to provide the floating AI chat bubble
 * with awareness of the current navigation screen.
 *
 * This component listens to navigation state changes and passes the
 * current screen name and params to the AIChatBubble.
 *
 * The bubble is hidden when:
 * - The user is not authenticated (no token)
 * - The AI utility is disabled
 * - Navigation is not ready (e.g. on the landing page which renders
 *   outside of NavigationContainer)
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
  const [navReady, setNavReady] = useState(false);
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
        setNavReady(true);
        updateScreen();
      }
    }, 100);

    // If navigation never becomes ready (landing page), the bubble stays hidden
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
      {/* Only show AI bubble when authenticated, nav is mounted, and utility is enabled */}
      {token && aiEnabled && navReady && (
        <AIChatBubble
          screenName={currentScreen.name}
          screenParams={currentScreen.params}
        />
      )}
    </>
  );
}
