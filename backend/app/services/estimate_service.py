"""Estimate service — CRUD with line item and entry management (v2)."""

from decimal import Decimal

from ..models import Estimate, LineItem, LineItemEntry
from ..repositories.estimate_repo import IEstimateRepository, SQLAlchemyEstimateRepository
from ..repositories.job_repo import IJobRepository, SQLAlchemyJobRepository
from ..repositories.job_site_repo import IJobSiteRepository, SQLAlchemyJobSiteRepository


class NotFoundError(Exception):
    pass


class ValidationError(Exception):
    pass


def _entry_cost(entry: LineItemEntry, hourly_rate: Decimal) -> Decimal:
    """Compute the cost of a single entry."""
    if entry.entry_type == "material":
        up = entry.unit_price or Decimal("0")
        qty = entry.quantity or Decimal("0")
        return up * qty
    else:  # hours
        hrs = entry.hours or Decimal("0")
        return hrs * hourly_rate


def compute_line_item_totals(item: LineItem) -> dict:
    """Return total_cost and total_hours for a LineItem."""
    rate = item.hourly_rate or Decimal("0")
    total_cost = Decimal("0")
    total_hours = Decimal("0")
    for entry in item.entries:
        total_cost += _entry_cost(entry, rate)
        if entry.entry_type == "hours":
            total_hours += entry.hours or Decimal("0")
    return {"total_cost": total_cost, "total_hours": total_hours}


class EstimateService:

    def __init__(
        self,
        estimate_repo: IEstimateRepository | None = None,
        job_repo: IJobRepository | None = None,
        site_repo: IJobSiteRepository | None = None,
    ):
        self._estimate_repo = estimate_repo or SQLAlchemyEstimateRepository()
        self._job_repo = job_repo or SQLAlchemyJobRepository()
        self._site_repo = site_repo or SQLAlchemyJobSiteRepository()

    def _verify_job_access(self, job_id: str, user_id: str):
        job = self._job_repo.get_by_id(job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found.")
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Job {job_id} not found.")
        return job

    def _verify_estimate_access(self, estimate_id: str, user_id: str) -> Estimate:
        estimate = self._estimate_repo.get_by_id(estimate_id)
        if estimate is None:
            raise NotFoundError(f"Estimate {estimate_id} not found.")
        self._verify_job_access(str(estimate.job_id), user_id)
        return estimate

    def _verify_line_item(self, estimate_id: str, item_id: str) -> LineItem:
        item = self._estimate_repo.get_line_item_by_id(item_id)
        if item is None or str(item.parent_id) != estimate_id:
            raise NotFoundError(f"Line item {item_id} not found.")
        return item

    # ------------------------------------------------------------------
    # Estimate CRUD
    # ------------------------------------------------------------------

    def list_for_job(self, job_id: str, user_id: str) -> list[Estimate]:
        self._verify_job_access(job_id, user_id)
        return self._estimate_repo.get_for_job(job_id)

    def get(self, estimate_id: str, user_id: str) -> Estimate:
        return self._verify_estimate_access(estimate_id, user_id)

    def create(self, job_id: str, user_id: str, title: str, delivered: bool = False) -> Estimate:
        self._verify_job_access(job_id, user_id)
        return self._estimate_repo.create(Estimate(job_id=job_id, title=title, delivered=delivered))

    def update(self, estimate_id: str, user_id: str, title: str | None = None, delivered: bool | None = None) -> Estimate:
        estimate = self._verify_estimate_access(estimate_id, user_id)
        if title is not None:
            estimate.title = title
        if delivered is not None:
            estimate.delivered = delivered
        return self._estimate_repo.update(estimate)

    def delete(self, estimate_id: str, user_id: str) -> None:
        self._verify_estimate_access(estimate_id, user_id)
        self._estimate_repo.delete(estimate_id)

    # ------------------------------------------------------------------
    # Line item CRUD
    # ------------------------------------------------------------------

    def get_line_items(self, estimate_id: str, user_id: str) -> list[LineItem]:
        self._verify_estimate_access(estimate_id, user_id)
        return self._estimate_repo.get_line_items(estimate_id)

    def add_line_item(self, estimate_id: str, user_id: str, name: str,
                      notes: str | None = None, hourly_rate: Decimal | None = None,
                      sort_order: int = 0) -> LineItem:
        self._verify_estimate_access(estimate_id, user_id)
        item = LineItem(
            parent_id=estimate_id, parent_type="estimate",
            name=name, notes=notes, hourly_rate=hourly_rate, sort_order=sort_order,
        )
        return self._estimate_repo.add_line_item(item)

    def update_line_item(self, estimate_id: str, item_id: str, user_id: str,
                         name: str | None = None, notes: str | None = None,
                         hourly_rate: Decimal | None = None,
                         sort_order: int | None = None) -> LineItem:
        self._verify_estimate_access(estimate_id, user_id)
        item = self._verify_line_item(estimate_id, item_id)
        if name is not None:
            item.name = name
        if notes is not None:
            item.notes = notes
        if hourly_rate is not None:
            item.hourly_rate = hourly_rate
        if sort_order is not None:
            item.sort_order = sort_order
        return self._estimate_repo.update_line_item(item)

    def delete_line_item(self, estimate_id: str, item_id: str, user_id: str) -> None:
        self._verify_estimate_access(estimate_id, user_id)
        self._verify_line_item(estimate_id, item_id)
        self._estimate_repo.delete_line_item(item_id)

    # ------------------------------------------------------------------
    # Entry CRUD (sub-items)
    # ------------------------------------------------------------------

    def add_entry(self, estimate_id: str, item_id: str, user_id: str,
                  entry_type: str, name: str, notes: str | None = None,
                  url: str | None = None, unit_price: Decimal | None = None,
                  quantity: Decimal | None = None, hours: Decimal | None = None,
                  sort_order: int = 0) -> LineItemEntry:
        self._verify_estimate_access(estimate_id, user_id)
        self._verify_line_item(estimate_id, item_id)
        if entry_type not in ("material", "hours"):
            raise ValidationError("entry_type must be 'material' or 'hours'.")
        entry = LineItemEntry(
            line_item_id=item_id, entry_type=entry_type, name=name,
            notes=notes, url=url, unit_price=unit_price, quantity=quantity,
            hours=hours, sort_order=sort_order,
        )
        return self._estimate_repo.add_entry(entry)

    def update_entry(self, estimate_id: str, item_id: str, entry_id: str,
                     user_id: str, name: str | None = None, notes: str | None = None,
                     url: str | None = None, unit_price: Decimal | None = None,
                     quantity: Decimal | None = None, hours: Decimal | None = None,
                     sort_order: int | None = None) -> LineItemEntry:
        self._verify_estimate_access(estimate_id, user_id)
        self._verify_line_item(estimate_id, item_id)
        entry = self._estimate_repo.get_entry_by_id(entry_id)
        if entry is None or str(entry.line_item_id) != item_id:
            raise NotFoundError(f"Entry {entry_id} not found.")
        if name is not None:
            entry.name = name
        if notes is not None:
            entry.notes = notes
        if url is not None:
            entry.url = url
        if unit_price is not None:
            entry.unit_price = unit_price
        if quantity is not None:
            entry.quantity = quantity
        if hours is not None:
            entry.hours = hours
        if sort_order is not None:
            entry.sort_order = sort_order
        return self._estimate_repo.update_entry(entry)

    def delete_entry(self, estimate_id: str, item_id: str, entry_id: str, user_id: str) -> None:
        self._verify_estimate_access(estimate_id, user_id)
        self._verify_line_item(estimate_id, item_id)
        entry = self._estimate_repo.get_entry_by_id(entry_id)
        if entry is None or str(entry.line_item_id) != item_id:
            raise NotFoundError(f"Entry {entry_id} not found.")
        self._estimate_repo.delete_entry(entry_id)

    # ------------------------------------------------------------------
    # Totals
    # ------------------------------------------------------------------

    def calculate_total(self, estimate_id: str, user_id: str) -> Decimal:
        items = self.get_line_items(estimate_id, user_id)
        return sum(
            compute_line_item_totals(item)["total_cost"] for item in items
        )
