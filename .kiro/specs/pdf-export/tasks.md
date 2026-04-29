# Implementation Plan: PDF Export

## Overview

Add PDF generation and download capabilities for estimates and invoices. The implementation follows the design's layered approach: infrastructure and storage first, then backend modules (MinIO client → PDF generator → PDF service → blueprint), then frontend hooks and UI, and finally deploy script changes. Property-based tests use Hypothesis to verify the five correctness properties from the design.

## Tasks

- [x] 1. Infrastructure and dependencies
  - [x] 1.1 Add MinIO service to `docker-compose.yml` for development
    - Add `minio` service using `minio/minio` image with S3 API on port 9000 and console on port 9001
    - Add `minio_data` named volume for persistent storage
    - Configure environment variables with dev defaults (`minioadmin`/`minioadmin`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 1.2 Create `docker-compose.prod.yml` with MinIO service for production
    - Add `minio` service with `restart: unless-stopped`, S3 API on port 9000, console on port 9001
    - Add `minio_data` named volume
    - Credentials via environment variables (no defaults)
    - Include existing `db` service definition from production setup
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 1.3 Add `reportlab` and `minio` to `backend/requirements.txt`
    - Add `reportlab` for PDF generation
    - Add `minio` for MinIO Python SDK
    - _Requirements: 1.1 (dependency for PDF generation), 4.3 (dependency for MinIO client)_
  - [x] 1.4 Add MinIO configuration to `backend/app/config.py`
    - Add `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME`, `MINIO_USE_SSL` from environment variables
    - Set sensible dev defaults (`localhost:9000`, `minioadmin`, `minioadmin`, `sitekeeper-pdfs`, `false`)
    - Log clear error if required variables are missing
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [x] 1.5 Update `backend/.env.example` with MinIO environment variables
    - Add `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME`, `MINIO_USE_SSL` with example values
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2. Database migration and model changes
  - [x] 2.1 Create Alembic migration `backend/migrations/versions/006_pdf_columns.py`
    - Add `pdf_generated_at TIMESTAMPTZ` nullable column to `estimates` table
    - Add `pdf_object_key TEXT` nullable column to `estimates` table
    - Add `pdf_generated_at TIMESTAMPTZ` nullable column to `invoices` table
    - Add `pdf_object_key TEXT` nullable column to `invoices` table
    - Write both `upgrade()` and `downgrade()` functions
    - _Requirements: 1.2, 3.1, 3.2, 3.3_
  - [x] 2.2 Add `pdf_generated_at` and `pdf_object_key` columns to `Estimate` and `Invoice` models in `backend/app/models.py`
    - Add `pdf_generated_at = Column(TIMESTAMP(timezone=True), nullable=True)` to both models
    - Add `pdf_object_key = Column(Text, nullable=True)` to both models
    - _Requirements: 1.2, 3.1, 3.2, 3.3_

- [x] 3. Checkpoint — Verify infrastructure
  - Ensure Docker Compose files are valid, migration is correct, and models compile. Ask the user if questions arise.

- [x] 4. MinIO client module
  - [x] 4.1 Create `backend/app/minio_client.py` with `MinioStorage` class
    - Implement `__init__` accepting endpoint, access_key, secret_key, bucket_name, use_ssl
    - Implement `ensure_bucket()` to create the bucket if it doesn't exist
    - Implement `upload(object_key, data, content_type)` to upload PDF bytes
    - Implement `download(object_key)` to retrieve PDF bytes
    - Handle and log connection errors clearly
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 4.2 Initialize MinIO storage in `backend/app/__init__.py`
    - Create `MinioStorage` instance from app config during `create_app()`
    - Call `ensure_bucket()` with warning-level logging if MinIO is unreachable
    - Store the instance on `app.extensions` or as a module-level singleton for service access
    - _Requirements: 4.4, 7.6_

- [x] 5. PDF generator module
  - [x] 5.1 Create `backend/app/pdf_generator.py` with dataclasses and `build_pdf()` function
    - Define `PdfData`, `PdfLineItem`, `PdfMaterialEntry`, `PdfHoursEntry` dataclasses
    - Implement `build_pdf(data: PdfData) -> bytes` using ReportLab
    - PDF layout: header (company name, user name, phone, email), document type heading, title, bill to section, job site address, materials table grouped by line item, hours table grouped by line item, grand total section, payment method, "Thank you for your business!" footer
    - Omit sections for null optional fields (no "Bill To" if bill_to_name is None, etc.)
    - _Requirements: 9.1, 9.2, 10.1, 10.2, 11.1, 11.2, 12.1, 12.2, 12.3, 12.4, 12.5, 13.1, 13.2, 13.3, 13.4, 14.1, 14.2, 14.3, 15.1, 15.2, 15.3, 16.1_
  - [ ]* 5.2 Write property test: PDF status computation (Property 1)
    - **Property 1: PDF status computation is correct for all document states**
    - Use Hypothesis to generate random `updated_at`, `pdf_generated_at` (or None), and `pdf_object_key` (or None)
    - Verify `_compute_pdf_status()` returns exactly "none", "stale", or "current" per the rules
    - `@settings(max_examples=100)`
    - **Validates: Requirements 3.1, 3.2, 3.3, 20.1, 20.2, 20.3, 20.4**
  - [ ]* 5.3 Write property test: PDF contains document type and title (Property 2)
    - **Property 2: PDF contains document type and title**
    - Use Hypothesis to generate valid `PdfData` with random document_type ("Estimate"/"Invoice") and non-empty title
    - Extract text from generated PDF and verify both document_type and title appear
    - `@settings(max_examples=100)`
    - **Validates: Requirements 9.1, 9.2**
  - [ ]* 5.4 Write property test: PDF includes non-null optional fields and excludes null ones (Property 3)
    - **Property 3: PDF includes all non-null optional fields and excludes null optional fields**
    - Use Hypothesis to generate `PdfData` with random combinations of null/non-null optional fields
    - Verify each non-null field value appears in extracted PDF text, and section labels for null fields do not appear
    - `@settings(max_examples=100)`
    - **Validates: Requirements 10.1, 10.2, 11.1, 11.2, 12.1, 12.2, 12.3, 12.4, 12.5**
  - [ ]* 5.5 Write property test: PDF contains all line item entry names (Property 4)
    - **Property 4: PDF contains all line item entry names**
    - Use Hypothesis to generate `PdfData` with one or more line items containing material and hours entries
    - Verify every entry name appears in extracted PDF text
    - `@settings(max_examples=100)`
    - **Validates: Requirements 13.1, 14.1**
  - [ ]* 5.6 Write property test: PDF contains financial summary values (Property 5)
    - **Property 5: PDF contains financial summary values**
    - Use Hypothesis to generate `PdfData` with random subtotal, total, tax_rate, and tax_amount
    - Verify formatted subtotal and total appear in extracted PDF text; verify tax_amount appears when tax_rate is non-null and > 0
    - `@settings(max_examples=100)`
    - **Validates: Requirements 13.2, 13.3, 13.4, 14.2, 14.3, 15.1, 15.2, 15.3**

- [x] 6. Checkpoint — Verify PDF generator and properties
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. PDF service
  - [x] 7.1 Create `backend/app/services/pdf_service.py` with `PdfService` class
    - Implement `__init__` with dependency injection for `EstimateService`, `InvoiceService`, `ProfileService`, `MinioStorage`
    - Implement `generate_estimate_pdf(estimate_id, user_id)`: load estimate + line items + profile + primary contact + job site address, build `PdfData`, call `build_pdf()`, upload to MinIO, update `pdf_generated_at` and `pdf_object_key` on the estimate, return serialized estimate with `pdf_status`
    - Implement `generate_invoice_pdf(invoice_id, user_id)`: same flow for invoices
    - Implement `download_estimate_pdf(estimate_id, user_id)`: verify `pdf_object_key` exists, download from MinIO, return `(pdf_bytes, filename)`
    - Implement `download_invoice_pdf(invoice_id, user_id)`: same flow for invoices
    - Object key format: `estimates/{estimate_id}.pdf` or `invoices/{invoice_id}.pdf`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 4.1, 4.2, 4.5_

- [x] 8. PDF blueprint and serializer changes
  - [x] 8.1 Create `backend/app/blueprints/pdf_bp.py` with four routes
    - `POST /estimates/<id>/pdf` — generate PDF for estimate
    - `GET /estimates/<id>/pdf` — download PDF for estimate
    - `POST /invoices/<id>/pdf` — generate PDF for invoice
    - `GET /invoices/<id>/pdf` — download PDF for invoice
    - Use `@auth_required` decorator on all routes
    - Return PDF bytes with `Content-Type: application/pdf` and `Content-Disposition: attachment` for downloads
    - Use existing error helpers (`not_found`, `server_error`) for error responses
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3_
  - [x] 8.2 Register `pdf_bp` in `backend/app/__init__.py`
    - Import and register the blueprint under `/api/v1`
    - _Requirements: 1.1_
  - [x] 8.3 Add `_compute_pdf_status()` helper and update serializers in `estimates_bp.py` and `invoices_bp.py`
    - Add `_compute_pdf_status(doc)` function that returns "none", "stale", or "current"
    - Add `"pdf_status": _compute_pdf_status(estimate)` to `_serialize_estimate()`
    - Add `"pdf_status": _compute_pdf_status(invoice)` to `_serialize_invoice()`
    - _Requirements: 3.1, 3.2, 3.3, 20.1, 20.2, 20.3, 20.4_

- [x] 9. Checkpoint — Verify backend API
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Frontend types and hooks
  - [x] 10.1 Add `pdf_status` to `Estimate` and `Invoice` interfaces in `frontend/src/api/types.ts`
    - Add `pdf_status: "none" | "current" | "stale"` to both interfaces
    - _Requirements: 20.1_
  - [x] 10.2 Create `frontend/src/api/hooks/usePdf.ts` with PDF hooks
    - Implement `useGenerateEstimatePdf()` — POST mutation to `/api/v1/estimates/:id/pdf`, invalidates estimate detail query on success
    - Implement `useDownloadEstimatePdf()` — triggers file download via GET `/api/v1/estimates/:id/pdf`
    - Implement `useGenerateInvoicePdf()` — POST mutation to `/api/v1/invoices/:id/pdf`, invalidates invoice detail query on success
    - Implement `useDownloadInvoicePdf()` — triggers file download via GET `/api/v1/invoices/:id/pdf`
    - For web download: use blob URL approach with authenticated fetch
    - _Requirements: 17.2, 18.2_

- [x] 11. Frontend UI changes
  - [x] 11.1 Add PDF actions section to `EstimateEditorScreen`
    - Add PDF action buttons below the grand total block
    - When `pdf_status === "none"`: show "Generate PDF" button
    - When `pdf_status === "current"`: show "Download PDF" button and secondary "Regenerate PDF" button
    - When `pdf_status === "stale"`: show warning badge ("PDF is outdated") and "Generate PDF" button; hide "Download PDF"
    - Show loading spinner on button while generating
    - Display inline error message on failure
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 18.1, 18.2, 18.3, 19.1, 19.2, 19.3_
  - [x] 11.2 Add PDF actions section to `InvoiceEditorScreen`
    - Same PDF action buttons and logic as EstimateEditorScreen
    - When `pdf_status === "none"`: show "Generate PDF" button
    - When `pdf_status === "current"`: show "Download PDF" button and secondary "Regenerate PDF" button
    - When `pdf_status === "stale"`: show warning badge ("PDF is outdated") and "Generate PDF" button; hide "Download PDF"
    - Show loading spinner on button while generating
    - Display inline error message on failure
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 18.1, 18.2, 18.3, 19.1, 19.2, 19.3_

- [x] 12. Deploy script changes
  - [x] 12.1 Update `deploy.sh` to start MinIO container on production
    - Add `docker compose -f docker-compose.prod.yml up -d` command in `deploy_backend()` function
    - Ensure it runs before migrations so MinIO is available
    - Use the prod compose file at `$APP_DIR/docker-compose.prod.yml`
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 13. Checkpoint — Verify full integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 14. Unit and integration tests
  - [ ]* 14.1 Write unit tests in `backend/tests/test_pdf_unit.py`
    - Test `_compute_pdf_status()` with specific examples: no PDF, current PDF, stale PDF
    - Test `build_pdf()` with a known `PdfData` fixture — verify "Thank you for your business!" appears
    - Test `build_pdf()` with empty line items — verify PDF generates without errors
    - Test `PdfService` with mocked dependencies — verify correct orchestration
    - _Requirements: 16.1, 3.1, 3.2, 3.3_
  - [ ]* 14.2 Write integration tests in `backend/tests/test_pdf_integration.py`
    - Test full generate → download flow with mocked MinIO
    - Verify DB columns (`pdf_generated_at`, `pdf_object_key`) are set after generation
    - Verify object key is reused on regeneration (overwrite behavior)
    - Test download without prior generation → 404
    - Verify `pdf_status` field appears in estimate/invoice GET responses
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 4.1, 4.2, 20.1_

- [x] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the five universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend uses Python (Flask, ReportLab, minio SDK) and the frontend uses TypeScript (Expo, TanStack Query)
- `pdfplumber` or similar library may be needed as a test dependency for PDF text extraction in property tests
