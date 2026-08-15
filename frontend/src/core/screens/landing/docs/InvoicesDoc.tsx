/**
 * InvoicesDoc — documentation for the Invoices utility.
 */

import React from "react";
import DocPageLayout from "./DocPageLayout";

const invoicesScreenshot = require("../../../../../assets/landing/docs/invoices-tab.png");
const invoiceMgmtScreenshot = require("../../../../../assets/landing/docs/invoice-management.png");
const invoiceEditorScreenshot = require("../../../../../assets/landing/docs/invoice-editor.png");

export default function InvoicesDoc({ onBack }: { onBack: () => void }) {
  return (
    <DocPageLayout
      onBack={onBack}
      icon="💵"
      title="Invoices"
      subtitle="Create, track, and manage invoices through their full lifecycle."
      sections={[
        {
          title: "What It Does",
          content:
            "The Invoices utility handles your billing workflow from creation through payment. Invoices use the same Line Item + Entry structure as estimates, with the addition of a status workflow that tracks where each invoice is in its lifecycle. You can create invoices from scratch or convert them directly from approved estimates.",
          screenshot: invoicesScreenshot,
        },
        {
          title: "Status Workflow",
          content:
            "Every invoice moves through a defined status workflow. Each status change is timestamped and recorded in a history log so you always know when transitions happened:\n\n• Drafting — You're still building the invoice, adding line items, adjusting numbers.\n• Waiting to Send — The invoice is finalized and ready to be delivered to the client.\n• Sent / Awaiting Payment — Delivered to the client, waiting for them to pay.\n• Paid — Payment received. Job done.\n\nThe Invoice Management screen gives you a dashboard view across all jobs and sites, showing which invoices are in each status at a glance.",
        },
        {
          title: "Key Features",
          bullets: [
            "Full status workflow: Drafting → Waiting to Send → Sent → Paid",
            "Status history with timestamps for audit trail",
            "Invoice Management dashboard across all jobs/sites",
            "Same line item + entry structure as estimates",
            "Auto-populated document metadata from business profile",
            "Per-field visibility control on the PDF",
            "Sequential document numbering",
            "One-tap conversion from estimate (deep copies all data)",
            "PDF generation with professional formatting",
            "Photo attachments carried over from estimate conversion",
            "Tax calculation on materials only",
          ],
        },
        {
          title: "How It Works Technically",
          content:
            "Invoices share the same Line Item model as estimates (with a parent_type field distinguishing them). When converted from an estimate, the system performs a deep copy: all line items, all entries within those items, all document metadata fields, visibility flags, and even attached photos are duplicated into the new invoice.\n\nThe invoice gets its own auto-assigned document number from a separate counter. Status changes are recorded in an InvoiceStatusHistory table with the timestamp of each transition.",
          screenshot: invoiceEditorScreenshot,
        },
        {
          title: "How to Use",
          content:
            "1. Navigate to a job and tap the Invoices tab, OR go to Invoice Management from the home screen.\n2. Create a new invoice (or convert from an existing estimate).\n3. Add/edit line items with materials and labor hours.\n4. Set the status as you progress: Drafting → Waiting to Send → Sent → Paid.\n5. Generate a PDF to send to your client.\n6. Use the Invoice Management dashboard to see all invoices across all your jobs at once.",
          screenshot: invoiceMgmtScreenshot,
        },
      ]}
    />
  );
}
