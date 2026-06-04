"""Job photo service — upload, list, and delete photos for jobs.

Photos are stored in a per-tenant media bucket in MinIO. The object key
follows the pattern: photos/<job_id>/<uuid>_<filename>

Access control: any approved user in the tenant can view/upload/delete
photos for any job in the tenant (same shared-access model as all other
resources).
"""

import uuid as uuid_mod

from flask import current_app, g

from ..models import JobPhoto
from ..repositories.job_photo_repo import (
    IJobPhotoRepository,
    SQLAlchemyJobPhotoRepository,
)
from ..repositories.job_repo import IJobRepository, SQLAlchemyJobRepository
from ..repositories.job_site_repo import IJobSiteRepository, SQLAlchemyJobSiteRepository
from ..tenant import get_tenant_config


class NotFoundError(Exception):
    """Raised when a requested resource does not exist."""


class ValidationError(Exception):
    """Raised when input fails validation."""


# Maximum file size: 20 MB
MAX_FILE_SIZE = 20 * 1024 * 1024

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
}


def _get_media_bucket() -> str:
    """Determine the media bucket for the current tenant.

    Convention: <slug>-media (separate from <slug>-pdfs).
    """
    slug = getattr(g, "tenant_slug", "default")
    config = get_tenant_config(slug)
    if config and "media_bucket" in config:
        return config["media_bucket"]
    # Convention: derive from slug
    if slug == "default":
        return "sitekeeper-media"
    return f"{slug}-media"


class JobPhotoService:
    """Business logic for job photo management."""

    def __init__(
        self,
        photo_repo: IJobPhotoRepository | None = None,
        job_repo: IJobRepository | None = None,
        site_repo: IJobSiteRepository | None = None,
    ):
        self._photo_repo = photo_repo or SQLAlchemyJobPhotoRepository()
        self._job_repo = job_repo or SQLAlchemyJobRepository()
        self._site_repo = site_repo or SQLAlchemyJobSiteRepository()

    def _verify_job_access(self, job_id: str, user_id: str):
        """Verify the job exists and user has access (via parent site)."""
        job = self._job_repo.get_by_id(job_id)
        if job is None:
            raise NotFoundError(f"Job {job_id} not found.")
        site = self._site_repo.get_by_id(str(job.job_site_id), user_id)
        if site is None:
            raise NotFoundError(f"Job {job_id} not found.")
        return job

    def _get_storage(self):
        """Get a MinioStorage instance pointing to the tenant's media bucket."""
        storage = current_app.minio_storage
        if storage is None:
            raise RuntimeError("MinIO storage is not available.")
        bucket = _get_media_bucket()
        return storage.with_bucket(bucket), bucket

    def list_photos(self, job_id: str, user_id: str) -> list[JobPhoto]:
        """List all photos for a job."""
        self._verify_job_access(job_id, user_id)
        return self._photo_repo.get_all_for_job(job_id)

    def upload_photo(
        self,
        job_id: str,
        user_id: str,
        file_data: bytes,
        filename: str,
        content_type: str,
    ) -> JobPhoto:
        """Upload a photo to MinIO and create a database record.

        Raises ValidationError for invalid content type or file size.
        Raises NotFoundError if job doesn't exist.
        Raises RuntimeError if MinIO is unavailable.
        """
        self._verify_job_access(job_id, user_id)

        # Validate content type
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValidationError(
                f"Unsupported file type '{content_type}'. "
                f"Allowed: JPEG, PNG, GIF, WebP, HEIC."
            )

        # Validate file size
        if len(file_data) > MAX_FILE_SIZE:
            raise ValidationError(
                f"File too large ({len(file_data) // (1024*1024)}MB). Maximum is 20MB."
            )

        if not filename:
            raise ValidationError("Filename is required.")

        # Generate unique object key
        unique_id = uuid_mod.uuid4().hex[:12]
        safe_filename = filename.replace("/", "_").replace("\\", "_")
        object_key = f"photos/{job_id}/{unique_id}_{safe_filename}"

        # Upload to MinIO
        storage, bucket = self._get_storage()
        storage.ensure_bucket()
        storage.upload(object_key, file_data, content_type=content_type)

        # Create database record
        photo = JobPhoto(
            job_id=job_id,
            uploaded_by=user_id,
            object_key=object_key,
            filename=filename,
            content_type=content_type,
            file_size=len(file_data),
        )
        return self._photo_repo.create(photo)

    def get_photo(self, photo_id: str, user_id: str) -> JobPhoto:
        """Get a single photo record, verifying access."""
        photo = self._photo_repo.get_by_id(photo_id)
        if photo is None:
            raise NotFoundError(f"Photo {photo_id} not found.")
        self._verify_job_access(str(photo.job_id), user_id)
        return photo

    def download_photo(self, photo_id: str, user_id: str) -> tuple[bytes, str, str]:
        """Download photo bytes from MinIO.

        Returns (data, filename, content_type).
        """
        photo = self.get_photo(photo_id, user_id)
        storage, _ = self._get_storage()
        data = storage.download(photo.object_key)
        return data, photo.filename, photo.content_type

    def delete_photo(self, photo_id: str, user_id: str) -> None:
        """Delete a photo from both MinIO and the database."""
        photo = self._photo_repo.get_by_id(photo_id)
        if photo is None:
            raise NotFoundError(f"Photo {photo_id} not found.")
        self._verify_job_access(str(photo.job_id), user_id)

        # Delete from MinIO (best effort — don't block DB delete on storage failure)
        try:
            storage, _ = self._get_storage()
            storage.delete(photo.object_key)
        except Exception:
            import logging
            logging.getLogger(__name__).warning(
                "Failed to delete photo from MinIO: %s", photo.object_key
            )

        # Delete from database
        self._photo_repo.delete(photo_id)
