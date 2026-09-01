# AI Assistant System

JobSyte includes an in-app AI assistant that can interact with the app on behalf of the user. It uses OpenAI's function calling (tool use) to perform actions like creating job sites, jobs, estimates, invoices, contacts, notes, and time entries.

The AI assistant is a **utility** (toggleable per tenant via the `ai_assistant` utility id), so it lives under the `utilities/` layout on both backend and frontend and is only registered/rendered when enabled for the tenant.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Expo)                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  AIChatBubble (floating, draggable)           │  │
│  │  - Tracks current screen via navigationRef    │  │
│  │  - Sends messages + screen context to API     │  │
│  │  - Receives text responses + actions taken    │  │
│  │  - Invalidates TanStack Query caches          │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  AIProvider (wraps app, provides context)     │  │
│  │  - Listens to navigation state changes        │  │
│  │  - Only renders bubble when authenticated     │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Backend: POST /api/v1/ai/chat                       │
│  ┌───────────────────────────────────────────────┐  │
│  │  ai_assistant/blueprint.py                    │  │
│  │  - Validates request, loads API key from env  │  │
│  │  - Instantiates AIService                     │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  ai_assistant/service.py                      │  │
│  │  - Builds system prompt with user context     │  │
│  │  - Defines OpenAI tools (function schemas)    │  │
│  │  - Calls OpenAI chat completions API          │  │
│  │  - Executes tool calls via existing services  │  │
│  │  - Loops until AI returns final text response │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  OpenAI API (GPT-4.1-mini by default)                │
│  - Receives system prompt + conversation + tools    │
│  - Returns text and/or tool_calls                   │
│  - Tool results are fed back for multi-step flows   │
└─────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/utilities/ai_assistant/service.py` | Core AI logic: tool definitions, system prompt, tool execution, chat loop |
| `backend/app/utilities/ai_assistant/blueprint.py` | HTTP endpoint `POST /api/v1/ai/chat` |
| `frontend/src/utilities/ai_assistant/components/AIChatBubble.tsx` | Floating bubble UI + chat modal + query invalidation |
| `frontend/src/utilities/ai_assistant/components/AIProvider.tsx` | Navigation state tracking, auth-gated + utility-gated rendering |
| `frontend/src/utilities/ai_assistant/hooks/useAI.ts` | TanStack Query mutation hook for the chat endpoint |

## Configuration

Environment variables (in `backend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Model to use for chat completions |
| `OPENAI_BASE_URL` | (empty = OpenAI) | Optional: point to an OpenAI-compatible API (Groq, Together, OpenRouter, etc.) |

## How It Works

### Request Flow

1. User taps the floating AI bubble → chat modal opens
2. User types a message → frontend sends `POST /api/v1/ai/chat` with:
   - `messages`: full conversation history `[{role, content}, ...]`
   - `screen_context`: `{screen: "JobDetail", params: {jobId: "...", siteId: "..."}}`
3. Backend builds a system prompt including:
   - User's name (from the `User`) and the tenant's state (from `BusinessInfo`, used for regional pricing)
   - Current screen name and params (for context)
   - Summary of user's saved items library (for reuse)
4. Backend calls OpenAI with the system prompt, messages, and tool definitions
5. If OpenAI returns `tool_calls`, backend executes them via existing service layer
6. Tool results are fed back to OpenAI for the next iteration (up to 10 loops)
7. When OpenAI returns a text response (no more tool calls), backend returns:
   - `response`: the AI's text message
   - `actions`: list of `{tool, args, result}` for each action taken
8. Frontend displays the response, shows action chips, and invalidates relevant query caches

### Screen Context

The AI knows which screen the user is on and uses route params as implicit context. The
frontend sends the current route name + params (via `navigationRef`), and the system prompt
documents each screen so the model can infer intent. Screen names/params below match
`frontend/src/core/navigation/types.ts`:

| Screen | Available params | AI behavior |
|--------|-----------------|-------------|
| `Home` | (none) | Job sites list; use list_job_sites / list_jobs to find IDs first |
| `JobSiteDetail` | `siteId`, `siteName` | Uses siteId for creating jobs, contacts, site primary contact |
| `JobDetail` | `jobId`, `jobName`, `siteId` | Hub for a job — jobId for estimates, invoices, notes, contacts, time entries |
| `EstimateEditor` | `estimateId`, `jobId` | Edits THIS estimate; calls get_estimate_details first |
| `InvoiceEditor` | `invoiceId`, `jobId` | Edits THIS invoice; calls get_invoice_details first |
| `InvoiceManagement` | (none) | Cross-job invoice list; no single id |
| `ContactEditor` | `parentId`, `parentType` (`job_site`/`job`), `contactId?` | Create/update contact for the parent |
| `SavedItems` / `SavedItemEditor` / `MaterialsLibrary` | varies | Reusable item & materials library; referenced via list_saved_items |
| `Settings` / `EstimateSettings` / `InvoiceSettings` / `EditEstimateOptions` / `EditInvoiceOptions` | (none) | Document-default & field-visibility config; not edited via tools |
| `ProfileSettings` / `BusinessInfo` | (none) | Profile & tenant business details; not edited via tools |
| `AdminUsers` | (none) | Admin-only user management; not acted on via tools |

### Tool Execution

Tools reuse the existing service layer — the AI doesn't bypass any business logic or access control. All operations go through the same `auth_required` decorator and service methods that the regular API uses.

## Available Tools

Line items are named groups; each has material/hours/fee **entries** (see the library
architecture steering doc). Estimates and invoices also carry document metadata
(document_number, document_date, bill_to, company_name, user_name, user_phone, user_email,
payment_method, business_address, worksite_address, notes) with matching `show_*` PDF
visibility flags — the create/update tools accept these as overrides.

### Creation
- `create_job_site` — create a new job site
- `create_job` — create a job within a site
- `create_estimate` — create an estimate with optional line items, entries, and document metadata overrides
- `create_invoice` — create an invoice with optional line items, entries, and document metadata overrides
- `create_note` — create a markdown note on a job
- `create_contact` — create and attach a contact to a job site or job (optionally set primary)

### Estimate Editing
- `get_estimate_details` — fetch full estimate with all line items/entries and their IDs
- `update_estimate` — change title, tax rate, or any document metadata / `show_*` flags
- `add_line_item_to_estimate` — add a new line item (with entries) to existing estimate
- `update_line_item` — change name, notes, or hourly rate of a line item
- `delete_line_item` — remove a line item and all its entries
- `add_entry_to_line_item` — add a material, hours, or fee entry to a line item
- `update_entry` — change an entry's name, price, quantity, or hours
- `delete_entry` — remove a single entry
- `clear_all_line_items` — remove all line items from an estimate (start over)

### Invoice Editing
- `get_invoice_details` — fetch full invoice with all line items/entries and their IDs
- `update_invoice` — change title, tax rate, or any document metadata / `show_*` flags

### Conversion
- `convert_estimate_to_invoice` — deep-copy an estimate into a new invoice

### Time Tracking
- `add_time_entry` — log manual hours worked on a job (optional `worked_at` ISO 8601)
- `clock_in` — start real-time tracking on a job
- `clock_out` — stop real-time tracking on a job
- `list_time_entries` — list logged hours for a job

### Lookup
- `list_job_sites` — find job site IDs
- `list_jobs` — find job IDs for a site
- `list_estimates` — find estimate IDs for a job
- `list_contacts` — list contacts for a job site or job (job lists include inherited site contacts)
- `list_saved_items` — list reusable templates

### Contact Management
- `set_primary_contact` — set a contact as primary for a job site or job

## System Prompt Behavior

The system prompt instructs the AI to:

1. **Favor single estimates** — multiple tasks become line items within one estimate, not separate estimates
2. **Always get details before editing** — call `get_estimate_details` before any update/delete
3. **Use screen context** — infer which job site/job/estimate the user means from their current screen
4. **Use regional pricing** — generate realistic material costs and labor rates for the user's state
5. **Format notes in markdown** — use headings, lists, bold for structured notes
6. **Confirm actions** — always tell the user what was done after completing tool calls

## Frontend Query Invalidation

After the AI takes actions, the frontend invalidates the relevant TanStack Query caches so the UI refreshes immediately. The mapping is in `AIChatBubble.tsx` — each tool name maps to the query keys it affects (e.g. `create_job` invalidates both `["job-sites"]` and `["jobs"]`).

## Adding a New Tool

1. Add the tool schema to the `TOOLS` list in `ai_assistant/service.py` (OpenAI function calling format)
2. Add the execution handler in `_execute_tool()` — call the appropriate service method
3. Add the tool name to the `switch` statement in `AIChatBubble.tsx` for query invalidation
4. Update the system prompt if the AI needs behavioral guidance for the new tool

> Keep the backend `TOOLS` names and the frontend `AIChatBubble.tsx` `switch` cases in sync —
> every tool should have an invalidation case so the UI refreshes after the AI acts.

## Model Compatibility

The architecture uses the OpenAI SDK's chat completions with tool calling. Compatible options:

- **OpenAI models**: gpt-4.1-mini (default), gpt-4.1, gpt-4.1-nano, gpt-4o, gpt-4o-mini
- **OpenAI-compatible APIs** (set `OPENAI_BASE_URL`): Groq, Together AI, OpenRouter, Fireworks AI, Ollama (local)
- **Requires code changes**: Anthropic Claude, Google Gemini, AWS Bedrock (different SDKs)

## Cost

The default is GPT-4.1-mini, chosen for stronger instruction-following and tool-calling
reliability (this assistant does multi-step tool calls across ~28 tools). It costs a few times
more per token than GPT-4o-mini but is still inexpensive: a typical interaction uses ~2-4K
tokens, and even heavy usage (100+ messages/day) is on the order of ~$10-15/month. For a
lower-cost option, set `OPENAI_MODEL=gpt-4o-mini`; for maximum accuracy, `gpt-4.1`. Verify
current per-token pricing on OpenAI's pricing page, as it changes over time.
