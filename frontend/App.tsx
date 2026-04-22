/**
 * App.tsx — Expo entry point.
 *
 * Wraps the app in:
 * - QueryClientProvider (TanStack Query server state)
 * - RootNavigator (React Navigation + auth-gated routing)
 */

import React from "react";
import { registerRootComponent } from "expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import RootNavigator from "./src/navigation/RootNavigator";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

// registerRootComponent handles AppRegistry.registerComponent for both
// native (Android/iOS) and web, replacing the need for a separate index.js.
registerRootComponent(App);

export default App;
