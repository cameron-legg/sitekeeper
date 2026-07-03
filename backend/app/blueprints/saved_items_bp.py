"""Saved items blueprint (v2) — with sub-entry support."""

from decimal import Decimal, InvalidOperation

from flask import Blueprint, g, jsonify, request

from ..auth.decorators import auth_required
from ..services.saved_item_service import NotFoundError, SavedItemService, ValidationError
from .helpers import error_response, not_found, server_error

saved_items_bp = Blueprint("saved_items", __name__)
_service = SavedItemService()


def _parse_decimal_optional(value, field_name: str):
    if value is None:
        return None, None
    try:
        return Decimal(str(value)), None
    except (InvalidOperation, TypeError, ValueError):
        return None, error_response("VALIDATION_ERROR", f"{field_name} must be a valid number.", field=field_name)


def _serialize_entry(entry) -> dict:
    return {
        "id": str(entry.id),
        "saved_item_id": str(entry.saved_item_id) if entry.saved_item_id is not None else None,
        "entry_type": entry.entry_type,
        "name": entry.name,
        "notes": entry.notes,
        "url": entry.url,
        "unit_price": str(entry.unit_price) if entry.unit_price is not None else None,
        "quantity": str(entry.quantity) if entry.quantity is not None else None,
        "hours": str(entry.hours) if entry.hours is not None else None,
        "sort_order": entry.sort_order,
        "parent_item_name": entry.saved_item.name if entry.saved_item_id and entry.saved_item else None,
    }


def _serialize_saved_item(item) -> dict:
    return {
        "id": str(item.id),
        "user_id": str(item.user_id),
        "name": item.name,
        "notes": item.notes,
        "hourly_rate": str(item.hourly_rate) if item.hourly_rate is not None else None,
        "entries": [_serialize_entry(e) for e in item.entries],
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


# ---------------------------------------------------------------------------
# SavedItem CRUD
# ---------------------------------------------------------------------------

@saved_items_bp.get("/saved-items")
@auth_required
def list_saved_items():
    user_id = g.current_user_id
    try:
        return jsonify([_serialize_saved_item(i) for i in _service.list_for_user(user_id)]), 200
    except Exception:
        return server_error()


@saved_items_bp.get("/saved-items/entries")
@auth_required
def list_all_entries():
    """Return all saved item entries for the user as a flat list."""
    user_id = g.current_user_id
    try:
        entries = _service.list_all_entries_for_user(user_id)
        return jsonify([_serialize_entry(e) for e in entries]), 200
    except Exception:
        return server_error()


@saved_items_bp.post("/saved-items")
@auth_required
def create_saved_item():
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return error_response("VALIDATION_ERROR", "Name is required.", field="name")
    hourly_rate, err = _parse_decimal_optional(data.get("hourly_rate"), "hourly_rate")
    if err:
        return err
    try:
        item = _service.create(user_id=user_id, name=name, notes=data.get("notes"), hourly_rate=hourly_rate)
        return jsonify(_serialize_saved_item(item)), 201
    except Exception:
        return server_error()


@saved_items_bp.get("/saved-items/<item_id>")
@auth_required
def get_saved_item(item_id: str):
    user_id = g.current_user_id
    try:
        return jsonify(_serialize_saved_item(_service.get(item_id, user_id))), 200
    except NotFoundError:
        return not_found("Saved item")
    except Exception:
        return server_error()


@saved_items_bp.put("/saved-items/<item_id>")
@auth_required
def update_saved_item(item_id: str):
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return error_response("VALIDATION_ERROR", "Name is required.", field="name")
    hourly_rate, err = _parse_decimal_optional(data.get("hourly_rate"), "hourly_rate")
    if err:
        return err
    try:
        item = _service.update(item_id=item_id, user_id=user_id, name=name,
                               notes=data.get("notes"), hourly_rate=hourly_rate)
        return jsonify(_serialize_saved_item(item)), 200
    except NotFoundError:
        return not_found("Saved item")
    except Exception:
        return server_error()


@saved_items_bp.delete("/saved-items/<item_id>")
@auth_required
def delete_saved_item(item_id: str):
    user_id = g.current_user_id
    try:
        _service.delete(item_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Saved item")
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# SavedItemEntry CRUD
# ---------------------------------------------------------------------------

@saved_items_bp.post("/saved-items/<item_id>/entries")
@auth_required
def add_entry(item_id: str):
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return error_response("VALIDATION_ERROR", "Name is required.", field="name")
    entry_type = data.get("entry_type", "")
    if entry_type not in ("material", "hours", "fee"):
        return error_response("VALIDATION_ERROR", "entry_type must be 'material', 'hours', or 'fee'.", field="entry_type")

    unit_price, err = _parse_decimal_optional(data.get("unit_price"), "unit_price")
    if err:
        return err
    quantity, err = _parse_decimal_optional(data.get("quantity"), "quantity")
    if err:
        return err
    hours, err = _parse_decimal_optional(data.get("hours"), "hours")
    if err:
        return err

    try:
        entry = _service.add_entry(
            item_id=item_id, user_id=user_id, entry_type=entry_type, name=name,
            notes=data.get("notes"), url=data.get("url"),
            unit_price=unit_price, quantity=quantity, hours=hours,
            sort_order=int(data.get("sort_order", 0)),
        )
        return jsonify(_serialize_entry(entry)), 201
    except (NotFoundError, ValidationError) as exc:
        return not_found(str(exc))
    except Exception:
        return server_error()


@saved_items_bp.put("/saved-items/<item_id>/entries/<entry_id>")
@auth_required
def update_entry(item_id: str, entry_id: str):
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    unit_price, err = _parse_decimal_optional(data.get("unit_price"), "unit_price")
    if err:
        return err
    quantity, err = _parse_decimal_optional(data.get("quantity"), "quantity")
    if err:
        return err
    hours, err = _parse_decimal_optional(data.get("hours"), "hours")
    if err:
        return err
    try:
        entry = _service.update_entry(
            item_id=item_id, entry_id=entry_id, user_id=user_id,
            name=data.get("name"), notes=data.get("notes"), url=data.get("url"),
            unit_price=unit_price, quantity=quantity, hours=hours,
            sort_order=int(data["sort_order"]) if data.get("sort_order") is not None else None,
        )
        return jsonify(_serialize_entry(entry)), 200
    except NotFoundError:
        return not_found("Entry")
    except Exception:
        return server_error()


@saved_items_bp.delete("/saved-items/<item_id>/entries/<entry_id>")
@auth_required
def delete_entry(item_id: str, entry_id: str):
    user_id = g.current_user_id
    try:
        _service.delete_entry(item_id, entry_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Entry")
    except Exception:
        return server_error()


@saved_items_bp.post("/saved-items/<item_id>/entries/assign")
@auth_required
def assign_entry_to_item(item_id: str):
    """Assign an existing entry to a SavedItem (move it from standalone or another item).

    Request body:
        entry_id (str) — the entry to assign
    """
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    entry_id = data.get("entry_id", "").strip()
    if not entry_id:
        return error_response("VALIDATION_ERROR", "entry_id is required.", field="entry_id")
    try:
        entry = _service.assign_entry_to_item(item_id=item_id, entry_id=entry_id, user_id=user_id)
        return jsonify(_serialize_entry(entry)), 200
    except NotFoundError as exc:
        return not_found(str(exc))
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Populate: copy a saved item into a real line item (snapshot)
# ---------------------------------------------------------------------------

@saved_items_bp.post("/saved-items/<item_id>/populate")
@auth_required
def populate_line_item(item_id: str):
    """Copy a saved item into a new LineItem on an estimate or invoice.

    Request body:
        parent_id   (str) — estimate or invoice id
        parent_type (str) — 'estimate' or 'invoice'
    """
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    parent_id = data.get("parent_id", "").strip()
    parent_type = data.get("parent_type", "").strip()

    if not parent_id:
        return error_response("VALIDATION_ERROR", "parent_id is required.", field="parent_id")
    if parent_type not in ("estimate", "invoice"):
        return error_response("VALIDATION_ERROR", "parent_type must be 'estimate' or 'invoice'.", field="parent_type")

    try:
        line_item = _service.populate_line_item(
            saved_item_id=item_id,
            user_id=user_id,
            parent_id=parent_id,
            parent_type=parent_type,
        )
        from ..services.estimate_service import compute_line_item_totals
        totals = compute_line_item_totals(line_item)
        return jsonify({
            "id": str(line_item.id),
            "parent_id": str(line_item.parent_id),
            "parent_type": line_item.parent_type,
            "name": line_item.name,
            "notes": line_item.notes,
            "hourly_rate": str(line_item.hourly_rate) if line_item.hourly_rate else None,
            "sort_order": line_item.sort_order,
            "total_cost": str(totals["total_cost"]),
            "total_hours": str(totals["total_hours"]),
            "entries": [],
        }), 201
    except (NotFoundError, ValidationError) as exc:
        return not_found(str(exc))
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Save a single entry to the library
# ---------------------------------------------------------------------------

@saved_items_bp.post("/saved-items/save-entry")
@auth_required
def save_entry_to_library():
    """Save a single entry (material or hours) to the Materials Library as a standalone entry.

    Request body:
        entry_type  (str) — 'material' or 'hours'
        name        (str) — entry name
        notes       (str, optional)
        url         (str, optional)
        unit_price  (str, optional) — for material entries
        quantity    (str, optional) — for material entries
        hours       (str, optional) — for hours entries
    """
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    if not name:
        return error_response("VALIDATION_ERROR", "Name is required.", field="name")
    entry_type = data.get("entry_type", "")
    if entry_type not in ("material", "hours", "fee"):
        return error_response("VALIDATION_ERROR", "entry_type must be 'material', 'hours', or 'fee'.", field="entry_type")

    unit_price, err = _parse_decimal_optional(data.get("unit_price"), "unit_price")
    if err:
        return err
    quantity, err = _parse_decimal_optional(data.get("quantity"), "quantity")
    if err:
        return err
    hours, err = _parse_decimal_optional(data.get("hours"), "hours")
    if err:
        return err

    try:
        entry = _service.save_entry_to_library(
            user_id=user_id, entry_type=entry_type, name=name,
            notes=data.get("notes"), url=data.get("url"),
            unit_price=unit_price, quantity=quantity, hours=hours,
        )
        return jsonify(_serialize_entry(entry)), 201
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Standalone entry CRUD (Materials Library — no parent SavedItem)
# ---------------------------------------------------------------------------

@saved_items_bp.put("/saved-items/entries/<entry_id>")
@auth_required
def update_standalone_entry(entry_id: str):
    """Update a standalone entry in the Materials Library."""
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}
    unit_price, err = _parse_decimal_optional(data.get("unit_price"), "unit_price")
    if err:
        return err
    quantity, err = _parse_decimal_optional(data.get("quantity"), "quantity")
    if err:
        return err
    hours, err = _parse_decimal_optional(data.get("hours"), "hours")
    if err:
        return err
    try:
        entry = _service.update_standalone_entry(
            entry_id=entry_id, user_id=user_id,
            name=data.get("name"), notes=data.get("notes"), url=data.get("url"),
            unit_price=unit_price, quantity=quantity, hours=hours,
        )
        return jsonify(_serialize_entry(entry)), 200
    except NotFoundError:
        return not_found("Entry")
    except Exception:
        return server_error()


@saved_items_bp.delete("/saved-items/entries/<entry_id>")
@auth_required
def delete_standalone_entry(entry_id: str):
    """Delete a standalone entry from the Materials Library."""
    user_id = g.current_user_id
    try:
        _service.delete_standalone_entry(entry_id, user_id)
        return "", 204
    except NotFoundError:
        return not_found("Entry")
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Populate: copy a single saved entry into an existing line item
# ---------------------------------------------------------------------------

@saved_items_bp.post("/saved-items/entries/<entry_id>/populate")
@auth_required
def populate_entry(entry_id: str):
    """Copy a single saved item entry into an existing LineItem.

    Request body:
        line_item_id (str) — target line item id
        parent_id    (str) — estimate or invoice id
        parent_type  (str) — 'estimate' or 'invoice'
    """
    user_id = g.current_user_id
    data = request.get_json(silent=True) or {}

    line_item_id = data.get("line_item_id", "").strip()
    parent_id = data.get("parent_id", "").strip()
    parent_type = data.get("parent_type", "").strip()

    if not line_item_id:
        return error_response("VALIDATION_ERROR", "line_item_id is required.", field="line_item_id")
    if not parent_id:
        return error_response("VALIDATION_ERROR", "parent_id is required.", field="parent_id")
    if parent_type not in ("estimate", "invoice"):
        return error_response("VALIDATION_ERROR", "parent_type must be 'estimate' or 'invoice'.", field="parent_type")

    try:
        entry = _service.populate_entry(
            saved_entry_id=entry_id,
            user_id=user_id,
            line_item_id=line_item_id,
            parent_id=parent_id,
            parent_type=parent_type,
        )
        return jsonify({
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
        }), 201
    except (NotFoundError, ValidationError) as exc:
        return not_found(str(exc))
    except Exception:
        return server_error()
