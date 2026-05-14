"""Estimates blueprint (v2) — line items with sub-entries.

New routes:
    POST   /api/v1/estimates/<id>/line-items/<item_id>/entries
    PUT    /api/v1/estimates/<id>/line-items/<item_id>/entries/<entry_id>
    DELETE /api/v1/estimates/<id>/line-items/<item_id>/entries/<entry_id>
"""

from decimal import Decimal, InvalidOperation

from flask import Blueprint, g, jsonify, request

from ..auth.decorators import auth_required
from ..services.estimate_service import EstimateService, NotFoundError, ValidationError, compute_line_item_totals
from .helpers import error_response, not_found, server_error

estimates_bp = Blueprint("estimates", __name__)
_service = EstimateService()


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


def _serialize_estimate(estimate, totals: dict | None = None) -> dict:
    t = totals or {}
    return {
        "id": str(estimate.id),
        "job_id": str(estimate.job_id),
        "title": estimate.title,
        "delivered": estimate.delivered,
        "tax_rate": str(estimate.tax_rate) if estimate.tax_rate is not None else None,
        "subtotal": str(t.get("subtotal", "0")),
        "tax_amount": str(t.get("tax_amount", "0")),
        "total": str(t.get("total", "0")),
        "created_at": estimate.created_at.isoformat() if estimate.created_at else None,
        "updated_at": estimate.updated_at.isoformat() if estimate.updated_at else None,
        "pdf_status": _compute_pdf_status(estimate),
        # Document metadata
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
        # Visibility flags
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
    }


# ---------------------------------------------------------------------------
# Estimate CRUD
# ---------------------------------------------------------------------------

@estimates_bp.get("/jobs/<job_id>/estimates")
@auth_required
def list_estimates(job_id: str):
    user_id = g.current_user_id
    try:
        estimates = _service.list_for_job(job_id, user_id)
        result = [_serialize_estimate(e, _service.calculate_totals(str(e.id), user_id)) for e in estimates]
        return jsonify(result), 200
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


@estimates_bp.post("/jobs/<job_id>/estimates")
@auth_required
def create_estimate(job_id: str):
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

    # Build metadata from profile defaults, then override with any explicit values
    from ..services.profile_service import ProfileService
    profile_service = ProfileService()
    try:
        profile = profile_service.get_profile(user_id)
    except Exception:
        profile = {}

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
        "company_name": data.get("company_name", profile.get("company_name")),
        "user_name": data.get("user_name", profile.get("name")),
        "user_phone": data.get("user_phone", profile.get("phone")),
        "user_email": data.get("user_email", profile.get("email")),
        "payment_method": data.get("payment_method", profile.get("payment_method")),
        "business_address": data.get("business_address", profile.get("address")),
        "bill_to": data.get("bill_to", bill_to_default),
        "worksite_address": data.get("worksite_address", worksite_default),
        "notes": data.get("notes"),
    }
    # Pass through any explicit visibility flags
    for key in [k for k in data if k.startswith("show_")]:
        metadata[key] = data[key]

    try:
        est = _service.create(job_id=job_id, user_id=user_id, title=title,
                              delivered=bool(data.get("delivered", False)),
                              tax_rate=tax_rate, metadata=metadata)
        return jsonify(_serialize_estimate(est, _service.calculate_totals(str(est.id), user_id))), 201
    except NotFoundError:
        return not_found("Job")
    except Exception:
        return server_error()


@estimates_bp.get("/estimates/<estimate_id>")
@auth_required
def get_estimate(estimate_id: str):
    user_id = g.current_user_id
    try:
        est = _service.get(estimate_id, user_id)
        return jsonify(_serialize_estimate(est, _service.calculate_totals(estimate_id, user_id))), 200
    except NotFoundError:
        return not_found("Estimate")
    except Exception:
        return server_error()


@estimates_bp.patch("/estimates/<estimate_id>")
@auth_required
def patch_estimate(estimate_id: str):
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
        est = _service.update(estimate_id=estimate_id, user_id=user_id, title=title,
                              delivered=delivered, tax_rate=tax_rate, clear_tax=clear_tax,
                              metadata=metadata or None)
        return jsonify(_serialize_estimate(est, _service.calculate_totals(estimate_id, user_id))), 200
    except NotFoundError:
        return not_found("Estimate")
    except Exception:
        return server_error()


@estimates_bp.put("/estimates/<estimate_id>")
@auth_required
def update_estimate(estimate_id: str):
    return patch_estimate(estimate_id)


@estimates_bp.delete("/estimates/<estimate_id>")
@auth_required
def delete_estimate(estimate_id: str):
    user_id = g.current_user_id
    try:
        _service.delete(estimate_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Estimate")
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Line item CRUD
# ---------------------------------------------------------------------------

@estimates_bp.get("/estimates/<estimate_id>/line-items")
@auth_required
def list_line_items(estimate_id: str):
    user_id = g.current_user_id
    try:
        items = _service.get_line_items(estimate_id, user_id)
        return jsonify([_serialize_line_item(i) for i in items]), 200
    except NotFoundError:
        return not_found("Estimate")
    except Exception:
        return server_error()


@estimates_bp.post("/estimates/<estimate_id>/line-items")
@auth_required
def add_line_item(estimate_id: str):
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
            estimate_id=estimate_id, user_id=user_id, name=name,
            notes=data.get("notes"), hourly_rate=hourly_rate,
            sort_order=int(data.get("sort_order", 0)),
        )
        return jsonify(_serialize_line_item(item)), 201
    except NotFoundError:
        return not_found("Estimate")
    except Exception:
        return server_error()


@estimates_bp.put("/estimates/<estimate_id>/line-items/<item_id>")
@auth_required
def update_line_item(estimate_id: str, item_id: str):
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    hourly_rate = None
    if data.get("hourly_rate") is not None:
        hourly_rate, err = _parse_decimal(data["hourly_rate"], "hourly_rate")
        if err:
            return err
    try:
        item = _service.update_line_item(
            estimate_id=estimate_id, item_id=item_id, user_id=user_id,
            name=data.get("name"), notes=data.get("notes"),
            hourly_rate=hourly_rate,
            sort_order=int(data["sort_order"]) if data.get("sort_order") is not None else None,
        )
        return jsonify(_serialize_line_item(item)), 200
    except NotFoundError:
        return not_found("Line item")
    except Exception:
        return server_error()


@estimates_bp.delete("/estimates/<estimate_id>/line-items/<item_id>")
@auth_required
def delete_line_item(estimate_id: str, item_id: str):
    user_id = g.current_user_id
    try:
        _service.delete_line_item(estimate_id, item_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Line item")
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Save line item to library
# ---------------------------------------------------------------------------

@estimates_bp.post("/estimates/<estimate_id>/line-items/<item_id>/save-to-library")
@auth_required
def save_line_item_to_library(estimate_id: str, item_id: str):
    """Copy a line item (and its entries) into the user's saved items library."""
    user_id = g.current_user_id
    try:
        from ..services.saved_item_service import SavedItemService
        from ..models import SavedItem, SavedItemEntry
        from ..extensions import db

        item = _service.get_line_items(estimate_id, user_id)
        # Find the specific item
        target = next((i for i in item if str(i.id) == item_id), None)
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
# Entry CRUD (sub-items)
# ---------------------------------------------------------------------------

@estimates_bp.post("/estimates/<estimate_id>/line-items/<item_id>/entries")
@auth_required
def add_entry(estimate_id: str, item_id: str):
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
            estimate_id=estimate_id, item_id=item_id, user_id=user_id,
            entry_type=entry_type, name=name, notes=data.get("notes"),
            url=data.get("url"), unit_price=unit_price, quantity=quantity,
            hours=hours, sort_order=int(data.get("sort_order", 0)),
        )
        return jsonify(_serialize_entry(entry)), 201
    except (NotFoundError, ValidationError) as exc:
        return not_found(str(exc))
    except Exception:
        return server_error()


@estimates_bp.put("/estimates/<estimate_id>/line-items/<item_id>/entries/<entry_id>")
@auth_required
def update_entry(estimate_id: str, item_id: str, entry_id: str):
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
            estimate_id=estimate_id, item_id=item_id, entry_id=entry_id, user_id=user_id,
            name=data.get("name"), notes=data.get("notes"), url=data.get("url"),
            unit_price=unit_price, quantity=quantity, hours=hours,
            sort_order=int(data["sort_order"]) if data.get("sort_order") is not None else None,
        )
        return jsonify(_serialize_entry(entry)), 200
    except NotFoundError:
        return not_found("Entry")
    except Exception:
        return server_error()


@estimates_bp.delete("/estimates/<estimate_id>/line-items/<item_id>/entries/<entry_id>")
@auth_required
def delete_entry(estimate_id: str, item_id: str, entry_id: str):
    user_id = g.current_user_id
    try:
        _service.delete_entry(estimate_id, item_id, entry_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Entry")
    except Exception:
        return server_error()
