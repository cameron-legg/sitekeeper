"""Platform infrastructure migrations.

One-time scripts that set up the platform environment:
- Create the sk_platform database
- Seed tenants from tenants.json
- Migrate nginx to wildcard config

These follow the same runner pattern as infra/storage_migrations/.
"""
