"""Invoices blueprint (v2) — line items with sub-entries."""

from decimal import Decimal, InvalidOperation

from flask import Blueprint, g, jsonify, request

from ..auth.decorators import auth_required
from ..services.invoice_service import InvoiceService, NotFoundError, ValidationError
from ..services.estimate_service import compute_line_item_totals
from .helpers import error_response, not_found, server_error

invoices_bp = Blueprint("invoices", __name__)
_service = InvoiceService()


def _compute_pdf_status(doc) -> str:
    if doc.pdf_generated_at is None:
        return "none"
    if doc.updated_at > doc.pdf_generated_at:
        return "stale"
    return "current"


def _parse_decimal(value, field_name: str):
    try:
        return Decimal(str(value)), None
    except (InvalidOperation, TypeError, ValueError):
        return None, error_response("VALIDATION_ERROR", f"{field_name} must be a valid number.", field=field_name)


def _serialize_entry(entry) -> dict:
    return {
        "id": str(entry.id),
        "line_item_id": str(entry.line_item_id),
        "entry_type": entry.entry_type,
        "name": entry.name,
        "notes": entry.notes,
        "url": entry.url,
        "unit_price": str(entry.unit_price) if entry.unit_price is not None else None,
        "quantity": str(entry.quantity) if entry.quantity is not None else None,
        "hours": str(entry.hours) if entry.hours is not None else None,
        "sort_order": entry.sort_order,
    }


def _serialize_line_item(item) -> dict:
    totals = compute_line_item_totals(item)
    return {
        "id": str(item.id),
        "parent_id": str(item.parent_id),
        "parent_type": item.parent_type,
        "name": item.name,
        "notes": item.notes,
        "hourly_rate": str(item.hourly_rate) if item.hourly_rate is not None else None,
        "sort_order": item.sort_order,
        "total_cost": str(totals["total_cost"]),
        "total_hours": str(totals["total_hours"]),
        "entries": [_serialize_entry(e) for e in item.entries],
    }


def _serialize_invoice(invoice, totals: dict | None = None) -> dict:
    t = totals or {}
    return {
        "id": str(invoice.id),
        "job_id": str(invoice.job_id),
        "title": invoice.title,
        "delivered": invoice.delivered,
        "status": invoice.status,
        "status_changed_at": invoice.status_changed_at.isoformat() if invoice.status_changed_at else None,
        "source_estimate_id": str(invoice.source_estimate_id) if invoice.source_estimate_id else None,
        "tax_rate": str(invoice.tax_rate) if invoice.tax_rate is not None else None,
        "subtotal": str(t.get("subtotal", "0")),
        "tax_amount": str(t.get("tax_amount", "0")),
        "total": str(t.get("total", "0")),
        "materials_cost": str(t.get("taxable_amount", "0")),
        "labor_cost": str(t.get("labor_cost", "0")),
        "labor_hours": str(t.get("total_hours", "0")),
        "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
        "updated_at": invoice.updated_at.isoformat() if invoice.updated_at else None,
        "pdf_status": _compute_pdf_status(invoice),
        # Document metadata
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
        # Visibility flags
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
    }


# ---------------------------------------------------------------------------
# All invoices (across all jobs/sites) — for Invoice Management screen
# ---------------------------------------------------------------------------

@invoices_bp.get("/invoices")
@auth_required
def list_all_invoices():
    """List all invoices across all jobs/sites for the tenant, with job and site context."""
    user_id = g.current_user_id
    try:
        from ..models import Invoice, Job, JobSite, InvoiceStatusHistory
        from ..repositories.job_site_repo import SQLAlchemyJobSiteRepository
        from sqlalchemy.orm import joinedload

        # Get all accessible sites (approved users see all)
        site_repo = SQLAlchemyJobSiteRepository()
        sites = site_repo.get_all_for_user(user_id)
        site_ids = [str(s.id) for s in sites]

        # Fetch all invoices for jobs within those sites, newest first
        invoices = (
            Invoice.query
            .join(Job, Invoice.job_id == Job.id)
            .filter(Job.job_site_id.in_(site_ids))
            .options(joinedload(Invoice.status_history))
            .order_by(Invoice.created_at.desc())
            .all()
        )

        result = []
        for inv in invoices:
            totals = _service.calculate_totals(str(inv.id), user_id)
            job = inv.job
            site_name = job.job_site.name if job.job_site else None
            history = sorted(inv.status_history, key=lambda h: h.changed_at)
            result.append({
                **_serialize_invoice(inv, totals),
                "job_name": job.name if job else None,
                "job_site_id": str(job.job_site_id) if job else None,
                "job_site_name": site_name,
                "status_history": [
                    {"status": h.status, "changed_at": h.changed_at.isoformat()}
                    for h in history
                ],
            })
        return jsonify(result), 200
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Invoice CRUD
# ---------------------------------------------------------------------------

@invoices_bp.get("/jobs/<job_id>/invoices")
@auth_required
def list_invoices(job_id: str):
    user_id = g.current_user_id
    try:
        invoices = _service.list_for_job(job_id, user_id)
        result = [_serialize_invoice(i, _service.calculate_totals(str(i.id), user_id)) for i in invoices]
        return jsonify(result), 200
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


@invoices_bp.post("/jobs/<job_id>/invoices")
@auth_required
def create_invoice(job_id: str):
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    if not title:
        return error_response("VALIDATION_ERROR", "Title is required.", field="title")
    tax_rate = None
    if data.get("tax_rate") is not None:
        tax_rate, err = _parse_decimal(data["tax_rate"], "tax_rate")
        if err:
            return err

    # Build metadata from business info + profile defaults
    from ..services.profile_service import ProfileService
    from ..services.business_info_service import BusinessInfoService
    profile_service = ProfileService()
    try:
        profile = profile_service.get_profile(user_id)
    except Exception:
        profile = {}
    biz_service = BusinessInfoService()
    try:
        biz = biz_service.get_business_info()
    except Exception:
        biz = {}

    # Owner name takes priority over creating user's name
    owner_name = biz.get("owner_name") or biz_service.get_owner_name()
    default_user_name = owner_name or profile.get("name")

    # Resolve bill_to from primary contact on the job
    from ..repositories.job_repo import SQLAlchemyJobRepository
    job_repo = SQLAlchemyJobRepository()
    job = job_repo.get_by_id(job_id)
    bill_to_default = None
    worksite_default = None
    if job:
        if job.primary_contact is not None:
            bill_to_default = job.primary_contact.name
        elif job.job_site and job.job_site.primary_contact:
            bill_to_default = job.job_site.primary_contact.name
        if job.job_site:
            worksite_default = job.job_site.address

    metadata = {
        "company_name": data.get("company_name", biz.get("business_name")),
        "user_name": data.get("user_name", default_user_name),
        "user_phone": data.get("user_phone", biz.get("business_phone")),
        "user_email": data.get("user_email", biz.get("business_email")),
        "payment_method": data.get("payment_method", biz.get("payment_method")),
        "business_address": data.get("business_address", biz.get("business_address")),
        "bill_to": data.get("bill_to", bill_to_default),
        "worksite_address": data.get("worksite_address", worksite_default),
        "notes": data.get("notes"),
    }
    for key in [k for k in data if k.startswith("show_")]:
        metadata[key] = data[key]

    try:
        inv = _service.create(job_id=job_id, user_id=user_id, title=title,
                              delivered=bool(data.get("delivered", False)),
                              source_estimate_id=data.get("source_estimate_id"),
                              tax_rate=tax_rate, metadata=metadata)
        return jsonify(_serialize_invoice(inv, _service.calculate_totals(str(inv.id), user_id))), 201
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


@invoices_bp.get("/invoices/<invoice_id>")
@auth_required
def get_invoice(invoice_id: str):
    user_id = g.current_user_id
    try:
        inv = _service.get(invoice_id, user_id)
        data = _serialize_invoice(inv, _service.calculate_totals(invoice_id, user_id))
        # Include status history
        from ..models import InvoiceStatusHistory
        history = (
            InvoiceStatusHistory.query
            .filter_by(invoice_id=invoice_id)
            .order_by(InvoiceStatusHistory.changed_at.asc())
            .all()
        )
        data["status_history"] = [
            {"status": h.status, "changed_at": h.changed_at.isoformat()}
            for h in history
        ]
        return jsonify(data), 200
    except NotFoundError:
        return not_found("Invoice")
    except Exception:
        return server_error()


@invoices_bp.patch("/invoices/<invoice_id>")
@auth_required
def patch_invoice(invoice_id: str):
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    title = data.get("title")
    if title is not None:
        title = str(title).strip()
        if not title:
            return error_response("VALIDATION_ERROR", "Title cannot be empty.", field="title")
    delivered = data.get("delivered")
    if delivered is not None:
        delivered = bool(delivered)
    status = data.get("status")
    if status is not None:
        valid_statuses = ("drafting", "waiting_to_send", "sent_awaiting_payment", "paid")
        if status not in valid_statuses:
            return error_response("VALIDATION_ERROR", f"status must be one of: {', '.join(valid_statuses)}.", field="status")
    tax_rate = None
    clear_tax = False
    if "tax_rate" in data:
        if data["tax_rate"] is None:
            clear_tax = True
        else:
            tax_rate, err = _parse_decimal(data["tax_rate"], "tax_rate")
            if err:
                return err

    # Extract metadata fields
    META_KEYS = (
        "document_number", "document_date", "bill_to", "company_name",
        "user_name", "user_phone", "user_email", "payment_method",
        "business_address", "worksite_address", "notes",
        "show_document_number", "show_document_date", "show_bill_to",
        "show_company_name", "show_user_name", "show_user_phone",
        "show_user_email", "show_payment_method", "show_business_address",
        "show_worksite_address", "show_notes",
    )
    metadata = {k: data[k] for k in META_KEYS if k in data}

    try:
        inv = _service.update(invoice_id=invoice_id, user_id=user_id, title=title,
                              delivered=delivered, status=status, tax_rate=tax_rate, clear_tax=clear_tax,
                              metadata=metadata or None)
        return jsonify(_serialize_invoice(inv, _service.calculate_totals(invoice_id, user_id))), 200
    except NotFoundError:
        return not_found("Invoice")
    except Exception:
        return server_error()


@invoices_bp.post("/invoices/<invoice_id>/populate-defaults")
@auth_required
def populate_invoice_defaults(invoice_id: str):
    """Re-populate metadata fields from profile and job context (overwrites current values)."""
    user_id = g.current_user_id
    try:
        inv = _service.populate_defaults(invoice_id, user_id)
        return jsonify(_serialize_invoice(inv, _service.calculate_totals(invoice_id, user_id))), 200
    except NotFoundError:
        return not_found("Invoice")
    except Exception:
        return server_error()


@invoices_bp.put("/invoices/<invoice_id>")
@auth_required
def update_invoice(invoice_id: str):
    return patch_invoice(invoice_id)


@invoices_bp.delete("/invoices/<invoice_id>")
@auth_required
def delete_invoice(invoice_id: str):
    user_id = g.current_user_id
    try:
        _service.delete(invoice_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Invoice")
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Line item CRUD
# ---------------------------------------------------------------------------

@invoices_bp.get("/invoices/<invoice_id>/line-items")
@auth_required
def list_line_items(invoice_id: str):
    user_id = g.current_user_id
    try:
        items = _service.get_line_items(invoice_id, user_id)
        return jsonify([_serialize_line_item(i) for i in items]), 200
    except NotFoundError:
        return not_found("Invoice")
    except Exception:
        return server_error()


@invoices_bp.post("/invoices/<invoice_id>/line-items")
@auth_required
def add_line_item(invoice_id: str):
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return error_response("VALIDATION_ERROR", "Name is required.", field="name")
    hourly_rate = None
    if data.get("hourly_rate") is not None:
        hourly_rate, err = _parse_decimal(data["hourly_rate"], "hourly_rate")
        if err:
            return err
    try:
        item = _service.add_line_item(
            invoice_id=invoice_id, user_id=user_id, name=name,
            notes=data.get("notes"), hourly_rate=hourly_rate,
            sort_order=int(data.get("sort_order", 0)),
        )
        return jsonify(_serialize_line_item(item)), 201
    except NotFoundError:
        return not_found("Invoice")
    except Exception:
        return server_error()


@invoices_bp.put("/invoices/<invoice_id>/line-items/<item_id>")
@auth_required
def update_line_item(invoice_id: str, item_id: str):
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    hourly_rate = None
    if data.get("hourly_rate") is not None:
        hourly_rate, err = _parse_decimal(data["hourly_rate"], "hourly_rate")
        if err:
            return err
    try:
        item = _service.update_line_item(
            invoice_id=invoice_id, item_id=item_id, user_id=user_id,
            name=data.get("name"), notes=data.get("notes"), hourly_rate=hourly_rate,
            sort_order=int(data["sort_order"]) if data.get("sort_order") is not None else None,
        )
        return jsonify(_serialize_line_item(item)), 200
    except NotFoundError:
        return not_found("Line item")
    except Exception:
        return server_error()


@invoices_bp.delete("/invoices/<invoice_id>/line-items/<item_id>")
@auth_required
def delete_line_item(invoice_id: str, item_id: str):
    user_id = g.current_user_id
    try:
        _service.delete_line_item(invoice_id, item_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Line item")
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Save line item to library
# ---------------------------------------------------------------------------

@invoices_bp.post("/invoices/<invoice_id>/line-items/<item_id>/save-to-library")
@auth_required
def save_line_item_to_library(invoice_id: str, item_id: str):
    """Copy a line item (and its entries) into the user's saved items library."""
    user_id = g.current_user_id
    try:
        from ..models import SavedItem, SavedItemEntry
        from ..extensions import db

        items = _service.get_line_items(invoice_id, user_id)
        target = next((i for i in items if str(i.id) == item_id), None)
        if target is None:
            return not_found("Line item")

        saved = SavedItem(
            user_id=user_id,
            name=target.name,
            notes=target.notes,
            hourly_rate=target.hourly_rate,
        )
        db.session.add(saved)
        db.session.flush()

        for entry in target.entries:
            db.session.add(SavedItemEntry(
                saved_item_id=str(saved.id),
                entry_type=entry.entry_type,
                name=entry.name,
                notes=entry.notes,
                url=entry.url,
                unit_price=entry.unit_price,
                quantity=entry.quantity,
                hours=entry.hours,
                sort_order=entry.sort_order,
            ))
        db.session.commit()
        db.session.refresh(saved)

        return jsonify({"id": str(saved.id), "name": saved.name}), 201
    except NotFoundError:
        return not_found("Line item")
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Entry CRUD
# ---------------------------------------------------------------------------

@invoices_bp.post("/invoices/<invoice_id>/line-items/<item_id>/entries")
@auth_required
def add_entry(invoice_id: str, item_id: str):
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return error_response("VALIDATION_ERROR", "Name is required.", field="name")
    entry_type = data.get("entry_type", "")
    if entry_type not in ("material", "hours"):
        return error_response("VALIDATION_ERROR", "entry_type must be 'material' or 'hours'.", field="entry_type")

    unit_price = hours = quantity = None
    if entry_type == "material":
        if data.get("unit_price") is not None:
            unit_price, err = _parse_decimal(data["unit_price"], "unit_price")
            if err:
                return err
        if data.get("quantity") is not None:
            quantity, err = _parse_decimal(data["quantity"], "quantity")
            if err:
                return err
    else:
        if data.get("hours") is not None:
            hours, err = _parse_decimal(data["hours"], "hours")
            if err:
                return err

    try:
        entry = _service.add_entry(
            invoice_id=invoice_id, item_id=item_id, user_id=user_id,
            entry_type=entry_type, name=name, notes=data.get("notes"),
            url=data.get("url"), unit_price=unit_price, quantity=quantity,
            hours=hours, sort_order=int(data.get("sort_order", 0)),
        )
        return jsonify(_serialize_entry(entry)), 201
    except (NotFoundError, ValidationError) as exc:
        return not_found(str(exc))
    except Exception:
        return server_error()


@invoices_bp.put("/invoices/<invoice_id>/line-items/<item_id>/entries/<entry_id>")
@auth_required
def update_entry(invoice_id: str, item_id: str, entry_id: str):
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    unit_price = hours = quantity = None
    if data.get("unit_price") is not None:
        unit_price, err = _parse_decimal(data["unit_price"], "unit_price")
        if err:
            return err
    if data.get("quantity") is not None:
        quantity, err = _parse_decimal(data["quantity"], "quantity")
        if err:
            return err
    if data.get("hours") is not None:
        hours, err = _parse_decimal(data["hours"], "hours")
        if err:
            return err
    try:
        entry = _service.update_entry(
            invoice_id=invoice_id, item_id=item_id, entry_id=entry_id, user_id=user_id,
            name=data.get("name"), notes=data.get("notes"), url=data.get("url"),
            unit_price=unit_price, quantity=quantity, hours=hours,
            sort_order=int(data["sort_order"]) if data.get("sort_order") is not None else None,
        )
        return jsonify(_serialize_entry(entry)), 200
    except NotFoundError:
        return not_found("Entry")
    except Exception:
        return server_error()


@invoices_bp.delete("/invoices/<invoice_id>/line-items/<item_id>/entries/<entry_id>")
@auth_required
def delete_entry(invoice_id: str, item_id: str, entry_id: str):
    user_id = g.current_user_id
    try:
        _service.delete_entry(invoice_id, item_id, entry_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Entry")
    except Exception:
        return server_error()
