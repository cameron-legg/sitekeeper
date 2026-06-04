#!/usr/bin/env bash
# init-minio-buckets.sh
#
# Creates ALL MinIO buckets for ALL tenants (both PDF and media).
# Safe to run multiple times — skips existing buckets.
#
# Use this to bootstrap MinIO from scratch (fresh volume) or to ensure
# all expected buckets exist after adding a new tenant manually.
#
# Usage (local dev — after `docker compose up -d`):
#   ./infra/init-minio-buckets.sh
#
# Usage (production):
#   ssh awspantrypix "sudo -u sitekeeper bash /home/sitekeeper/app/infra/init-minio-buckets.sh"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Determine which Python to use
if [ -f "$PROJECT_ROOT/backend/venv/bin/python" ]; then
    PYTHON="$PROJECT_ROOT/backend/venv/bin/python"
else
    PYTHON="python3"
fi

echo "=== MinIO Bucket Initialisation ==="
echo "Using Python: $PYTHON"
echo ""

$PYTHON -c "
import json
import os
import sys
import time

from dotenv import load_dotenv
load_dotenv(os.path.join('$PROJECT_ROOT', 'backend', '.env'))

from minio import Minio
from minio.error import S3Error

endpoint = os.environ.get('MINIO_ENDPOINT', 'localhost:9000')
access_key = os.environ.get('MINIO_ACCESS_KEY', 'minioadmin')
secret_key = os.environ.get('MINIO_SECRET_KEY', 'minioadmin')
use_ssl = os.environ.get('MINIO_USE_SSL', 'false').lower() == 'true'

print(f'Connecting to MinIO at {endpoint} (ssl={use_ssl})')

# Retry connection up to 30 seconds (MinIO may still be starting)
client = None
for attempt in range(15):
    try:
        client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=use_ssl)
        client.list_buckets()  # test connectivity
        break
    except Exception as e:
        if attempt < 14:
            print(f'  Waiting for MinIO... (attempt {attempt + 1}/15)')
            time.sleep(2)
        else:
            print(f'ERROR: Cannot connect to MinIO at {endpoint}: {e}', file=sys.stderr)
            sys.exit(1)

# Load tenants
tenants_file = os.environ.get(
    'TENANTS_FILE',
    os.path.join('$PROJECT_ROOT', 'backend', 'tenants.json')
)

with open(tenants_file) as f:
    tenants = json.load(f)

print(f'Loaded {len(tenants)} tenant(s) from {tenants_file}')
print()

# Collect all buckets that should exist
buckets_to_create = set()

for slug, config in tenants.items():
    # PDF bucket
    pdf_bucket = config.get('bucket')
    if not pdf_bucket:
        pdf_bucket = f'{slug}-pdfs' if slug != 'default' else 'sitekeeper-pdfs'
    buckets_to_create.add(pdf_bucket)

    # Media bucket
    media_bucket = config.get('media_bucket')
    if not media_bucket:
        media_bucket = f'{slug}-media' if slug != 'default' else 'sitekeeper-media'
    buckets_to_create.add(media_bucket)

# Also ensure the default bucket from env (MINIO_BUCKET_NAME)
default_bucket = os.environ.get('MINIO_BUCKET_NAME', 'sitekeeper-pdfs')
buckets_to_create.add(default_bucket)

print(f'Ensuring {len(buckets_to_create)} bucket(s) exist:')

for bucket in sorted(buckets_to_create):
    try:
        if client.bucket_exists(bucket):
            print(f'  ✓ {bucket} (exists)')
        else:
            client.make_bucket(bucket)
            print(f'  ✓ {bucket} (created)')
    except S3Error as e:
        if e.code in ('BucketAlreadyOwnedByYou', 'BucketAlreadyExists'):
            print(f'  ✓ {bucket} (exists, race condition)')
        else:
            print(f'  ✗ {bucket} FAILED: {e}', file=sys.stderr)
            sys.exit(1)

print()
print('=== All buckets ready. ===')
"

echo ""
echo "Done."
