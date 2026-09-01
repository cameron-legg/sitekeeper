/**
 * App.tsx — Expo entry point.
 *
 * Wraps the app in:
 * - QueryClientProvider (TanStack Query server state)
 * - AIProvider (floating AI chat bubble with screen awareness)
 * - RootNavigator (React Navigation + auth-gated routing)
 */

import React from "react";
import { registerRootComponent } from "expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, ActivityIndicator, View } from "react-native";
import { useFonts } from "expo-font";
import {
  Montserrat_800ExtraBold,
  Montserrat_900Black,
} from "@expo-google-fonts/montserrat";
import RootNavigator from "./src/core/navigation/RootNavigator";
import AIProvider from "./src/utilities/ai_assistant/components/AIProvider";
import ErrorToast from "./src/core/components/ErrorToast";
import UpdateBanner from "./src/core/components/UpdateBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

function App() {
  const [fontsLoaded] = useFonts({
    Montserrat_800ExtraBold,
    Montserrat_900Black,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FC7E1F" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <AIProvider>
          <RootNavigator />
        </AIProvider>
        <ErrorToast />
        <UpdateBanner />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});

// registerRootComponent handles AppRegistry.registerComponent for both
// native (Android/iOS) and web, replacing the need for a separate index.js.
registerRootComponent(App);

export default App;
