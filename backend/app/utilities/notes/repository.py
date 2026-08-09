"""Note repository — interface and SQLAlchemy implementation."""

from abc import ABC, abstractmethod

from ...extensions import db
from ...models import Note


class INoteRepository(ABC):
    """Abstract interface for note persistence operations."""

    @abstractmethod
    def get_for_job(self, job_id: str) -> list[Note]:
        """Return all notes for the given job, ordered by created_at DESC."""
        ...

    @abstractmethod
    def get_by_id(self, note_id: str) -> Note | None:
        """Return the note with the given id, or None."""
        ...

    @abstractmethod
    def create(self, note: Note) -> Note:
        """Persist a new note and return it with server-generated fields."""
        ...

    @abstractmethod
    def update(self, note: Note) -> Note:
        """Persist changes to an existing note and return the updated record."""
        ...

    @abstractmethod
    def delete(self, note_id: str) -> None:
        """Delete the note."""
        ...


class SQLAlchemyNoteRepository(INoteRepository):
    """SQLAlchemy-backed implementation of INoteRepository."""

    def get_for_job(self, job_id: str) -> list[Note]:
        return (
            Note.query.filter_by(job_id=job_id)
            .order_by(Note.created_at.desc())
            .all()
        )

    def get_by_id(self, note_id: str) -> Note | None:
        return Note.query.filter_by(id=note_id).first()

    def create(self, note: Note) -> Note:
        db.session.add(note)
        db.session.commit()
        db.session.refresh(note)
        return note

    def update(self, note: Note) -> Note:
        db.session.commit()
        db.session.refresh(note)
        return note

    def delete(self, note_id: str) -> None:
        note = Note.query.filter_by(id=note_id).first()
        if note:
            db.session.delete(note)
            db.session.commit()
