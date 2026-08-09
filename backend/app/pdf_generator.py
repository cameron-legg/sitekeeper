"""Pure PDF generator module.

Takes structured data (PdfData) and returns PDF bytes using ReportLab.
No database or storage access — keeps this module testable in isolation.
"""

from dataclasses import dataclass
from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class PdfMaterialEntry:
    name: str
    unit_price: Decimal
    quantity: Decimal
    total: Decimal


@dataclass
class PdfHoursEntry:
    name: str
    hours: Decimal
    hourly_rate: Decimal
    total: Decimal


@dataclass
class PdfFeeEntry:
    name: str
    unit_price: Decimal
    quantity: Decimal
    total: Decimal


@dataclass
class PdfLineItem:
    name: str
    hourly_rate: Decimal | None
    material_entries: list[PdfMaterialEntry]
    hours_entries: list[PdfHoursEntry]
    fee_entries: list[PdfFeeEntry]


@dataclass
class PdfData:
    document_type: str  # "Estimate" or "Invoice"
    title: str
    company_name: str | None
    user_name: str | None
    user_phone: str | None
    user_email: str
    payment_method: str | None
    bill_to_name: str | None
    job_site_address: str | None
    line_items: list[PdfLineItem]
    tax_rate: Decimal | None
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    # New fields
    document_number: str | None = None
    document_date: str | None = None
    business_address: str | None = None
    notes: str | None = None
    # Photo data (list of raw image bytes)
    photo_images: list[bytes] | None = None
    # Visibility flags (all default True for backward compat)
    show_document_number: bool = True
    show_document_date: bool = True
    show_bill_to: bool = True
    show_company_name: bool = True
    show_user_name: bool = True
    show_user_phone: bool = True
    show_user_email: bool = True
    show_payment_method: bool = True
    show_business_address: bool = True
    show_worksite_address: bool = True
    show_notes: bool = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fmt(value: Decimal) -> str:
    """Format a Decimal as $X.XX with 2 decimal places."""
    return f"${value:.2f}"


def _fmt_qty(value: Decimal) -> str:
    """Format a quantity — strip trailing zeros for cleaner display."""
    return f"{value:.2f}"


# ---------------------------------------------------------------------------
# PDF builder
# ---------------------------------------------------------------------------


def build_pdf(data: PdfData) -> bytes:
    """Generate a professional-looking PDF document and return the raw bytes."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    elements: list = []

    # Custom styles
    style_company = ParagraphStyle(
        "CompanyName",
        parent=styles["Title"],
        fontSize=20,
        leading=24,
        spaceAfter=2,
    )
    style_contact = ParagraphStyle(
        "ContactInfo",
        parent=styles["Normal"],
        fontSize=10,
        leading=13,
        spaceAfter=1,
    )
    style_heading = ParagraphStyle(
        "DocHeading",
        parent=styles["Title"],
        fontSize=18,
        leading=22,
        spaceBefore=12,
        spaceAfter=4,
    )
    style_title = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontSize=14,
        leading=18,
        spaceAfter=8,
    )
    style_section = ParagraphStyle(
        "SectionLabel",
        parent=styles["Normal"],
        fontSize=11,
        leading=14,
        spaceAfter=4,
        textColor=colors.HexColor("#444444"),
    )
    style_bold = ParagraphStyle(
        "BoldNormal",
        parent=styles["Normal"],
        fontSize=10,
        leading=13,
    )
    style_footer = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=10,
        leading=13,
        alignment=1,  # center
        spaceBefore=20,
    )

    # Table styling helpers
    page_width = letter[0] - 1.5 * inch  # usable width

    header_bg = colors.HexColor("#2C3E50")
    subheader_bg = colors.HexColor("#ECF0F1")
    line_color = colors.HexColor("#BDC3C7")

    # ------------------------------------------------------------------
    # 1. Header area — company name, user info
    # ------------------------------------------------------------------
    if data.company_name and data.show_company_name:
        elements.append(Paragraph(data.company_name, style_company))
    if data.user_name and data.show_user_name:
        elements.append(Paragraph(data.user_name, style_contact))
    if data.business_address and data.show_business_address:
        elements.append(Paragraph(data.business_address, style_contact))
    if data.user_phone and data.show_user_phone:
        elements.append(Paragraph(data.user_phone, style_contact))
    if data.user_email and data.show_user_email:
        elements.append(Paragraph(data.user_email, style_contact))
    elements.append(Spacer(1, 8))

    # ------------------------------------------------------------------
    # 2. Document type heading + title + number + date
    # ------------------------------------------------------------------
    elements.append(
        Paragraph(data.document_type.upper(), style_heading)
    )

    # Title comes right before document number
    elements.append(Paragraph(data.title, style_title))

    if data.document_number and data.show_document_number:
        elements.append(
            Paragraph(f"{data.document_type} #: {data.document_number}", style_section)
        )
    if data.document_date and data.show_document_date:
        elements.append(
            Paragraph(f"Date: {data.document_date}", style_section)
        )

    # ------------------------------------------------------------------
    # 3. Bill To section
    # ------------------------------------------------------------------
    if data.bill_to_name is not None and data.show_bill_to:
        elements.append(
            Paragraph(f"Bill To: {data.bill_to_name}", style_section)
        )
        elements.append(Spacer(1, 4))

    # ------------------------------------------------------------------
    # 5. Job Site Address
    # ------------------------------------------------------------------
    if data.job_site_address is not None and data.show_worksite_address:
        elements.append(
            Paragraph(f"Job Site: {data.job_site_address}", style_section)
        )
        elements.append(Spacer(1, 4))

    elements.append(Spacer(1, 8))

    # ------------------------------------------------------------------
    # 6. Materials Table
    # ------------------------------------------------------------------
    all_material_entries: list[tuple[str, PdfMaterialEntry]] = []
    for item in data.line_items:
        for entry in item.material_entries:
            all_material_entries.append((item.name, entry))

    if all_material_entries:
        elements.append(
            Paragraph("<b>Materials</b>", style_bold)
        )
        elements.append(Spacer(1, 4))

        col_widths = [
            page_width * 0.40,
            page_width * 0.20,
            page_width * 0.15,
            page_width * 0.25,
        ]

        table_data = [["Description", "Unit Price", "Qty", "Total"]]

        current_group: str | None = None
        for group_name, entry in all_material_entries:
            if group_name != current_group:
                table_data.append([group_name, "", "", ""])
                current_group = group_name
            table_data.append([
                f"  {entry.name}",
                _fmt(entry.unit_price),
                _fmt_qty(entry.quantity),
                _fmt(entry.total),
            ])

        # Materials subtotal row
        materials_subtotal = sum(
            (e.total for _, e in all_material_entries), Decimal("0")
        )
        table_data.append([
            "Materials Subtotal", "", "", _fmt(materials_subtotal)
        ])

        # Tax rows (if applicable)
        if data.tax_rate is not None and data.tax_rate > 0:
            tax_on_materials = (
                materials_subtotal * data.tax_rate / Decimal("100")
            ).quantize(Decimal("0.01"))
            materials_with_tax = materials_subtotal + tax_on_materials
            table_data.append([
                f"Sales Tax ({data.tax_rate}%)", "", "", _fmt(tax_on_materials)
            ])
            table_data.append([
                "Materials Total (with tax)", "", "", _fmt(materials_with_tax)
            ])

        # Build the table style
        tbl_style_cmds = [
            # Header row
            ("BACKGROUND", (0, 0), (-1, 0), header_bg),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            # Whole table
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("GRID", (0, 0), (-1, -1), 0.5, line_color),
        ]

        # Highlight sub-header rows (line item group names)
        row_idx = 1
        current_group = None
        for group_name, _ in all_material_entries:
            if group_name != current_group:
                tbl_style_cmds.append(
                    ("BACKGROUND", (0, row_idx), (-1, row_idx), subheader_bg)
                )
                tbl_style_cmds.append(
                    ("FONTNAME", (0, row_idx), (-1, row_idx), "Helvetica-Bold")
                )
                row_idx += 1
                current_group = group_name
            row_idx += 1

        tbl = Table(table_data, colWidths=col_widths)
        tbl.setStyle(TableStyle(tbl_style_cmds))
        elements.append(tbl)
        elements.append(Spacer(1, 12))

    # ------------------------------------------------------------------
    # 7. Hours Table
    # ------------------------------------------------------------------
    all_hours_entries: list[tuple[str, PdfHoursEntry]] = []
    for item in data.line_items:
        for entry in item.hours_entries:
            all_hours_entries.append((item.name, entry))

    if all_hours_entries:
        elements.append(
            Paragraph("<b>Labor</b>", style_bold)
        )
        elements.append(Spacer(1, 4))

        col_widths_h = [
            page_width * 0.40,
            page_width * 0.20,
            page_width * 0.15,
            page_width * 0.25,
        ]

        table_data_h = [["Description", "Hours", "Rate", "Total"]]

        current_group = None
        for group_name, entry in all_hours_entries:
            if group_name != current_group:
                table_data_h.append([group_name, "", "", ""])
                current_group = group_name
            table_data_h.append([
                f"  {entry.name}",
                _fmt_qty(entry.hours),
                _fmt(entry.hourly_rate),
                _fmt(entry.total),
            ])

        # Total hours and labor total
        total_hours = sum(
            (e.hours for _, e in all_hours_entries), Decimal("0")
        )
        labor_total = sum(
            (e.total for _, e in all_hours_entries), Decimal("0")
        )
        table_data_h.append([
            "Total Hours", _fmt_qty(total_hours), "", ""
        ])
        table_data_h.append([
            "Labor Total", "", "", _fmt(labor_total)
        ])

        # Build the table style
        tbl_style_cmds_h = [
            ("BACKGROUND", (0, 0), (-1, 0), header_bg),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("GRID", (0, 0), (-1, -1), 0.5, line_color),
        ]

        row_idx = 1
        current_group = None
        for group_name, _ in all_hours_entries:
            if group_name != current_group:
                tbl_style_cmds_h.append(
                    ("BACKGROUND", (0, row_idx), (-1, row_idx), subheader_bg)
                )
                tbl_style_cmds_h.append(
                    ("FONTNAME", (0, row_idx), (-1, row_idx), "Helvetica-Bold")
                )
                row_idx += 1
                current_group = group_name
            row_idx += 1

        tbl_h = Table(table_data_h, colWidths=col_widths_h)
        tbl_h.setStyle(TableStyle(tbl_style_cmds_h))
        elements.append(tbl_h)
        elements.append(Spacer(1, 12))

    # ------------------------------------------------------------------
    # 7b. Fees Table
    # ------------------------------------------------------------------
    all_fee_entries: list[tuple[str, PdfFeeEntry]] = []
    for item in data.line_items:
        for entry in item.fee_entries:
            all_fee_entries.append((item.name, entry))

    if all_fee_entries:
        elements.append(
            Paragraph("<b>Fees</b>", style_bold)
        )
        elements.append(Spacer(1, 4))

        col_widths_f = [
            page_width * 0.40,
            page_width * 0.20,
            page_width * 0.15,
            page_width * 0.25,
        ]

        table_data_f = [["Description", "Amount", "Qty", "Total"]]

        current_group = None
        for group_name, entry in all_fee_entries:
            if group_name != current_group:
                table_data_f.append([group_name, "", "", ""])
                current_group = group_name
            table_data_f.append([
                f"  {entry.name}",
                _fmt(entry.unit_price),
                _fmt_qty(entry.quantity),
                _fmt(entry.total),
            ])

        fees_total = sum(
            (e.total for _, e in all_fee_entries), Decimal("0")
        )
        table_data_f.append([
            "Fees Total", "", "", _fmt(fees_total)
        ])

        tbl_style_cmds_f = [
            ("BACKGROUND", (0, 0), (-1, 0), header_bg),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("GRID", (0, 0), (-1, -1), 0.5, line_color),
        ]

        row_idx = 1
        current_group = None
        for group_name, _ in all_fee_entries:
            if group_name != current_group:
                tbl_style_cmds_f.append(
                    ("BACKGROUND", (0, row_idx), (-1, row_idx), subheader_bg)
                )
                tbl_style_cmds_f.append(
                    ("FONTNAME", (0, row_idx), (-1, row_idx), "Helvetica-Bold")
                )
                row_idx += 1
                current_group = group_name
            row_idx += 1

        tbl_f = Table(table_data_f, colWidths=col_widths_f)
        tbl_f.setStyle(TableStyle(tbl_style_cmds_f))
        elements.append(tbl_f)
        elements.append(Spacer(1, 12))

    # ------------------------------------------------------------------
    # 8. Grand Total section
    # ------------------------------------------------------------------
    elements.append(Spacer(1, 8))

    summary_data = [
        ["Subtotal:", _fmt(data.subtotal)],
    ]
    if data.tax_rate is not None and data.tax_rate > 0:
        summary_data.append(
            [f"Tax ({data.tax_rate}%):", _fmt(data.tax_amount)]
        )
    summary_data.append(["Total:", _fmt(data.total)])

    summary_col_widths = [page_width * 0.75, page_width * 0.25]
    summary_tbl = Table(summary_data, colWidths=summary_col_widths)

    summary_style_cmds = [
        ("ALIGN", (0, 0), (0, -1), "RIGHT"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEABOVE", (0, 0), (-1, 0), 1, line_color),
    ]
    # Bold the total row (last row)
    last_row = len(summary_data) - 1
    summary_style_cmds.append(
        ("FONTNAME", (0, last_row), (-1, last_row), "Helvetica-Bold")
    )
    summary_style_cmds.append(
        ("FONTSIZE", (0, last_row), (-1, last_row), 12)
    )

    summary_tbl.setStyle(TableStyle(summary_style_cmds))
    elements.append(summary_tbl)

    # ------------------------------------------------------------------
    # 9. Payment method
    # ------------------------------------------------------------------
    if data.payment_method is not None and data.show_payment_method:
        elements.append(Spacer(1, 12))
        elements.append(
            Paragraph(f"Payment: {data.payment_method}", style_section)
        )

    # ------------------------------------------------------------------
    # 9b. Additional Notes (markdown rendered as plain text paragraphs)
    # ------------------------------------------------------------------
    if data.notes and data.show_notes:
        elements.append(Spacer(1, 16))
        elements.append(
            Paragraph("<b>Notes</b>", style_bold)
        )
        elements.append(Spacer(1, 4))
        # Render notes as simple paragraphs (split by newlines)
        for line in data.notes.strip().split("\n"):
            if line.strip():
                elements.append(Paragraph(line, style_contact))
            else:
                elements.append(Spacer(1, 6))

    # ------------------------------------------------------------------
    # 10. Attached Photos
    # ------------------------------------------------------------------
    if data.photo_images:
        elements.append(Spacer(1, 16))
        elements.append(
            Paragraph("<b>Photos</b>", style_bold)
        )
        elements.append(Spacer(1, 8))

        max_width = page_width * 0.9
        max_height = 5 * inch

        for img_bytes in data.photo_images:
            try:
                img_buf = BytesIO(img_bytes)
                img = Image(img_buf)
                # Scale to fit within max dimensions while preserving aspect ratio
                iw, ih = img.drawWidth, img.drawHeight
                if iw > max_width:
                    scale = max_width / iw
                    iw *= scale
                    ih *= scale
                if ih > max_height:
                    scale = max_height / ih
                    iw *= scale
                    ih *= scale
                img.drawWidth = iw
                img.drawHeight = ih
                elements.append(img)
                elements.append(Spacer(1, 8))
            except Exception:
                # Skip photos that can't be rendered (corrupt, unsupported format)
                pass

    # ------------------------------------------------------------------
    # 11. Footer
    # ------------------------------------------------------------------
    elements.append(Spacer(1, 24))
    # elements.append(
    #     Paragraph("Thank you for your business!", style_footer)
    # )

    # Build the PDF
    doc.build(elements)
    return buf.getvalue()
