"""Thin wrapper around the MinIO Python SDK for PDF blob storage."""

import io
import logging

from minio import Minio
from minio.error import S3Error

logger = logging.getLogger(__name__)


class MinioStorage:
    """S3-compatible blob storage client backed by MinIO.

    Provides simple upload / download operations against a single bucket.
    Connection errors are logged clearly so operators can diagnose issues
    without digging through stack traces.
    """

    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket_name: str,
        use_ssl: bool = False,
        _client=None,
    ):
        self.bucket_name = bucket_name
        if _client is not None:
            # Internal: reuse an existing Minio client (for with_bucket)
            self.client = _client
            return
        try:
            self.client = Minio(
                endpoint,
                access_key=access_key,
                secret_key=secret_key,
                secure=use_ssl,
            )
            logger.info("MinIO client initialised (endpoint=%s, bucket=%s)", endpoint, bucket_name)
        except Exception:
            logger.exception("Failed to create MinIO client for endpoint %s", endpoint)
            raise

    def with_bucket(self, bucket_name: str) -> "MinioStorage":
        """Return a new MinioStorage instance sharing the same client but targeting a different bucket."""
        clone = MinioStorage(
            endpoint="",
            access_key="",
            secret_key="",
            bucket_name=bucket_name,
            _client=self.client,
        )
        return clone

    def ensure_bucket(self) -> None:
        """Create the storage bucket if it does not already exist."""
        try:
            if not self.client.bucket_exists(self.bucket_name):
                try:
                    self.client.make_bucket(self.bucket_name)
                    logger.info("Created MinIO bucket '%s'", self.bucket_name)
                except S3Error as exc:
                    # Handle race condition: another worker may have created it
                    if exc.code == "BucketAlreadyOwnedByYou" or exc.code == "BucketAlreadyExists":
                        logger.info("MinIO bucket '%s' already exists (concurrent creation)", self.bucket_name)
                    else:
                        raise
            else:
                logger.info("MinIO bucket '%s' already exists", self.bucket_name)
        except S3Error:
            logger.exception("S3 error while ensuring bucket '%s' exists", self.bucket_name)
            raise
        except Exception:
            logger.exception("Failed to connect to MinIO while ensuring bucket '%s'", self.bucket_name)
            raise

    def upload(self, object_key: str, data: bytes, content_type: str = "application/pdf") -> None:
        """Upload bytes to the bucket at *object_key*."""
        try:
            stream = io.BytesIO(data)
            self.client.put_object(
                self.bucket_name,
                object_key,
                stream,
                length=len(data),
                content_type=content_type,
            )
            logger.info("Uploaded %d bytes to '%s/%s'", len(data), self.bucket_name, object_key)
        except S3Error:
            logger.exception("S3 error uploading to '%s/%s'", self.bucket_name, object_key)
            raise
        except Exception:
            logger.exception("Failed to upload to MinIO at '%s/%s'", self.bucket_name, object_key)
            raise

    def download(self, object_key: str) -> bytes:
        """Download and return bytes stored at *object_key*."""
        response = None
        try:
            response = self.client.get_object(self.bucket_name, object_key)
            data = response.read()
            logger.info("Downloaded %d bytes from '%s/%s'", len(data), self.bucket_name, object_key)
            return data
        except S3Error:
            logger.exception("S3 error downloading '%s/%s'", self.bucket_name, object_key)
            raise
        except Exception:
            logger.exception("Failed to download from MinIO at '%s/%s'", self.bucket_name, object_key)
            raise
        finally:
            if response is not None:
                response.close()
                response.release_conn()

    def delete(self, object_key: str) -> None:
        """Delete an object from the bucket."""
        try:
            self.client.remove_object(self.bucket_name, object_key)
            logger.info("Deleted '%s/%s'", self.bucket_name, object_key)
        except S3Error:
            logger.exception("S3 error deleting '%s/%s'", self.bucket_name, object_key)
            raise
        except Exception:
            logger.exception("Failed to delete from MinIO at '%s/%s'", self.bucket_name, object_key)
            raise
