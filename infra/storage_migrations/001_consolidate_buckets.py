"""Storage Migration 001: Consolidate per-tenant buckets.

Previously each tenant had two buckets:
    - <slug>-pdfs   (estimates/, invoices/ objects)
    - <slug>-media  (photos/ objects)

This migration consolidates them into a single bucket per tenant:
    - <slug>        (all objects, keys unchanged)

For the default tenant:
    - sitekeeper-pdfs + sitekeeper-media → sitekeeper

The migration is idempotent:
    - Creates the target bucket if it doesn't exist
    - Copies objects only if they don't already exist in the target
    - Leaves old buckets intact (manual cleanup later)
"""

import logging

from minio.error import S3Error

logger = logging.getLogger("storage_migrations.001")


def _get_new_bucket_name(slug: str, config: dict) -> str:
    """Derive the new unified bucket name for a tenant.

    Uses the 'bucket' field from the NEW tenants.json format if present,
    otherwise falls back to the slug itself (or 'sitekeeper' for default).
    """
    # If tenants.json already has the new single-bucket value, use it
    bucket = config.get("bucket", "")
    # Detect if it's still the OLD format (ends with -pdfs)
    if bucket and not bucket.endswith("-pdfs"):
        return bucket
    # Derive from slug
    if slug == "default":
        return "sitekeeper"
    return slug


def _get_old_pdf_bucket(slug: str, config: dict) -> str:
    """Get the old PDF bucket name."""
    # Check if config still has the old-style bucket name
    bucket = config.get("bucket", "")
    if bucket and bucket.endswith("-pdfs"):
        return bucket
    # Convention
    if slug == "default":
        return "sitekeeper-pdfs"
    return f"{slug}-pdfs"


def _get_old_media_bucket(slug: str, config: dict) -> str:
    """Get the old media bucket name."""
    media = config.get("media_bucket", "")
    if media:
        return media
    if slug == "default":
        return "sitekeeper-media"
    return f"{slug}-media"


def _copy_objects(client, source_bucket: str, target_bucket: str) -> int:
    """Copy all objects from source_bucket to target_bucket.

    Skips objects that already exist in the target (by key name).
    Returns the number of objects copied.
    """
    if not client.bucket_exists(source_bucket):
        logger.info("    Source bucket '%s' does not exist — skipping.", source_bucket)
        return 0

    copied = 0
    skipped = 0

    for obj in client.list_objects(source_bucket, recursive=True):
        key = obj.object_name

        # Check if already exists in target
        try:
            client.stat_object(target_bucket, key)
            skipped += 1
            continue
        except S3Error as e:
            if e.code != "NoSuchKey":
                raise
            # Object doesn't exist in target — proceed to copy

        # Copy from source to target (server-side copy)
        from minio.commonconfig import CopySource
        client.copy_object(
            target_bucket,
            key,
            CopySource(source_bucket, key),
        )
        copied += 1

    logger.info(
        "    %s → %s: %d copied, %d already existed.",
        source_bucket, target_bucket, copied, skipped,
    )
    return copied


def upgrade(client, tenants: dict) -> None:
    """Run the bucket consolidation for all tenants."""
    logger.info("Consolidating per-tenant buckets (2 → 1)...")

    for slug, config in tenants.items():
        new_bucket = _get_new_bucket_name(slug, config)
        old_pdf_bucket = _get_old_pdf_bucket(slug, config)
        old_media_bucket = _get_old_media_bucket(slug, config)

        logger.info("")
        logger.info("  Tenant '%s':", slug)
        logger.info("    Old PDF bucket:   %s", old_pdf_bucket)
        logger.info("    Old media bucket: %s", old_media_bucket)
        logger.info("    New bucket:       %s", new_bucket)

        # If old and new are the same (already migrated or naming collision), skip
        if new_bucket == old_pdf_bucket:
            logger.info("    New bucket == old PDF bucket — already consolidated or naming conflict. Skipping.")
            continue

        # Create target bucket if it doesn't exist
        if not client.bucket_exists(new_bucket):
            client.make_bucket(new_bucket)
            logger.info("    Created bucket '%s'.", new_bucket)
        else:
            logger.info("    Bucket '%s' already exists.", new_bucket)

        # Copy objects from old PDF bucket
        _copy_objects(client, old_pdf_bucket, new_bucket)

        # Copy objects from old media bucket
        _copy_objects(client, old_media_bucket, new_bucket)

    logger.info("")
    logger.info("  Consolidation complete. Old buckets were left intact for manual cleanup.")
    logger.info("  Once verified, you can delete them with:")
    logger.info("    mc rb --force minio/<slug>-pdfs")
    logger.info("    mc rb --force minio/<slug>-media")
