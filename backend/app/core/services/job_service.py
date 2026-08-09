"""Job service — CRUD with status-transition logic."""

from datetime import datetime, timezone

from ...models import Job, JobSite
from ..repositories.job_repo import IJobRepository, SQLAlchemyJobRepository
from ..repositories.job_site_repo import IJobSiteRepository, SQLAlchemyJobSiteRepository

_VALID_STATUSES = {"pending", "in_progress", "completed", "cancelled"}

# Sentinel to distinguish "caller did not pass finished_at" from "caller passed None"
_UNSET = object()


class NotFoundError(Exception):
    """Raised when a requested resource does not exist or is not accessible."""


class ValidationError(Exception):
    """Raised when input data fails business-rule validation."""


class JobService:
    """Business logic for job management.

    Ownership is enforced indirectly: callers must first verify the parent
    job site belongs to the user (via JobSiteService) before operating on jobs.
    The service itself verifies the job belongs to the given site.
    """

    def __init__(
        self,
        job_repo: IJobRepository | None = None,
        site_repo: IJobSiteRepository | None = None,
    ):
        self._job_repo = job_repo or SQLAlchemyJobRepository()
        self._site_repo = site_repo or SQLAlchemyJobSiteRepository()

    def list_for_site(self, site_id: str, user_id: str) -> list[Job]:
        """Return all jobs for the given site, verifying user ownership."""
        site = self._site_repo.get_by_id(site_id, user_id)
        if site is None:
            raise NotFoundError(f"Job site {site_id} not found.")
        return self._job_repo.get_all_for_site(site_id)

    def get(self, job_id: str, user_id: str) -> Job:
        """Return the job, raising NotFoundError if not found or not accessible.

        Ownership is verified by checking the parent job site belongs to user_id.
        """
        job = self._job_repo.get_by_id(job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found.")
        # Verify ownership via parent site
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Job {job_id} not found.")
        return job

    def create(
        self,
        site_id: str,
        user_id: str,
        name: str,
        status: str = "pending",
        description: str | None = None,
    ) -> Job:
        """Create and persist a new job within the given site.

        Inherits default_hourly_rate from the parent job site.
        Raises NotFoundError if the site does not exist or is not owned by user.
        Raises ValidationError if status is not a valid value.
        """
        site = self._site_repo.get_by_id(site_id, user_id)
        if site is None:
            raise NotFoundError(f"Job site {site_id} not found.")
        if status not in _VALID_STATUSES:
            raise ValidationError(
                f"Invalid status '{status}'. Must be one of: {', '.join(sorted(_VALID_STATUSES))}."
            )
        job = Job(
            job_site_id=site_id, name=name, status=status, description=description,
            default_hourly_rate=site.default_hourly_rate,
        )
        return self._job_repo.create(job)

    def update(
        self,
        job_id: str,
        user_id: str,
        name: str | None = None,
        status: str | None = None,
        description: str | None = None,
        finished_at=_UNSET,
        default_hourly_rate=_UNSET,
    ) -> Job:
        """Update fields on an existing job.

        Status transition rules:
        - If status transitions to 'completed' and finished_at is currently None
          AND the caller did not explicitly pass finished_at, auto-set it to now().
        - If the caller explicitly passes finished_at (including None to clear it),
          that value is persisted as-is.

        Raises NotFoundError if the job does not exist or is not accessible.
        Raises ValidationError if status is not a valid value.
        """
        job = self._job_repo.get_by_id(job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found.")
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Job {job_id} not found.")

        if name is not None:
            job.name = name
        if description is not None:
            job.description = description

        if status is not None:
            if status not in _VALID_STATUSES:
                raise ValidationError(
                    f"Invalid status '{status}'. Must be one of: {', '.join(sorted(_VALID_STATUSES))}."
                )
            old_status = job.status
            job.status = status

            # Auto-set finished_at when transitioning to completed
            if (
                status == "completed"
                and old_status != "completed"
                and job.finished_at is None
                and finished_at is _UNSET
            ):
                job.finished_at = datetime.now(tz=timezone.utc)

        # Honour explicit finished_at from caller (including None to clear)
        if finished_at is not _UNSET:
            job.finished_at = finished_at

        # Honour explicit default_hourly_rate (including None to clear)
        if default_hourly_rate is not _UNSET:
            job.default_hourly_rate = default_hourly_rate

        return self._job_repo.update(job)

    def delete(self, job_id: str, user_id: str) -> None:
        """Delete the job (and all children via cascade).

        Raises NotFoundError if the job does not exist or is not accessible.
        """
        job = self._job_repo.get_by_id(job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found.")
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Job {job_id} not found.")
        self._job_repo.delete(job_id)
