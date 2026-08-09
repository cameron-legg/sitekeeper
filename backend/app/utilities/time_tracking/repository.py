"""Time entry repository — interface and SQLAlchemy implementation."""

from abc import ABC, abstractmethod

from ...extensions import db
from ...models import TimeEntry


class ITimeEntryRepository(ABC):
    """Abstract interface for time entry persistence operations."""

    @abstractmethod
    def get_all_for_job(self, job_id: str) -> list[TimeEntry]:
        ...

    @abstractmethod
    def get_by_id(self, entry_id: str) -> TimeEntry | None:
        ...

    @abstractmethod
    def get_active_for_user_and_job(self, user_id: str, job_id: str) -> TimeEntry | None:
        """Return the open (clocked-in, not clocked-out) entry for a user on a job."""
        ...

    @abstractmethod
    def create(self, entry: TimeEntry) -> TimeEntry:
        ...

    @abstractmethod
    def update(self, entry: TimeEntry) -> TimeEntry:
        ...

    @abstractmethod
    def delete(self, entry_id: str) -> None:
        ...


class SQLAlchemyTimeEntryRepository(ITimeEntryRepository):
    """SQLAlchemy-backed implementation of ITimeEntryRepository."""

    def get_all_for_job(self, job_id: str) -> list[TimeEntry]:
        return (
            TimeEntry.query.filter_by(job_id=job_id)
            .order_by(TimeEntry.created_at.desc())
            .all()
        )

    def get_by_id(self, entry_id: str) -> TimeEntry | None:
        return TimeEntry.query.filter_by(id=entry_id).first()

    def get_active_for_user_and_job(self, user_id: str, job_id: str) -> TimeEntry | None:
        return (
            TimeEntry.query.filter_by(
                user_id=user_id, job_id=job_id, clock_out=None
            )
            .filter(TimeEntry.clock_in.isnot(None))
            .first()
        )

    def create(self, entry: TimeEntry) -> TimeEntry:
        db.session.add(entry)
        db.session.commit()
        db.session.refresh(entry)
        return entry

    def update(self, entry: TimeEntry) -> TimeEntry:
        db.session.commit()
        db.session.refresh(entry)
        return entry

    def delete(self, entry_id: str) -> None:
        entry = TimeEntry.query.filter_by(id=entry_id).first()
        if entry:
            db.session.delete(entry)
            db.session.commit()
