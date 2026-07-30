"""Tests for tenant resolution — unit tests for slug extraction logic.

These test the pure logic of resolve_tenant_slug without needing a database.
"""

import pytest
from unittest.mock import patch

from app.tenant import resolve_tenant_slug, get_tenant_bucket, get_tenant_database_url


class TestResolveTenantSlug:
    """Test tenant slug resolution from Host header."""

    def test_localhost_returns_default(self, app):
        """localhost resolves to the default tenant."""
        with app.test_request_context(headers={"Host": "localhost:5000"}):
            slug = resolve_tenant_slug()
            assert slug == "default"

    def test_localhost_without_port(self, app):
        """localhost without port resolves to default."""
        with app.test_request_context(headers={"Host": "localhost"}):
            slug = resolve_tenant_slug()
            assert slug == "default"

    def test_127_0_0_1_returns_default(self, app):
        """127.0.0.1 resolves to default tenant."""
        with app.test_request_context(headers={"Host": "127.0.0.1:5000"}):
            slug = resolve_tenant_slug()
            assert slug == "default"

    def test_ip_address_returns_default(self, app):
        """IP addresses (LAN) resolve to default tenant."""
        with app.test_request_context(headers={"Host": "192.168.1.100:5000"}):
            slug = resolve_tenant_slug()
            assert slug == "default"

    def test_bare_domain_returns_default(self, app):
        """Bare domain (entouch.org) resolves to default."""
        with app.test_request_context(headers={"Host": "entouch.org"}):
            slug = resolve_tenant_slug()
            assert slug == "default"

    def test_www_returns_default(self, app):
        """www.entouch.org resolves to default (www is not a tenant)."""
        with app.test_request_context(headers={"Host": "www.entouch.org"}):
            slug = resolve_tenant_slug()
            assert slug == "default"

    def test_subdomain_extracts_slug(self, app):
        """subdomain.entouch.org extracts the subdomain as slug."""
        with app.test_request_context(headers={"Host": "nocoresources.entouch.org"}):
            slug = resolve_tenant_slug()
            assert slug == "nocoresources"

    def test_subdomain_with_port(self, app):
        """subdomain.entouch.org:443 still extracts correctly."""
        with app.test_request_context(headers={"Host": "mycompany.entouch.org:443"}):
            slug = resolve_tenant_slug()
            assert slug == "mycompany"

    def test_deep_subdomain(self, app):
        """a.b.entouch.org takes first part."""
        with app.test_request_context(headers={"Host": "sub.tenant.entouch.org"}):
            slug = resolve_tenant_slug()
            assert slug == "sub"

    def test_10_x_ip_returns_default(self, app):
        """10.0.0.5 resolves to default."""
        with app.test_request_context(headers={"Host": "10.0.0.5:5000"}):
            slug = resolve_tenant_slug()
            assert slug == "default"


class TestGetTenantBucket:
    """Test bucket name generation."""

    def test_default_tenant_bucket(self):
        """Default tenant should use the app's configured bucket."""
        # When no config exists for a slug, it falls back to convention
        bucket = get_tenant_bucket("someclient")
        assert bucket == "someclient-pdfs"

    def test_bucket_from_config(self):
        """Bucket from tenants.json config takes precedence."""
        with patch("app.tenant._load_tenants", return_value={
            "mycompany": {"bucket": "custom-bucket", "database_url": "..."}
        }):
            bucket = get_tenant_bucket("mycompany")
            assert bucket == "custom-bucket"


class TestGetTenantDatabaseUrl:
    """Test database URL resolution."""

    def test_default_tenant_returns_none(self):
        """Default tenant returns None (uses app config)."""
        url = get_tenant_database_url("default")
        assert url is None

    def test_unknown_tenant_uses_convention(self):
        """Unknown tenant builds URL from BASE_DATABASE_URL + sk_<slug>."""
        with patch("app.tenant._load_tenants", return_value={}):
            url = get_tenant_database_url("newclient")
            assert url.endswith("/sk_newclient")

    def test_known_tenant_uses_config(self):
        """Known tenant uses the database_url from tenants.json."""
        with patch("app.tenant._load_tenants", return_value={
            "mycompany": {"database_url": "postgresql://user:pass@host/mydb"}
        }):
            url = get_tenant_database_url("mycompany")
            assert url == "postgresql://user:pass@host/mydb"
