"""Storage migrations framework for MinIO bucket operations.

Analogous to Alembic for database schema, this framework manages numbered,
idempotent migrations for object storage (bucket creation, object relocation,
key restructuring, etc.).

Migrations are discovered from this package directory and executed in order.
Applied state is tracked in a JSON file on the server.
"""
