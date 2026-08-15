/**
 * SavedItemsDoc — documentation for the Item Library / Saved Items utility.
 */

import React from "react";
import DocPageLayout from "./DocPageLayout";

const savedItemsScreenshot = require("../../../../../assets/landing/docs/saved-items.png");

export default function SavedItemsDoc({ onBack }: { onBack: () => void }) {
  return (
    <DocPageLayout
      onBack={onBack}
      icon="📚"
      title="Item Library"
      subtitle="Save and reuse line item templates across estimates and invoices."
      sections={[
        {
          title: "What It Does",
          content:
            "The Item Library (Saved Items) lets you create reusable templates for common line items. If you frequently estimate the same types of work — like a 'Standard Faucet Replacement' or 'Bathroom Tile Installation' — you can save them as templates with pre-configured materials, labor hours, and pricing. Then, when building a new estimate or invoice, import from your library instead of re-entering everything from scratch.",
          screenshot: savedItemsScreenshot,
        },
        {
          title: "How It Works",
          content:
            "The library has two levels:\n\n1. Saved Items — These are full line item templates with a name, hourly rate, and a collection of entries (materials, hours, fees). When you 'populate' a saved item into an estimate, it creates a snapshot — a new line item with all its entries copied in. Changes to the original template don't affect previously populated copies.\n\n2. Materials Library — Standalone entries (individual materials or labor tasks) that aren't grouped into a saved item. Think of these as individual building blocks you can add to any line item.\n\nEntries can be moved between standalone and grouped. You can assign a standalone entry to a saved item, or detach it.",
        },
        {
          title: "Key Features",
          bullets: [
            "Create reusable line item templates with materials, labor, and fees",
            "Set default hourly rates per template",
            "Materials Library for individual standalone entries",
            "One-tap populate: copy a template into an estimate or invoice",
            "Populate creates an independent snapshot (no live link to template)",
            "Assign standalone entries to saved items (and vice versa)",
            "Store URLs and notes on entries for reference (e.g. product links)",
            "Import from library directly within the estimate/invoice editor",
            "AI Assistant can reference your library when creating estimates",
          ],
        },
        {
          title: "Saved Item vs Materials Library",
          content:
            "A Saved Item is a complete template that becomes a full line item when populated. It has a name, hourly rate, and multiple entries.\n\nThe Materials Library holds individual entries (a specific material with its price, or a labor task with its hours) that aren't tied to any particular saved item. These are useful when you have common materials you use across many different types of work.\n\nYou can mix and match: assign a material from the library into a saved item, or keep it standalone.",
        },
        {
          title: "How to Use",
          content:
            "Creating Templates:\n1. Navigate to Settings → Item Library.\n2. Tap '+' to create a new saved item.\n3. Give it a name and set an hourly rate.\n4. Add entries: materials (with price and quantity), hours, or fees.\n5. Save. It's now available across all your estimates and invoices.\n\nUsing Templates:\n1. Open an estimate or invoice editor.\n2. Tap 'Add from Library' or the library icon.\n3. Select a saved item to import.\n4. A new line item is created with all the template's entries.\n5. Customize the imported line item as needed for this specific job.",
        },
      ]}
    />
  );
}
