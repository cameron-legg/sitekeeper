/**
 * RootNavigator — top-level navigation structure.
 *
 * Switches between AuthStack (unauthenticated) and AppStack (authenticated)
 * based on the presence of a token in the Zustand auth store.
 *
 * Web URL routing is configured via the `linking` prop so that each screen
 * maps to a clean URL path.
 */

import React from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuthStore } from "../store/authStore";
import { navigationRef } from "./navigationRef";
import type { RootStackParamList } from "./types";

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
import MaterialsLibraryScreen from "../screens/app/MaterialsLibraryScreen";
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
      JobSiteDetail: "sites/:siteId",
      JobDetail: "jobs/:jobId",
      EstimateEditor: "estimates/:estimateId?",
      InvoiceEditor: "invoices/:invoiceId?",
      ContactEditor: "contacts/:contactId?",
      SavedItems: "saved-items",
      SavedItemEditor: "saved-items/:itemId?",
      MaterialsLibrary: "materials",
      AdminUsers: "admin/users",
    },
  },
};

export default function RootNavigator() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s._hydrated);

  // Don't render the navigator until the persisted auth state is loaded.
  // Without this, on web the navigator renders with token=null before
  // localStorage is read, causing a blank screen or incorrect redirect.
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

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
