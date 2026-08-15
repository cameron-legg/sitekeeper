/**
 * PdfDoc — documentation for the PDF Generation utility.
 */

import React from "react";
import DocPageLayout from "./DocPageLayout";

const estimatePdfScreenshot = require("../../../../../assets/landing/docs/estimate-pdf.png");
const invoicePdfScreenshot = require("../../../../../assets/landing/docs/invoice-pdf.png");

export default function PdfDoc({ onBack }: { onBack: () => void }) {
  return (
    <DocPageLayout
      onBack={onBack}
      icon="📄"
      title="PDF Generation"
      subtitle="Generate professional PDF documents for estimates and invoices."
      sections={[
        {
          title: "What It Does",
          content:
            "The PDF utility generates professionally formatted PDF documents from your estimates and invoices. These PDFs include your company branding, line item breakdowns, totals with tax, contact information, and optionally attached photos. The generated PDFs are stored securely and can be downloaded or shared with clients.",
          screenshot: estimatePdfScreenshot,
        },
        {
          title: "How It Works",
          content:
            "When you tap 'Generate PDF', the system collects all document data (line items, entries, totals, metadata, photos, logo) and feeds it into a ReportLab-based PDF generator. The resulting PDF is stored in your tenant's MinIO bucket and linked to the document.\n\nThe system tracks a 'PDF status' for each document:\n• None — no PDF has been generated yet\n• Current — the PDF matches the document's current state\n• Stale — the document has been modified since the last PDF was generated\n\nThis status helps you know when you need to re-generate before sending to a client.",
        },
        {
          title: "PDF Content",
          bullets: [
            "Company logo (if uploaded in business settings)",
            "Company name and contact information",
            "Document number and date",
            "Bill-to name (from primary contact)",
            "Worksite address (from job site)",
            "Business address",
            "Payment method information",
            "Itemized line items with materials, labor, and fees",
            "Subtotal, tax breakdown (materials only), and grand total",
            "Notes section (supports markdown-style formatting)",
            "Attached photos from the job",
          ],
          screenshot: invoicePdfScreenshot,
        },
        {
          title: "Visibility Controls",
          content:
            "Every metadata field on an estimate/invoice has a corresponding 'show' toggle. This lets you control exactly what appears in the PDF without deleting the data. For example, you might want to record the payment method internally but not show it on the client-facing PDF.\n\nVisibility defaults are configurable at the tenant level in Settings, so new documents automatically inherit your preferred visibility configuration.",
        },
        {
          title: "How to Use",
          content:
            "1. Open an estimate or invoice in the editor.\n2. Make sure all line items, entries, and metadata are correct.\n3. Adjust visibility toggles if needed (the eye icons next to each field).\n4. Tap 'Generate PDF'.\n5. Once generated, tap 'Download PDF' to save or share it.\n6. If you make changes after generating, the status will show 'Stale' — regenerate before sending to the client.",
        },
      ]}
    />
  );
}
