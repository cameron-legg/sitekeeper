/**
 * Utilities Registry — central manifest of all toggleable feature modules.
 *
 * Each utility declares:
 * - id: matches the backend utility ID in tenants.json
 * - screens: screens to register in the navigator
 * - jobDetailTabs: tabs to render in JobDetailScreen
 * - settingsItems: items to render in SettingsScreen
 */

import type { ComponentType } from "react";
import { useAppContext } from "../core/api/hooks/useAppContext";

// Utility screen imports — contacts
import ContactEditorScreen from "./contacts/screens/ContactEditorScreen";
import ContactsTab from "./contacts/components/ContactsTab";

// Utility screen imports — estimates
import EstimateEditorScreen from "./estimates/screens/EstimateEditorScreen";
import EstimateSettingsScreen from "./estimates/screens/EstimateSettingsScreen";
import EditEstimateOptionsScreen from "./estimates/screens/EditEstimateOptionsScreen";
import EstimatesTab from "./estimates/components/EstimatesTab";

// Utility screen imports — invoices
import InvoiceEditorScreen from "./invoices/screens/InvoiceEditorScreen";
import InvoiceManagementScreen from "./invoices/screens/InvoiceManagementScreen";
import InvoiceSettingsScreen from "./invoices/screens/InvoiceSettingsScreen";
import EditInvoiceOptionsScreen from "./invoices/screens/EditInvoiceOptionsScreen";
import InvoicesTab from "./invoices/components/InvoicesTab";

// Utility screen imports — notes
import NotesTab from "./notes/components/NotesTab";

// Utility screen imports — photos
import MediaTab from "./photos/components/MediaTab";

// Utility screen imports — saved items
import SavedItemsScreen from "./saved_items/screens/SavedItemsScreen";
import SavedItemEditorScreen from "./saved_items/screens/SavedItemEditorScreen";
import MaterialsLibraryScreen from "./saved_items/screens/MaterialsLibraryScreen";

export interface UtilityScreen {
  name: string;
  component: ComponentType<any>;
  options?: Record<string, any>;
}

export interface UtilityTab {
  key: string;
  label: string;
  component: ComponentType<any>;
}

export interface UtilitySettingsItem {
  key: string;
  label: string;
  screen: string;
}

export interface UtilityManifest {
  id: string;
  screens: UtilityScreen[];
  jobDetailTabs: UtilityTab[];
  settingsItems: UtilitySettingsItem[];
}

export const ALL_UTILITIES: UtilityManifest[] = [
  {
    id: "notes",
    screens: [],
    jobDetailTabs: [
      { key: "notes", label: "Notes", component: NotesTab },
    ],
    settingsItems: [],
  },
  {
    id: "contacts",
    screens: [
      { name: "ContactEditor", component: ContactEditorScreen, options: { headerShown: true, title: "Contact" } },
    ],
    jobDetailTabs: [
      { key: "contacts", label: "Contacts", component: ContactsTab },
    ],
    settingsItems: [],
  },
  {
    id: "estimates",
    screens: [
      { name: "EstimateEditor", component: EstimateEditorScreen, options: { headerShown: true, title: "Estimate" } },
      { name: "EstimateSettings", component: EstimateSettingsScreen, options: { headerShown: true, title: "Estimate Settings" } },
      { name: "EditEstimateOptions", component: EditEstimateOptionsScreen, options: { headerShown: true, title: "Edit Estimate Options" } },
    ],
    jobDetailTabs: [
      { key: "estimates", label: "Estimates", component: EstimatesTab },
    ],
    settingsItems: [
      { key: "estimate-settings", label: "Estimate Defaults", screen: "EstimateSettings" },
    ],
  },
  {
    id: "invoices",
    screens: [
      { name: "InvoiceEditor", component: InvoiceEditorScreen, options: { headerShown: true, title: "Invoice" } },
      { name: "InvoiceManagement", component: InvoiceManagementScreen, options: { headerShown: true, title: "Invoice Management" } },
      { name: "InvoiceSettings", component: InvoiceSettingsScreen, options: { headerShown: true, title: "Invoice Settings" } },
      { name: "EditInvoiceOptions", component: EditInvoiceOptionsScreen, options: { headerShown: true, title: "Edit Invoice Options" } },
    ],
    jobDetailTabs: [
      { key: "invoices", label: "Invoices", component: InvoicesTab },
    ],
    settingsItems: [
      { key: "invoice-settings", label: "Invoice Defaults", screen: "InvoiceSettings" },
    ],
  },
  {
    id: "time_tracking",
    screens: [],
    jobDetailTabs: [],
    settingsItems: [],
  },
  {
    id: "photos",
    screens: [],
    jobDetailTabs: [
      { key: "media", label: "Media", component: MediaTab },
    ],
    settingsItems: [],
  },
  {
    id: "pdf",
    screens: [],
    jobDetailTabs: [],
    settingsItems: [],
  },
  {
    id: "saved_items",
    screens: [
      { name: "SavedItems", component: SavedItemsScreen, options: { headerShown: true, title: "Item Library" } },
      { name: "SavedItemEditor", component: SavedItemEditorScreen, options: { headerShown: true, title: "Saved Item" } },
      { name: "MaterialsLibrary", component: MaterialsLibraryScreen, options: { headerShown: true, title: "Materials Library" } },
    ],
    jobDetailTabs: [],
    settingsItems: [],
  },
  {
    id: "ai_assistant",
    screens: [],
    jobDetailTabs: [],
    settingsItems: [],
  },
];

export const ALL_UTILITY_IDS = ALL_UTILITIES.map((u) => u.id);

/**
 * Hook that returns the list of enabled utility IDs for the current tenant.
 * Returns all utility IDs if the backend doesn't specify (backwards compat).
 */
export function useEnabledUtilities(): string[] {
  const { data } = useAppContext();
  if (!data || data.mode !== "tenant") return ALL_UTILITY_IDS;
  return data.utilities ?? ALL_UTILITY_IDS;
}

/**
 * Hook to check if a specific utility is enabled.
 */
export function useIsUtilityEnabled(id: string): boolean {
  const enabled = useEnabledUtilities();
  return enabled.includes(id);
}

/**
 * Returns only the utility manifests that are enabled for the current tenant.
 */
export function useEnabledUtilityManifests(): UtilityManifest[] {
  const enabled = useEnabledUtilities();
  return ALL_UTILITIES.filter((u) => enabled.includes(u.id));
}
