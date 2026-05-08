---
inclusion: fileMatch
fileMatchPattern: "**/saved_item*,**/line_item*,**/LineItemEditor*,**/MaterialsLibrary*,**/SavedItem*,**/useSavedItems*,**/useEstimates*,**/useInvoices*,**/EstimateEditor*,**/InvoiceEditor*"
---

# Library Architecture — Line Items, Entries, and Saved Libraries

## Conceptual Model

There are two "working" tables and two "library" tables:

| Table | Purpose | UI Name |
|-------|---------|---------|
| `line_items` | Active line items on estimates/invoices | (shown inline on estimate/invoice) |
| `line_item_entries` | Materials/hours under a line item | (shown inline on estimate/invoice) |
| `saved_items` | Reusable line item templates | **Item Library** |
| `saved_item_entries` | Reusable material/hours entries | **Materials Library** |

## Relationships

```
Estimate/Invoice
  └── LineItem (named group, e.g. "Toilet Replacement", has hourly_rate)
        └── LineItemEntry (material or hours — the actual cost items)

SavedItem (Item Library — template for a LineItem)
  └── SavedItemEntry (belongs to a SavedItem, also visible in Materials Library)

SavedItemEntry (standalone — saved_item_id IS NULL, only in Materials Library)
```

## Key Rules

### 1. Materials Library = ALL SavedItemEntry records
The Materials Library (`GET /api/v1/saved-items/entries`) returns every `SavedItemEntry` row in the tenant — both standalone entries (saved_item_id = NULL) and entries that belong to a SavedItem. They all look and behave the same in the UI.

### 2. Item Library entries reference Materials Library entries
When you "add from Materials Library" to an Item Library item, the existing `SavedItemEntry` is **assigned** (its `saved_item_id` is set to the target item). No copy is created. This prevents duplicates.

### 3. Estimates/Invoices use COPIES, not references
When you populate a SavedItem or SavedItemEntry into an estimate/invoice, the data is **copied** into `line_items`/`line_item_entries`. There is no FK link back to the library. Editing the copy does NOT affect the library.

### 4. Duplicate prevention via fingerprinting
The 📚 save button on a LineItemEntry is hidden when a matching SavedItemEntry already exists. The match uses a fingerprint: `entry_type|name|unit_price|quantity|hours`. If the user edits any field, the fingerprint changes and the save button reappears.

### 5. Deleting from Materials Library cascades to Item Library
Since a SavedItemEntry may belong to a SavedItem (via saved_item_id FK with ON DELETE CASCADE), deleting it from the Materials Library removes it from the Item Library item too. The UI warns the user about this.

### 6. Creating entries in the Materials Library
`POST /api/v1/saved-items/save-entry` creates a standalone SavedItemEntry (saved_item_id = NULL, user_id set). This does NOT create a SavedItem.

## Database Schema (relevant columns)

### saved_items
- `id` UUID PK
- `user_id` UUID FK → users (who created it)
- `name` — the template name (e.g. "Toilet Replacement")
- `notes`, `hourly_rate`, `created_at`, `updated_at`

### saved_item_entries
- `id` UUID PK
- `saved_item_id` UUID FK → saved_items **NULLABLE** (NULL = standalone)
- `user_id` UUID FK → users **NULLABLE** (set for standalone entries)
- `entry_type` — 'material' or 'hours'
- `name`, `notes`, `url`
- `unit_price`, `quantity` (material fields)
- `hours` (hours field)
- `sort_order`

### line_items
- `id` UUID PK
- `parent_id` UUID (estimate or invoice id — polymorphic, no FK)
- `parent_type` — 'estimate' or 'invoice'
- `name`, `notes`, `hourly_rate`, `sort_order`

### line_item_entries
- `id` UUID PK
- `line_item_id` UUID FK → line_items
- `entry_type` — 'material' or 'hours'
- `name`, `notes`, `url`
- `unit_price`, `quantity` (material fields)
- `hours` (hours field)
- `sort_order`

## API Endpoints

### Materials Library (SavedItemEntry CRUD)
- `GET /api/v1/saved-items/entries` — list ALL entries (standalone + grouped)
- `POST /api/v1/saved-items/save-entry` — create standalone entry
- `PUT /api/v1/saved-items/entries/<id>` — update any entry
- `DELETE /api/v1/saved-items/entries/<id>` — delete any entry (warns if grouped)

### Item Library (SavedItem CRUD)
- `GET /api/v1/saved-items` — list all saved items with their entries
- `POST /api/v1/saved-items` — create a saved item
- `PUT /api/v1/saved-items/<id>` — update a saved item
- `DELETE /api/v1/saved-items/<id>` — delete (cascades entries)
- `POST /api/v1/saved-items/<id>/entries` — add a NEW entry to an item
- `POST /api/v1/saved-items/<id>/entries/assign` — assign an EXISTING entry to an item (move)
- `PUT /api/v1/saved-items/<id>/entries/<eid>` — update grouped entry
- `DELETE /api/v1/saved-items/<id>/entries/<eid>` — delete grouped entry

### Populate (copy library → estimate/invoice)
- `POST /api/v1/saved-items/<id>/populate` — copy SavedItem → new LineItem
- `POST /api/v1/saved-items/entries/<id>/populate` — copy SavedItemEntry → existing LineItem

## Frontend Architecture

### Hooks (`src/api/hooks/useSavedItems.ts`)
- `useSavedItems()` — Item Library list
- `useAllSavedEntries()` — Materials Library flat list
- `useSaveEntryToLibrary()` — create standalone entry (Materials Library)
- `useUpdateStandaloneEntry()` — edit any entry from Materials Library
- `useDeleteStandaloneEntry()` — delete any entry from Materials Library
- `useAssignEntryToItem()` — move entry into a SavedItem
- `usePopulateSavedItem()` — copy SavedItem → estimate/invoice
- `usePopulateSavedEntry()` — copy SavedItemEntry → line item

### Screens
- `MaterialsLibraryScreen` — flat list of all SavedItemEntry records, full CRUD
- `SavedItemsScreen` — list of SavedItems, expand to see entries, pick from Materials Library
- `SavedItemEditorScreen` — create/edit a SavedItem, add entries manually or from Materials Library

### LineItemEditor Component
- Shows 📚 save button per entry (hidden if fingerprint matches library)
- Shows 📚 Save button on line item header (hidden if name matches Item Library)
- Shows 📚 From Library picker to add SavedItemEntry to the current LineItem
- Receives `allSavedEntries` prop for fingerprint comparison
- Receives `savedItems` prop for item name comparison and picker
