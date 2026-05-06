#!/bin/bash
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting gunicorn..."
exec gunicorn "app:create_app()" \
    --bind 0.0.0.0:5000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
