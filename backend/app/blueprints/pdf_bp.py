"""PDF blueprint — generate and download PDFs for estimates and invoices."""

from flask import Blueprint, Response, g, jsonify

from ..auth.decorators import auth_required
from ..services.pdf_service import NotFoundError, PdfService
from .helpers import not_found, server_error

pdf_bp = Blueprint("pdf", __name__)
_service = PdfService()


# ---------------------------------------------------------------------------
# Estimate PDF
# ---------------------------------------------------------------------------


@pdf_bp.post("/estimates/<estimate_id>/pdf")
@auth_required
def generate_estimate_pdf(estimate_id: str):
    """Generate a PDF for the given estimate."""
    try:
        result = _service.generate_estimate_pdf(estimate_id, g.current_user_id)
        return jsonify(result), 200
    except NotFoundError:
        return not_found("Estimate")
    except RuntimeError as exc:
        return server_error(str(exc))
    except Exception:
        return server_error()


@pdf_bp.get("/estimates/<estimate_id>/pdf")
@auth_required
def download_estimate_pdf(estimate_id: str):
    """Download the previously generated PDF for the given estimate."""
    try:
        pdf_bytes, filename = _service.download_estimate_pdf(
            estimate_id, g.current_user_id
        )
        return Response(
            pdf_bytes,
            status=200,
            content_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )
    except NotFoundError:
        return not_found("No PDF has been generated for this estimate.")
    except RuntimeError as exc:
        return server_error(str(exc))
    except Exception:
        return server_error()


# ---------------------------------------------------------------------------
# Invoice PDF
# ---------------------------------------------------------------------------


@pdf_bp.post("/invoices/<invoice_id>/pdf")
@auth_required
def generate_invoice_pdf(invoice_id: str):
    """Generate a PDF for the given invoice."""
    try:
        result = _service.generate_invoice_pdf(invoice_id, g.current_user_id)
        return jsonify(result), 200
    except NotFoundError:
        return not_found("Invoice")
    except RuntimeError as exc:
        return server_error(str(exc))
    except Exception:
        return server_error()


@pdf_bp.get("/invoices/<invoice_id>/pdf")
@auth_required
def download_invoice_pdf(invoice_id: str):
    """Download the previously generated PDF for the given invoice."""
    try:
        pdf_bytes, filename = _service.download_invoice_pdf(
            invoice_id, g.current_user_id
        )
        return Response(
            pdf_bytes,
            status=200,
            content_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )
    except NotFoundError:
        return not_found("No PDF has been generated for this invoice.")
    except RuntimeError as exc:
        return server_error(str(exc))
    except Exception:
        return server_error()
