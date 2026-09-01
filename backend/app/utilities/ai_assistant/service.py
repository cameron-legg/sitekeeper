"""AI assistant service — orchestrates OpenAI function calling with app context.

The AI can:
- Create job sites, jobs, estimates, invoices, notes
- Add line items and entries to estimates/invoices
- Convert estimates to invoices
- Use saved items as templates
- Generate line items using LLM knowledge + user's state for pricing
"""

import json
import logging
from decimal import Decimal

from openai import OpenAI

from ...models import User
from ...extensions import db
from ...config import Config
from ...core.services.job_site_service import JobSiteService
from ...core.services.job_service import JobService
from ..estimates.service import EstimateService
from ..invoices.service import InvoiceService
from ..notes.service import NoteService
from ..invoices.conversion_service import ConversionService
from ..saved_items.service import SavedItemService
from ..contacts.service import ContactService
from ..time_tracking.service import TimeEntryService

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tool definitions for OpenAI function calling
# ---------------------------------------------------------------------------

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_job_site",
            "description": "Create a new job site (property/location) for the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name of the job site (e.g. '1234 Elm Street')"},
                    "description": {"type": "string", "description": "Optional description of the site"},
                    "address": {"type": "string", "description": "Full address of the job site"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_job",
            "description": "Create a new job within a job site.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_site_id": {"type": "string", "description": "ID of the job site to create the job in"},
                    "name": {"type": "string", "description": "Name/title of the job (e.g. 'Fix leaking faucet')"},
                    "description": {"type": "string", "description": "Optional description of the work"},
                },
                "required": ["job_site_id", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_estimate",
            "description": "Create a new estimate for a job. Optionally include line items with entries. Document metadata (number, date, bill_to, business details) is auto-populated from the tenant's business info but can be overridden.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "ID of the job to create the estimate for"},
                    "title": {"type": "string", "description": "Title of the estimate"},
                    "tax_rate": {"type": "number", "description": "Sales tax rate as a percentage (e.g. 8.5 for 8.5%). Only applies to materials."},
                    "bill_to": {"type": "string", "description": "Who to bill (overrides primary contact name)"},
                    "worksite_address": {"type": "string", "description": "Worksite address (overrides job site address)"},
                    "notes": {"type": "string", "description": "Additional notes to include at the end of the PDF (supports markdown)"},
                    "company_name": {"type": "string", "description": "Business name override"},
                    "user_name": {"type": "string", "description": "Worker/owner name override"},
                    "user_phone": {"type": "string", "description": "Business phone override"},
                    "user_email": {"type": "string", "description": "Business email override"},
                    "payment_method": {"type": "string", "description": "Payment method override"},
                    "business_address": {"type": "string", "description": "Business address override"},
                    "line_items": {
                        "type": "array",
                        "description": "Optional line items to add to the estimate",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string", "description": "Name of the line item group (e.g. 'Faucet Replacement')"},
                                "notes": {"type": "string", "description": "Optional notes"},
                                "hourly_rate": {"type": "number", "description": "Hourly rate for labor entries in this group"},
                                "entries": {
                                    "type": "array",
                                    "description": "Material and hours entries for this line item",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "entry_type": {"type": "string", "enum": ["material", "hours", "fee"]},
                                            "name": {"type": "string", "description": "Name of the material or labor task"},
                                            "unit_price": {"type": "number", "description": "Price per unit (materials only)"},
                                            "quantity": {"type": "number", "description": "Quantity (materials only)"},
                                            "hours": {"type": "number", "description": "Number of hours (hours entries only)"},
                                            "notes": {"type": "string", "description": "Optional notes"},
                                        },
                                        "required": ["entry_type", "name"],
                                    },
                                },
                            },
                            "required": ["name"],
                        },
                    },
                },
                "required": ["job_id", "title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_invoice",
            "description": "Create a new invoice for a job. Optionally include line items with entries. Document metadata is auto-populated from the tenant's business info but can be overridden.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "ID of the job to create the invoice for"},
                    "title": {"type": "string", "description": "Title of the invoice"},
                    "tax_rate": {"type": "number", "description": "Sales tax rate as a percentage (e.g. 8.5 for 8.5%). Only applies to materials."},
                    "bill_to": {"type": "string", "description": "Who to bill (overrides primary contact name)"},
                    "worksite_address": {"type": "string", "description": "Worksite address (overrides job site address)"},
                    "notes": {"type": "string", "description": "Additional notes to include at the end of the PDF (supports markdown)"},
                    "company_name": {"type": "string", "description": "Business name override"},
                    "user_name": {"type": "string", "description": "Worker/owner name override"},
                    "user_phone": {"type": "string", "description": "Business phone override"},
                    "user_email": {"type": "string", "description": "Business email override"},
                    "payment_method": {"type": "string", "description": "Payment method override"},
                    "business_address": {"type": "string", "description": "Business address override"},
                    "line_items": {
                        "type": "array",
                        "description": "Optional line items to add to the invoice",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string", "description": "Name of the line item group"},
                                "notes": {"type": "string", "description": "Optional notes"},
                                "hourly_rate": {"type": "number", "description": "Hourly rate for labor entries"},
                                "entries": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "entry_type": {"type": "string", "enum": ["material", "hours", "fee"]},
                                            "name": {"type": "string"},
                                            "unit_price": {"type": "number"},
                                            "quantity": {"type": "number"},
                                            "hours": {"type": "number"},
                                            "notes": {"type": "string"},
                                        },
                                        "required": ["entry_type", "name"],
                                    },
                                },
                            },
                            "required": ["name"],
                        },
                    },
                },
                "required": ["job_id", "title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_note",
            "description": "Create a note on a job. Notes support full markdown formatting (headings, lists, bold, links, code blocks, etc.).",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "ID of the job to add the note to"},
                    "body": {"type": "string", "description": "The note content in markdown format. Use headings, bullet lists, bold, etc. for well-structured notes."},
                },
                "required": ["job_id", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "convert_estimate_to_invoice",
            "description": "Convert an existing estimate into an invoice (copies all line items).",
            "parameters": {
                "type": "object",
                "properties": {
                    "estimate_id": {"type": "string", "description": "ID of the estimate to convert"},
                },
                "required": ["estimate_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_estimate_details",
            "description": "Get full details of an estimate including all its line items and entries. Use this before editing to see what currently exists.",
            "parameters": {
                "type": "object",
                "properties": {
                    "estimate_id": {"type": "string", "description": "ID of the estimate to retrieve"},
                },
                "required": ["estimate_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_estimate",
            "description": "Update an existing estimate's title, tax rate, or document metadata fields (bill_to, notes, business details, visibility flags, etc.).",
            "parameters": {
                "type": "object",
                "properties": {
                    "estimate_id": {"type": "string", "description": "ID of the estimate to update"},
                    "title": {"type": "string", "description": "New title for the estimate"},
                    "tax_rate": {"type": "number", "description": "New tax rate as a percentage (e.g. 8.5). Set to 0 to clear tax."},
                    "document_number": {"type": "string", "description": "Override the auto-assigned document number"},
                    "document_date": {"type": "string", "description": "Document date in YYYY-MM-DD format"},
                    "bill_to": {"type": "string", "description": "Who to bill"},
                    "worksite_address": {"type": "string", "description": "Worksite address"},
                    "company_name": {"type": "string", "description": "Business name"},
                    "user_name": {"type": "string", "description": "Worker/owner name"},
                    "user_phone": {"type": "string", "description": "Business phone"},
                    "user_email": {"type": "string", "description": "Business email"},
                    "payment_method": {"type": "string", "description": "Payment method"},
                    "business_address": {"type": "string", "description": "Business address"},
                    "notes": {"type": "string", "description": "Additional notes (markdown) for end of PDF"},
                    "show_document_number": {"type": "boolean", "description": "Show document number in PDF"},
                    "show_document_date": {"type": "boolean", "description": "Show date in PDF"},
                    "show_bill_to": {"type": "boolean", "description": "Show bill-to in PDF"},
                    "show_company_name": {"type": "boolean", "description": "Show business name in PDF"},
                    "show_user_name": {"type": "boolean", "description": "Show owner/worker name in PDF"},
                    "show_user_phone": {"type": "boolean", "description": "Show phone in PDF"},
                    "show_user_email": {"type": "boolean", "description": "Show email in PDF"},
                    "show_payment_method": {"type": "boolean", "description": "Show payment method in PDF"},
                    "show_business_address": {"type": "boolean", "description": "Show business address in PDF"},
                    "show_worksite_address": {"type": "boolean", "description": "Show worksite address in PDF"},
                    "show_notes": {"type": "boolean", "description": "Show notes in PDF"},
                },
                "required": ["estimate_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_line_item_to_estimate",
            "description": "Add a new line item (with optional entries) to an existing estimate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "estimate_id": {"type": "string", "description": "ID of the estimate to add the line item to"},
                    "name": {"type": "string", "description": "Name of the line item group (e.g. 'Shower Replacement')"},
                    "notes": {"type": "string", "description": "Optional notes"},
                    "hourly_rate": {"type": "number", "description": "Hourly rate for labor entries in this group"},
                    "entries": {
                        "type": "array",
                        "description": "Material and hours entries for this line item",
                        "items": {
                            "type": "object",
                            "properties": {
                                "entry_type": {"type": "string", "enum": ["material", "hours", "fee"]},
                                "name": {"type": "string", "description": "Name of the material or labor task"},
                                "unit_price": {"type": "number", "description": "Price per unit (materials only)"},
                                "quantity": {"type": "number", "description": "Quantity (materials only)"},
                                "hours": {"type": "number", "description": "Number of hours (hours entries only)"},
                                "notes": {"type": "string", "description": "Optional notes"},
                            },
                            "required": ["entry_type", "name"],
                        },
                    },
                },
                "required": ["estimate_id", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_line_item",
            "description": "Update an existing line item's name, notes, or hourly rate on an estimate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "estimate_id": {"type": "string", "description": "ID of the estimate containing the line item"},
                    "line_item_id": {"type": "string", "description": "ID of the line item to update"},
                    "name": {"type": "string", "description": "New name for the line item"},
                    "notes": {"type": "string", "description": "New notes"},
                    "hourly_rate": {"type": "number", "description": "New hourly rate"},
                },
                "required": ["estimate_id", "line_item_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_line_item",
            "description": "Remove a line item (and all its entries) from an estimate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "estimate_id": {"type": "string", "description": "ID of the estimate"},
                    "line_item_id": {"type": "string", "description": "ID of the line item to delete"},
                },
                "required": ["estimate_id", "line_item_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_entry_to_line_item",
            "description": "Add a material or hours entry to an existing line item on an estimate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "estimate_id": {"type": "string", "description": "ID of the estimate"},
                    "line_item_id": {"type": "string", "description": "ID of the line item to add the entry to"},
                    "entry_type": {"type": "string", "enum": ["material", "hours", "fee"], "description": "Type of entry"},
                    "name": {"type": "string", "description": "Name of the material or labor task"},
                    "unit_price": {"type": "number", "description": "Price per unit (materials only)"},
                    "quantity": {"type": "number", "description": "Quantity (materials only)"},
                    "hours": {"type": "number", "description": "Number of hours (hours entries only)"},
                    "notes": {"type": "string", "description": "Optional notes"},
                },
                "required": ["estimate_id", "line_item_id", "entry_type", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_entry",
            "description": "Update an existing entry (material or hours) on a line item in an estimate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "estimate_id": {"type": "string", "description": "ID of the estimate"},
                    "line_item_id": {"type": "string", "description": "ID of the line item containing the entry"},
                    "entry_id": {"type": "string", "description": "ID of the entry to update"},
                    "name": {"type": "string", "description": "New name"},
                    "unit_price": {"type": "number", "description": "New unit price (materials only)"},
                    "quantity": {"type": "number", "description": "New quantity (materials only)"},
                    "hours": {"type": "number", "description": "New hours (hours entries only)"},
                    "notes": {"type": "string", "description": "New notes"},
                },
                "required": ["estimate_id", "line_item_id", "entry_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_entry",
            "description": "Remove an entry from a line item on an estimate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "estimate_id": {"type": "string", "description": "ID of the estimate"},
                    "line_item_id": {"type": "string", "description": "ID of the line item"},
                    "entry_id": {"type": "string", "description": "ID of the entry to delete"},
                },
                "required": ["estimate_id", "line_item_id", "entry_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "clear_all_line_items",
            "description": "Remove ALL line items (and their entries) from an estimate. Use when the user wants to start over or redo an estimate from scratch.",
            "parameters": {
                "type": "object",
                "properties": {
                    "estimate_id": {"type": "string", "description": "ID of the estimate to clear"},
                },
                "required": ["estimate_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_job_sites",
            "description": "List all job sites for the current user. Use this to find a job site ID.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_jobs",
            "description": "List all jobs for a given job site.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_site_id": {"type": "string", "description": "ID of the job site"},
                },
                "required": ["job_site_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_estimates",
            "description": "List all estimates for a given job.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "ID of the job"},
                },
                "required": ["job_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_saved_items",
            "description": "List the user's saved items (reusable line item templates with materials and labor).",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_invoice_details",
            "description": "Get full details of an invoice including all its line items, entries, and document metadata. Use this before editing.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string", "description": "ID of the invoice to retrieve"},
                },
                "required": ["invoice_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_invoice",
            "description": "Update an existing invoice's title, tax rate, or document metadata fields.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string", "description": "ID of the invoice to update"},
                    "title": {"type": "string", "description": "New title"},
                    "tax_rate": {"type": "number", "description": "New tax rate as a percentage. Set to 0 to clear tax."},
                    "document_number": {"type": "string", "description": "Override the document number"},
                    "document_date": {"type": "string", "description": "Document date in YYYY-MM-DD format"},
                    "bill_to": {"type": "string", "description": "Who to bill"},
                    "worksite_address": {"type": "string", "description": "Worksite address"},
                    "company_name": {"type": "string", "description": "Business name"},
                    "user_name": {"type": "string", "description": "Worker/owner name"},
                    "user_phone": {"type": "string", "description": "Business phone"},
                    "user_email": {"type": "string", "description": "Business email"},
                    "payment_method": {"type": "string", "description": "Payment method"},
                    "business_address": {"type": "string", "description": "Business address"},
                    "notes": {"type": "string", "description": "Additional notes (markdown) for end of PDF"},
                    "show_document_number": {"type": "boolean", "description": "Show document number in PDF"},
                    "show_document_date": {"type": "boolean", "description": "Show date in PDF"},
                    "show_bill_to": {"type": "boolean", "description": "Show bill-to in PDF"},
                    "show_company_name": {"type": "boolean", "description": "Show business name in PDF"},
                    "show_user_name": {"type": "boolean", "description": "Show owner/worker name in PDF"},
                    "show_user_phone": {"type": "boolean", "description": "Show phone in PDF"},
                    "show_user_email": {"type": "boolean", "description": "Show email in PDF"},
                    "show_payment_method": {"type": "boolean", "description": "Show payment method in PDF"},
                    "show_business_address": {"type": "boolean", "description": "Show business address in PDF"},
                    "show_worksite_address": {"type": "boolean", "description": "Show worksite address in PDF"},
                    "show_notes": {"type": "boolean", "description": "Show notes in PDF"},
                },
                "required": ["invoice_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_contact",
            "description": "Create a new contact and associate it with a job site or job. Contacts have a name, phone, email, mailing address, and notes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Full name of the contact"},
                    "phone": {"type": "string", "description": "Phone number"},
                    "email": {"type": "string", "description": "Email address"},
                    "mailing_address": {"type": "string", "description": "Mailing/physical address"},
                    "notes": {"type": "string", "description": "Any notes about this contact"},
                    "parent_type": {"type": "string", "enum": ["job_site", "job"], "description": "Whether to attach this contact to a job site or a job"},
                    "parent_id": {"type": "string", "description": "ID of the job site or job to attach the contact to"},
                    "set_as_primary": {"type": "boolean", "description": "Whether to set this contact as the primary contact for the parent"},
                },
                "required": ["name", "parent_type", "parent_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_contacts",
            "description": "List all contacts for a job site or job.",
            "parameters": {
                "type": "object",
                "properties": {
                    "parent_type": {"type": "string", "enum": ["job_site", "job"], "description": "Whether to list contacts for a job site or a job"},
                    "parent_id": {"type": "string", "description": "ID of the job site or job"},
                },
                "required": ["parent_type", "parent_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_primary_contact",
            "description": "Set an existing contact as the primary contact for a job site or job.",
            "parameters": {
                "type": "object",
                "properties": {
                    "contact_id": {"type": "string", "description": "ID of the contact to set as primary"},
                    "parent_type": {"type": "string", "enum": ["job_site", "job"], "description": "Whether to set primary on a job site or a job"},
                    "parent_id": {"type": "string", "description": "ID of the job site or job"},
                },
                "required": ["contact_id", "parent_type", "parent_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_time_entry",
            "description": "Add a manual time entry (hours worked) for the current user on a job. Use this when the user says they worked X hours on a job.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "ID of the job to log hours on"},
                    "hours": {"type": "number", "description": "Number of hours worked (e.g. 2.5)"},
                    "worked_at": {"type": "string", "description": "ISO 8601 datetime of when the work was done (e.g. '2026-05-31T09:00:00'). If not provided, defaults to now."},
                    "note": {"type": "string", "description": "Optional note describing what was done"},
                },
                "required": ["job_id", "hours"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "clock_in",
            "description": "Clock in the current user on a job. Starts tracking time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "ID of the job to clock in on"},
                    "note": {"type": "string", "description": "Optional note about what you're working on"},
                },
                "required": ["job_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "clock_out",
            "description": "Clock out the current user from a job. Stops tracking time and records the hours.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "ID of the job to clock out from"},
                },
                "required": ["job_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_time_entries",
            "description": "List all time entries (hours logged) for a job, grouped by user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "ID of the job"},
                },
                "required": ["job_id"],
            },
        },
    },
]


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def _build_system_prompt(user: User, screen_context: dict, saved_items_summary: str) -> str:
    """Build the system prompt with app context."""
    from ...core.services.business_info_service import BusinessInfoService
    try:
        biz = BusinessInfoService().get_business_info()
    except Exception:
        biz = {}
    state = biz.get("state") or "unknown"
    user_name = user.name or "there"

    screen_name = screen_context.get("screen", "Home")
    screen_params = screen_context.get("params", {})

    context_parts = [
        f"You are {Config.APP_NAME} AI, a helpful assistant for contractors using the {Config.APP_NAME} app.",
        f"The user's name is {user_name}. They operate in the state of {state}.",
        f"",
        f"The user is currently on the '{screen_name}' screen.",
    ]

    if screen_params:
        context_parts.append(f"Screen parameters: {json.dumps(screen_params)}")

    context_parts.extend([
        "",
        "You can help the user by:",
        "- Creating job sites, jobs, estimates, invoices, and notes",
        "- Creating contacts and associating them with job sites or jobs",
        "- Setting primary contacts on job sites and jobs",
        "- Adding line items with materials and labor to estimates/invoices",
        "- Converting estimates to invoices",
        "- Suggesting materials and pricing based on the user's state and the type of work",
        "- Using their saved items library when relevant",
        "",
        "When creating estimates or invoices with line items:",
        "- ALWAYS create a SINGLE estimate with MULTIPLE line items unless the user explicitly asks for separate estimates",
        "- Each distinct task (e.g. 'shower replacement', 'toilet replacement') should be its own line item WITHIN one estimate",
        "- Line items are groups within an estimate — they are NOT separate estimates",
        "- For example: 'estimate for shower and toilet replacement' = 1 estimate with 2 line items (one for shower, one for toilet)",
        "- Only create multiple estimates if the user explicitly says 'separate estimates' or 'two estimates'",
        "- Use realistic pricing for the user's state/region",
        "- Include both materials and labor hours where appropriate",
        "- Apply appropriate tax rates for the user's state (materials only, not labor)",
        "- For titles, use SHORT descriptive names like 'Bathroom Renovation' or 'Kitchen Faucet Repair' — do NOT prefix with 'Estimate for' or 'Invoice for' since the document type is already shown on the PDF",
        "",
        "Document metadata on estimates/invoices:",
        "- Each estimate/invoice has metadata fields: document_number, document_date, bill_to, company_name, user_name, user_phone, user_email, payment_method, business_address, worksite_address, and notes",
        "- These are auto-populated from the tenant's business info and job/site data on creation",
        "- You can override any of these when creating or updating an estimate/invoice",
        "- Each field has a corresponding show_* visibility flag (e.g. show_bill_to) that controls whether it appears in the generated PDF",
        "- The 'notes' field supports markdown and appears at the end of the PDF",
        "- If the user asks to hide something from the PDF, set the corresponding show_* flag to false",
        "- If the user asks to change who the estimate is billed to, update the bill_to field",
        "- If the user asks to add notes to the estimate/invoice, update the notes field",
        "- Use get_estimate_details or get_invoice_details to see current metadata before editing",
        "",
        "When editing estimates:",
        "- If the user asks to edit, update, change, or modify an estimate, use the EDIT tools (update_estimate, update_line_item, update_entry, add_line_item_to_estimate, add_entry_to_line_item, delete_line_item, delete_entry) — do NOT create a new estimate",
        "- If the user is on the EstimateEditor screen, use the estimateId from screen params",
        "- ALWAYS call get_estimate_details FIRST before any edit or delete operation — you need the line_item IDs and entry IDs to modify or delete them",
        "- To add more work to an existing estimate, use add_line_item_to_estimate",
        "- To change prices, quantities, or hours, use update_entry with the entry's ID from get_estimate_details",
        "- To rename a line item or change its hourly rate, use update_line_item with the line item's ID",
        "- To remove a line item and all its entries, use delete_line_item with the line item's ID",
        "- To remove a single entry from a line item, use delete_entry with both the line_item_id and entry_id",
        "- If the user asks to remove/delete multiple items, call delete_line_item or delete_entry for EACH one individually",
        "- If the user says 'remove the toilet replacement' or similar, first get_estimate_details to find the matching line_item_id, then call delete_line_item",
        "- To change document metadata (bill_to, notes, business details, visibility), use update_estimate with the metadata fields",
        "",
        "When editing invoices:",
        "- If the user is on the InvoiceEditor screen, use the invoiceId from screen params",
        "- ALWAYS call get_invoice_details FIRST before any edit operation",
        "- Use update_invoice to change title, tax rate, or any document metadata fields",
        "- To change document metadata (bill_to, notes, business details, visibility), use update_invoice with the metadata fields",
        "",
        "When working with contacts:",
        "- Contacts are associated with job sites or jobs (not standalone)",
        "- A contact has: name, phone, email, mailing_address, notes",
        "- Each job site and job can have a primary contact",
        "- If the user asks to add a contact, create it and attach it to the relevant job site or job",
        "- Use the screen context to determine which job site or job to attach to",
        "",
        "When tracking time/hours:",
        "- Users can log hours worked on a job using add_time_entry (manual hours) or clock_in/clock_out (real-time tracking)",
        "- If the user says 'I worked 3 hours on X' or 'log 2.5 hours', use add_time_entry",
        "- If the user says 'clock me in' or 'start tracking', use clock_in",
        "- If the user says 'clock me out' or 'stop tracking', use clock_out",
        "- If the user mentions a specific date/time for the work, pass it as worked_at in ISO 8601 format",
        "- If no date is mentioned, omit worked_at and it defaults to now",
        "- Use the jobId from screen context (JobDetail screen) if the user doesn't specify which job",
        "- Use list_time_entries to show the user their logged hours on a job",
        "",
        "When creating notes:",
        "- Notes support full markdown: headings (#, ##), bold (**text**), bullet lists (- item), numbered lists, links, code blocks, etc.",
        "- Use markdown formatting to make notes well-structured and readable",
        "- For example, use headings for sections, bullet lists for action items, bold for emphasis",
        "",
        "Screen context — infer what the user means from where they currently are.",
        "The 'screen' and its 'params' tell you which record the user is looking at, so you",
        "usually don't need to ask 'which job?' or 'which estimate?'. Current screens and the",
        "params you can rely on:",
        "- Home: the job sites list. No params. If the user references a specific site/job, use list_job_sites / list_jobs to find IDs first.",
        "- JobSiteDetail: params.siteId (and siteName). Use siteId for creating jobs, contacts, or setting a site's primary contact.",
        "- JobDetail: params.jobId, params.siteId (and jobName). This is the hub for a job — use jobId for estimates, invoices, notes, job contacts, and time entries; use siteId if you need the parent site.",
        "- EstimateEditor: params.estimateId and params.jobId. The user is editing THIS estimate — default all estimate edits to params.estimateId and call get_estimate_details first.",
        "- InvoiceEditor: params.invoiceId and params.jobId. The user is editing THIS invoice — default invoice edits to params.invoiceId and call get_invoice_details first.",
        "- InvoiceManagement: a cross-job list of invoices. No single id; ask or use list tools if the user references a specific one.",
        "- ContactEditor: params.parentId and params.parentType ('job_site' | 'job'), and optional contactId. Use parentId/parentType when creating or updating the contact here.",
        "- SavedItems / SavedItemEditor / MaterialsLibrary: the reusable item & materials library. Use list_saved_items to reference these as templates when building estimates/invoices.",
        "- Settings / EstimateSettings / InvoiceSettings / EditEstimateOptions / EditInvoiceOptions: configuration screens for document defaults and field visibility. No record id — these are for app configuration, not data you edit via tools.",
        "- ProfileSettings / BusinessInfo: the user's profile and tenant business details (company name, address, phone, email, state). If the user asks to change business info shown on documents, note you can't edit business settings directly — set the corresponding override fields on a specific estimate/invoice instead.",
        "- AdminUsers: admin-only user management. Not something you act on via tools.",
        "When a screen provides an id you need (siteId, jobId, estimateId, invoiceId, parentId), prefer it over asking the user. If the current screen doesn't have the id you need, use the list_* tools to look it up before acting.",
        "",
        "Always confirm what you've done after completing actions.",
        "Be concise but friendly. You're a knowledgeable contractor's assistant.",
    ])

    if saved_items_summary:
        context_parts.extend([
            "",
            "The user's saved items library (reusable templates):",
            saved_items_summary,
        ])

    return "\n".join(context_parts)


# ---------------------------------------------------------------------------
# Tool execution
# ---------------------------------------------------------------------------

class AIService:
    """Orchestrates AI chat with OpenAI function calling."""

    def __init__(self, api_key: str, model: str = "gpt-4.1-mini"):
        self._client = OpenAI(api_key=api_key)
        self._model = model
        self._job_site_service = JobSiteService()
        self._job_service = JobService()
        self._estimate_service = EstimateService()
        self._invoice_service = InvoiceService()
        self._note_service = NoteService()
        self._conversion_service = ConversionService()
        self._saved_item_service = SavedItemService()
        self._contact_service = ContactService()
        self._time_entry_service = TimeEntryService()

    def _get_saved_items_summary(self, user_id: str) -> str:
        """Build a brief summary of the user's saved items for context."""
        try:
            items = self._saved_item_service.list_for_user(user_id)
            if not items:
                return ""
            lines = []
            for item in items[:20]:  # Limit to 20 items for context window
                entry_summary = []
                for entry in (item.entries or [])[:5]:
                    if entry.entry_type == "material":
                        price = f"${entry.unit_price}" if entry.unit_price else "no price"
                        entry_summary.append(f"  - {entry.name} ({price})")
                    else:
                        hrs = entry.hours or "?"
                        entry_summary.append(f"  - {entry.name} ({hrs}h)")
                lines.append(f"• {item.name} (rate: ${item.hourly_rate or 0}/hr)")
                lines.extend(entry_summary)
            return "\n".join(lines)
        except Exception:
            return ""

    def _execute_tool(self, tool_name: str, args: dict, user_id: str) -> dict:
        """Execute a tool call and return the result."""
        try:
            if tool_name == "create_job_site":
                site = self._job_site_service.create(
                    user_id=user_id,
                    name=args["name"],
                    description=args.get("description"),
                    address=args.get("address"),
                )
                return {
                    "success": True,
                    "job_site_id": str(site.id),
                    "name": site.name,
                    "message": f"Created job site '{site.name}'",
                }

            elif tool_name == "create_job":
                job = self._job_service.create(
                    site_id=args["job_site_id"],
                    user_id=user_id,
                    name=args["name"],
                    description=args.get("description"),
                )
                return {
                    "success": True,
                    "job_id": str(job.id),
                    "job_site_id": args["job_site_id"],
                    "name": job.name,
                    "message": f"Created job '{job.name}'",
                }

            elif tool_name == "create_estimate":
                # Build metadata from args
                metadata = {}
                for key in ("bill_to", "worksite_address", "notes", "company_name",
                            "user_name", "user_phone", "user_email", "payment_method",
                            "business_address"):
                    if args.get(key):
                        metadata[key] = args[key]

                estimate = self._estimate_service.create(
                    job_id=args["job_id"],
                    user_id=user_id,
                    title=args["title"],
                    tax_rate=Decimal(str(args["tax_rate"])) if args.get("tax_rate") else None,
                    metadata=metadata or None,
                )
                # Add line items if provided
                line_items_data = args.get("line_items", [])
                for li_data in line_items_data:
                    li = self._estimate_service.add_line_item(
                        estimate_id=str(estimate.id),
                        user_id=user_id,
                        name=li_data["name"],
                        notes=li_data.get("notes"),
                        hourly_rate=Decimal(str(li_data["hourly_rate"])) if li_data.get("hourly_rate") else None,
                    )
                    for entry_data in li_data.get("entries", []):
                        self._estimate_service.add_entry(
                            estimate_id=str(estimate.id),
                            item_id=str(li.id),
                            user_id=user_id,
                            entry_type=entry_data["entry_type"],
                            name=entry_data["name"],
                            notes=entry_data.get("notes"),
                            unit_price=Decimal(str(entry_data["unit_price"])) if entry_data.get("unit_price") else None,
                            quantity=Decimal(str(entry_data["quantity"])) if entry_data.get("quantity") else None,
                            hours=Decimal(str(entry_data["hours"])) if entry_data.get("hours") else None,
                        )
                return {
                    "success": True,
                    "estimate_id": str(estimate.id),
                    "job_id": args["job_id"],
                    "title": estimate.title,
                    "line_items_count": len(line_items_data),
                    "message": f"Created estimate '{estimate.title}' with {len(line_items_data)} line item(s)",
                }

            elif tool_name == "create_invoice":
                # Build metadata from args
                metadata = {}
                for key in ("bill_to", "worksite_address", "notes", "company_name",
                            "user_name", "user_phone", "user_email", "payment_method",
                            "business_address"):
                    if args.get(key):
                        metadata[key] = args[key]

                invoice = self._invoice_service.create(
                    job_id=args["job_id"],
                    user_id=user_id,
                    title=args["title"],
                    tax_rate=Decimal(str(args["tax_rate"])) if args.get("tax_rate") else None,
                    metadata=metadata or None,
                )
                line_items_data = args.get("line_items", [])
                for li_data in line_items_data:
                    li = self._invoice_service.add_line_item(
                        invoice_id=str(invoice.id),
                        user_id=user_id,
                        name=li_data["name"],
                        notes=li_data.get("notes"),
                        hourly_rate=Decimal(str(li_data["hourly_rate"])) if li_data.get("hourly_rate") else None,
                    )
                    for entry_data in li_data.get("entries", []):
                        self._invoice_service.add_entry(
                            invoice_id=str(invoice.id),
                            item_id=str(li.id),
                            user_id=user_id,
                            entry_type=entry_data["entry_type"],
                            name=entry_data["name"],
                            notes=entry_data.get("notes"),
                            unit_price=Decimal(str(entry_data["unit_price"])) if entry_data.get("unit_price") else None,
                            quantity=Decimal(str(entry_data["quantity"])) if entry_data.get("quantity") else None,
                            hours=Decimal(str(entry_data["hours"])) if entry_data.get("hours") else None,
                        )
                return {
                    "success": True,
                    "invoice_id": str(invoice.id),
                    "job_id": args["job_id"],
                    "title": invoice.title,
                    "line_items_count": len(line_items_data),
                    "message": f"Created invoice '{invoice.title}' with {len(line_items_data)} line item(s)",
                }

            elif tool_name == "create_note":
                note = self._note_service.create(
                    job_id=args["job_id"],
                    user_id=user_id,
                    body=args["body"],
                )
                return {
                    "success": True,
                    "note_id": str(note.id),
                    "job_id": args["job_id"],
                    "message": "Created note",
                }

            elif tool_name == "convert_estimate_to_invoice":
                invoice = self._conversion_service.convert(
                    estimate_id=args["estimate_id"],
                    user_id=user_id,
                )
                return {
                    "success": True,
                    "invoice_id": str(invoice.id),
                    "estimate_id": args["estimate_id"],
                    "title": invoice.title,
                    "message": f"Converted estimate to invoice '{invoice.title}'",
                }

            elif tool_name == "get_estimate_details":
                estimate = self._estimate_service.get(args["estimate_id"], user_id)
                line_items = self._estimate_service.get_line_items(args["estimate_id"], user_id)
                from ..estimates.service import compute_line_item_totals
                items_data = []
                for li in line_items:
                    totals = compute_line_item_totals(li)
                    items_data.append({
                        "id": str(li.id),
                        "name": li.name,
                        "notes": li.notes,
                        "hourly_rate": str(li.hourly_rate) if li.hourly_rate else None,
                        "total_cost": str(totals["total_cost"]),
                        "total_hours": str(totals["total_hours"]),
                        "entries": [
                            {
                                "id": str(e.id),
                                "entry_type": e.entry_type,
                                "name": e.name,
                                "notes": e.notes,
                                "unit_price": str(e.unit_price) if e.unit_price else None,
                                "quantity": str(e.quantity) if e.quantity else None,
                                "hours": str(e.hours) if e.hours else None,
                            }
                            for e in (li.entries or [])
                        ],
                    })
                return {
                    "success": True,
                    "estimate_id": str(estimate.id),
                    "title": estimate.title,
                    "tax_rate": str(estimate.tax_rate) if estimate.tax_rate else None,
                    "delivered": estimate.delivered,
                    "document_number": estimate.document_number,
                    "document_date": estimate.document_date.isoformat() if estimate.document_date else None,
                    "bill_to": estimate.bill_to,
                    "company_name": estimate.company_name,
                    "user_name": estimate.user_name,
                    "user_phone": estimate.user_phone,
                    "user_email": estimate.user_email,
                    "payment_method": estimate.payment_method,
                    "business_address": estimate.business_address,
                    "worksite_address": estimate.worksite_address,
                    "notes": estimate.notes,
                    "show_document_number": estimate.show_document_number,
                    "show_document_date": estimate.show_document_date,
                    "show_bill_to": estimate.show_bill_to,
                    "show_company_name": estimate.show_company_name,
                    "show_user_name": estimate.show_user_name,
                    "show_user_phone": estimate.show_user_phone,
                    "show_user_email": estimate.show_user_email,
                    "show_payment_method": estimate.show_payment_method,
                    "show_business_address": estimate.show_business_address,
                    "show_worksite_address": estimate.show_worksite_address,
                    "show_notes": estimate.show_notes,
                    "line_items": items_data,
                }

            elif tool_name == "update_estimate":
                clear_tax = False
                tax_rate = None
                if "tax_rate" in args:
                    if args["tax_rate"] == 0:
                        clear_tax = True
                    else:
                        tax_rate = Decimal(str(args["tax_rate"]))

                # Build metadata from args
                META_KEYS = (
                    "document_number", "document_date", "bill_to", "company_name",
                    "user_name", "user_phone", "user_email", "payment_method",
                    "business_address", "worksite_address", "notes",
                    "show_document_number", "show_document_date", "show_bill_to",
                    "show_company_name", "show_user_name", "show_user_phone",
                    "show_user_email", "show_payment_method", "show_business_address",
                    "show_worksite_address", "show_notes",
                )
                metadata = {k: args[k] for k in META_KEYS if k in args}

                estimate = self._estimate_service.update(
                    estimate_id=args["estimate_id"],
                    user_id=user_id,
                    title=args.get("title"),
                    tax_rate=tax_rate,
                    clear_tax=clear_tax,
                    metadata=metadata or None,
                )
                return {
                    "success": True,
                    "estimate_id": str(estimate.id),
                    "title": estimate.title,
                    "message": f"Updated estimate '{estimate.title}'",
                }

            elif tool_name == "add_line_item_to_estimate":
                li = self._estimate_service.add_line_item(
                    estimate_id=args["estimate_id"],
                    user_id=user_id,
                    name=args["name"],
                    notes=args.get("notes"),
                    hourly_rate=Decimal(str(args["hourly_rate"])) if args.get("hourly_rate") else None,
                )
                # Add entries if provided
                for entry_data in args.get("entries", []):
                    self._estimate_service.add_entry(
                        estimate_id=args["estimate_id"],
                        item_id=str(li.id),
                        user_id=user_id,
                        entry_type=entry_data["entry_type"],
                        name=entry_data["name"],
                        notes=entry_data.get("notes"),
                        unit_price=Decimal(str(entry_data["unit_price"])) if entry_data.get("unit_price") else None,
                        quantity=Decimal(str(entry_data["quantity"])) if entry_data.get("quantity") else None,
                        hours=Decimal(str(entry_data["hours"])) if entry_data.get("hours") else None,
                    )
                return {
                    "success": True,
                    "line_item_id": str(li.id),
                    "estimate_id": args["estimate_id"],
                    "name": li.name,
                    "message": f"Added line item '{li.name}' to estimate",
                }

            elif tool_name == "update_line_item":
                li = self._estimate_service.update_line_item(
                    estimate_id=args["estimate_id"],
                    item_id=args["line_item_id"],
                    user_id=user_id,
                    name=args.get("name"),
                    notes=args.get("notes"),
                    hourly_rate=Decimal(str(args["hourly_rate"])) if args.get("hourly_rate") else None,
                )
                return {
                    "success": True,
                    "line_item_id": str(li.id),
                    "name": li.name,
                    "message": f"Updated line item '{li.name}'",
                }

            elif tool_name == "delete_line_item":
                self._estimate_service.delete_line_item(
                    estimate_id=args["estimate_id"],
                    item_id=args["line_item_id"],
                    user_id=user_id,
                )
                return {
                    "success": True,
                    "message": "Deleted line item",
                }

            elif tool_name == "add_entry_to_line_item":
                entry = self._estimate_service.add_entry(
                    estimate_id=args["estimate_id"],
                    item_id=args["line_item_id"],
                    user_id=user_id,
                    entry_type=args["entry_type"],
                    name=args["name"],
                    notes=args.get("notes"),
                    unit_price=Decimal(str(args["unit_price"])) if args.get("unit_price") else None,
                    quantity=Decimal(str(args["quantity"])) if args.get("quantity") else None,
                    hours=Decimal(str(args["hours"])) if args.get("hours") else None,
                )
                return {
                    "success": True,
                    "entry_id": str(entry.id),
                    "name": entry.name,
                    "message": f"Added {entry.entry_type} entry '{entry.name}'",
                }

            elif tool_name == "update_entry":
                entry = self._estimate_service.update_entry(
                    estimate_id=args["estimate_id"],
                    item_id=args["line_item_id"],
                    entry_id=args["entry_id"],
                    user_id=user_id,
                    name=args.get("name"),
                    notes=args.get("notes"),
                    unit_price=Decimal(str(args["unit_price"])) if args.get("unit_price") else None,
                    quantity=Decimal(str(args["quantity"])) if args.get("quantity") else None,
                    hours=Decimal(str(args["hours"])) if args.get("hours") else None,
                )
                return {
                    "success": True,
                    "entry_id": str(entry.id),
                    "name": entry.name,
                    "message": f"Updated entry '{entry.name}'",
                }

            elif tool_name == "delete_entry":
                self._estimate_service.delete_entry(
                    estimate_id=args["estimate_id"],
                    item_id=args["line_item_id"],
                    entry_id=args["entry_id"],
                    user_id=user_id,
                )
                return {
                    "success": True,
                    "message": "Deleted entry",
                }

            elif tool_name == "clear_all_line_items":
                line_items = self._estimate_service.get_line_items(args["estimate_id"], user_id)
                count = len(line_items)
                for li in line_items:
                    self._estimate_service.delete_line_item(
                        estimate_id=args["estimate_id"],
                        item_id=str(li.id),
                        user_id=user_id,
                    )
                return {
                    "success": True,
                    "deleted_count": count,
                    "message": f"Cleared all {count} line item(s) from estimate",
                }

            elif tool_name == "list_job_sites":
                entries = self._job_site_service.list_for_user(user_id)
                sites = []
                for e in entries[:20]:
                    site = e["site"]
                    sites.append({
                        "id": str(site.id),
                        "name": site.name,
                        "address": site.address,
                        "job_count": e["job_count"],
                    })
                return {"success": True, "job_sites": sites}

            elif tool_name == "list_jobs":
                jobs = self._job_service.list_for_site(
                    site_id=args["job_site_id"],
                    user_id=user_id,
                )
                return {
                    "success": True,
                    "jobs": [
                        {"id": str(j.id), "name": j.name, "status": j.status}
                        for j in jobs[:20]
                    ],
                }

            elif tool_name == "list_estimates":
                estimates = self._estimate_service.list_for_job(
                    job_id=args["job_id"],
                    user_id=user_id,
                )
                return {
                    "success": True,
                    "estimates": [
                        {"id": str(e.id), "title": e.title, "delivered": e.delivered}
                        for e in estimates[:20]
                    ],
                }

            elif tool_name == "list_saved_items":
                items = self._saved_item_service.list_for_user(user_id)
                return {
                    "success": True,
                    "saved_items": [
                        {
                            "id": str(item.id),
                            "name": item.name,
                            "hourly_rate": str(item.hourly_rate) if item.hourly_rate else None,
                            "entries": [
                                {
                                    "name": e.name,
                                    "entry_type": e.entry_type,
                                    "unit_price": str(e.unit_price) if e.unit_price else None,
                                    "quantity": str(e.quantity) if e.quantity else None,
                                    "hours": str(e.hours) if e.hours else None,
                                }
                                for e in (item.entries or [])
                            ],
                        }
                        for item in items[:20]
                    ],
                }

            elif tool_name == "get_invoice_details":
                invoice = self._invoice_service.get(args["invoice_id"], user_id)
                line_items = self._invoice_service.get_line_items(args["invoice_id"], user_id)
                from ..estimates.service import compute_line_item_totals as _compute_li_totals
                items_data = []
                for li in line_items:
                    totals = _compute_li_totals(li)
                    items_data.append({
                        "id": str(li.id),
                        "name": li.name,
                        "notes": li.notes,
                        "hourly_rate": str(li.hourly_rate) if li.hourly_rate else None,
                        "total_cost": str(totals["total_cost"]),
                        "total_hours": str(totals["total_hours"]),
                        "entries": [
                            {
                                "id": str(e.id),
                                "entry_type": e.entry_type,
                                "name": e.name,
                                "notes": e.notes,
                                "unit_price": str(e.unit_price) if e.unit_price else None,
                                "quantity": str(e.quantity) if e.quantity else None,
                                "hours": str(e.hours) if e.hours else None,
                            }
                            for e in (li.entries or [])
                        ],
                    })
                return {
                    "success": True,
                    "invoice_id": str(invoice.id),
                    "title": invoice.title,
                    "tax_rate": str(invoice.tax_rate) if invoice.tax_rate else None,
                    "delivered": invoice.delivered,
                    "status": invoice.status,
                    "document_number": invoice.document_number,
                    "document_date": invoice.document_date.isoformat() if invoice.document_date else None,
                    "bill_to": invoice.bill_to,
                    "company_name": invoice.company_name,
                    "user_name": invoice.user_name,
                    "user_phone": invoice.user_phone,
                    "user_email": invoice.user_email,
                    "payment_method": invoice.payment_method,
                    "business_address": invoice.business_address,
                    "worksite_address": invoice.worksite_address,
                    "notes": invoice.notes,
                    "show_document_number": invoice.show_document_number,
                    "show_document_date": invoice.show_document_date,
                    "show_bill_to": invoice.show_bill_to,
                    "show_company_name": invoice.show_company_name,
                    "show_user_name": invoice.show_user_name,
                    "show_user_phone": invoice.show_user_phone,
                    "show_user_email": invoice.show_user_email,
                    "show_payment_method": invoice.show_payment_method,
                    "show_business_address": invoice.show_business_address,
                    "show_worksite_address": invoice.show_worksite_address,
                    "show_notes": invoice.show_notes,
                    "line_items": items_data,
                }

            elif tool_name == "update_invoice":
                clear_tax = False
                tax_rate = None
                if "tax_rate" in args:
                    if args["tax_rate"] == 0:
                        clear_tax = True
                    else:
                        tax_rate = Decimal(str(args["tax_rate"]))

                META_KEYS = (
                    "document_number", "document_date", "bill_to", "company_name",
                    "user_name", "user_phone", "user_email", "payment_method",
                    "business_address", "worksite_address", "notes",
                    "show_document_number", "show_document_date", "show_bill_to",
                    "show_company_name", "show_user_name", "show_user_phone",
                    "show_user_email", "show_payment_method", "show_business_address",
                    "show_worksite_address", "show_notes",
                )
                metadata = {k: args[k] for k in META_KEYS if k in args}

                invoice = self._invoice_service.update(
                    invoice_id=args["invoice_id"],
                    user_id=user_id,
                    title=args.get("title"),
                    tax_rate=tax_rate,
                    clear_tax=clear_tax,
                    metadata=metadata or None,
                )
                return {
                    "success": True,
                    "invoice_id": str(invoice.id),
                    "title": invoice.title,
                    "message": f"Updated invoice '{invoice.title}'",
                }

            elif tool_name == "create_contact":
                # Create the contact
                contact = self._contact_service.create_contact(
                    name=args["name"],
                    phone=args.get("phone"),
                    email=args.get("email"),
                    mailing_address=args.get("mailing_address"),
                    notes=args.get("notes"),
                )
                contact_id = str(contact.id)

                # Associate with parent (job site or job)
                parent_type = args["parent_type"]
                parent_id = args["parent_id"]
                if parent_type == "job_site":
                    self._contact_service.add_contact_to_job_site(parent_id, user_id, contact_id)
                else:
                    self._contact_service.add_contact_to_job(parent_id, user_id, contact_id)

                # Optionally set as primary
                if args.get("set_as_primary"):
                    if parent_type == "job_site":
                        self._contact_service.set_primary_for_job_site(parent_id, user_id, contact_id)
                    else:
                        self._contact_service.set_primary_for_job(parent_id, user_id, contact_id)

                return {
                    "success": True,
                    "contact_id": contact_id,
                    "name": contact.name,
                    "parent_type": parent_type,
                    "parent_id": parent_id,
                    "is_primary": bool(args.get("set_as_primary")),
                    "message": f"Created contact '{contact.name}' and added to {parent_type.replace('_', ' ')}",
                }

            elif tool_name == "list_contacts":
                parent_type = args["parent_type"]
                parent_id = args["parent_id"]
                # NOTE: the two service methods return different shapes —
                # get_contacts_for_job_site -> list[Contact]
                # get_contacts_for_job      -> list[{"contact": Contact, "inherited": bool}]
                # Normalize both to (Contact, inherited) pairs before serializing.
                if parent_type == "job_site":
                    rows = self._contact_service.get_contacts_for_job_site(parent_id, user_id)
                    pairs = [(c, False) for c in rows]
                else:
                    rows = self._contact_service.get_contacts_for_job(parent_id, user_id)
                    pairs = [(r["contact"], r.get("inherited", False)) for r in rows]
                return {
                    "success": True,
                    "contacts": [
                        {
                            "id": str(c.id),
                            "name": c.name,
                            "phone": c.phone,
                            "email": c.email,
                            "mailing_address": c.mailing_address,
                            "notes": c.notes,
                            "inherited": inherited,
                        }
                        for c, inherited in pairs
                    ],
                }

            elif tool_name == "set_primary_contact":
                contact_id = args["contact_id"]
                parent_type = args["parent_type"]
                parent_id = args["parent_id"]
                if parent_type == "job_site":
                    self._contact_service.set_primary_for_job_site(parent_id, user_id, contact_id)
                else:
                    self._contact_service.set_primary_for_job(parent_id, user_id, contact_id)
                return {
                    "success": True,
                    "contact_id": contact_id,
                    "parent_type": parent_type,
                    "parent_id": parent_id,
                    "message": f"Set contact as primary for {parent_type.replace('_', ' ')}",
                }

            elif tool_name == "add_time_entry":
                from datetime import datetime
                worked_at = None
                if args.get("worked_at"):
                    try:
                        worked_at = datetime.fromisoformat(args["worked_at"].replace("Z", "+00:00"))
                    except (ValueError, AttributeError):
                        pass
                entry = self._time_entry_service.add_manual(
                    job_id=args["job_id"],
                    user_id=user_id,
                    hours=Decimal(str(args["hours"])),
                    note=args.get("note"),
                    worked_at=worked_at,
                )
                return {
                    "success": True,
                    "time_entry_id": str(entry.id),
                    "job_id": args["job_id"],
                    "hours": str(entry.hours),
                    "worked_at": entry.worked_at.isoformat() if entry.worked_at else None,
                    "message": f"Logged {entry.hours} hours on the job",
                }

            elif tool_name == "clock_in":
                entry = self._time_entry_service.clock_in(
                    job_id=args["job_id"],
                    user_id=user_id,
                    note=args.get("note"),
                )
                return {
                    "success": True,
                    "time_entry_id": str(entry.id),
                    "job_id": args["job_id"],
                    "clock_in": entry.clock_in.isoformat() if entry.clock_in else None,
                    "message": "Clocked in successfully",
                }

            elif tool_name == "clock_out":
                entry = self._time_entry_service.clock_out(
                    job_id=args["job_id"],
                    user_id=user_id,
                )
                return {
                    "success": True,
                    "time_entry_id": str(entry.id),
                    "job_id": args["job_id"],
                    "hours": str(entry.hours),
                    "clock_in": entry.clock_in.isoformat() if entry.clock_in else None,
                    "clock_out": entry.clock_out.isoformat() if entry.clock_out else None,
                    "message": f"Clocked out — {entry.hours} hours recorded",
                }

            elif tool_name == "list_time_entries":
                entries = self._time_entry_service.list_for_job(args["job_id"])
                return {
                    "success": True,
                    "time_entries": [
                        {
                            "id": str(e.id),
                            "user_name": e.user.name if e.user else None,
                            "user_email": e.user.email if e.user else None,
                            "hours": str(e.hours) if e.hours else None,
                            "clock_in": e.clock_in.isoformat() if e.clock_in else None,
                            "clock_out": e.clock_out.isoformat() if e.clock_out else None,
                            "worked_at": e.worked_at.isoformat() if e.worked_at else None,
                            "note": e.note,
                        }
                        for e in entries
                    ],
                }

            else:
                return {"success": False, "error": f"Unknown tool: {tool_name}"}

        except Exception as e:
            logger.error(f"Tool execution error ({tool_name}): {e}")
            return {"success": False, "error": str(e)}

    def chat(self, user_id: str, messages: list[dict], screen_context: dict) -> dict:
        """Process a chat message with function calling.

        Args:
            user_id: The authenticated user's ID.
            messages: Conversation history [{role, content}, ...].
            screen_context: {screen: "ScreenName", params: {...}}.

        Returns:
            {response: str, actions: [{tool, result}, ...]}
        """
        # Load user for context
        user = db.session.get(User, user_id)
        if user is None:
            return {"response": "I couldn't find your user profile.", "actions": []}

        # Build system prompt with saved items context
        saved_items_summary = self._get_saved_items_summary(user_id)
        system_prompt = _build_system_prompt(user, screen_context, saved_items_summary)

        # Prepare messages for OpenAI
        openai_messages = [{"role": "system", "content": system_prompt}]
        openai_messages.extend(messages)

        actions = []
        max_iterations = 10  # Prevent infinite loops

        for _ in range(max_iterations):
            response = self._client.chat.completions.create(
                model=self._model,
                messages=openai_messages,
                tools=TOOLS,
                tool_choice="auto",
            )

            choice = response.choices[0]
            message = choice.message

            # If no tool calls, we have the final response
            if not message.tool_calls:
                return {
                    "response": message.content or "",
                    "actions": actions,
                }

            # Process tool calls
            openai_messages.append(message.model_dump())

            for tool_call in message.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)

                result = self._execute_tool(fn_name, fn_args, user_id)
                actions.append({"tool": fn_name, "args": fn_args, "result": result})

                openai_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result),
                })

        # If we hit max iterations, return what we have
        return {
            "response": "I completed several actions but hit my limit. Please check the results.",
            "actions": actions,
        }
