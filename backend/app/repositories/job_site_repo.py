"""Job site repository — interface and SQLAlchemy implementation."""

from abc import ABC, abstractmethod

from sqlalchemy import func

from ..extensions import db
from ..models import Job, JobSite


class IJobSiteRepository(ABC):
    """Abstract interface for job site persistence operations."""

    @abstractmethod
    def get_all_for_user(self, user_id: str) -> list[JobSite]:
        """Return all job sites owned by the given user."""
        ...

    @abstractmethod
    def get_by_id(self, site_id: str, user_id: str) -> JobSite | None:
        """Return the job site with the given id if it belongs to user_id."""
        ...

    @abstractmethod
    def create(self, site: JobSite) -> JobSite:
        """Persist a new job site and return it with server-generated fields."""
        ...

    @abstractmethod
    def update(self, site: JobSite) -> JobSite:
        """Persist changes to an existing job site and return the updated record."""
        ...

    @abstractmethod
    def delete(self, site_id: str, user_id: str) -> None:
        """Delete the job site (and cascade to all children) if owned by user."""
        ...

    @abstractmethod
    def count_jobs(self, site_id: str) -> int:
        """Return the number of jobs associated with the given job site."""
        ...


class SQLAlchemyJobSiteRepository(IJobSiteRepository):
    """SQLAlchemy-backed implementation of IJobSiteRepository."""

    def get_all_for_user(self, user_id: str) -> list[JobSite]:
        return (
            JobSite.query.filter_by(user_id=user_id)
            .order_by(JobSite.created_at.desc())
            .all()
        )

    def get_by_id(self, site_id: str, user_id: str) -> JobSite | None:
        return JobSite.query.filter_by(id=site_id, user_id=user_id).first()

    def create(self, site: JobSite) -> JobSite:
        db.session.add(site)
        db.session.commit()
        db.session.refresh(site)
        return site

    def update(self, site: JobSite) -> JobSite:
        db.session.commit()
        db.session.refresh(site)
        return site

    def delete(self, site_id: str, user_id: str) -> None:
        site = JobSite.query.filter_by(id=site_id, user_id=user_id).first()
        if site:
            db.session.delete(site)
            db.session.commit()

    def count_jobs(self, site_id: str) -> int:
        return Job.query.filter_by(job_site_id=site_id).count()
