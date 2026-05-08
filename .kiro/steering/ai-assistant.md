# AI Assistant System

SiteKeeper includes an in-app AI assistant that can interact with the app on behalf of the user. It uses OpenAI's function calling (tool use) to perform actions like creating job sites, estimates, contacts, and notes.

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
│  │  ai_bp.py (blueprint)                         │  │
│  │  - Validates request, loads API key from env  │  │
│  │  - Instantiates AIService                     │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  ai_service.py (service)                      │  │
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
│  OpenAI API (GPT-4o-mini by default)                 │
│  - Receives system prompt + conversation + tools    │
│  - Returns text and/or tool_calls                   │
│  - Tool results are fed back for multi-step flows   │
└─────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/services/ai_service.py` | Core AI logic: tool definitions, system prompt, tool execution, chat loop |
| `backend/app/blueprints/ai_bp.py` | HTTP endpoint `POST /api/v1/ai/chat` |
| `frontend/src/components/AIChatBubble.tsx` | Floating bubble UI + chat modal + query invalidation |
| `frontend/src/components/AIProvider.tsx` | Navigation state tracking, auth-gated rendering |
| `frontend/src/api/hooks/useAI.ts` | TanStack Query mutation hook for the chat endpoint |

## Configuration

Environment variables (in `backend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model to use for chat completions |
| `OPENAI_BASE_URL` | (empty = OpenAI) | Optional: point to an OpenAI-compatible API (Groq, Together, OpenRouter, etc.) |

## How It Works

### Request Flow

1. User taps the floating AI bubble → chat modal opens
2. User types a message → frontend sends `POST /api/v1/ai/chat` with:
   - `messages`: full conversation history `[{role, content}, ...]`
   - `screen_context`: `{screen: "JobDetail", params: {jobId: "...", siteId: "..."}}`
3. Backend builds a system prompt including:
   - User's name and state (for regional pricing)
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

The AI knows which screen the user is on and uses route params as implicit context:

| Screen | Available params | AI behavior |
|--------|-----------------|-------------|
| `Home` | (none) | May need to list/find job sites first |
| `JobSiteDetail` | `siteId`, `siteName` | Uses siteId for creating jobs, contacts |
| `JobDetail` | `jobId`, `jobName`, `siteId` | Uses jobId for estimates, notes, contacts |
| `EstimateEditor` | `estimateId`, `jobId` | Uses estimateId for editing existing estimate |
| `InvoiceEditor` | `invoiceId`, `jobId` | Uses invoiceId for editing |

### Tool Execution

Tools reuse the existing service layer — the AI doesn't bypass any business logic or access control. All operations go through the same `auth_required` decorator and service methods that the regular API uses.

## Available Tools

### Creation
- `create_job_site` — create a new job site
- `create_job` — create a job within a site
- `create_estimate` — create an estimate with optional line items and entries
- `create_invoice` — create an invoice with optional line items and entries
- `create_note` — create a markdown note on a job
- `create_contact` — create and attach a contact to a job site or job

### Estimate Editing
- `get_estimate_details` — fetch full estimate with all line items/entries and their IDs
- `update_estimate` — change title or tax rate
- `add_line_item_to_estimate` — add a new line item (with entries) to existing estimate
- `update_line_item` — change name, notes, or hourly rate of a line item
- `delete_line_item` — remove a line item and all its entries
- `add_entry_to_line_item` — add a material or hours entry to a line item
- `update_entry` — change an entry's name, price, quantity, or hours
- `delete_entry` — remove a single entry
- `clear_all_line_items` — remove all line items from an estimate (start over)

### Conversion
- `convert_estimate_to_invoice` — deep-copy an estimate into a new invoice

### Lookup
- `list_job_sites` — find job site IDs
- `list_jobs` — find job IDs for a site
- `list_estimates` — find estimate IDs for a job
- `list_contacts` — list contacts for a job site or job
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

1. Add the tool schema to the `TOOLS` list in `ai_service.py` (OpenAI function calling format)
2. Add the execution handler in `_execute_tool()` — call the appropriate service method
3. Add the tool name to the `switch` statement in `AIChatBubble.tsx` for query invalidation
4. Update the system prompt if the AI needs behavioral guidance for the new tool

## Model Compatibility

The architecture uses the OpenAI SDK's chat completions with tool calling. Compatible options:

- **OpenAI models**: gpt-4o-mini (default), gpt-4o, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano
- **OpenAI-compatible APIs** (set `OPENAI_BASE_URL`): Groq, Together AI, OpenRouter, Fireworks AI, Ollama (local)
- **Requires code changes**: Anthropic Claude, Google Gemini, AWS Bedrock (different SDKs)

## Cost

GPT-4o-mini at ~$0.15/1M input + $0.60/1M output tokens. A typical interaction uses ~2-4K tokens total, costing roughly $0.001-0.003 per message. Even heavy usage (100+ messages/day) stays under $5/month.
