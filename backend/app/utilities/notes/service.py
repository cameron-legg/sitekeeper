"""Note service — CRUD with timestamp management."""

from datetime import datetime, timezone

from ...models import Note
from ...core.repositories.job_repo import IJobRepository, SQLAlchemyJobRepository
from ...core.repositories.job_site_repo import IJobSiteRepository, SQLAlchemyJobSiteRepository
from .repository import INoteRepository, SQLAlchemyNoteRepository


class NotFoundError(Exception):
    """Raised when a requested resource does not exist or is not accessible."""


class NoteService:
    """Business logic for note management."""

    def __init__(
        self,
        note_repo: INoteRepository | None = None,
        job_repo: IJobRepository | None = None,
        site_repo: IJobSiteRepository | None = None,
    ):
        self._note_repo = note_repo or SQLAlchemyNoteRepository()
        self._job_repo = job_repo or SQLAlchemyJobRepository()
        self._site_repo = site_repo or SQLAlchemyJobSiteRepository()

    def _verify_job_access(self, job_id: str, user_id: str):
        """Raise NotFoundError if the job doesn't exist or isn't accessible."""
        job = self._job_repo.get_by_id(job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found.")
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Job {job_id} not found.")
        return job

    def list_for_job(self, job_id: str, user_id: str) -> list[Note]:
        """Return all notes for the job, ordered by created_at DESC."""
        self._verify_job_access(job_id, user_id)
        return self._note_repo.get_for_job(job_id)

    def get(self, note_id: str, job_id: str, user_id: str) -> Note:
        """Return the note, verifying it belongs to the given job and user."""
        self._verify_job_access(job_id, user_id)
        note = self._note_repo.get_by_id(note_id)
        if note is None or str(note.job_id) != job_id:
            raise NotFoundError(f"Note {note_id} not found.")
        return note

    def create(self, job_id: str, user_id: str, body: str) -> Note:
        """Create and persist a new note on the given job."""
        self._verify_job_access(job_id, user_id)
        note = Note(job_id=job_id, body=body)
        return self._note_repo.create(note)

    def update(self, note_id: str, job_id: str, user_id: str, body: str) -> Note:
        """Update the note body and refresh updated_at."""
        self._verify_job_access(job_id, user_id)
        note = self._note_repo.get_by_id(note_id)
        if note is None or str(note.job_id) != job_id:
            raise NotFoundError(f"Note {note_id} not found.")
        note.body = body
        note.updated_at = datetime.now(tz=timezone.utc)
        return self._note_repo.update(note)

    def delete(self, note_id: str, job_id: str, user_id: str) -> None:
        """Delete the note."""
        self._verify_job_access(job_id, user_id)
        note = self._note_repo.get_by_id(note_id)
        if note is None or str(note.job_id) != job_id:
            raise NotFoundError(f"Note {note_id} not found.")
        self._note_repo.delete(note_id)
