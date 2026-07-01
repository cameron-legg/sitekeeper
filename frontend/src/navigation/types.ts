/**
 * React Navigation type definitions.
 *
 * Centralises all screen param lists so every navigator and screen
 * gets full TypeScript type-checking on route params.
 */

export type RootStackParamList = {
  // Auth screens (unauthenticated)
  Login: undefined;
  Register: undefined;

  // App screens (authenticated)
  Home: undefined;
  ProfileSettings: undefined;
  BusinessInfo: undefined;
  JobSiteDetail: { siteId: string; siteName: string };
  JobDetail: { jobId: string; jobName: string; siteId: string };
  EstimateEditor: { estimateId?: string; jobId: string };
  InvoiceEditor: { invoiceId?: string; jobId: string };
  ContactEditor: {
    contactId?: string;
    parentId: string;
    parentType: "job_site" | "job";
    initialValues?: {
      name?: string;
      phone?: string | null;
      email?: string | null;
      mailing_address?: string | null;
      notes?: string | null;
    };
  };
  SavedItems: { pickerMode?: boolean; onSelect?: (item: SavedItemPickerResult) => void };
  SavedItemEditor: { itemId?: string };
  MaterialsLibrary: undefined;
  InvoiceManagement: undefined;
  Settings: undefined;
  InvoiceSettings: undefined;
  EstimateSettings: undefined;
  EditInvoiceOptions: undefined;
  EditEstimateOptions: undefined;
  AdminUsers: undefined;
};

export type SavedItemPickerResult = {
  id: string;
  name: string;
  notes: string | null;
  url: string | null;
  hours: string | null;
  price: string | null;
};
