/**
 * EstimatesDoc — documentation for the Estimates utility.
 */

import React from "react";
import DocPageLayout from "./DocPageLayout";

const estimatesScreenshot = require("../../../../../assets/landing/docs/estimates-tab.png");
const editorScreenshot = require("../../../../../assets/landing/docs/estimate-editor.png");
const editorItemsScreenshot = require("../../../../../assets/landing/docs/estimate-editor-items.png");

export default function EstimatesDoc({ onBack }: { onBack: () => void }) {
  return (
    <DocPageLayout
      onBack={onBack}
      icon="📝"
      title="Estimates"
      subtitle="Create detailed, professional estimates with itemized materials, labor, and fees."
      sections={[
        {
          title: "What It Does",
          content:
            "The Estimates utility lets you build professional project estimates with a two-level structure: Line Items and Entries. Line Items are named groups of work (like 'Bathroom Renovation' or 'Install Kitchen Faucet'), and each Line Item contains individual Entries for materials, labor hours, and fees. The system automatically calculates totals, applies tax (on materials only), and can generate a PDF for client delivery.",
          screenshot: estimatesScreenshot,
        },
        {
          title: "How It Works",
          content:
            "Each estimate belongs to a job. When you create an estimate, document metadata (your company name, phone, email, bill-to, worksite address) is auto-populated from your business profile and the job's primary contact. You can override any field.\n\nLine Items group related work. Each Line Item has a name, optional notes, and an hourly rate used for labor calculations. Within a Line Item, you add Entries:\n\n• Material entries: name, unit price, quantity → auto-calculates cost\n• Hours entries: name, hours → multiplied by the Line Item's hourly rate\n• Fee entries: name, unit price, quantity → flat fees not subject to tax\n\nTax is applied only to materials at the rate you set (e.g. 8.5%). Labor and fees are never taxed.",
          screenshot: editorItemsScreenshot,
        },
        {
          title: "Key Features",
          bullets: [
            "Two-level structure: Line Items containing material, labor, and fee entries",
            "Automatic total calculation with tax on materials only",
            "Document metadata auto-populated from business profile",
            "Per-field visibility control (show/hide fields on the PDF)",
            "Auto-assigned sequential document numbers",
            "One-tap conversion from estimate to invoice",
            "PDF generation with professional formatting",
            "Photo attachments from job photos",
            "Import line items from your saved Item Library",
            "Customizable tax rate per estimate",
          ],
        },
        {
          title: "Estimate → Invoice Conversion",
          content:
            "When a client approves an estimate, you can convert it to an invoice with a single tap. This deep-copies all line items, entries, document metadata, visibility flags, and attached photos into a new invoice. The invoice starts in 'Drafting' status and gets its own document number. The original estimate remains unchanged for your records.",
        },
        {
          title: "How to Use",
          content:
            "1. Navigate to a job detail screen and tap the Estimates tab.\n2. Tap '+' to create a new estimate. Give it a title.\n3. The estimate editor opens. Add Line Items for each group of work.\n4. Within each Line Item, add material entries (with price and quantity), hours entries, or fee entries.\n5. Set a tax rate if applicable (applies to materials only).\n6. Tap 'Generate PDF' to create a professional document.\n7. When ready, use 'Convert to Invoice' to create an invoice from this estimate.",
          screenshot: editorScreenshot,
        },
      ]}
    />
  );
}
