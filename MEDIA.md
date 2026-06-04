# Media Uploads — Job Photos

SiteKeeper supports photo uploads on a per-job basis. Users can attach multiple photos to any job for documentation (e.g. before/after shots, progress photos, damage records).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Expo)                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  MediaTab (in JobDetailScreen)                │  │
│  │  - expo-image-picker for cross-platform       │  │
│  │  - Grid view of photo thumbnails              │  │
│  │  - Full-screen viewer with delete option      │  │
│  │  - Multipart upload via Axios FormData        │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Backend: /api/v1/jobs/<id>/photos                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  job_photos_bp.py (blueprint)                 │  │
│  │  - Handles multipart/form-data upload         │  │
│  │  - Serves binary photo downloads              │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  job_photo_service.py (service)               │  │
│  │  - Validates file type & size                 │  │
│  │  - Generates unique object keys               │  │
│  │  - Stores in per-tenant media bucket          │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  job_photo_repo.py (repository)               │  │
│  │  - CRUD on job_photos table                   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  MinIO (S3-compatible object storage)                │
│  - Per-tenant media buckets (separate from PDFs)    │
│  - Object key: photos/<job_id>/<uuid>_<filename>    │
└─────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/models.py` | `JobPhoto` model |
| `backend/app/repositories/job_photo_repo.py` | Database CRUD for photos |
| `backend/app/services/job_photo_service.py` | Upload/download/delete logic, validation |
| `backend/app/blueprints/job_photos_bp.py` | REST endpoints |
| `backend/migrations/versions/016_job_photos.py` | Database migration |
| `frontend/src/components/MediaTab.tsx` | Photo grid UI + viewer + upload |
| `frontend/src/api/hooks/usePhotos.ts` | TanStack Query hooks |
| `frontend/src/api/types.ts` | `JobPhoto` TypeScript interface |
| `infra/migrate-minio-media-buckets.sh` | One-time MinIO bucket creation |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/jobs/<job_id>/photos` | List all photos for a job |
| `POST` | `/api/v1/jobs/<job_id>/photos` | Upload a photo (multipart/form-data) |
| `GET` | `/api/v1/photos/<photo_id>` | Download photo binary |
| `DELETE` | `/api/v1/photos/<photo_id>` | Delete a photo |

### Upload Request

```
POST /api/v1/jobs/<job_id>/photos
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <binary image data>
```

### Upload Response

```json
{
  "id": "uuid",
  "job_id": "uuid",
  "uploaded_by": "uuid",
  "filename": "photo.jpg",
  "content_type": "image/jpeg",
  "file_size": 1234567,
  "created_at": "2026-06-03T12:00:00+00:00"
}
```

## Storage Layout

### MinIO Buckets

Each tenant gets two buckets:

| Bucket | Purpose |
|--------|---------|
| `<slug>-pdfs` | Generated PDF documents (estimates, invoices) |
| `<slug>-media` | User-uploaded media files (photos) |

For the default tenant: `sitekeeper-pdfs` and `sitekeeper-media`.

### Object Key Format

```
photos/<job_id>/<12-char-uuid>_<original-filename>
```

Example: `photos/a1b2c3d4-e5f6-7890-abcd-ef1234567890/3f8a9b2c1d4e_exterior-damage.jpg`

## Constraints

| Rule | Value |
|------|-------|
| Max file size | 20 MB |
| Allowed types | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/heic`, `image/heif` |
| Access control | Any approved tenant user can view/upload/delete |
| Cascade delete | Deleting a job deletes all its photos (DB + best-effort MinIO cleanup) |

## Deployment

### First-time setup (after merging)

After deploying the code, the deploy script automatically creates all MinIO buckets. You can also run it manually:

```bash
# Creates ALL buckets (PDFs + media) for ALL tenants — idempotent:
ssh awspantrypix "sudo -u sitekeeper bash /home/sitekeeper/app/infra/init-minio-buckets.sh"
```

### Starting from scratch

If you ever wipe the MinIO volume and need to recreate everything:

```bash
docker compose up -d              # start MinIO container
./infra/init-minio-buckets.sh     # recreate all buckets for all tenants
```

The `init-minio-buckets.sh` script:
1. Reads all tenants from `tenants.json`
2. Creates both `<slug>-pdfs` and `<slug>-media` buckets for each
3. Also creates the default bucket from `MINIO_BUCKET_NAME` env var
4. Retries for up to 30 seconds if MinIO is still starting
5. Is fully idempotent (safe to run any time)

### New tenants

The `./tenant.sh create` command automatically creates both the PDF and media buckets for new tenants.

## Cross-Platform Notes

- **iOS/Android**: Uses `expo-image-picker` for native photo library access with proper permissions
- **Web**: Uses the browser's file input via `expo-image-picker` (works seamlessly)
- **Image display**: Uses `<Image>` with auth headers for authenticated image loading on all platforms
- **Multi-select**: Users can select multiple photos at once for batch upload

## Future Expansion

This architecture is designed to support additional media types in the future:
- Videos (increase file size limit, add video MIME types)
- Documents (PDFs, blueprints)
- Audio recordings

The `content_type` field and flexible object key structure make it straightforward to extend.
