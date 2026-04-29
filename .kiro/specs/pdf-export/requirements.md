# Requirements Document

## Introduction

SiteKeeper users create estimates and invoices for contractor jobs. This feature adds the ability to generate a PDF from an estimate or invoice and download it later. PDFs are generated server-side and stored in MinIO (S3-compatible blob storage) running as a Docker container alongside the application. If the underlying estimate or invoice changes after a PDF was generated, the user must re-generate before downloading to ensure the PDF reflects the latest data. The infrastructure is designed for easy deployment to the awspantrypix (entouch) production server.

## Glossary

- **PDF_Service**: The backend service responsible for building PDF files from estimate or invoice data.
- **PDF_Storage**: The MinIO blob storage bucket where generated PDF files are stored, organized by UUID-based object keys per Document.
- **MinIO_Service**: The MinIO Docker container providing S3-compatible blob storage for PDF files.
- **MinIO_Client**: The backend library (e.g. boto3 or minio-py) used by the API_Server to communicate with the MinIO_Service.
- **Storage_Bucket**: The MinIO bucket dedicated to storing generated PDF files.
- **Document**: An estimate or invoice that can be exported as a PDF.
- **Document_Detail_Sheet**: The bottom-sheet modal shown when a user taps an estimate or invoice in the list view, displaying summary info and action options.
- **Generation_Timestamp**: The UTC timestamp recorded when a PDF is successfully generated.
- **Staleness**: The condition where a Document's `updated_at` timestamp is more recent than the Generation_Timestamp of its most recent PDF, indicating the PDF no longer reflects current data.
- **Primary_Contact**: The contact assigned as the primary contact on the estimate's or invoice's parent job or job site, resolved via the existing inheritance chain (job → job site).
- **User_Profile**: The authenticated user's profile data including company name, name, phone, email, and payment method.
- **Line_Item**: A named group (e.g. "Toilet Replacement") containing material and hours entries, with an hourly rate used to compute hours entry costs.
- **Material_Entry**: A sub-entry under a Line_Item with a name, unit price, and quantity. Cost equals unit_price × quantity.
- **Hours_Entry**: A sub-entry under a Line_Item with a name, description, and number of hours. Cost equals hours × parent Line_Item hourly rate.
- **API_Server**: The Flask backend application serving the SiteKeeper REST API.
- **Frontend_App**: The Expo React Native application used by contractors on mobile and web.
- **Dev_Compose**: The `docker-compose.yml` file at the project root used for local development.
- **Prod_Compose**: The `docker-compose.prod.yml` file used on the awspantrypix production server at `/home/sitekeeper/app/docker-compose.prod.yml`.

## Requirements

### Requirement 1: Generate PDF via API

**User Story:** As a contractor, I want to generate a PDF from an estimate or invoice, so that I can share a professional document with my clients.

#### Acceptance Criteria

1. WHEN the user requests PDF generation for a Document, THE API_Server SHALL build a PDF file containing the Document data and upload it to PDF_Storage.
2. WHEN the PDF is successfully generated, THE API_Server SHALL record the Generation_Timestamp and the PDF object key for the Document.
3. WHEN the PDF is successfully generated, THE API_Server SHALL return the Generation_Timestamp and a PDF status indicator to the Frontend_App.
4. IF the Document does not exist or the user does not own the Document, THEN THE API_Server SHALL return a 404 error response.
5. IF PDF generation fails due to a server error, THEN THE API_Server SHALL return a 500 error response with a descriptive error message.

### Requirement 2: Download Generated PDF

**User Story:** As a contractor, I want to download a previously generated PDF, so that I can save or share it without regenerating each time.

#### Acceptance Criteria

1. WHEN the user requests to download a PDF for a Document, THE API_Server SHALL retrieve the PDF file from PDF_Storage and return it as a binary download with the appropriate content-type header.
2. IF no PDF has been generated for the Document, THEN THE API_Server SHALL return a 404 error response indicating no PDF is available.
3. IF the Document does not exist or the user does not own the Document, THEN THE API_Server SHALL return a 404 error response.

### Requirement 3: PDF Staleness Detection

**User Story:** As a contractor, I want to know when a generated PDF is outdated, so that I only share documents that reflect the latest data.

#### Acceptance Criteria

1. WHEN the Document's `updated_at` timestamp is more recent than the Generation_Timestamp, THE API_Server SHALL report the PDF status as stale.
2. WHEN the Document's `updated_at` timestamp is equal to or earlier than the Generation_Timestamp, THE API_Server SHALL report the PDF status as current.
3. WHEN no PDF has been generated for the Document, THE API_Server SHALL report the PDF status as not generated.

### Requirement 4: PDF Storage in MinIO Blob Storage

**User Story:** As a system operator, I want PDFs stored in S3-compatible blob storage (MinIO), so that storage is decoupled from the application filesystem and portable across environments.

#### Acceptance Criteria

1. THE PDF_Storage SHALL store each generated PDF as an object in the Storage_Bucket, keyed by a UUID that is unique per Document.
2. WHEN a new PDF is generated for a Document that already has a PDF, THE PDF_Service SHALL overwrite the previous object at the same key in the Storage_Bucket.
3. THE API_Server SHALL connect to the MinIO_Service using endpoint, access key, secret key, and bucket name values provided via environment variables.
4. WHEN the API_Server starts, THE API_Server SHALL verify that the Storage_Bucket exists in the MinIO_Service and create the Storage_Bucket if the Storage_Bucket does not exist.
5. IF the MinIO_Service is unreachable during PDF generation or download, THEN THE API_Server SHALL return a 500 error response with a descriptive error message.

### Requirement 5: MinIO Docker Container for Development

**User Story:** As a developer, I want a MinIO container in the local Docker Compose setup, so that I can develop and test PDF storage without external dependencies.

#### Acceptance Criteria

1. THE Dev_Compose SHALL include a MinIO_Service container using the official `minio/minio` image.
2. THE MinIO_Service in Dev_Compose SHALL expose the S3 API on a host port that does not conflict with existing services (ports 5433, 5434 are in use).
3. THE MinIO_Service in Dev_Compose SHALL expose the MinIO web console on a separate host port for local debugging.
4. THE MinIO_Service in Dev_Compose SHALL use a named Docker volume for persistent data storage across container restarts.
5. THE MinIO_Service in Dev_Compose SHALL accept root credentials via environment variables with sensible development defaults.

### Requirement 6: MinIO Docker Container for Production

**User Story:** As a system operator, I want a MinIO container in the production Docker Compose setup, so that PDF storage runs alongside the database on the awspantrypix server.

#### Acceptance Criteria

1. THE Prod_Compose SHALL include a MinIO_Service container using the official `minio/minio` image.
2. THE MinIO_Service in Prod_Compose SHALL expose the S3 API on a host port that does not conflict with existing services on the awspantrypix server (ports 5001, 5433, 5434, 5435 are in use).
3. THE MinIO_Service in Prod_Compose SHALL use a named Docker volume for persistent data storage.
4. THE MinIO_Service in Prod_Compose SHALL accept root credentials via environment variables.
5. THE MinIO_Service in Prod_Compose SHALL be configured with `restart: unless-stopped` so the MinIO_Service recovers automatically after server reboots.

### Requirement 7: Backend MinIO Configuration

**User Story:** As a developer, I want MinIO connection settings managed through environment variables, so that the same codebase works in development and production without code changes.

#### Acceptance Criteria

1. THE API_Server SHALL read the MinIO endpoint URL from the `MINIO_ENDPOINT` environment variable.
2. THE API_Server SHALL read the MinIO access key from the `MINIO_ACCESS_KEY` environment variable.
3. THE API_Server SHALL read the MinIO secret key from the `MINIO_SECRET_KEY` environment variable.
4. THE API_Server SHALL read the MinIO bucket name from the `MINIO_BUCKET_NAME` environment variable.
5. THE API_Server SHALL read a boolean `MINIO_USE_SSL` environment variable to determine whether to connect to the MinIO_Service over HTTPS, defaulting to false for development.
6. IF any required MinIO environment variable is missing at startup, THEN THE API_Server SHALL log a clear error message identifying the missing variable.

### Requirement 8: Deployment of MinIO to Production

**User Story:** As a system operator, I want the deploy script to manage the MinIO container on the production server, so that PDF storage is deployed alongside the rest of the application.

#### Acceptance Criteria

1. WHEN the backend is deployed, THE deploy script SHALL run `docker compose -f docker-compose.prod.yml up -d` on the awspantrypix server to ensure the MinIO_Service container is running.
2. WHEN the MinIO_Service container is already running, THE deploy script SHALL leave the MinIO_Service container running without data loss.
3. THE deploy script SHALL use the Prod_Compose file located at `/home/sitekeeper/app/docker-compose.prod.yml` on the awspantrypix server.

### Requirement 9: PDF Content — Header and Document Type

**User Story:** As a contractor, I want the PDF to clearly indicate whether it is an estimate or invoice, so that my clients can identify the document type.

#### Acceptance Criteria

1. THE PDF_Service SHALL display the text "Estimate" or "Invoice" as the document type heading based on the Document source.
2. THE PDF_Service SHALL display the Document title below the document type heading.

### Requirement 10: PDF Content — Bill To Section

**User Story:** As a contractor, I want the PDF to show who the document is billed to, so that my client sees their name on the document.

#### Acceptance Criteria

1. WHEN the Document's parent job or job site has a Primary_Contact, THE PDF_Service SHALL display the Primary_Contact name in a "Bill To" section.
2. WHEN no Primary_Contact is set on the job or inherited from the job site, THE PDF_Service SHALL omit the "Bill To" section from the PDF.

### Requirement 11: PDF Content — Job Site Address

**User Story:** As a contractor, I want the PDF to include the job site address, so that the document references the work location.

#### Acceptance Criteria

1. WHEN the Document's parent job belongs to a job site with an address, THE PDF_Service SHALL display the job site address in the PDF.
2. WHEN the job site has no address set, THE PDF_Service SHALL omit the job site address section from the PDF.

### Requirement 12: PDF Content — User Profile Information

**User Story:** As a contractor, I want my business information on the PDF, so that clients know how to contact and pay me.

#### Acceptance Criteria

1. THE PDF_Service SHALL display the User_Profile company name in the PDF header area when the company name is set.
2. THE PDF_Service SHALL display the User_Profile name in the PDF.
3. THE PDF_Service SHALL display the User_Profile phone number in the PDF when the phone number is set.
4. THE PDF_Service SHALL display the User_Profile email address in the PDF.
5. THE PDF_Service SHALL display the User_Profile payment method (e.g. Venmo handle) in the PDF when the payment method is set.

### Requirement 13: PDF Content — Material Entries Table

**User Story:** As a contractor, I want material costs itemized on the PDF, so that clients can see what materials are needed and their costs.

#### Acceptance Criteria

1. THE PDF_Service SHALL display each Material_Entry with its name, unit price, quantity, and total cost (unit_price × quantity) grouped under the parent Line_Item name.
2. THE PDF_Service SHALL display the materials sales tax rate when a tax rate is set on the Document.
3. THE PDF_Service SHALL display the materials subtotal (sum of all Material_Entry costs across all Line_Items) before tax.
4. THE PDF_Service SHALL display the materials total cost with tax applied (materials subtotal × tax rate) when a tax rate is set.

### Requirement 14: PDF Content — Hours Entries Table

**User Story:** As a contractor, I want labour hours itemized on the PDF, so that clients can see the work breakdown and costs.

#### Acceptance Criteria

1. THE PDF_Service SHALL display each Hours_Entry with its name, number of hours, the parent Line_Item hourly rate, and the computed cost (hours × hourly rate) grouped under the parent Line_Item name.
2. THE PDF_Service SHALL display the total hours across all Hours_Entries.
3. THE PDF_Service SHALL display the total labour cost across all Hours_Entries.

### Requirement 15: PDF Content — Document Total

**User Story:** As a contractor, I want a clear total on the PDF, so that clients can see the overall cost at a glance.

#### Acceptance Criteria

1. THE PDF_Service SHALL display the Document subtotal (sum of all Line_Item costs before tax).
2. WHEN a tax rate is set, THE PDF_Service SHALL display the tax amount and the tax rate percentage.
3. THE PDF_Service SHALL display the Document grand total (subtotal plus tax amount).

### Requirement 16: PDF Content — Thank You Message

**User Story:** As a contractor, I want a professional closing message on the PDF, so that the document feels polished and courteous.

#### Acceptance Criteria

1. THE PDF_Service SHALL display the text "Thank you for your business!" at the bottom of the PDF.

### Requirement 17: Frontend — Generate PDF Option

**User Story:** As a contractor, I want a "Generate PDF" button when viewing an estimate or invoice, so that I can create a downloadable document.

#### Acceptance Criteria

1. WHEN the user opens the Document_Detail_Sheet for an estimate or invoice, THE Frontend_App SHALL display a "Generate PDF" action option.
2. WHEN the user taps "Generate PDF", THE Frontend_App SHALL send a generation request to the API_Server and display a loading indicator until the response is received.
3. WHEN PDF generation completes successfully, THE Frontend_App SHALL display a success confirmation and update the Document_Detail_Sheet to reflect the new PDF status.
4. IF PDF generation fails, THEN THE Frontend_App SHALL display an error message to the user.

### Requirement 18: Frontend — Download PDF Option

**User Story:** As a contractor, I want a "Download PDF" button that appears after generation, so that I can save the file to my device.

#### Acceptance Criteria

1. WHEN a current (non-stale) PDF exists for the Document, THE Frontend_App SHALL display a "Download PDF" action option in the Document_Detail_Sheet.
2. WHEN the user taps "Download PDF", THE Frontend_App SHALL initiate a file download of the PDF from the API_Server.
3. WHILE no PDF has been generated for the Document, THE Frontend_App SHALL hide the "Download PDF" option.

### Requirement 19: Frontend — Stale PDF Indicator

**User Story:** As a contractor, I want to know when a PDF is outdated, so that I regenerate it before sharing with a client.

#### Acceptance Criteria

1. WHEN the PDF status is stale, THE Frontend_App SHALL display a visual indicator (e.g. warning badge or text) in the Document_Detail_Sheet informing the user the PDF is outdated.
2. WHEN the PDF status is stale, THE Frontend_App SHALL hide the "Download PDF" option and display the "Generate PDF" option so the user can regenerate.
3. WHEN the user regenerates a stale PDF successfully, THE Frontend_App SHALL update the status to current and show the "Download PDF" option.

### Requirement 20: PDF Status in Document API Responses

**User Story:** As a frontend developer, I want PDF status included in estimate and invoice API responses, so that the UI can show the correct options without extra API calls.

#### Acceptance Criteria

1. THE API_Server SHALL include a `pdf_status` field in estimate and invoice detail responses with one of three values: "none", "current", or "stale".
2. WHEN a PDF exists and the Generation_Timestamp is equal to or later than the Document `updated_at`, THE API_Server SHALL set `pdf_status` to "current".
3. WHEN a PDF exists and the Generation_Timestamp is earlier than the Document `updated_at`, THE API_Server SHALL set `pdf_status` to "stale".
4. WHEN no PDF has been generated, THE API_Server SHALL set `pdf_status` to "none".
