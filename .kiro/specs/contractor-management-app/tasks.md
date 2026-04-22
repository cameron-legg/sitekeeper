# Implementation Plan: Contractor Management App

## Overview

Incremental implementation of the Contractor Management App: Python Flask + PostgreSQL backend with SQLAlchemy 2.x, and an Expo (React Native) frontend. Tasks are ordered so each step builds on the previous one, ending with full integration. Property-based tests use Hypothesis (backend) and Jest + React Native Testing Library (frontend).

## Tasks

- [x] 1. Project scaffolding and configuration
  - Create `backend/` directory with `app/`, `tests/`, and `migrations/` sub-directories
  - Create `frontend/` directory using `npx create-expo-app frontend --template blank-typescript`
  - Create `docker-compose.yml` at the project root defining two PostgreSQL 16 services: `db` (port 5432, dev) and `db_test` (port 5433, integration tests), each with a named volume for data persistence
  - Add `backend/requirements.txt` pinning: `flask`, `flask-bcrypt`, `pyjwt`, `sqlalchemy`, `psycopg2-binary`, `alembic`, `hypothesis`, `pytest`, `pytest-flask`, `flask-cors`
  - Add `backend/.env.example` with `DATABASE_URL` (pointing to `db` container), `JWT_SECRET`, `JWT_EXPIRY_SECONDS`
  - Add `backend/.env.test.example` with `DATABASE_URL` pointing to `db_test` container (port 5433)
  - Add `frontend/package.json` dependencies: `@react-navigation/native`, `@react-navigation/stack`, `@tanstack/react-query`, `axios`, `zustand`, `@react-native-async-storage/async-storage`, `react-native-markdown-display`
  - Create `backend/app/__init__.py` with Flask app factory (`create_app`) that registers blueprints and extensions
  - Create `backend/app/config.py` loading settings from environment variables
  - Verify `docker compose up -d` starts both `db` and `db_test` containers successfully
  - _Requirements: 9.5, 10.3, 10.4_

- [x] 2. Database schema and migrations
  - [x] 2.1 Define SQLAlchemy models for all entities
    - Create `backend/app/models.py` with `User`, `JobSite`, `Job`, `Contact`, `JobSiteContact`, `JobContact`, `Note`, `Estimate`, `Invoice`, `LineItem`, `SavedItem` mapped classes
    - Use `UUID` primary keys (`gen_random_uuid()`), `TIMESTAMPTZ` timestamps, and `ON DELETE CASCADE` FK constraints as specified in the DDL
    - Add `parent_type` CHECK constraint (`'estimate'` or `'invoice'`) on `LineItem`
    - _Requirements: 2.2, 3.2, 4.1, 5.1, 6.1, 7.1, 11.2_
  - [x] 2.2 Create Alembic migration for initial schema
    - Initialise Alembic (`alembic init migrations`)
    - Write `migrations/versions/001_initial_schema.py` generating all tables from the DDL in the design document
    - Verify migration applies cleanly with `alembic upgrade head`
    - _Requirements: 10.2_

- [x] 3. Auth Service — backend
  - [x] 3.1 Implement `IAuthService` interface and `EmailPasswordAuthService`
    - Create `backend/app/auth/interface.py` with `AuthResult` dataclass and `IAuthService` ABC
    - Create `backend/app/auth/email_password.py` implementing `register`, `login`, and `validate_token` using `flask-bcrypt` and `PyJWT`
    - Store bcrypt hash (bcrypt generates per-password salt internally); never store plaintext
    - `validate_token` raises `AuthError` on expired or invalid tokens
    - _Requirements: 1.1, 1.4, 1.7, 1.9, 10.6_
  - [x] 3.2 Implement `auth_required` decorator
    - Create `backend/app/auth/decorators.py` with `auth_required` that reads `Authorization: Bearer <token>`, calls `validate_token`, and injects `current_user_id` into `flask.g`
    - Return 401 JSON error on missing or invalid token
    - _Requirements: 1.6, 10.1_
  - [x] 3.3 Implement auth route blueprint
    - Create `backend/app/blueprints/auth_bp.py` with `POST /api/v1/auth/register` and `POST /api/v1/auth/login`
    - Validate email format (RFC 5322 regex or `email-validator` library); return 400 on invalid format
    - Return 409 on duplicate email; return 401 with generic `"Invalid credentials."` on login failure
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [ ]* 3.4 Write property tests for auth (Properties 1–5)
    - **Property 1: Registration and login round-trip** — `@given` valid email + password strategies; register then login; assert token returned
    - **Property 2: Invalid email format rejected** — `@given` strings that fail email regex; assert 400 and no account created
    - **Property 3: Duplicate email rejected** — `@given` valid email; register twice; assert second call returns error and user count unchanged
    - **Property 4: Invalid credentials do not reveal which field is wrong** — `@given` wrong email or wrong password; assert generic 401 message
    - **Property 5: Password hashes are unique per user** — `@given` same password for two users; assert stored hashes differ and plaintext absent
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.7**

- [x] 4. Repository layer — backend
  - [x] 4.1 Implement `IJobSiteRepository` and `SQLAlchemyJobSiteRepository`
    - Create `backend/app/repositories/job_site_repo.py` with `get_all_for_user`, `get_by_id`, `create`, `update`, `delete` filtering by `user_id`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 4.2 Implement `IJobRepository` and `SQLAlchemyJobRepository`
    - Create `backend/app/repositories/job_repo.py` with CRUD methods and a `count_for_site` helper used by the job-site list endpoint
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 2.5_
  - [x] 4.3 Implement `IContactRepository` and `SQLAlchemyContactRepository`
    - Create `backend/app/repositories/contact_repo.py` with methods to add/remove contacts from job sites and jobs, set primary contact, and fetch contacts for an entity
    - _Requirements: 4.1, 4.2, 4.5, 4.6_
  - [x] 4.4 Implement `INoteRepository`, `IEstimateRepository`, `IInvoiceRepository`, `ISavedItemRepository`
    - Create corresponding files in `backend/app/repositories/`
    - Note repo: `get_for_job` returns notes ordered by `created_at DESC`
    - Estimate/Invoice repos: include `get_line_items` and individual line-item CRUD
    - SavedItem repo: filters by `user_id`
    - _Requirements: 5.1, 5.4, 6.1, 6.4, 7.1, 7.4, 11.2_

- [x] 5. Service layer — backend
  - [x] 5.1 Implement `JobSiteService` and `JobService`
    - Create `backend/app/services/job_site_service.py` enforcing user ownership on all operations
    - Create `backend/app/services/job_service.py`; in `update_job`, if `status` transitions to `'completed'` and `finished_at` is `None`, set `finished_at = datetime.utcnow()`; honour explicit `finished_at` values (including `null`) from the caller
    - _Requirements: 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 3.6, 3.7_
  - [x] 5.2 Implement `ContactService`
    - Create `backend/app/services/contact_service.py`
    - `get_effective_primary_contact(job_id)`: if job has `primary_contact_id`, return it with `source='direct'`; else return parent site's `primary_contact_id` with `source='inherited'`; return `None` if neither is set
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.9_
  - [x] 5.3 Implement `NoteService`, `EstimateService`, `InvoiceService`
    - `NoteService`: set `updated_at = now()` on edit
    - `EstimateService` / `InvoiceService`: `calculate_total` sums `price` across all line items; `delivered` defaults to `false` on creation
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.3, 6.9, 7.1, 7.3, 7.9_
  - [x] 5.4 Implement `ConversionService` and `SavedItemService`
    - `ConversionService.convert(estimate_id)`: copy all line items into a new `Invoice` record; set `source_estimate_id`; do not link line items back to the estimate
    - `SavedItemService`: when pre-populating a line item, copy field values (`name`, `notes`, `url`, `hours`, `price`) into a new `LINE_ITEM` with no FK to the saved item
    - _Requirements: 8.1, 8.2, 8.3, 11.5, 11.6_
  - [ ]* 5.5 Write property tests for service layer (Properties 6–26)
    - Use in-memory fake repositories (no database) for all service tests
    - **Property 6: Job site CRUD round-trip with job count** — Validates: Requirements 2.1, 2.2, 2.5
    - **Property 7: Job site update round-trip** — Validates: Requirements 2.3
    - **Property 8: Job site deletion cascades completely** — Validates: Requirements 2.4
    - **Property 9: Job CRUD round-trip with name and status** — Validates: Requirements 3.1, 3.2, 3.5
    - **Property 10: Job deletion cascades completely** — Validates: Requirements 3.4
    - **Property 11: Multiple contacts on job site or job** — Validates: Requirements 4.1–4.6
    - **Property 12: Effective primary contact inheritance** — Validates: Requirements 4.7, 4.9
    - **Property 13: Job-level contact overrides site-level contact** — Validates: Requirements 4.8, 4.9
    - **Property 14: Note CRUD round-trip with reverse-chronological ordering** — Validates: Requirements 5.1, 5.4
    - **Property 15: Note update records edit timestamp** — Validates: Requirements 5.2
    - **Property 16: Line item total calculation** — `@given` lists of line items with `price` as `Decimal`; assert `calculate_total` equals `sum(price)` — Validates: Requirements 6.3, 7.3
    - **Property 17: Estimate and invoice line item round-trip** — Validates: Requirements 6.2, 6.4, 7.2, 7.4
    - **Property 18: Estimate-to-invoice conversion preserves line items and records source** — Validates: Requirements 8.1, 8.3
    - **Property 19: Converted invoice is independent of source estimate** — Validates: Requirements 8.2
    - **Property 20: Line item deletion does not affect siblings** — Validates: Requirements 6.6, 7.6
    - **Property 21: Job completion timestamp auto-set** — Validates: Requirements 3.6
    - **Property 22: `finished_at` manual control** — Validates: Requirements 3.7
    - **Property 23: Delivered flag round-trip** — Validates: Requirements 6.9, 6.10, 6.11, 7.9, 7.10, 7.11
    - **Property 24: Saved item CRUD round-trip** — Validates: Requirements 11.1, 11.2
    - **Property 25: Line item pre-population independence** — Validates: Requirements 11.5, 11.6
    - **Property 26: Markdown note round-trip** — `@given` arbitrary text including markdown characters; store and retrieve; assert body unchanged — Validates: Requirements 5.5

- [x] 6. Route blueprints — backend
  - [x] 6.1 Implement job site and job blueprints
    - Create `backend/app/blueprints/job_sites_bp.py`: `GET/POST /api/v1/job-sites`, `GET/PUT/DELETE /api/v1/job-sites/<id>`; include `job_count` in list response
    - Create `backend/app/blueprints/jobs_bp.py`: `GET/POST /api/v1/job-sites/<id>/jobs`, `GET/PUT/PATCH/DELETE /api/v1/jobs/<id>`
    - Apply `auth_required` to all routes; return 404 (not 403) when resource belongs to another user
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 10.1_
  - [x] 6.2 Implement contacts, notes, estimates, and invoices blueprints
    - Create `backend/app/blueprints/contacts_bp.py`: `GET/POST /api/v1/job-sites/<id>/contacts`, `GET/POST /api/v1/jobs/<id>/contacts`; include `source` field (`'direct'` or `'inherited'`) in effective-primary-contact response
    - Create `backend/app/blueprints/notes_bp.py`: `GET/POST /api/v1/jobs/<id>/notes`, `PUT/DELETE /api/v1/jobs/<id>/notes/<note_id>`
    - Create `backend/app/blueprints/estimates_bp.py` and `invoices_bp.py` with full CRUD plus line-item sub-routes
    - _Requirements: 4.1–4.9, 5.1–5.3, 6.1–6.11, 7.1–7.11_
  - [x] 6.3 Implement conversion and saved-items blueprints
    - Create `backend/app/blueprints/conversion_bp.py`: `POST /api/v1/estimates/<id>/convert-to-invoice`
    - Create `backend/app/blueprints/saved_items_bp.py`: `GET/POST /api/v1/saved-items`, `GET/PUT/DELETE /api/v1/saved-items/<id>`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 11.1–11.6_
  - [x] 6.4 Register all blueprints in the app factory
    - Update `backend/app/__init__.py` to register all blueprints under `/api/v1`
    - _Requirements: 10.1_

- [ ] 7. Backend integration tests
  - [ ]* 7.1 Write integration tests for auth endpoints
    - Use Flask test client against the `db_test` PostgreSQL container (port 5433, started via `docker compose up -d db_test`)
    - Test register → login → access protected endpoint full cycle
    - Test expired JWT returns 401 and triggers redirect signal
    - _Requirements: 1.1, 1.4, 1.6_
  - [ ]* 7.2 Write integration tests for job site and job endpoints
    - Test cascade delete: create site with jobs/notes/estimates/invoices; delete site; assert all child records gone
    - Test job count in list response
    - _Requirements: 2.4, 2.5, 3.4_
  - [ ]* 7.3 Write integration tests for contacts, notes, estimates, invoices, conversion, and saved items
    - Test effective primary contact inheritance end-to-end
    - Test estimate-to-invoice conversion: verify line item parity and `source_estimate_id`
    - Test saved item pre-population: edit saved item after use; assert line item unchanged
    - _Requirements: 4.7, 4.8, 8.1, 8.2, 8.3, 11.5, 11.6_

- [ ] 8. Checkpoint — backend complete
  - Ensure all pytest tests pass (`pytest backend/tests/`)
  - Confirm all 26 property tests run with `@settings(max_examples=100)`
  - Ask the user if questions arise before proceeding to frontend.

- [x] 9. Frontend — Zustand auth store and API client
  - [x] 9.1 Implement Zustand auth store
    - Create `frontend/src/store/authStore.ts` with `AuthStore` interface: `token`, `userId`, `setAuth`, `clearAuth`
    - Persist `token` and `userId` to `AsyncStorage` (mobile) / `localStorage` (web) using `zustand/middleware` `persist`
    - _Requirements: 1.4, 1.6, 10.5_
  - [x] 9.2 Implement Axios API client with auth interceptor
    - Create `frontend/src/api/client.ts` configuring Axios with `baseURL` from env and a request interceptor that attaches `Authorization: Bearer <token>` from the auth store
    - Add a response interceptor that calls `clearAuth()` and navigates to login on 401 responses
    - _Requirements: 1.6, 10.1_

- [x] 10. Frontend — navigation structure
  - Create `frontend/src/navigation/RootNavigator.tsx` with `AuthStack` (Login, Register) and `AppStack` (all authenticated screens) switching based on `token` presence in the auth store
  - Create placeholder screen files for: `LoginScreen`, `RegisterScreen`, `HomeScreen`, `JobSiteDetailScreen`, `JobDetailScreen`, `EstimateEditorScreen`, `InvoiceEditorScreen`, `ContactEditorScreen`, `SavedItemsScreen`, `SavedItemEditorScreen`
  - Configure `NavigationContainer` with linking config for web URL routing
  - _Requirements: 1.6, 9.3, 9.4, 10.5_

- [x] 11. Frontend — TanStack Query hooks
  - [x] 11.1 Create auth mutation hooks
    - Create `frontend/src/api/hooks/useAuth.ts` with `useRegister` and `useLogin` mutations; on success call `setAuth(token, userId)` and navigate to `HomeScreen`
    - _Requirements: 1.1, 1.4_
  - [x] 11.2 Create job site and job query/mutation hooks
    - Create `frontend/src/api/hooks/useJobSites.ts`: `useJobSites`, `useJobSite`, `useCreateJobSite`, `useUpdateJobSite`, `useDeleteJobSite`
    - Create `frontend/src/api/hooks/useJobs.ts`: `useJobs`, `useJob`, `useCreateJob`, `useUpdateJob`, `useDeleteJob`
    - Use hierarchical query keys (`['job-sites']`, `['job-sites', siteId]`, `['jobs', jobId]`) and invalidate on mutations
    - _Requirements: 2.1–2.5, 3.1–3.7_
  - [x] 11.3 Create contacts, notes, estimates, invoices, conversion, and saved-items hooks
    - Create hooks files for each resource following the same pattern
    - `useEffectivePrimaryContact(jobId)` returns contact plus `source` field
    - `useConvertEstimate` mutation calls `POST /api/v1/estimates/:id/convert-to-invoice`
    - _Requirements: 4.1–4.9, 5.1–5.7, 6.1–6.11, 7.1–7.11, 8.1–8.4, 11.1–11.6_

- [x] 12. Frontend — Auth screens
  - [x] 12.1 Implement `LoginScreen`
    - Render email and password fields; call `useLogin` on submit; display inline error on 401
    - _Requirements: 1.4, 1.5_
  - [x] 12.2 Implement `RegisterScreen`
    - Render email and password fields; call `useRegister` on submit; display inline errors for invalid email (400) and duplicate email (409)
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ]* 12.3 Write unit tests for auth screens
    - Mock `useLogin` and `useRegister`; assert error messages render for each error code
    - _Requirements: 1.2, 1.3, 1.5_

- [x] 13. Frontend — Home screen and Job Site screens
  - [x] 13.1 Implement `HomeScreen`
    - Render list of job sites from `useJobSites`; each item shows name and job count; include create and delete actions
    - _Requirements: 2.1, 2.5_
  - [x] 13.2 Implement `JobSiteDetailScreen`
    - Render job site name and list of jobs from `useJobs`; each job shows name, status, and `finished_at` when present; include create and delete actions
    - _Requirements: 3.1, 3.5_
  - [ ]* 13.3 Write unit tests for Home and JobSiteDetail screens
    - Mock query hooks; assert job count displayed; assert job list renders name, status, and `finished_at`
    - _Requirements: 2.5, 3.5_

- [x] 14. Frontend — Job Detail screen with tabs
  - [x] 14.1 Implement `JobDetailScreen` with tab layout
    - Create tab navigator with four tabs: Notes, Contacts, Estimates, Invoices
    - Display job name, status selector, and `finished_at` field with manual set/clear control at the top
    - _Requirements: 3.3, 3.5, 3.7_
  - [x] 14.2 Implement Notes tab
    - Render notes in reverse-chronological order using `useNotes`; each note renders markdown body via `react-native-markdown-display`
    - Include create and delete actions; navigate to a note editor on tap
    - _Requirements: 5.4, 5.6_
  - [x] 14.3 Implement `MarkdownEditor` component
    - Create `frontend/src/components/MarkdownEditor.tsx` with a text input and a preview toggle that renders markdown (bold, italic, checklists) using `react-native-markdown-display`
    - Used for note creation and editing
    - _Requirements: 5.5, 5.6, 5.7_
  - [x] 14.4 Implement Contacts tab
    - Render list of contacts for the job; show effective primary contact with a visual indicator: "Inherited from job site" or "Directly assigned"
    - Allow designating a primary contact when multiple contacts exist
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_
  - [ ]* 14.5 Write unit tests for Job Detail screen components
    - Test `MarkdownEditor` renders markdown body correctly (bold, italic, checklist)
    - Test Contacts tab shows correct inheritance indicator for inherited vs. direct primary contact
    - Test `getEffectivePrimaryContact` utility with concrete examples
    - _Requirements: 4.9, 5.6, 5.7_

- [x] 15. Frontend — Estimates and Invoices
  - [x] 15.1 Implement Estimates tab and `EstimateEditorScreen`
    - Estimates tab: list estimates with title, total, and delivery status; include create, delete, and "Mark as delivered" actions; include "Convert to Invoice" button per estimate
    - `EstimateEditorScreen`: form for title and line items; each line item has name (required), price (required), notes, URL, hours; display running total as sum of prices; include "Add from Library" button
    - _Requirements: 6.1–6.11, 8.4_
  - [x] 15.2 Implement Invoices tab and `InvoiceEditorScreen`
    - Mirror Estimates tab and editor; show `source_estimate_id` reference when present
    - _Requirements: 7.1–7.11_
  - [x] 15.3 Implement Saved Items library picker in line item editor
    - When user taps "Add from Library", show `SavedItemsScreen` in picker mode; selecting an item pre-populates line item fields; resulting line item is independent of the saved item
    - _Requirements: 11.5, 11.6_
  - [ ]* 15.4 Write unit tests for estimate/invoice screens
    - Test total display equals sum of line item prices with concrete examples
    - Test delivery status toggle renders correctly
    - Test saved items picker pre-populates line item fields from selected saved item
    - _Requirements: 6.3, 6.11, 7.3, 7.11, 11.5_

- [x] 16. Frontend — Contact Editor and Saved Items screens
  - [x] 16.1 Implement `ContactEditorScreen`
    - Form with fields: name (required), phone, email, mailing_address, notes
    - Used for creating and editing contacts on both job sites and jobs
    - _Requirements: 4.10_
  - [x] 16.2 Implement `SavedItemsScreen` and `SavedItemEditorScreen`
    - `SavedItemsScreen`: list all saved items with name and price; include create and delete actions
    - `SavedItemEditorScreen`: form with name (required), notes, URL, hours, price
    - _Requirements: 11.1, 11.3, 11.4_

- [ ] 17. Checkpoint — frontend complete
  - Run `npx jest --testPathPattern=frontend` to confirm all frontend unit tests pass
  - Verify navigation flows compile without TypeScript errors (`npx tsc --noEmit`)
  - Ask the user if questions arise before proceeding to final integration.

- [-] 18. Wire backend and frontend together
  - [x] 18.1 Configure environment and CORS
    - Add `flask-cors` to `requirements.txt` and configure `CORS(app, origins=[...])` in the app factory
    - Add `EXPO_PUBLIC_API_URL` to `frontend/.env.example` pointing to the Flask dev server
    - _Requirements: 9.1, 9.2, 9.3_
  - [ ] 18.2 Verify end-to-end happy path with automated integration tests
    - Write a pytest integration test covering: register → login → create job site → create job → add note → create estimate → add line items → convert to invoice → verify invoice line items match estimate
    - Write a pytest integration test for saved items: create saved item → add to estimate line item → edit saved item → assert line item unchanged
    - _Requirements: 8.1, 8.2, 11.5, 11.6_

- [x] 19. Final checkpoint — full stack
  - Ensure all backend pytest tests pass including all 26 property tests
  - Ensure all frontend Jest tests pass
  - Confirm TypeScript compiles without errors
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `@settings(max_examples=100)` and in-memory fake repositories (no database required for service-layer properties)
- Integration tests (Tasks 7.1–7.3 and 18.2) require the `db_test` Docker container — run `docker compose up -d db_test` before executing them
- The dev database runs in the `db` container — run `docker compose up -d db` before starting the Flask server
- Checkpoints at Tasks 8 and 17 gate backend and frontend completion respectively before integration
