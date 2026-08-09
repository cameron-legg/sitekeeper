"""Contact repository — interface and SQLAlchemy implementation."""

from abc import ABC, abstractmethod

from ...extensions import db
from ...models import Contact, Job, JobSite, job_contacts, job_site_contacts


class IContactRepository(ABC):
    """Abstract interface for contact persistence operations."""

    @abstractmethod
    def get_by_id(self, contact_id: str) -> Contact | None:
        """Return the contact with the given id, or None."""
        ...

    @abstractmethod
    def create(self, contact: Contact) -> Contact:
        """Persist a new contact and return it with server-generated fields."""
        ...

    @abstractmethod
    def update(self, contact: Contact) -> Contact:
        """Persist changes to an existing contact and return the updated record."""
        ...

    @abstractmethod
    def delete(self, contact_id: str) -> None:
        """Delete the contact record."""
        ...

    @abstractmethod
    def get_for_job_site(self, site_id: str) -> list[Contact]:
        """Return all contacts associated with the given job site."""
        ...

    @abstractmethod
    def get_for_job(self, job_id: str) -> list[Contact]:
        """Return all contacts associated with the given job."""
        ...

    @abstractmethod
    def add_to_job_site(self, site_id: str, contact_id: str) -> None:
        """Associate a contact with a job site."""
        ...

    @abstractmethod
    def add_to_job(self, job_id: str, contact_id: str) -> None:
        """Associate a contact with a job."""
        ...

    @abstractmethod
    def remove_from_job_site(self, site_id: str, contact_id: str) -> None:
        """Remove the association between a contact and a job site."""
        ...

    @abstractmethod
    def remove_from_job(self, job_id: str, contact_id: str) -> None:
        """Remove the association between a contact and a job."""
        ...

    @abstractmethod
    def set_primary_for_job_site(self, site_id: str, contact_id: str | None) -> None:
        """Set (or clear) the primary contact for a job site."""
        ...

    @abstractmethod
    def set_primary_for_job(self, job_id: str, contact_id: str | None) -> None:
        """Set (or clear) the primary contact for a job."""
        ...


class SQLAlchemyContactRepository(IContactRepository):
    """SQLAlchemy-backed implementation of IContactRepository."""

    def get_by_id(self, contact_id: str) -> Contact | None:
        return Contact.query.filter_by(id=contact_id).first()

    def create(self, contact: Contact) -> Contact:
        db.session.add(contact)
        db.session.commit()
        db.session.refresh(contact)
        return contact

    def update(self, contact: Contact) -> Contact:
        db.session.commit()
        db.session.refresh(contact)
        return contact

    def delete(self, contact_id: str) -> None:
        contact = Contact.query.filter_by(id=contact_id).first()
        if contact:
            db.session.delete(contact)
            db.session.commit()

    def get_for_job_site(self, site_id: str) -> list[Contact]:
        site = JobSite.query.filter_by(id=site_id).first()
        if site is None:
            return []
        return site.contacts

    def get_for_job(self, job_id: str) -> list[Contact]:
        job = Job.query.filter_by(id=job_id).first()
        if job is None:
            return []
        return job.contacts

    def add_to_job_site(self, site_id: str, contact_id: str) -> None:
        site = JobSite.query.filter_by(id=site_id).first()
        contact = Contact.query.filter_by(id=contact_id).first()
        if site and contact and contact not in site.contacts:
            site.contacts.append(contact)
            db.session.commit()

    def add_to_job(self, job_id: str, contact_id: str) -> None:
        job = Job.query.filter_by(id=job_id).first()
        contact = Contact.query.filter_by(id=contact_id).first()
        if job and contact and contact not in job.contacts:
            job.contacts.append(contact)
            db.session.commit()

    def remove_from_job_site(self, site_id: str, contact_id: str) -> None:
        site = JobSite.query.filter_by(id=site_id).first()
        contact = Contact.query.filter_by(id=contact_id).first()
        if site and contact and contact in site.contacts:
            site.contacts.remove(contact)
            db.session.commit()

    def remove_from_job(self, job_id: str, contact_id: str) -> None:
        job = Job.query.filter_by(id=job_id).first()
        contact = Contact.query.filter_by(id=contact_id).first()
        if job and contact and contact in job.contacts:
            job.contacts.remove(contact)
            db.session.commit()

    def set_primary_for_job_site(self, site_id: str, contact_id: str | None) -> None:
        site = JobSite.query.filter_by(id=site_id).first()
        if site:
            site.primary_contact_id = contact_id
            db.session.commit()

    def set_primary_for_job(self, job_id: str, contact_id: str | None) -> None:
        job = Job.query.filter_by(id=job_id).first()
        if job:
            job.primary_contact_id = contact_id
            db.session.commit()
