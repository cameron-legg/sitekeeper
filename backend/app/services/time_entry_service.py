"""Time entry service — clock in/out and manual hour logging."""

from datetime import datetime, timezone
from decimal import Decimal

from ..models import TimeEntry
from ..repositories.time_entry_repo import (
    ITimeEntryRepository,
    SQLAlchemyTimeEntryRepository,
)


class NotFoundError(Exception):
    pass


class ValidationError(Exception):
    pass


class TimeEntryService:
    """Business logic for time tracking on jobs."""

    def __init__(self, repo: ITimeEntryRepository | None = None):
        self._repo = repo or SQLAlchemyTimeEntryRepository()

    def list_for_job(self, job_id: str) -> list[TimeEntry]:
        """Return all time entries for a job."""
        return self._repo.get_all_for_job(job_id)

    def get(self, entry_id: str) -> TimeEntry:
        entry = self._repo.get_by_id(entry_id)
        if entry is None:
            raise NotFoundError(f"Time entry {entry_id} not found.")
        return entry

    def clock_in(self, job_id: str, user_id: str, note: str | None = None) -> TimeEntry:
        """Clock in the user on the given job.

        Raises ValidationError if the user already has an open clock-in on this job.
        """
        existing = self._repo.get_active_for_user_and_job(user_id, job_id)
        if existing is not None:
            raise ValidationError("You are already clocked in on this job.")

        entry = TimeEntry(
            job_id=job_id,
            user_id=user_id,
            clock_in=datetime.now(tz=timezone.utc),
            note=note,
        )
        return self._repo.create(entry)

    def clock_out(self, job_id: str, user_id: str) -> TimeEntry:
        """Clock out the user on the given job.

        Automatically computes hours from clock_in to now.
        Raises ValidationError if the user is not currently clocked in.
        """
        entry = self._repo.get_active_for_user_and_job(user_id, job_id)
        if entry is None:
            raise ValidationError("You are not currently clocked in on this job.")

        now = datetime.now(tz=timezone.utc)
        entry.clock_out = now

        # Compute hours as decimal
        delta = now - entry.clock_in
        total_seconds = delta.total_seconds()
        entry.hours = Decimal(str(round(total_seconds / 3600, 4)))

        return self._repo.update(entry)

    def add_manual(
        self, job_id: str, user_id: str, hours: Decimal,
        note: str | None = None, worked_at: datetime | None = None,
    ) -> TimeEntry:
        """Add a manual time entry (no clock in/out, just hours).

        If worked_at is not provided, defaults to now (UTC).
        """
        if hours <= 0:
            raise ValidationError("Hours must be greater than zero.")

        entry = TimeEntry(
            job_id=job_id,
            user_id=user_id,
            hours=hours,
            worked_at=worked_at or datetime.now(tz=timezone.utc),
            note=note,
        )
        return self._repo.create(entry)

    def delete(self, entry_id: str, user_id: str) -> None:
        """Delete a time entry. Users can only delete their own entries."""
        entry = self._repo.get_by_id(entry_id)
        if entry is None:
            raise NotFoundError(f"Time entry {entry_id} not found.")
        if str(entry.user_id) != user_id:
            raise ValidationError("You can only delete your own time entries.")
        self._repo.delete(entry_id)
