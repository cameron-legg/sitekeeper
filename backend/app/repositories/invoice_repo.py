"""Invoice repository — interface and SQLAlchemy implementation (v2)."""

from abc import ABC, abstractmethod

from ..extensions import db
from ..models import Invoice, LineItem, LineItemEntry


class IInvoiceRepository(ABC):

    @abstractmethod
    def get_for_job(self, job_id: str) -> list[Invoice]: ...

    @abstractmethod
    def get_by_id(self, invoice_id: str) -> Invoice | None: ...

    @abstractmethod
    def create(self, invoice: Invoice) -> Invoice: ...

    @abstractmethod
    def update(self, invoice: Invoice) -> Invoice: ...

    @abstractmethod
    def delete(self, invoice_id: str) -> None: ...

    @abstractmethod
    def get_line_items(self, invoice_id: str) -> list[LineItem]: ...

    @abstractmethod
    def get_line_item_by_id(self, item_id: str) -> LineItem | None: ...

    @abstractmethod
    def add_line_item(self, item: LineItem) -> LineItem: ...

    @abstractmethod
    def update_line_item(self, item: LineItem) -> LineItem: ...

    @abstractmethod
    def delete_line_item(self, item_id: str) -> None: ...

    @abstractmethod
    def add_entry(self, entry: LineItemEntry) -> LineItemEntry: ...

    @abstractmethod
    def update_entry(self, entry: LineItemEntry) -> LineItemEntry: ...

    @abstractmethod
    def delete_entry(self, entry_id: str) -> None: ...

    @abstractmethod
    def get_entry_by_id(self, entry_id: str) -> LineItemEntry | None: ...


class SQLAlchemyInvoiceRepository(IInvoiceRepository):

    def get_for_job(self, job_id: str) -> list[Invoice]:
        return (
            Invoice.query.filter_by(job_id=job_id)
            .order_by(Invoice.created_at.desc())
            .all()
        )

    def get_by_id(self, invoice_id: str) -> Invoice | None:
        return Invoice.query.filter_by(id=invoice_id).first()

    def create(self, invoice: Invoice) -> Invoice:
        db.session.add(invoice)
        db.session.commit()
        db.session.refresh(invoice)
        return invoice

    def update(self, invoice: Invoice) -> Invoice:
        db.session.commit()
        db.session.refresh(invoice)
        return invoice

    def delete(self, invoice_id: str) -> None:
        invoice = Invoice.query.filter_by(id=invoice_id).first()
        if invoice:
            db.session.delete(invoice)
            db.session.commit()

    def get_line_items(self, invoice_id: str) -> list[LineItem]:
        return (
            LineItem.query.filter_by(parent_id=invoice_id, parent_type="invoice")
            .order_by(LineItem.sort_order.asc(), LineItem.id.asc())
            .all()
        )

    def get_line_item_by_id(self, item_id: str) -> LineItem | None:
        return LineItem.query.filter_by(id=item_id, parent_type="invoice").first()

    def add_line_item(self, item: LineItem) -> LineItem:
        db.session.add(item)
        db.session.commit()
        db.session.refresh(item)
        return item

    def update_line_item(self, item: LineItem) -> LineItem:
        db.session.commit()
        db.session.refresh(item)
        return item

    def delete_line_item(self, item_id: str) -> None:
        item = LineItem.query.filter_by(id=item_id, parent_type="invoice").first()
        if item:
            db.session.delete(item)
            db.session.commit()

    def add_entry(self, entry: LineItemEntry) -> LineItemEntry:
        db.session.add(entry)
        db.session.commit()
        db.session.refresh(entry)
        return entry

    def update_entry(self, entry: LineItemEntry) -> LineItemEntry:
        db.session.commit()
        db.session.refresh(entry)
        return entry

    def delete_entry(self, entry_id: str) -> None:
        entry = LineItemEntry.query.filter_by(id=entry_id).first()
        if entry:
            db.session.delete(entry)
            db.session.commit()

    def get_entry_by_id(self, entry_id: str) -> LineItemEntry | None:
        return LineItemEntry.query.filter_by(id=entry_id).first()
