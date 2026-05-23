"""Job site service — CRUD with user ownership enforcement."""

from ..models import JobSite
from ..repositories.job_site_repo import IJobSiteRepository, SQLAlchemyJobSiteRepository


class NotFoundError(Exception):
    """Raised when a requested resource does not exist or is not accessible."""


class JobSiteService:
    """Business logic for job site management.

    All operations enforce user ownership: a job site that exists but belongs
    to a different user is treated as not found (returns 404, not 403) to
    avoid leaking existence information.
    """

    def __init__(self, repo: IJobSiteRepository | None = None):
        self._repo = repo or SQLAlchemyJobSiteRepository()

    def list_for_user(self, user_id: str) -> list[dict]:
        """Return all job sites for the user, each with a job_count and active_job_count field."""
        sites = self._repo.get_all_for_user(user_id)
        result = []
        for site in sites:
            job_count = self._repo.count_jobs(str(site.id))
            active_job_count = self._repo.count_active_jobs(str(site.id))
            result.append({"site": site, "job_count": job_count, "active_job_count": active_job_count})
        return result

    def get(self, site_id: str, user_id: str) -> JobSite:
        """Return the job site, raising NotFoundError if not found or not owned."""
        site = self._repo.get_by_id(site_id, user_id)
        if site is None:
            raise NotFoundError(f"Job site {site_id} not found.")
        return site

    def create(self, user_id: str, name: str, description: str | None = None, address: str | None = None) -> JobSite:
        """Create and persist a new job site owned by user_id.

        Inherits default_hourly_rate from business_info if not explicitly set.
        """
        from .business_info_service import BusinessInfoService
        try:
            biz = BusinessInfoService().get_business_info()
        except Exception:
            biz = {}
        inherited_rate = biz.get("default_hourly_rate")

        site = JobSite(
            user_id=user_id, name=name, description=description, address=address,
            default_hourly_rate=inherited_rate,
        )
        return self._repo.create(site)

    def update(
        self,
        site_id: str,
        user_id: str,
        name: str | None = None,
        description: str | None = None,
        address: str | None = None,
        default_hourly_rate=None,
        clear_hourly_rate: bool = False,
    ) -> JobSite:
        """Update fields on an existing job site.

        Only provided (non-None) fields are updated.
        Use clear_hourly_rate=True to explicitly set default_hourly_rate to None.
        Raises NotFoundError if the site does not exist or is not owned by user.
        """
        site = self._repo.get_by_id(site_id, user_id)
        if site is None:
            raise NotFoundError(f"Job site {site_id} not found.")
        if name is not None:
            site.name = name
        if description is not None:
            site.description = description
        if address is not None:
            site.address = address
        if clear_hourly_rate:
            site.default_hourly_rate = None
        elif default_hourly_rate is not None:
            site.default_hourly_rate = default_hourly_rate
        return self._repo.update(site)

    def delete(self, site_id: str, user_id: str) -> None:
        """Delete the job site (and all children via cascade).

        Raises NotFoundError if the site does not exist or is not owned by user.
        """
        site = self._repo.get_by_id(site_id, user_id)
        if site is None:
            raise NotFoundError(f"Job site {site_id} not found.")
        self._repo.delete(site_id, user_id)
