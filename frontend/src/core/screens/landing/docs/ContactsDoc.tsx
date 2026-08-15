/**
 * ContactsDoc — documentation for the Contacts utility.
 */

import React from "react";
import DocPageLayout from "./DocPageLayout";

const contactsScreenshot = require("../../../../../assets/landing/docs/contacts-tab.png");

export default function ContactsDoc({ onBack }: { onBack: () => void }) {
  return (
    <DocPageLayout
      onBack={onBack}
      icon="👤"
      title="Contacts"
      subtitle="Manage client contacts for your job sites and individual jobs."
      sections={[
        {
          title: "What It Does",
          content:
            "The Contacts utility lets you create and manage client contacts, then associate them with job sites or individual jobs. Each contact stores a name, phone number, email, mailing address, and freeform notes. Contacts can be designated as the primary contact for a site or job, which automatically populates the 'Bill To' field on estimates and invoices.",
          screenshot: contactsScreenshot,
        },
        {
          title: "How It Works",
          content:
            "Contacts live at two levels: job sites and jobs. When you add a contact to a job site, that contact is automatically inherited by all jobs under that site. You can also add contacts directly to a specific job for job-level contacts that don't apply to the whole site.\n\nThe primary contact is resolved with a smart fallback: if a job has its own primary contact, that takes priority. If not, it inherits the job site's primary contact. If there's only one contact visible to a job (either direct or inherited), it's automatically treated as the primary.",
        },
        {
          title: "Key Features",
          bullets: [
            "Create contacts with name, phone, email, mailing address, and notes",
            "Associate contacts with job sites or individual jobs",
            "Set a primary contact per site or per job",
            "Contact inheritance: job site contacts are visible on all jobs within that site",
            "Primary contact auto-populates 'Bill To' on estimates and invoices",
            "Smart resolution: direct > inherited > auto (single contact)",
            "Edit or remove contacts at any time",
          ],
        },
        {
          title: "How to Use",
          content:
            "1. Navigate to a job site or job detail screen.\n2. Tap the Contacts tab.\n3. Tap the '+' button to add a new contact.\n4. Fill in the contact details (only name is required).\n5. To set a contact as primary, tap the star icon next to their name.\n6. Contacts added at the site level will automatically appear on all jobs under that site (marked as 'inherited').",
        },
      ]}
    />
  );
}
