/**
 * RootNavigator — top-level navigation structure.
 *
 * Three-way routing:
 * 1. Landing mode (LANDING_MODE=true on backend, or EXPO_PUBLIC_FORCE_MODE=landing):
 *    Shows the public landing page with tenant directory.
 * 2. Tenant mode, unauthenticated: Shows AuthStack (Login/Register).
 * 3. Tenant mode, authenticated: Shows AppStack (all app screens).
 *
 * Utility screens are dynamically registered based on the tenant's enabled utilities.
 * The mode is determined by calling GET /api/v1/context on boot.
 * Web URL routing is configured via the `linking` prop.
 */

import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuthStore } from "../store/authStore";
import { useAppContext } from "../api/hooks/useAppContext";
import { navigationRef } from "./navigationRef";
import type { RootStackParamList } from "./types";
import { useEnabledUtilityManifests } from "../../utilities";

// Landing screen
import LandingScreen from "../screens/landing/LandingScreen";

// Auth screens
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";

// Core app screens (always registered)
import HomeScreen from "../screens/app/HomeScreen";
import JobSiteDetailScreen from "../screens/app/JobSiteDetailScreen";
import JobDetailScreen from "../screens/app/JobDetailScreen";
import ProfileSettingsScreen from "../screens/app/ProfileSettingsScreen";
import BusinessInfoScreen from "../screens/app/BusinessInfoScreen";
import SettingsScreen from "../screens/app/SettingsScreen";
import AdminUsersScreen from "../screens/app/AdminUsersScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Web deep-link / URL mapping
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    "sitekeeper://",
    "http://localhost:8081",
    "https://entouch.org",
    "https://www.entouch.org",
  ],
  config: {
    screens: {
      Login: "login",
      Register: "register",
      Home: "",
      ProfileSettings: "profile",
      BusinessInfo: "business-info",
      JobSiteDetail: "sites/:siteId",
      JobDetail: "jobs/:jobId",
      EstimateEditor: "estimates/:estimateId?",
      InvoiceEditor: "invoices/:invoiceId?",
      ContactEditor: "contacts/:contactId?",
      SavedItems: "saved-items",
      SavedItemEditor: "saved-items/:itemId?",
      MaterialsLibrary: "materials",
      InvoiceManagement: "invoices/manage",
      Settings: "settings",
      InvoiceSettings: "settings/invoices",
      EstimateSettings: "settings/estimates",
      EditInvoiceOptions: "settings/invoices/options",
      EditEstimateOptions: "settings/estimates/options",
      AdminUsers: "admin/users",
    },
  },
};

export default function RootNavigator() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s._hydrated);
  const { data: appContext, isLoading: contextLoading, isError } = useAppContext();
  const enabledUtilities = useEnabledUtilityManifests();

  // Wait for both the auth store to rehydrate and the context call to resolve.
  if (!hydrated || contextLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // If the context call failed, fall back to tenant mode so existing
  // behavior is preserved (the app still works, just no landing page).
  if (isError || !appContext) {
    // Fall through to tenant mode
  }

  // Landing mode — show the public landing page
  if (appContext?.mode === "landing") {
    return <LandingScreen />;
  }

  // Tenant mode — standard auth-gated navigation
  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token == null ? (
          // ── Unauthenticated ──────────────────────────────────────────
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          // ── Authenticated ────────────────────────────────────────────
          <>
            {/* Core screens (always on) */}
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="ProfileSettings"
              component={ProfileSettingsScreen}
              options={{ headerShown: true, title: "Profile Settings" }}
            />
            <Stack.Screen
              name="BusinessInfo"
              component={BusinessInfoScreen}
              options={{ headerShown: true, title: "Business Information" }}
            />
            <Stack.Screen
              name="JobSiteDetail"
              component={JobSiteDetailScreen}
              options={{ headerShown: true, title: "Job Site" }}
            />
            <Stack.Screen
              name="JobDetail"
              component={JobDetailScreen}
              options={{ headerShown: true, title: "Job" }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: true, title: "Settings" }}
            />
            <Stack.Screen
              name="AdminUsers"
              component={AdminUsersScreen}
              options={{ headerShown: false }}
            />

            {/* Utility screens (dynamically registered based on tenant config) */}
            {enabledUtilities.flatMap((utility) =>
              utility.screens.map((screen) => (
                <Stack.Screen
                  key={screen.name}
                  name={screen.name as keyof RootStackParamList}
                  component={screen.component}
                  options={screen.options}
                />
              ))
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
