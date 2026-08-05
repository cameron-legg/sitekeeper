import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, StyleSheet, Switch,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import {
  useEstimate, useCreateEstimate, useUpdateEstimate,
  useEstimateLineItems, useAddEstimateLineItem, useUpdateEstimateLineItem,
  useDeleteEstimateLineItem, useAddEstimateEntry, useUpdateEstimateEntry,
  useDeleteEstimateEntry, useSaveEstimateLineItemToLibrary,
  usePopulateEstimateDefaults,
} from "../../api/hooks/useEstimates";
import { useSavedItems, usePopulateSavedItem, useSaveEntryToLibrary, usePopulateSavedEntry, useAllSavedEntries } from "../../api/hooks/useSavedItems";
import { useJob } from "../../api/hooks/useJobs";
import { useDocumentFieldSettings, type FieldVisibility } from "../../api/hooks/useDocumentSettings";
import LineItemEditor from "../../components/LineItemEditor";
import DocumentPhotoPicker from "../../components/DocumentPhotoPicker";
import type { LineItemEntry, SavedItem, SavedItemEntry } from "../../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "EstimateEditor">;

/** Debounce hook: returns a stable function that delays calling `fn` */
function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback((...args: any[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]) as unknown as T;
}

export default function EstimateEditorScreen({ route, navigation }: Props) {
  const { estimateId, jobId } = route.params;
  const isNew = !estimateId;

  const { data: estimate, isLoading: loadingEst } = useEstimate(estimateId ?? "");
  const { data: lineItems, isLoading: loadingItems } = useEstimateLineItems(estimateId ?? "");
  const { data: job } = useJob(jobId);

  const createEstimate = useCreateEstimate();
  const updateEstimate = useUpdateEstimate();
  const addLineItem = useAddEstimateLineItem();
  const updateLineItem = useUpdateEstimateLineItem();
  const deleteLineItem = useDeleteEstimateLineItem();
  const addEntry = useAddEstimateEntry();
  const updateEntry = useUpdateEstimateEntry();
  const deleteEntry = useDeleteEstimateEntry();
  const populateDefaults = usePopulateEstimateDefaults();

  // --- Form state ---
  const [title, setTitle] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [billTo, setBillTo] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [worksiteAddress, setWorksiteAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Visibility toggles
  const [showDocumentNumber, setShowDocumentNumber] = useState(true);
  const [showDocumentDate, setShowDocumentDate] = useState(true);
  const [showBillTo, setShowBillTo] = useState(true);
  const [showCompanyName, setShowCompanyName] = useState(true);
  const [showUserName, setShowUserName] = useState(true);
  const [showUserPhone, setShowUserPhone] = useState(true);
  const [showUserEmail, setShowUserEmail] = useState(true);
  const [showPaymentMethod, setShowPaymentMethod] = useState(true);
  const [showBusinessAddress, setShowBusinessAddress] = useState(true);
  const [showWorksiteAddress, setShowWorksiteAddress] = useState(true);
  const [showNotes, setShowNotes] = useState(true);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const initialized = useRef(false);
  const lastSyncedAt = useRef<string | null>(null);

  const saveToLibrary = useSaveEstimateLineItemToLibrary();
  const populateSaved = usePopulateSavedItem();
  const saveEntryToLib = useSaveEntryToLibrary();
  const populateSavedEntry = usePopulateSavedEntry();
  const { data: savedItems } = useSavedItems();
  const { data: allSavedEntries } = useAllSavedEntries();

  // Document field settings (tenant-level visibility config)
  const { data: fieldSettings } = useDocumentFieldSettings("estimate");
  const [showAdditional, setShowAdditional] = useState(false);

  function fieldVisibility(key: string): FieldVisibility {
    const setting = fieldSettings?.find((f) => f.key === key);
    return setting?.visibility ?? "always_show";
  }

  function isFieldVisible(key: string): boolean {
    return fieldVisibility(key) !== "disabled";
  }

  function isFieldAlwaysShow(key: string): boolean {
    return fieldVisibility(key) === "always_show";
  }

  function isFieldAdditional(key: string): boolean {
    return fieldVisibility(key) === "additional";
  }

  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemMode, setAddItemMode] = useState<"new" | "library">("new");
  const [newItemName, setNewItemName] = useState("");
  const [newItemRate, setNewItemRate] = useState("");
  const [newItemError, setNewItemError] = useState<string | null>(null);

  // Initialize form from loaded estimate, and re-sync when data changes externally (e.g. AI updates)
  useEffect(() => {
    if (!estimate) return;
    // First load or external update detected (updated_at changed)
    const isExternalUpdate = initialized.current && estimate.updated_at !== lastSyncedAt.current;
    if (!initialized.current || isExternalUpdate) {
      initialized.current = true;
      lastSyncedAt.current = estimate.updated_at;
      setTitle(estimate.title ?? "");
      setTaxRate(estimate.tax_rate ?? "");
      setDocumentNumber(estimate.document_number ?? "");
      setDocumentDate(estimate.document_date ?? "");
      setBillTo(estimate.bill_to ?? "");
      setCompanyName(estimate.company_name ?? "");
      setUserName(estimate.user_name ?? "");
      setUserPhone(estimate.user_phone ?? "");
      setUserEmail(estimate.user_email ?? "");
      setPaymentMethod(estimate.payment_method ?? "");
      setBusinessAddress(estimate.business_address ?? "");
      setWorksiteAddress(estimate.worksite_address ?? "");
      setNotes(estimate.notes ?? "");
      setShowDocumentNumber(estimate.show_document_number);
      setShowDocumentDate(estimate.show_document_date);
      setShowBillTo(estimate.show_bill_to);
      setShowCompanyName(estimate.show_company_name);
      setShowUserName(estimate.show_user_name);
      setShowUserPhone(estimate.show_user_phone);
      setShowUserEmail(estimate.show_user_email);
      setShowPaymentMethod(estimate.show_payment_method);
      setShowBusinessAddress(estimate.show_business_address);
      setShowWorksiteAddress(estimate.show_worksite_address);
      setShowNotes(estimate.show_notes);
    }
  }, [estimate]);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: isNew ? "New Estimate" : "Edit Estimate" });
  }, [navigation, isNew]);

  // --- Auto-save via debounced PATCH ---
  const debouncedSave = useDebouncedCallback((fields: Record<string, any>) => {
    if (!estimateId) return;
    updateEstimate.mutate({ estimateId, ...fields }, {
      onSuccess: (updated) => {
        // Track our own save so the re-sync effect doesn't overwrite local state
        lastSyncedAt.current = updated.updated_at;
      },
    });
  }, 800);

  // Field change handlers that auto-save
  function onFieldChange(setter: (v: string) => void, field: string, value: string) {
    setter(value);
    if (!estimateId) return;
    if (field === "title" && !value.trim()) return; // don't save empty title
    const payload: Record<string, any> = {};
    if (field === "tax_rate") {
      payload.tax_rate = value.trim() || null;
    } else {
      payload[field] = value;
    }
    debouncedSave(payload);
  }

  function onToggleChange(setter: (v: boolean) => void, field: string, value: boolean) {
    setter(value);
    if (!estimateId) return;
    debouncedSave({ [field]: value });
  }

  // Create new estimate (only for new documents)
  function handleCreate() {
    const t = title.trim();
    if (!t) { setTitleError("Title is required."); return; }
    setTitleError(null);
    setIsCreating(true);
    createEstimate.mutate({ jobId, title: t, tax_rate: taxRate.trim() || undefined }, {
      onSuccess: (est) => {
        setIsCreating(false);
        initialized.current = true;
        navigation.setParams({ estimateId: est.id } as any);
        // Populate form from returned defaults
        setDocumentNumber(est.document_number ?? "");
        setDocumentDate(est.document_date ?? "");
        setBillTo(est.bill_to ?? "");
        setCompanyName(est.company_name ?? "");
        setUserName(est.user_name ?? "");
        setUserPhone(est.user_phone ?? "");
        setUserEmail(est.user_email ?? "");
        setPaymentMethod(est.payment_method ?? "");
        setBusinessAddress(est.business_address ?? "");
        setWorksiteAddress(est.worksite_address ?? "");
        // Apply PDF visibility defaults from settings
        setShowDocumentNumber(est.show_document_number);
        setShowDocumentDate(est.show_document_date);
        setShowBillTo(est.show_bill_to);
        setShowCompanyName(est.show_company_name);
        setShowUserName(est.show_user_name);
        setShowUserPhone(est.show_user_phone);
        setShowUserEmail(est.show_user_email);
        setShowPaymentMethod(est.show_payment_method);
        setShowBusinessAddress(est.show_business_address);
        setShowWorksiteAddress(est.show_worksite_address);
        setShowNotes(est.show_notes);
      },
      onError: () => { setIsCreating(false); setTitleError("Failed to create estimate."); },
    });
  }

  function handleAddLineItem() {
    const name = newItemName.trim();
    if (!name) { setNewItemError("Name is required."); return; }
    if (!estimateId) return;
    setNewItemError(null);
    addLineItem.mutate({ estimateId, name, hourly_rate: newItemRate.trim() || undefined }, {
      onSuccess: () => { setShowAddItem(false); setNewItemName(""); setNewItemRate(""); },
      onError: () => setNewItemError("Failed to add line item."),
    });
  }

  function handlePickFromLibrary(saved: SavedItem) {
    if (!estimateId) return;
    populateSaved.mutate({ itemId: saved.id, parentId: estimateId, parentType: "estimate" }, {
      onSuccess: () => setShowAddItem(false),
      onError: () => setNewItemError("Failed to add from library."),
    });
  }

  const grandTotal = (lineItems ?? []).reduce((sum, item) => sum + parseFloat(item.total_cost || "0"), 0);
  const totalHours = (lineItems ?? []).reduce((sum, item) => sum + parseFloat(item.total_hours || "0"), 0);
  const materialsCost = (lineItems ?? []).reduce((sum, item) => {
    let mat = 0;
    for (const entry of item.entries) {
      if (entry.entry_type === "material") {
        mat += parseFloat(entry.unit_price || "0") * parseFloat(entry.quantity || "0");
      }
    }
    return sum + mat;
  }, 0);
  const feeCost = (lineItems ?? []).reduce((sum, item) => {
    let fee = 0;
    for (const entry of item.entries) {
      if (entry.entry_type === "fee") {
        fee += parseFloat(entry.unit_price || "0") * parseFloat(entry.quantity || "1");
      }
    }
    return sum + fee;
  }, 0);
  const laborCost = grandTotal - materialsCost - feeCost;
  const laborAndFees = laborCost + feeCost;

  if (!isNew && (loadingEst || loadingItems)) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <Text style={styles.sectionLabel}>Title</Text>
        {titleError && <Text style={styles.fieldError}>{titleError}</Text>}
        {isNew ? (
          <View style={styles.titleRow}>
            <TextInput style={[styles.input, styles.flex1]} value={title}
              onChangeText={(v) => { setTitle(v); setTitleError(null); }} placeholder="Estimate title" />
            <TouchableOpacity style={[styles.createBtn, isCreating && styles.btnDisabled]}
              onPress={handleCreate} disabled={isCreating}>
              {isCreating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.createBtnText}>Create</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <TextInput style={styles.input} value={title}
            onChangeText={(v) => onFieldChange(setTitle, "title", v)} placeholder="Estimate title" />
        )}

        {/* Only show full editor after creation */}
        {estimateId && (
          <>
            {/* Tax Rate */}
            {isFieldAlwaysShow("tax_rate") && (
              <>
                <Text style={styles.sectionLabel}>Sales Tax Rate %</Text>
                <TextInput style={styles.input} value={taxRate}
                  onChangeText={(v) => onFieldChange(setTaxRate, "tax_rate", v)}
                  placeholder="e.g. 8.5 (leave blank for no tax)" keyboardType="decimal-pad" />
                <Text style={styles.taxHint}>Tax applies to material items only, not labor hours.</Text>
              </>
            )}

            {/* Document Details Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, { marginTop: 0, marginBottom: 0, borderBottomWidth: 0, flex: 1 }]}>Document Details</Text>
              <TouchableOpacity
                style={styles.populateBtn}
                onPress={() => { if (estimateId) populateDefaults.mutate({ estimateId }); }}
                disabled={populateDefaults.isPending}
              >
                {populateDefaults.isPending
                  ? <ActivityIndicator size="small" color="#2563eb" />
                  : <Text style={styles.populateBtnText}>↻ Fill Defaults</Text>}
              </TouchableOpacity>
            </View>

            {isFieldAlwaysShow("document_number") && (
              <MetadataField label="Document #" value={documentNumber}
                onChangeText={(v) => onFieldChange(setDocumentNumber, "document_number", v)}
                showToggle={showDocumentNumber}
                onToggle={(v) => onToggleChange(setShowDocumentNumber, "show_document_number", v)} />
            )}

            {isFieldAlwaysShow("document_date") && (
              <MetadataField label="Date" value={documentDate}
                onChangeText={(v) => onFieldChange(setDocumentDate, "document_date", v)}
                placeholder="YYYY-MM-DD"
                showToggle={showDocumentDate}
                onToggle={(v) => onToggleChange(setShowDocumentDate, "show_document_date", v)}
                extraButton={
                  <TouchableOpacity style={styles.todayBtn} onPress={() => {
                    const today = new Date().toISOString().split("T")[0];
                    setDocumentDate(today);
                    if (estimateId) debouncedSave({ document_date: today });
                  }}>
                    <Text style={styles.todayBtnText}>Today</Text>
                  </TouchableOpacity>
                } />
            )}

            {isFieldAlwaysShow("bill_to") && (
              <MetadataField label="Bill To" value={billTo}
                onChangeText={(v) => onFieldChange(setBillTo, "bill_to", v)}
                showToggle={showBillTo}
                onToggle={(v) => onToggleChange(setShowBillTo, "show_bill_to", v)} />
            )}

            {isFieldAlwaysShow("worksite_address") && (
              <MetadataField label="Worksite Address" value={worksiteAddress}
                onChangeText={(v) => onFieldChange(setWorksiteAddress, "worksite_address", v)}
                showToggle={showWorksiteAddress}
                onToggle={(v) => onToggleChange(setShowWorksiteAddress, "show_worksite_address", v)} />
            )}

            {/* Business Details Section */}
            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Business Details</Text>

            {isFieldAlwaysShow("company_name") && (
              <MetadataField label="Business Name" value={companyName}
                onChangeText={(v) => onFieldChange(setCompanyName, "company_name", v)}
                showToggle={showCompanyName}
                onToggle={(v) => onToggleChange(setShowCompanyName, "show_company_name", v)} />
            )}

            {isFieldAlwaysShow("user_name") && (
              <MetadataField label="Owner / Worker Name" value={userName}
                onChangeText={(v) => onFieldChange(setUserName, "user_name", v)}
                showToggle={showUserName}
                onToggle={(v) => onToggleChange(setShowUserName, "show_user_name", v)} />
            )}

            {isFieldAlwaysShow("business_address") && (
              <MetadataField label="Business Address" value={businessAddress}
                onChangeText={(v) => onFieldChange(setBusinessAddress, "business_address", v)}
                showToggle={showBusinessAddress}
                onToggle={(v) => onToggleChange(setShowBusinessAddress, "show_business_address", v)} />
            )}

            {isFieldAlwaysShow("user_phone") && (
              <MetadataField label="Phone" value={userPhone}
                onChangeText={(v) => onFieldChange(setUserPhone, "user_phone", v)}
                showToggle={showUserPhone}
                onToggle={(v) => onToggleChange(setShowUserPhone, "show_user_phone", v)} />
            )}

            {isFieldAlwaysShow("user_email") && (
              <MetadataField label="Email" value={userEmail}
                onChangeText={(v) => onFieldChange(setUserEmail, "user_email", v)}
                showToggle={showUserEmail}
                onToggle={(v) => onToggleChange(setShowUserEmail, "show_user_email", v)} />
            )}

            {isFieldAlwaysShow("payment_method") && (
              <MetadataField label="Payment Method" value={paymentMethod}
                onChangeText={(v) => onFieldChange(setPaymentMethod, "payment_method", v)}
                showToggle={showPaymentMethod}
                onToggle={(v) => onToggleChange(setShowPaymentMethod, "show_payment_method", v)} />
            )}

            {/* Additional Notes */}
            {isFieldAlwaysShow("notes") && (
              <>
                <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Additional Notes</Text>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Show in PDF</Text>
                  <Switch value={showNotes} onValueChange={(v) => onToggleChange(setShowNotes, "show_notes", v)}
                    trackColor={{ true: "#2563eb" }} />
                </View>
                <TextInput style={[styles.input, styles.multiline]} value={notes}
                  onChangeText={(v) => onFieldChange(setNotes, "notes", v)}
                  placeholder="Additional notes (supports markdown)" multiline numberOfLines={4} />
              </>
            )}

            {/* Document Photos */}
            {isFieldAlwaysShow("photos") && (
              <DocumentPhotoPicker documentId={estimateId} documentType="estimate" jobId={jobId} />
            )}

            {/* Additional Options accordion */}
            {fieldSettings?.some((f) => f.visibility === "additional") && (
              <>
                <TouchableOpacity
                  style={styles.additionalToggle}
                  onPress={() => setShowAdditional((v) => !v)}
                >
                  <Text style={styles.additionalToggleText}>
                    {showAdditional ? "▲ Hide Additional Options" : "▼ Show Additional Options"}
                  </Text>
                </TouchableOpacity>

                {showAdditional && (
                  <View style={styles.additionalSection}>
                    {isFieldAdditional("tax_rate") && (
                      <>
                        <Text style={styles.sectionLabel}>Sales Tax Rate %</Text>
                        <TextInput style={styles.input} value={taxRate}
                          onChangeText={(v) => onFieldChange(setTaxRate, "tax_rate", v)}
                          placeholder="e.g. 8.5 (leave blank for no tax)" keyboardType="decimal-pad" />
                        <Text style={styles.taxHint}>Tax applies to material items only, not labor hours.</Text>
                      </>
                    )}
                    {isFieldAdditional("document_number") && (
                      <MetadataField label="Document #" value={documentNumber}
                        onChangeText={(v) => onFieldChange(setDocumentNumber, "document_number", v)}
                        showToggle={showDocumentNumber}
                        onToggle={(v) => onToggleChange(setShowDocumentNumber, "show_document_number", v)} />
                    )}
                    {isFieldAdditional("document_date") && (
                      <MetadataField label="Date" value={documentDate}
                        onChangeText={(v) => onFieldChange(setDocumentDate, "document_date", v)}
                        placeholder="YYYY-MM-DD"
                        showToggle={showDocumentDate}
                        onToggle={(v) => onToggleChange(setShowDocumentDate, "show_document_date", v)}
                        extraButton={
                          <TouchableOpacity style={styles.todayBtn} onPress={() => {
                            const today = new Date().toISOString().split("T")[0];
                            setDocumentDate(today);
                            if (estimateId) debouncedSave({ document_date: today });
                          }}>
                            <Text style={styles.todayBtnText}>Today</Text>
                          </TouchableOpacity>
                        } />
                    )}
                    {isFieldAdditional("bill_to") && (
                      <MetadataField label="Bill To" value={billTo}
                        onChangeText={(v) => onFieldChange(setBillTo, "bill_to", v)}
                        showToggle={showBillTo}
                        onToggle={(v) => onToggleChange(setShowBillTo, "show_bill_to", v)} />
                    )}
                    {isFieldAdditional("worksite_address") && (
                      <MetadataField label="Worksite Address" value={worksiteAddress}
                        onChangeText={(v) => onFieldChange(setWorksiteAddress, "worksite_address", v)}
                        showToggle={showWorksiteAddress}
                        onToggle={(v) => onToggleChange(setShowWorksiteAddress, "show_worksite_address", v)} />
                    )}
                    {isFieldAdditional("company_name") && (
                      <MetadataField label="Business Name" value={companyName}
                        onChangeText={(v) => onFieldChange(setCompanyName, "company_name", v)}
                        showToggle={showCompanyName}
                        onToggle={(v) => onToggleChange(setShowCompanyName, "show_company_name", v)} />
                    )}
                    {isFieldAdditional("user_name") && (
                      <MetadataField label="Owner / Worker Name" value={userName}
                        onChangeText={(v) => onFieldChange(setUserName, "user_name", v)}
                        showToggle={showUserName}
                        onToggle={(v) => onToggleChange(setShowUserName, "show_user_name", v)} />
                    )}
                    {isFieldAdditional("business_address") && (
                      <MetadataField label="Business Address" value={businessAddress}
                        onChangeText={(v) => onFieldChange(setBusinessAddress, "business_address", v)}
                        showToggle={showBusinessAddress}
                        onToggle={(v) => onToggleChange(setShowBusinessAddress, "show_business_address", v)} />
                    )}
                    {isFieldAdditional("user_phone") && (
                      <MetadataField label="Phone" value={userPhone}
                        onChangeText={(v) => onFieldChange(setUserPhone, "user_phone", v)}
                        showToggle={showUserPhone}
                        onToggle={(v) => onToggleChange(setShowUserPhone, "show_user_phone", v)} />
                    )}
                    {isFieldAdditional("user_email") && (
                      <MetadataField label="Email" value={userEmail}
                        onChangeText={(v) => onFieldChange(setUserEmail, "user_email", v)}
                        showToggle={showUserEmail}
                        onToggle={(v) => onToggleChange(setShowUserEmail, "show_user_email", v)} />
                    )}
                    {isFieldAdditional("payment_method") && (
                      <MetadataField label="Payment Method" value={paymentMethod}
                        onChangeText={(v) => onFieldChange(setPaymentMethod, "payment_method", v)}
                        showToggle={showPaymentMethod}
                        onToggle={(v) => onToggleChange(setShowPaymentMethod, "show_payment_method", v)} />
                    )}
                    {isFieldAdditional("notes") && (
                      <>
                        <Text style={[styles.sectionHeader, { marginTop: 12 }]}>Additional Notes</Text>
                        <View style={styles.toggleRow}>
                          <Text style={styles.toggleLabel}>Show in PDF</Text>
                          <Switch value={showNotes} onValueChange={(v) => onToggleChange(setShowNotes, "show_notes", v)}
                            trackColor={{ true: "#2563eb" }} />
                        </View>
                        <TextInput style={[styles.input, styles.multiline]} value={notes}
                          onChangeText={(v) => onFieldChange(setNotes, "notes", v)}
                          placeholder="Additional notes (supports markdown)" multiline numberOfLines={4} />
                      </>
                    )}
                    {isFieldAdditional("photos") && (
                      <DocumentPhotoPicker documentId={estimateId} documentType="estimate" jobId={jobId} />
                    )}
                  </View>
                )}
              </>
            )}

            {/* Line Items */}
            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Line Items</Text>

            {(lineItems ?? []).map((item) => (
              <LineItemEditor
                key={item.id} item={item}
                onUpdateItem={(data) => updateLineItem.mutate({ estimateId, itemId: item.id, ...data })}
                onDeleteItem={() => deleteLineItem.mutate({ estimateId, itemId: item.id })}
                onAddEntry={(values) => addEntry.mutate({ estimateId, itemId: item.id, ...values })}
                onUpdateEntry={(entryId, values) => {
                  const cleaned: Record<string, string | undefined> = {};
                  for (const [k, v] of Object.entries(values)) { cleaned[k] = typeof v === "string" && v.trim() === "" ? undefined : v; }
                  updateEntry.mutate({ estimateId, itemId: item.id, entryId, ...cleaned });
                }}
                onDeleteEntry={(entryId) => deleteEntry.mutate({ estimateId, itemId: item.id, entryId })}
                onSaveToLibrary={() => saveToLibrary.mutate({ estimateId, itemId: item.id })}
                onSaveEntryToLibrary={(entry: LineItemEntry) => saveEntryToLib.mutate({
                  entry_type: entry.entry_type, name: entry.name, notes: entry.notes ?? undefined,
                  url: entry.url ?? undefined, unit_price: entry.unit_price ?? undefined,
                  quantity: entry.quantity ?? undefined, hours: entry.hours ?? undefined,
                })}
                savedItems={savedItems}
                onPickSavedEntry={(savedEntry: SavedItemEntry) => populateSavedEntry.mutate({
                  entryId: savedEntry.id, lineItemId: item.id, parentId: estimateId, parentType: "estimate",
                })}
                allSavedEntries={allSavedEntries}
                isSavingEntry={addEntry.isPending || updateEntry.isPending}
              />
            ))}

            {(lineItems ?? []).length === 0 && (
              <Text style={styles.emptyText}>No line items yet. Tap "Add Line Item" to start.</Text>
            )}

            {/* Grand total */}
            {(lineItems ?? []).length > 0 && (
              <View style={styles.grandTotalBlock}>
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>Materials</Text>
                  <Text style={styles.grandTotalValue}>${materialsCost.toFixed(2)}</Text>
                </View>
                {estimate?.tax_rate && parseFloat(estimate.tax_rate) > 0 && (
                  <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>Tax ({estimate.tax_rate}%)</Text>
                    <Text style={styles.grandTotalValue}>${parseFloat(estimate.tax_amount || "0").toFixed(2)}</Text>
                  </View>
                )}
                {estimate?.tax_rate && parseFloat(estimate.tax_rate) > 0 && (
                  <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>Materials + Tax</Text>
                    <Text style={styles.grandTotalValue}>${(materialsCost + parseFloat(estimate.tax_amount || "0")).toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.grandTotalRow, { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 6, marginTop: 2 }]}>
                  <Text style={styles.grandTotalLabel}>Labor ({totalHours.toFixed(2)}h)</Text>
                  <Text style={styles.grandTotalValue}>${laborCost.toFixed(2)}</Text>
                </View>
                {feeCost > 0 && (
                  <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>Fees</Text>
                    <Text style={styles.grandTotalValue}>${feeCost.toFixed(2)}</Text>
                  </View>
                )}
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>Labor & Fees (Profit)</Text>
                  <Text style={[styles.grandTotalValue, { color: "#065f46", fontWeight: "600" }]}>${laborAndFees.toFixed(2)}</Text>
                </View>
                <View style={[styles.grandTotalRow, styles.grandTotalFinal]}>
                  <Text style={styles.grandTotalFinalLabel}>Total</Text>
                  <Text style={styles.grandTotalFinalValue}>
                    ${parseFloat(estimate?.total || grandTotal.toFixed(2)).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.addItemBtn} onPress={() => { setNewItemName(""); setNewItemRate(job?.default_hourly_rate ?? ""); setNewItemError(null); setAddItemMode("new"); setShowAddItem(true); }}>
              <Text style={styles.addItemBtnText}>+ Add Line Item</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Add line item modal */}
      <Modal visible={showAddItem} transparent animationType="fade" onRequestClose={() => setShowAddItem(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Line Item</Text>
            <View style={styles.modeTabs}>
              <TouchableOpacity style={[styles.modeTab, addItemMode === "new" && styles.modeTabActive]} onPress={() => setAddItemMode("new")}>
                <Text style={[styles.modeTabText, addItemMode === "new" && styles.modeTabTextActive]}>New Item</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeTab, addItemMode === "library" && styles.modeTabActive]} onPress={() => setAddItemMode("library")}>
                <Text style={[styles.modeTabText, addItemMode === "library" && styles.modeTabTextActive]}>From Library</Text>
              </TouchableOpacity>
            </View>
            {newItemError && <Text style={styles.fieldError}>{newItemError}</Text>}
            {addItemMode === "new" ? (
              <>
                <Text style={styles.fieldLabel}>Name <Text style={styles.req}>*</Text></Text>
                <TextInput style={styles.input} value={newItemName} onChangeText={setNewItemName} placeholder="e.g. Toilet Replacement" autoFocus />
                <Text style={styles.fieldLabel}>Hourly Rate (optional)</Text>
                <TextInput style={styles.input} value={newItemRate} onChangeText={setNewItemRate} placeholder="e.g. 85.00" keyboardType="decimal-pad" />
                <Text style={styles.rateHint}>Used to calculate cost of hours entries under this item.</Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddItem(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, addLineItem.isPending && styles.btnDisabled]} onPress={handleAddLineItem} disabled={addLineItem.isPending}>
                    {addLineItem.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmText}>Add</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {(savedItems ?? []).length === 0 ? (
                  <Text style={styles.emptyLibText}>No saved items yet. Create one from a line item using "📚 Save".</Text>
                ) : (
                  (savedItems ?? []).map((saved) => (
                    <TouchableOpacity key={saved.id} style={styles.savedItemRow} onPress={() => handlePickFromLibrary(saved)} disabled={populateSaved.isPending}>
                      <View style={styles.savedItemInfo}>
                        <Text style={styles.savedItemName}>{saved.name}</Text>
                        {saved.hourly_rate && <Text style={styles.savedItemMeta}>${saved.hourly_rate}/hr</Text>}
                        <Text style={styles.savedItemMeta}>{saved.entries.length} entries</Text>
                      </View>
                      <Text style={styles.pickText}>Add →</Text>
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddItem(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Reusable metadata field row with label, input, and visibility toggle */
function MetadataField({ label, value, onChangeText, placeholder, showToggle, onToggle, extraButton }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; showToggle: boolean; onToggle: (v: boolean) => void;
  extraButton?: React.ReactNode;
}) {
  return (
    <View style={styles.metaFieldContainer}>
      <View style={styles.metaFieldHeader}>
        <Text style={styles.metaFieldLabel}>{label}</Text>
        <View style={styles.toggleRow}>
          {extraButton}
          <Text style={styles.toggleLabel}>PDF</Text>
          <Switch value={showToggle} onValueChange={onToggle} trackColor={{ true: "#2563eb" }} />
        </View>
      </View>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText}
        placeholder={placeholder ?? label} />
    </View>
  );
}


const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f3f4f6" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  sectionHeader: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 6 },
  fieldError: { color: "#dc2626", fontSize: 13, marginBottom: 4 },
  titleRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#1a1a1a", backgroundColor: "#fff", marginBottom: 8 },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  flex1: { flex: 1 },
  createBtn: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", minWidth: 80 },
  createBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
  taxHint: { fontSize: 12, color: "#9ca3af", marginTop: -4, marginBottom: 12 },
  additionalToggle: { backgroundColor: "#f0f9ff", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 16, marginBottom: 8, borderWidth: 1, borderColor: "#bfdbfe" },
  additionalToggleText: { fontSize: 14, fontWeight: "600", color: "#2563eb" },
  additionalSection: { backgroundColor: "#f9fafb", borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 20 },
  grandTotalBlock: { backgroundColor: "#f9fafb", borderRadius: 10, padding: 14, borderTopWidth: 2, borderTopColor: "#e5e7eb", marginTop: 8 },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  grandTotalLabel: { fontSize: 14, color: "#6b7280" },
  grandTotalValue: { fontSize: 14, color: "#374151" },
  grandTotalFinal: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8, marginTop: 2, marginBottom: 0 },
  grandTotalFinalLabel: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
  grandTotalFinalValue: { fontSize: 20, fontWeight: "700", color: "#2563eb" },
  addItemBtn: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  addItemBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  // Metadata field styles
  metaFieldContainer: { marginBottom: 4 },
  metaFieldHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  metaFieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  toggleLabel: { fontSize: 11, color: "#6b7280" },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 6 },
  populateBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  populateBtnText: { fontSize: 12, fontWeight: "600", color: "#2563eb" },
  todayBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: "#e0e7ff" },
  todayBtnText: { fontSize: 11, fontWeight: "600", color: "#4338ca" },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 4, marginTop: 12 },
  req: { color: "#dc2626" },
  rateHint: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 20 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  cancelText: { fontSize: 14, color: "#374151" },
  confirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#2563eb", minWidth: 80, alignItems: "center" },
  confirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  modeTabs: { flexDirection: "row", borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden", marginBottom: 12 },
  modeTab: { flex: 1, paddingVertical: 9, alignItems: "center", backgroundColor: "#f9fafb" },
  modeTabActive: { backgroundColor: "#2563eb" },
  modeTabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  modeTabTextActive: { color: "#fff" },
  emptyLibText: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 16 },
  savedItemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  savedItemInfo: { flex: 1 },
  savedItemName: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  savedItemMeta: { fontSize: 12, color: "#6b7280" },
  pickText: { fontSize: 14, color: "#2563eb", fontWeight: "600" },
});
