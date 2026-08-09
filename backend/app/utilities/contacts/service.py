"""Contact service — contact management and primary-contact resolution."""

from ...models import Contact, Job, JobSite
from .repository import IContactRepository, SQLAlchemyContactRepository
from ...core.repositories.job_repo import IJobRepository, SQLAlchemyJobRepository
from ...core.repositories.job_site_repo import IJobSiteRepository, SQLAlchemyJobSiteRepository


class NotFoundError(Exception):
    """Raised when a requested resource does not exist or is not accessible."""


class ContactService:
    """Business logic for contact management.

    Contacts are not directly owned by a user — they are associated with
    job sites and jobs. Ownership is enforced by verifying the parent
    entity belongs to the requesting user.
    """

    def __init__(
        self,
        contact_repo: IContactRepository | None = None,
        job_repo: IJobRepository | None = None,
        site_repo: IJobSiteRepository | None = None,
    ):
        self._contact_repo = contact_repo or SQLAlchemyContactRepository()
        self._job_repo = job_repo or SQLAlchemyJobRepository()
        self._site_repo = site_repo or SQLAlchemyJobSiteRepository()

    # ------------------------------------------------------------------
    # Contact CRUD
    # ------------------------------------------------------------------

    def get_contact(self, contact_id: str) -> Contact:
        contact = self._contact_repo.get_by_id(contact_id)
        if contact is None:
            raise NotFoundError(f"Contact {contact_id} not found.")
        return contact

    def create_contact(
        self,
        name: str,
        phone: str | None = None,
        email: str | None = None,
        mailing_address: str | None = None,
        notes: str | None = None,
    ) -> Contact:
        contact = Contact(
            name=name,
            phone=phone,
            email=email,
            mailing_address=mailing_address,
            notes=notes,
        )
        return self._contact_repo.create(contact)

    def update_contact(
        self,
        contact_id: str,
        name: str | None = None,
        phone: str | None = None,
        email: str | None = None,
        mailing_address: str | None = None,
        notes: str | None = None,
    ) -> Contact:
        contact = self._contact_repo.get_by_id(contact_id)
        if contact is None:
            raise NotFoundError(f"Contact {contact_id} not found.")
        if name is not None:
            contact.name = name
        if phone is not None:
            contact.phone = phone
        if email is not None:
            contact.email = email
        if mailing_address is not None:
            contact.mailing_address = mailing_address
        if notes is not None:
            contact.notes = notes
        return self._contact_repo.update(contact)

    def delete_contact(self, contact_id: str) -> None:
        contact = self._contact_repo.get_by_id(contact_id)
        if contact is None:
            raise NotFoundError(f"Contact {contact_id} not found.")
        self._contact_repo.delete(contact_id)

    # ------------------------------------------------------------------
    # Job site contact management
    # ------------------------------------------------------------------

    def get_contacts_for_job_site(self, site_id: str, user_id: str) -> list[Contact]:
        site = self._site_repo.get_by_id(site_id, user_id)
        if site is None:
            raise NotFoundError(f"Job site {site_id} not found.")
        return self._contact_repo.get_for_job_site(site_id)

    def add_contact_to_job_site(
        self, site_id: str, user_id: str, contact_id: str
    ) -> None:
        site = self._site_repo.get_by_id(site_id, user_id)
        if site is None:
            raise NotFoundError(f"Job site {site_id} not found.")
        contact = self._contact_repo.get_by_id(contact_id)
        if contact is None:
            raise NotFoundError(f"Contact {contact_id} not found.")
        self._contact_repo.add_to_job_site(site_id, contact_id)

    def remove_contact_from_job_site(
        self, site_id: str, user_id: str, contact_id: str
    ) -> None:
        site = self._site_repo.get_by_id(site_id, user_id)
        if site is None:
            raise NotFoundError(f"Job site {site_id} not found.")
        self._contact_repo.remove_from_job_site(site_id, contact_id)

    def set_primary_for_job_site(
        self, site_id: str, user_id: str, contact_id: str | None
    ) -> None:
        site = self._site_repo.get_by_id(site_id, user_id)
        if site is None:
            raise NotFoundError(f"Job site {site_id} not found.")
        self._contact_repo.set_primary_for_job_site(site_id, contact_id)

    # ------------------------------------------------------------------
    # Job contact management
    # ------------------------------------------------------------------

    def get_contacts_for_job(self, job_id: str, user_id: str) -> list[dict]:
        """Return contacts for a job, including inherited job site contacts.

        Each item is a dict with keys 'contact' (Contact model) and
        'inherited' (bool). Directly-assigned job contacts come first,
        followed by inherited job site contacts that aren't already on the job.
        """
        job = self._job_repo.get_by_id(job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found.")
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Job {job_id} not found.")

        direct_contacts = self._contact_repo.get_for_job(job_id)
        direct_ids = {str(c.id) for c in direct_contacts}

        result = [{"contact": c, "inherited": False} for c in direct_contacts]

        # Inherit contacts from the parent job site
        site_contacts = self._contact_repo.get_for_job_site(str(job.job_site_id))
        for c in site_contacts:
            if str(c.id) not in direct_ids:
                result.append({"contact": c, "inherited": True})

        return result

    def add_contact_to_job(
        self, job_id: str, user_id: str, contact_id: str
    ) -> None:
        job = self._job_repo.get_by_id(job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found.")
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Job {job_id} not found.")
        contact = self._contact_repo.get_by_id(contact_id)
        if contact is None:
            raise NotFoundError(f"Contact {contact_id} not found.")
        self._contact_repo.add_to_job(job_id, contact_id)

        # Auto-set as primary if this is the only contact on the job
        contacts = self._contact_repo.get_for_job(job_id)
        if len(contacts) == 1:
            self._contact_repo.set_primary_for_job(job_id, contact_id)

    def remove_contact_from_job(
        self, job_id: str, user_id: str, contact_id: str
    ) -> None:
        job = self._job_repo.get_by_id(job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found.")
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Job {job_id} not found.")
        self._contact_repo.remove_from_job(job_id, contact_id)

        # If the removed contact was the primary, reassign or clear
        if str(job.primary_contact_id) == contact_id:
            remaining = self._contact_repo.get_for_job(job_id)
            if len(remaining) == 1:
                self._contact_repo.set_primary_for_job(job_id, str(remaining[0].id))
            else:
                self._contact_repo.set_primary_for_job(job_id, None)

    def set_primary_for_job(
        self, job_id: str, user_id: str, contact_id: str | None
    ) -> None:
        job = self._job_repo.get_by_id(job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found.")
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Job {job_id} not found.")
        self._contact_repo.set_primary_for_job(job_id, contact_id)

    # ------------------------------------------------------------------
    # Effective primary contact resolution
    # ------------------------------------------------------------------

    def get_effective_primary_contact(
        self, job_id: str, user_id: str
    ) -> dict | None:
        """Return the effective primary contact for a job with its source.

        Resolution order:
        1. If the job has a primary_contact_id, return it with source='direct'.
        2. Else if the parent site has a primary_contact_id, return it with
           source='inherited'.
        3. Else if there is exactly one contact visible to the job (direct or
           inherited from site), return it with source='auto'.
        4. Otherwise return None.

        Returns:
            dict with keys 'contact' (Contact model) and 'source' ('direct',
            'inherited', or 'auto'), or None if no primary contact can be
            resolved.
        """
        job = self._job_repo.get_by_id(job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found.")
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Job {job_id} not found.")

        if job.primary_contact_id is not None:
            contact = self._contact_repo.get_by_id(str(job.primary_contact_id))
            if contact is not None:
                return {"contact": contact, "source": "direct"}

        if site.primary_contact_id is not None:
            contact = self._contact_repo.get_by_id(str(site.primary_contact_id))
            if contact is not None:
                return {"contact": contact, "source": "inherited"}

        # Auto-resolve: if exactly one contact is visible, treat it as primary
        direct_contacts = self._contact_repo.get_for_job(job_id)
        site_contacts = self._contact_repo.get_for_job_site(str(job.job_site_id))
        direct_ids = {str(c.id) for c in direct_contacts}
        all_contacts = list(direct_contacts) + [
            c for c in site_contacts if str(c.id) not in direct_ids
        ]
        if len(all_contacts) == 1:
            return {"contact": all_contacts[0], "source": "auto"}

        return None
