/**
 * NotesDoc — documentation for the Notes utility.
 */

import React from "react";
import DocPageLayout from "./DocPageLayout";

const notesScreenshot = require("../../../../../assets/landing/docs/job-detail-notes.png");

export default function NotesDoc({ onBack }: { onBack: () => void }) {
  return (
    <DocPageLayout
      onBack={onBack}
      icon="📓"
      title="Notes"
      subtitle="Write and organize markdown notes attached to your jobs."
      sections={[
        {
          title: "What It Does",
          content:
            "The Notes utility lets you create rich markdown notes on any job. Use them for job documentation, progress updates, scope changes, client conversations, punch lists, or anything else you need to record. Notes support full markdown formatting so you can structure your information clearly.",
          screenshot: notesScreenshot,
        },
        {
          title: "How It Works",
          content:
            "Each note belongs to a job and stores a markdown body with creation and last-updated timestamps. Notes are displayed newest-first. The editor provides both a writing mode and a preview mode so you can see how your markdown renders before saving.\n\nAll team members in your organization can view and edit notes, making them great for shared documentation and handoffs between crew members.",
        },
        {
          title: "Key Features",
          bullets: [
            "Full markdown support: headings, bold, italic, lists, links, code blocks",
            "Edit/preview toggle in the note editor",
            "Timestamps for creation and last update",
            "Newest notes displayed first",
            "Shared across all team members in the organization",
            "Unlimited notes per job",
          ],
        },
        {
          title: "Markdown Formatting Tips",
          content:
            "• Use # for headings (## for sub-headings, ### for smaller)\n• Use **bold** for emphasis\n• Use - or * for bullet lists\n• Use 1. 2. 3. for numbered lists\n• Use [link text](url) for clickable links\n• Use `code` for inline code\n• Use --- for horizontal dividers\n\nThese formatting options help keep your notes organized and scannable, especially for longer job documentation.",
        },
        {
          title: "How to Use",
          content:
            "1. Navigate to a job detail screen and tap the Notes tab.\n2. Tap '+' to create a new note.\n3. Write your note using markdown formatting.\n4. Toggle to Preview mode to see how it renders.\n5. Save. Your note appears at the top of the list.\n6. Tap any existing note to edit or delete it.",
        },
      ]}
    />
  );
}
