# Requirements Document

## Introduction

A mobile-first application for small contractors to manage their business operations. The app provides a job-site-centric workflow where contractors can organize job sites, track individual jobs (tasks) within each site, and manage contacts, notes, estimates, and invoices per job. The application runs on Android, iOS, and web via Expo (React Native), with a Python Flask backend and PostgreSQL database. Authentication is email/password-based with a pluggable design to allow future auth providers. Users can self-register immediately without email verification. The architecture prioritizes simplicity and extensibility so new features can be added incrementally.

## Glossary

- **App**: The Expo (React Native) cross-platform application (Android, iOS, web), built and developed using `npx expo`.
- **Backend**: The server-side API service implemented in Python Flask, backed by a PostgreSQL database.
- **User**: An authenticated contractor using the App.
- **Job_Site**: A physical location or project grouping that contains one or more Jobs.
- **Job**: A discrete task or work item belonging to a Job_Site.
- **Contact**: A person associated with a Job_Site or Job, with optional fields including phone, email, mailing address, and notes.
- **Primary_Contact**: The designated main Contact for a Job_Site or Job, used when multiple Contacts are present and for inheritance resolution.
- **Note**: A record attached to a Job whose body is stored and edited as markdown text.
- **Estimate**: A cost estimate document attached to a Job.
- **Invoice**: A billing document attached to a Job.
- **Line_Item**: A single entry in an Estimate or Invoice with a name, optional description/notes, optional URL, optional hours, and a price.
- **Saved_Item**: A reusable item in the User's personal item library that can be used to pre-populate Line_Items on Estimates and Invoices.
- **Item_Library**: The collection of a User's Saved_Items.
- **Auth_Service**: The component responsible for registering and authenticating Users.
- **Session**: An authenticated session token issued to a User after login.

---

## Requirements

### Requirement 1: User Registration and Authentication

**User Story:** As a contractor, I want to register and log in with an email address and password, so that my business data is private and secure and I can start using the app immediately.

#### Acceptance Criteria

1. WHEN a User submits a valid email address and password on the registration screen, THE Auth_Service SHALL create a new account and issue a Session token granting immediate access to the App.
2. WHEN a User submits a registration request with an email address that does not conform to standard email format, THE Auth_Service SHALL return an error message indicating the email address is invalid.
3. WHEN a User submits a registration request with an email address already associated with an existing account, THE Auth_Service SHALL return an error message indicating the email address is already in use.
4. WHEN a User submits a valid email address and password on the login screen, THE Auth_Service SHALL issue a Session token and grant access to the App.
5. WHEN a User submits an invalid email address or password on the login screen, THE Auth_Service SHALL return an error message indicating the credentials are incorrect without revealing which field is wrong.
6. WHEN a Session token expires, THE App SHALL redirect the User to the login screen.
7. THE Auth_Service SHALL store passwords using a one-way cryptographic hash with a per-user salt.
8. THE Auth_Service SHALL use the User's email address as the unique username identifier throughout the system.
9. THE Auth_Service SHALL be implemented behind an interface so that alternative authentication providers can be substituted without changes to other system components.

---

### Requirement 2: Job Site Management

**User Story:** As a contractor, I want to create and manage job sites, so that I can organize my work by location or project.

#### Acceptance Criteria

1. THE App SHALL display a list of all Job_Sites belonging to the authenticated User on the home screen.
2. WHEN a User creates a Job_Site, THE Backend SHALL persist the Job_Site and associate it with the User's account.
3. WHEN a User edits a Job_Site, THE Backend SHALL update the Job_Site record and reflect the changes in the App.
4. WHEN a User deletes a Job_Site, THE Backend SHALL remove the Job_Site and all associated Jobs, Contacts, Notes, Estimates, and Invoices.
5. THE App SHALL display each Job_Site with its name and a count of associated Jobs.

---

### Requirement 3: Job Management

**User Story:** As a contractor, I want to create and manage jobs within a job site, so that I can track individual tasks or work orders.

#### Acceptance Criteria

1. WHEN a User opens a Job_Site, THE App SHALL display a list of all Jobs belonging to that Job_Site.
2. WHEN a User creates a Job within a Job_Site, THE Backend SHALL persist the Job and associate it with the Job_Site.
3. WHEN a User edits a Job, THE Backend SHALL update the Job record and reflect the changes in the App.
4. WHEN a User deletes a Job, THE Backend SHALL remove the Job and all associated Notes, Estimates, and Invoices.
5. THE App SHALL display each Job with its name, status, and `finished_at` timestamp when present.
6. WHEN a Job's status is set to `completed`, THE Backend SHALL record a `finished_at` timestamp on the Job if one is not already set.
7. THE App SHALL allow a User to manually set or clear the `finished_at` timestamp on a Job.

---

### Requirement 4: Contact Information and Inheritance

**User Story:** As a contractor, I want to attach multiple contacts to a job site or job and designate a primary contact, so that I always have the right person to call without re-entering data.

#### Acceptance Criteria

1. WHEN a User adds a Contact to a Job_Site, THE Backend SHALL persist the Contact and associate it with the Job_Site.
2. WHEN a User adds a Contact to a Job, THE Backend SHALL persist the Contact and associate it with the Job.
3. THE App SHALL allow a User to add more than one Contact to a Job_Site.
4. THE App SHALL allow a User to add more than one Contact to a Job.
5. WHEN a Job_Site has multiple Contacts, THE App SHALL allow the User to designate exactly one Contact as the Primary_Contact for that Job_Site.
6. WHEN a Job has multiple Contacts, THE App SHALL allow the User to designate exactly one Contact as the Primary_Contact for that Job.
7. WHEN a Job has no directly assigned Contacts, THE App SHALL display the Primary_Contact inherited from the parent Job_Site as the effective primary contact for that Job.
8. WHEN a Job has at least one directly assigned Contact, THE App SHALL use the Job-level Primary_Contact as the effective primary contact for that Job, regardless of the Job_Site's Primary_Contact.
9. THE App SHALL visually indicate whether the displayed Primary_Contact is inherited from the Job_Site or assigned directly to the Job.
10. THE App SHALL allow a User to record the following fields for a Contact: name (required), phone (optional), email (optional), mailing_address (optional text), and notes (optional).

---

### Requirement 5: Notes

**User Story:** As a contractor, I want to add notes to a job, so that I can record observations, instructions, or reminders.

#### Acceptance Criteria

1. WHEN a User creates a Note on a Job, THE Backend SHALL persist the Note with a timestamp and associate it with the Job.
2. WHEN a User edits a Note, THE Backend SHALL update the Note record and record the time of the last edit.
3. WHEN a User deletes a Note, THE Backend SHALL remove the Note record.
4. THE App SHALL display all Notes for a Job in reverse chronological order by creation time.
5. THE Backend SHALL store the Note body as markdown text.
6. THE App SHALL render the Note body as formatted markdown when displaying notes.
7. THE App SHALL provide a markdown-aware text editor for creating and editing Notes, supporting checklists and formatting.

---

### Requirement 6: Estimates

**User Story:** As a contractor, I want to create estimates for a job, so that I can communicate expected costs to clients.

#### Acceptance Criteria

1. WHEN a User creates an Estimate on a Job, THE Backend SHALL persist the Estimate with a creation timestamp and associate it with the Job.
2. THE App SHALL allow a User to add one or more Line_Items to an Estimate; each Line_Item SHALL have a name (required) and a price (required), and MAY optionally include a description/notes, a URL (a link to where the item can be purchased), and hours (time spent or estimated).
3. THE App SHALL calculate and display the total cost of an Estimate as the sum of all Line_Item prices.
4. WHEN a User adds a Line_Item to an Estimate, THE Backend SHALL persist the Line_Item and associate it with the Estimate.
5. WHEN a User edits a Line_Item on an Estimate, THE Backend SHALL update the Line_Item record and reflect the changes in the App.
6. WHEN a User deletes a Line_Item from an Estimate, THE Backend SHALL remove that Line_Item record without affecting other Line_Items on the Estimate.
7. WHEN a User edits an Estimate, THE Backend SHALL update the Estimate record and its line items.
8. WHEN a User deletes an Estimate, THE Backend SHALL remove the Estimate and all associated line items.
9. WHEN a User creates an Estimate, THE Backend SHALL set `delivered` to false by default.
10. THE App SHALL allow a User to mark an Estimate as delivered.
11. THE App SHALL display the delivery status of each Estimate.

---

### Requirement 7: Invoices

**User Story:** As a contractor, I want to generate invoices for a job, so that I can bill clients for completed work.

#### Acceptance Criteria

1. WHEN a User creates an Invoice on a Job, THE Backend SHALL persist the Invoice with a creation timestamp and associate it with the Job.
2. THE App SHALL allow a User to add one or more Line_Items to an Invoice; each Line_Item SHALL have a name (required) and a price (required), and MAY optionally include a description/notes, a URL (a link to where the item can be purchased), and hours (time spent or estimated).
3. THE App SHALL calculate and display the total amount due on an Invoice as the sum of all Line_Item prices.
4. WHEN a User adds a Line_Item to an Invoice, THE Backend SHALL persist the Line_Item and associate it with the Invoice.
5. WHEN a User edits a Line_Item on an Invoice, THE Backend SHALL update the Line_Item record and reflect the changes in the App.
6. WHEN a User deletes a Line_Item from an Invoice, THE Backend SHALL remove that Line_Item record without affecting other Line_Items on the Invoice.
7. WHEN a User edits an Invoice, THE Backend SHALL update the Invoice record and its line items.
8. WHEN a User deletes an Invoice, THE Backend SHALL remove the Invoice and all associated line items.
9. WHEN a User creates an Invoice, THE Backend SHALL set `delivered` to false by default.
10. THE App SHALL allow a User to mark an Invoice as delivered.
11. THE App SHALL display the delivery status of each Invoice.

---

### Requirement 8: Estimate to Invoice Conversion

**User Story:** As a contractor, I want to convert an existing estimate into an invoice, so that I can bill clients based on previously agreed costs without re-entering line items.

#### Acceptance Criteria

1. WHEN a User initiates a conversion of an Estimate to an Invoice, THE App SHALL create a new Invoice on the same Job pre-populated with all Line_Items from the source Estimate.
2. WHEN an Estimate is converted to an Invoice, THE Backend SHALL persist the new Invoice as an independent record so that subsequent edits to the Invoice do not affect the source Estimate.
3. WHEN an Estimate is converted to an Invoice, THE Backend SHALL record a reference to the source Estimate on the new Invoice.
4. WHEN a User converts an Estimate to an Invoice, THE App SHALL allow the User to review and edit the pre-populated Line_Items before saving the Invoice.

---

### Requirement 9: Cross-Platform Availability

**User Story:** As a contractor, I want to use the app on my phone, tablet, or computer, so that I can manage my business from any device.

#### Acceptance Criteria

1. THE App SHALL run on Android devices meeting the minimum supported OS version defined in the project configuration.
2. THE App SHALL run on iOS devices meeting the minimum supported OS version defined in the project configuration.
3. THE App SHALL run in a modern web browser without requiring a native installation.
4. THE App SHALL present a consistent user interface and feature set across all three platforms.
5. THE App SHALL be built and developed using Expo (`npx expo`) as the primary toolchain.

---

### Requirement 10: Extensible Architecture

**User Story:** As a developer, I want the codebase to follow a modular, layered architecture, so that new features can be added without restructuring existing code.

#### Acceptance Criteria

1. THE Backend SHALL expose all data operations through a versioned REST API so that clients and internal modules interact through defined contracts.
2. THE Backend SHALL separate data access logic from business logic so that the database layer can be replaced or extended independently.
3. THE Backend SHALL be implemented using Python Flask so that the server-side runtime is consistent with the chosen technology stack.
4. THE App SHALL be built using Expo (React Native) so that the frontend runtime is consistent with the chosen technology stack.
5. THE App SHALL separate navigation, screen, and data-fetching concerns into distinct layers so that individual layers can be modified without affecting others.
6. THE Auth_Service SHALL be accessed through a defined interface so that the authentication implementation can be replaced without modifying callers.

---

### Requirement 11: Saved Items (Item Library)

**User Story:** As a contractor, I want a personal library of reusable items so I can quickly populate estimates and invoices without re-entering common items.

#### Acceptance Criteria

1. THE App SHALL allow a User to create a Saved_Item with a name (required) and optionally notes, a URL, hours, and a price.
2. THE Backend SHALL persist Saved_Items and associate them with the User's account.
3. THE App SHALL allow a User to edit a Saved_Item.
4. THE App SHALL allow a User to delete a Saved_Item.
5. WHEN adding a Line_Item to an Estimate or Invoice, THE App SHALL allow the User to select a Saved_Item from their Item_Library to pre-populate the Line_Item fields.
6. WHEN a Saved_Item is used to pre-populate a Line_Item, THE resulting Line_Item SHALL be stored as an independent record with no ongoing link to the source Saved_Item.

---

### Requirement 12: User Profile Settings

**User Story:** As a contractor, I want to manage my profile settings so that my business information is stored and available for use across the app (e.g. on invoices).

#### Acceptance Criteria

1. THE App SHALL allow a User to view and edit their profile settings from the home screen.
2. THE App SHALL display the User's email address as a read-only field on the profile settings screen.
3. THE App SHALL allow a User to set their name.
4. THE App SHALL allow a User to set their US state as a 2-letter state code.
5. THE App SHALL allow a User to set their company name.
6. THE App SHALL allow a User to set their phone number.
7. THE App SHALL allow a User to set their payment method (e.g. Venmo handle, Zelle, etc.).
8. WHEN a User saves their profile settings, THE Backend SHALL persist all profile fields and associate them with the User's account.
9. THE Backend SHALL expose profile settings via authenticated GET and PUT endpoints at `/api/v1/profile`.
