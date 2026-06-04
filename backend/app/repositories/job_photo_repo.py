"""Job photo repository — interface and SQLAlchemy implementation."""

from abc import ABC, abstractmethod

from ..extensions import db
from ..models import JobPhoto


class IJobPhotoRepository(ABC):
    """Abstract interface for job photo persistence operations."""

    @abstractmethod
    def get_all_for_job(self, job_id: str) -> list[JobPhoto]:
        """Return all photos belonging to the given job, newest first."""
        ...

    @abstractmethod
    def get_by_id(self, photo_id: str) -> JobPhoto | None:
        """Return a single photo by id, or None."""
        ...

    @abstractmethod
    def create(self, photo: JobPhoto) -> JobPhoto:
        """Persist a new photo record."""
        ...

    @abstractmethod
    def delete(self, photo_id: str) -> None:
        """Delete a photo record by id."""
        ...


class SQLAlchemyJobPhotoRepository(IJobPhotoRepository):
    """SQLAlchemy-backed implementation of IJobPhotoRepository."""

    def get_all_for_job(self, job_id: str) -> list[JobPhoto]:
        return (
            JobPhoto.query.filter_by(job_id=job_id)
            .order_by(JobPhoto.created_at.desc())
            .all()
        )

    def get_by_id(self, photo_id: str) -> JobPhoto | None:
        return JobPhoto.query.filter_by(id=photo_id).first()

    def create(self, photo: JobPhoto) -> JobPhoto:
        db.session.add(photo)
        db.session.commit()
        db.session.refresh(photo)
        return photo

    def delete(self, photo_id: str) -> None:
        photo = JobPhoto.query.filter_by(id=photo_id).first()
        if photo:
            db.session.delete(photo)
            db.session.commit()
