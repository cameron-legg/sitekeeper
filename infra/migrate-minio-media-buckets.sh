#!/usr/bin/env bash
# migrate-minio-media-buckets.sh
#
# Creates per-tenant media buckets in MinIO for photo/file uploads.
# Safe to run multiple times — skips buckets that already exist.
#
# This does NOT modify or remove existing PDF buckets.
#
# Usage (local dev):
#   ./infra/migrate-minio-media-buckets.sh
#
# Usage (production — run on server):
#   ssh awspantrypix "sudo -u sitekeeper bash /home/sitekeeper/app/infra/migrate-minio-media-buckets.sh"
#
# Requirements:
#   - mc (MinIO Client) must be installed: https://min.io/docs/minio/linux/reference/minio-mc.html
#   - Or: Python with the minio package installed
#
# This script uses the Python minio SDK (already in the backend venv) for portability.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Determine which Python to use
if [ -f "$PROJECT_ROOT/backend/venv/bin/python" ]; then
    PYTHON="$PROJECT_ROOT/backend/venv/bin/python"
else
    PYTHON="python3"
fi

echo "=== MinIO Media Bucket Migration ==="
echo "Using Python: $PYTHON"
echo ""

$PYTHON -c "
import json
import os
import sys

# Load environment
from dotenv import load_dotenv
load_dotenv(os.path.join('$PROJECT_ROOT', 'backend', '.env'))

from minio import Minio
from minio.error import S3Error

endpoint = os.environ.get('MINIO_ENDPOINT', 'localhost:9000')
access_key = os.environ.get('MINIO_ACCESS_KEY', 'minioadmin')
secret_key = os.environ.get('MINIO_SECRET_KEY', 'minioadmin')
use_ssl = os.environ.get('MINIO_USE_SSL', 'false').lower() == 'true'

print(f'Connecting to MinIO at {endpoint} (ssl={use_ssl})')

client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=use_ssl)

# Load tenants
tenants_file = os.environ.get(
    'TENANTS_FILE',
    os.path.join('$PROJECT_ROOT', 'backend', 'tenants.json')
)

with open(tenants_file) as f:
    tenants = json.load(f)

print(f'Loaded {len(tenants)} tenant(s) from {tenants_file}')
print()

# Create media buckets
for slug, config in tenants.items():
    media_bucket = config.get('media_bucket')
    if not media_bucket:
        # Derive from convention
        media_bucket = f'{slug}-media' if slug != 'default' else 'sitekeeper-media'

    try:
        if client.bucket_exists(media_bucket):
            print(f'  ✓ Bucket \"{media_bucket}\" already exists (skipped)')
        else:
            client.make_bucket(media_bucket)
            print(f'  ✓ Created bucket \"{media_bucket}\" for tenant \"{slug}\"')
    except S3Error as e:
        if e.code in ('BucketAlreadyOwnedByYou', 'BucketAlreadyExists'):
            print(f'  ✓ Bucket \"{media_bucket}\" already exists (race condition, ok)')
        else:
            print(f'  ✗ FAILED to create bucket \"{media_bucket}\": {e}', file=sys.stderr)
            sys.exit(1)

print()
print('=== Migration complete. Existing PDF buckets were NOT modified. ===')

# List all buckets for verification
print()
print('Current buckets:')
for b in client.list_buckets():
    print(f'  - {b.name} (created {b.creation_date})')
"

echo ""
echo "Done."
