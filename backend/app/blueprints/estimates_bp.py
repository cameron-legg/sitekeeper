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


def _serialize_estimate(estimate, total: Decimal | None = None) -> dict:
    return {
        "id": str(estimate.id),
        "job_id": str(estimate.job_id),
        "title": estimate.title,
        "delivered": estimate.delivered,
        "total": str(total) if total is not None else None,
        "created_at": estimate.created_at.isoformat() if estimate.created_at else None,
        "updated_at": estimate.updated_at.isoformat() if estimate.updated_at else None,
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
        result = [_serialize_estimate(e, _service.calculate_total(str(e.id), user_id)) for e in estimates]
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
    try:
        est = _service.create(job_id=job_id, user_id=user_id, title=title, delivered=bool(data.get("delivered", False)))
        return jsonify(_serialize_estimate(est, _service.calculate_total(str(est.id), user_id))), 201
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
        return jsonify(_serialize_estimate(est, _service.calculate_total(estimate_id, user_id))), 200
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
    try:
        est = _service.update(estimate_id=estimate_id, user_id=user_id, title=title, delivered=delivered)
        return jsonify(_serialize_estimate(est, _service.calculate_total(estimate_id, user_id))), 200
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
