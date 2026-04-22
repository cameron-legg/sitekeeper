"""Job repository — interface and SQLAlchemy implementation."""

from abc import ABC, abstractmethod

from ..extensions import db
from ..models import Job


class IJobRepository(ABC):
    """Abstract interface for job persistence operations."""

    @abstractmethod
    def get_all_for_site(self, site_id: str) -> list[Job]:
        """Return all jobs belonging to the given job site."""
        ...

    @abstractmethod
    def get_by_id(self, job_id: str) -> Job | None:
        """Return the job with the given id, or None if not found."""
        ...

    @abstractmethod
    def create(self, job: Job) -> Job:
        """Persist a new job and return it with server-generated fields."""
        ...

    @abstractmethod
    def update(self, job: Job) -> Job:
        """Persist changes to an existing job and return the updated record."""
        ...

    @abstractmethod
    def delete(self, job_id: str) -> None:
        """Delete the job (and cascade to all children)."""
        ...

    @abstractmethod
    def count_for_site(self, site_id: str) -> int:
        """Return the number of jobs in the given job site."""
        ...


class SQLAlchemyJobRepository(IJobRepository):
    """SQLAlchemy-backed implementation of IJobRepository."""

    def get_all_for_site(self, site_id: str) -> list[Job]:
        return (
            Job.query.filter_by(job_site_id=site_id)
            .order_by(Job.created_at.desc())
            .all()
        )

    def get_by_id(self, job_id: str) -> Job | None:
        return Job.query.filter_by(id=job_id).first()

    def create(self, job: Job) -> Job:
        db.session.add(job)
        db.session.commit()
        db.session.refresh(job)
        return job

    def update(self, job: Job) -> Job:
        db.session.commit()
        db.session.refresh(job)
        return job

    def delete(self, job_id: str) -> None:
        job = Job.query.filter_by(id=job_id).first()
        if job:
            db.session.delete(job)
            db.session.commit()

    def count_for_site(self, site_id: str) -> int:
        return Job.query.filter_by(job_site_id=site_id).count()
