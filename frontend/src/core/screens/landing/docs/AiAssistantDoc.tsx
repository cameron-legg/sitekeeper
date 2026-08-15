/**
 * AiAssistantDoc — documentation for the AI Assistant utility.
 */

import React from "react";
import DocPageLayout from "./DocPageLayout";

const aiScreenshot = require("../../../../../assets/landing/docs/ai-assistant.png");

export default function AiAssistantDoc({ onBack }: { onBack: () => void }) {
  return (
    <DocPageLayout
      onBack={onBack}
      icon="🤖"
      title="AI Assistant"
      subtitle="An in-app AI that understands your context and helps you work faster."
      sections={[
        {
          title: "What It Does",
          content:
            "The AI Assistant is a conversational interface that can perform actions in the app on your behalf. It understands which screen you're on, knows your saved items library, and uses your state/region for realistic pricing. You can ask it to create estimates, add contacts, log time, write notes, and more — all through natural language.",
          screenshot: aiScreenshot,
        },
        {
          title: "How It Works",
          content:
            "The AI appears as a floating bubble in the app. When you tap it and type a message, the system sends your conversation along with your current screen context to an AI model (GPT-4o-mini by default). The AI can call 'tools' — functions that map to real actions in the app like creating an estimate or adding a line item.\n\nThe AI uses the same service layer as the regular UI — it doesn't bypass any business logic or access control. It just provides a faster, more natural way to get things done, especially for complex multi-step tasks.\n\nAfter the AI takes actions, the app automatically refreshes relevant screens so you see the results immediately.",
        },
        {
          title: "What It Can Do",
          bullets: [
            "Create job sites and jobs",
            "Create estimates with full line items, materials, and labor",
            "Create invoices with line items",
            "Edit existing estimates: add/update/delete line items and entries",
            "Edit existing invoices: update metadata and fields",
            "Convert estimates to invoices",
            "Create contacts and set primary contacts",
            "Write markdown notes on jobs",
            "Log time entries (manual hours or clock in/out)",
            "Look up your saved items library for template reuse",
            "List job sites, jobs, estimates, and contacts",
            "Use regional pricing based on your state",
          ],
        },
        {
          title: "Screen Context Awareness",
          content:
            "The AI knows which screen you're on and uses that context intelligently:\n\n• On a Job Site Detail screen — it knows the siteId, so 'add a job' doesn't require specifying which site.\n• On a Job Detail screen — it knows the jobId, so 'create an estimate for bathroom work' knows which job.\n• On an Estimate Editor — it knows the estimateId, so 'add a line item for tile work' targets the current estimate.\n• On an Invoice Editor — same context-aware behavior for invoices.\n\nThis means you rarely need to specify IDs or navigate — just describe what you want and the AI figures out the context.",
        },
        {
          title: "Tips for Best Results",
          bullets: [
            "Be specific about materials and labor when asking for estimates",
            "Navigate to the relevant screen first — the AI uses screen context",
            "Say 'edit the estimate' when on the EstimateEditor screen to modify it",
            "Ask for multiple line items in one estimate rather than separate estimates",
            "The AI uses your state for regional pricing (set this in your profile)",
            "The AI references your saved items library when relevant",
            "For edits, the AI will always look up current details before making changes",
          ],
        },
        {
          title: "How to Use",
          content:
            "1. Look for the floating AI bubble in the bottom-right corner.\n2. Tap it to open the chat interface.\n3. Type what you'd like to do in natural language.\n4. The AI will perform actions and tell you what it did.\n5. The app refreshes automatically to show the results.\n\nExamples:\n• 'Create an estimate for a full bathroom renovation'\n• 'Add a contact named John Smith, phone 555-1234'\n• 'Log 3 hours of work on this job'\n• 'Write a note about the scope change we discussed'\n• 'Convert this estimate to an invoice'",
        },
      ]}
    />
  );
}
