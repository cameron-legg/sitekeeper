/**
 * PhotosDoc — documentation for the Photos utility.
 */

import React from "react";
import DocPageLayout from "./DocPageLayout";

const photosScreenshot = require("../../../../../assets/landing/docs/media-tab.png");

export default function PhotosDoc({ onBack }: { onBack: () => void }) {
  return (
    <DocPageLayout
      onBack={onBack}
      icon="📷"
      title="Photos"
      subtitle="Upload job photos and attach them to estimates and invoices."
      sections={[
        {
          title: "What It Does",
          content:
            "The Photos utility lets you upload photos directly to jobs for documentation — before/after shots, progress photos, damage documentation, or anything visual you need to record. Photos can also be attached to estimates and invoices so they appear in generated PDFs, which is perfect for showing clients what work was done.",
          screenshot: photosScreenshot,
        },
        {
          title: "How It Works",
          content:
            "Photos are stored in MinIO (S3-compatible object storage) within your tenant's dedicated bucket. Each photo is associated with a job and tracked in the database with metadata: filename, content type, file size, who uploaded it, and when.\n\nPhotos uploaded to a job can then be selectively attached to any estimate or invoice on that same job. When you generate a PDF, attached photos are included in the document. Photo attachments are independent — removing a photo from an estimate doesn't delete the underlying job photo.",
        },
        {
          title: "Key Features",
          bullets: [
            "Upload photos directly from your phone's camera or gallery",
            "Supported formats: JPEG, PNG, GIF, WebP, HEIC",
            "Maximum file size: 20 MB per photo",
            "Attach photos to estimates and invoices",
            "Attached photos appear in generated PDFs",
            "Photos are automatically carried over in estimate → invoice conversion",
            "Shared across all team members",
            "Tracked with upload timestamp and uploader info",
          ],
        },
        {
          title: "Document Photo Attachments",
          content:
            "The document attachment system works as a many-to-many relationship: a job photo can be attached to multiple documents, and a document can have multiple photos. When you attach photos to an estimate and then convert it to an invoice, the photo attachments are automatically copied to the new invoice.\n\nPhotos on documents are ordered — you can control which photo appears first in the PDF.",
        },
        {
          title: "How to Use",
          content:
            "Uploading Photos:\n1. Navigate to a job detail screen and tap the Media tab.\n2. Tap the upload button.\n3. Choose a photo from your camera roll or take a new one.\n4. The photo uploads and appears in the job's photo gallery.\n\nAttaching to Estimates/Invoices:\n1. Open the estimate or invoice editor.\n2. Look for the Photos section.\n3. Select which job photos to attach.\n4. When you generate the PDF, attached photos will be included.",
        },
      ]}
    />
  );
}
