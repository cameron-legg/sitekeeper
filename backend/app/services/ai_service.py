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

from ..models import User
from ..extensions import db
from ..services.job_site_service import JobSiteService
from ..services.job_service import JobService
from ..services.estimate_service import EstimateService
from ..services.invoice_service import InvoiceService
from ..services.note_service import NoteService
from ..services.conversion_service import ConversionService
from ..services.saved_item_service import SavedItemService
from ..services.contact_service import ContactService

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
            "description": "Create a new estimate for a job. Optionally include line items with entries.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "ID of the job to create the estimate for"},
                    "title": {"type": "string", "description": "Title of the estimate"},
                    "tax_rate": {"type": "number", "description": "Sales tax rate as a percentage (e.g. 8.5 for 8.5%). Only applies to materials."},
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
                                            "entry_type": {"type": "string", "enum": ["material", "hours"]},
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
            "description": "Create a new invoice for a job. Optionally include line items with entries.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "ID of the job to create the invoice for"},
                    "title": {"type": "string", "description": "Title of the invoice"},
                    "tax_rate": {"type": "number", "description": "Sales tax rate as a percentage (e.g. 8.5 for 8.5%). Only applies to materials."},
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
                                            "entry_type": {"type": "string", "enum": ["material", "hours"]},
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
]


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def _build_system_prompt(user: User, screen_context: dict, saved_items_summary: str) -> str:
    """Build the system prompt with app context."""
    state = user.state or "unknown"
    user_name = user.name or "there"

    screen_name = screen_context.get("screen", "Home")
    screen_params = screen_context.get("params", {})

    context_parts = [
        f"You are SiteKeeper AI, a helpful assistant for contractors using the SiteKeeper app.",
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
        "",
        "When working with contacts:",
        "- Contacts are associated with job sites or jobs (not standalone)",
        "- A contact has: name, phone, email, mailing_address, notes",
        "- Each job site and job can have a primary contact",
        "- If the user asks to add a contact, create it and attach it to the relevant job site or job",
        "- Use the screen context to determine which job site or job to attach to",
        "",
        "When creating notes:",
        "- Notes support full markdown: headings (#, ##), bold (**text**), bullet lists (- item), numbered lists, links, code blocks, etc.",
        "- Use markdown formatting to make notes well-structured and readable",
        "- For example, use headings for sections, bullet lists for action items, bold for emphasis",
        "",
        "When the user is on a specific screen, use that context:",
        "- On JobSiteDetail: the siteId is available, use it for creating jobs and contacts",
        "- On JobDetail: the jobId and siteId are available, use them for estimates/notes/contacts",
        "- On EstimateEditor: the estimateId and jobId are available",
        "- On InvoiceEditor: the invoiceId and jobId are available",
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

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
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
                estimate = self._estimate_service.create(
                    job_id=args["job_id"],
                    user_id=user_id,
                    title=args["title"],
                    tax_rate=Decimal(str(args["tax_rate"])) if args.get("tax_rate") else None,
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
                invoice = self._invoice_service.create(
                    job_id=args["job_id"],
                    user_id=user_id,
                    title=args["title"],
                    tax_rate=Decimal(str(args["tax_rate"])) if args.get("tax_rate") else None,
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
                if parent_type == "job_site":
                    contacts = self._contact_service.get_contacts_for_job_site(parent_id, user_id)
                else:
                    contacts = self._contact_service.get_contacts_for_job(parent_id, user_id)
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
                        }
                        for c in contacts
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
