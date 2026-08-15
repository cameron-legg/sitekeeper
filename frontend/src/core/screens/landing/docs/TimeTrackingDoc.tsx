/**
 * TimeTrackingDoc — documentation for the Time Tracking utility.
 */

import React from "react";
import DocPageLayout from "./DocPageLayout";

const timeTrackingScreenshot = require("../../../../../assets/landing/docs/time-tracking.png");

export default function TimeTrackingDoc({ onBack }: { onBack: () => void }) {
  return (
    <DocPageLayout
      onBack={onBack}
      icon="⏱"
      title="Time Tracking"
      subtitle="Track labor hours with clock in/out or manual entry."
      sections={[
        {
          title: "What It Does",
          content:
            "The Time Tracking utility lets you log hours worked on each job. It supports two modes: real-time clock in/out (which automatically calculates hours when you clock out) and manual entry (where you log a specific number of hours after the fact). Time entries are tracked per user, so in a team environment you can see who worked when.",
          screenshot: timeTrackingScreenshot,
        },
        {
          title: "How It Works",
          content:
            "Each time entry belongs to a job and a user. When you clock in, the system records the current timestamp. When you clock out, it calculates the elapsed time and stores it as decimal hours (e.g. 2.5 hours for 2 hours 30 minutes).\n\nYou can only have one active clock-in per job at a time. If you try to clock in while already clocked in on the same job, you'll get an error — clock out first.\n\nManual entries let you log hours after the fact, with an optional date/time for when the work was performed and a note describing what was done.",
        },
        {
          title: "Key Features",
          bullets: [
            "Real-time clock in/out with automatic hour calculation",
            "Manual hour entry for after-the-fact logging",
            "Optional notes on each time entry",
            "Optional date/time for manual entries (defaults to now)",
            "Per-user tracking — see who logged what",
            "One active clock-in per user per job (prevents duplicates)",
            "Users can only delete their own time entries",
            "View all time entries for a job across all team members",
          ],
        },
        {
          title: "How to Use",
          content:
            "Clock In/Out:\n1. Navigate to a job detail screen.\n2. Tap 'Clock In' to start tracking.\n3. Work on the job.\n4. Tap 'Clock Out' when done — hours are automatically calculated.\n\nManual Entry:\n1. Navigate to a job detail screen.\n2. Tap 'Add Hours' or '+' on the time tracking section.\n3. Enter the number of hours worked.\n4. Optionally add a note and the date the work was performed.\n5. Save.",
        },
      ]}
    />
  );
}
