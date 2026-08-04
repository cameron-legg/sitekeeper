/**
 * RootNavigator — top-level navigation structure.
 *
 * Three-way routing:
 * 1. Landing mode (LANDING_MODE=true on backend, or EXPO_PUBLIC_FORCE_MODE=landing):
 *    Shows the public landing page with tenant directory.
 * 2. Tenant mode, unauthenticated: Shows AuthStack (Login/Register).
 * 3. Tenant mode, authenticated: Shows AppStack (all app screens).
 *
 * The mode is determined by calling GET /api/v1/context on boot.
 * Web URL routing is configured via the `linking` prop.
 */

import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuthStore } from "../store/authStore";
import { useAppContext } from "../api/hooks/useAppContext";
import { navigationRef } from "./navigationRef";
import type { RootStackParamList } from "./types";

// Landing screen
import LandingScreen from "../screens/landing/LandingScreen";

// Auth screens
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";

// App screens
import HomeScreen from "../screens/app/HomeScreen";
import JobSiteDetailScreen from "../screens/app/JobSiteDetailScreen";
import JobDetailScreen from "../screens/app/JobDetailScreen";
import EstimateEditorScreen from "../screens/app/EstimateEditorScreen";
import InvoiceEditorScreen from "../screens/app/InvoiceEditorScreen";
import ContactEditorScreen from "../screens/app/ContactEditorScreen";
import SavedItemsScreen from "../screens/app/SavedItemsScreen";
import SavedItemEditorScreen from "../screens/app/SavedItemEditorScreen";
import ProfileSettingsScreen from "../screens/app/ProfileSettingsScreen";
import BusinessInfoScreen from "../screens/app/BusinessInfoScreen";
import MaterialsLibraryScreen from "../screens/app/MaterialsLibraryScreen";
import InvoiceManagementScreen from "../screens/app/InvoiceManagementScreen";
import SettingsScreen from "../screens/app/SettingsScreen";
import InvoiceSettingsScreen from "../screens/app/InvoiceSettingsScreen";
import EstimateSettingsScreen from "../screens/app/EstimateSettingsScreen";
import EditInvoiceOptionsScreen from "../screens/app/EditInvoiceOptionsScreen";
import EditEstimateOptionsScreen from "../screens/app/EditEstimateOptionsScreen";
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
              name="EstimateEditor"
              component={EstimateEditorScreen}
              options={{ headerShown: true, title: "Estimate" }}
            />
            <Stack.Screen
              name="InvoiceEditor"
              component={InvoiceEditorScreen}
              options={{ headerShown: true, title: "Invoice" }}
            />
            <Stack.Screen
              name="ContactEditor"
              component={ContactEditorScreen}
              options={({ route }) => ({
                headerShown: true,
                title: route.params?.contactId ? "Edit Contact" : "New Contact",
              })}
            />
            <Stack.Screen
              name="SavedItems"
              component={SavedItemsScreen}
              options={{ headerShown: true, title: "Item Library" }}
            />
            <Stack.Screen
              name="SavedItemEditor"
              component={SavedItemEditorScreen}
              options={{ headerShown: true, title: "Saved Item" }}
            />
            <Stack.Screen
              name="MaterialsLibrary"
              component={MaterialsLibraryScreen}
              options={{ headerShown: true, title: "Materials Library" }}
            />
            <Stack.Screen
              name="InvoiceManagement"
              component={InvoiceManagementScreen}
              options={{ headerShown: true, title: "Invoice Management" }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: true, title: "Settings" }}
            />
            <Stack.Screen
              name="InvoiceSettings"
              component={InvoiceSettingsScreen}
              options={{ headerShown: true, title: "Invoice Settings" }}
            />
            <Stack.Screen
              name="EstimateSettings"
              component={EstimateSettingsScreen}
              options={{ headerShown: true, title: "Estimate Settings" }}
            />
            <Stack.Screen
              name="EditInvoiceOptions"
              component={EditInvoiceOptionsScreen}
              options={{ headerShown: true, title: "Edit Invoice Options" }}
            />
            <Stack.Screen
              name="EditEstimateOptions"
              component={EditEstimateOptionsScreen}
              options={{ headerShown: true, title: "Edit Estimate Options" }}
            />
            <Stack.Screen
              name="AdminUsers"
              component={AdminUsersScreen}
              options={{ headerShown: false }}
            />
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
