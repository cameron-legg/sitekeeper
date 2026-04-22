"""Repository layer — SQLAlchemy implementations of all domain repositories."""

from .job_site_repo import IJobSiteRepository, SQLAlchemyJobSiteRepository
from .job_repo import IJobRepository, SQLAlchemyJobRepository
from .contact_repo import IContactRepository, SQLAlchemyContactRepository
from .note_repo import INoteRepository, SQLAlchemyNoteRepository
from .estimate_repo import IEstimateRepository, SQLAlchemyEstimateRepository
from .invoice_repo import IInvoiceRepository, SQLAlchemyInvoiceRepository
from .saved_item_repo import ISavedItemRepository, SQLAlchemySavedItemRepository

__all__ = [
    "IJobSiteRepository",
    "SQLAlchemyJobSiteRepository",
    "IJobRepository",
    "SQLAlchemyJobRepository",
    "IContactRepository",
    "SQLAlchemyContactRepository",
    "INoteRepository",
    "SQLAlchemyNoteRepository",
    "IEstimateRepository",
    "SQLAlchemyEstimateRepository",
    "IInvoiceRepository",
    "SQLAlchemyInvoiceRepository",
    "ISavedItemRepository",
    "SQLAlchemySavedItemRepository",
]
