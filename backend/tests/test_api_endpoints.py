"""Integration tests for key API endpoints.

Tests the full HTTP request/response cycle including auth, serialization,
and error handling.
"""

import json

import pytest


class TestAuthEndpoints:
    """Test /api/v1/auth/* endpoints."""

    def test_register_success(self, client, app_context, db_session):
        """POST /api/v1/auth/register succeeds with valid data."""
        resp = client.post("/api/v1/auth/register", json={
            "email": "new@example.com",
            "password": "securepass123",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert "token" in data
        assert "user_id" in data
        assert data["role"] == "admin"  # first user

    def test_register_invalid_email(self, client, app_context, db_session):
        """Registration with invalid email returns 400."""
        resp = client.post("/api/v1/auth/register", json={
            "email": "not-valid",
            "password": "password123",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"]["code"] == "INVALID_EMAIL"

    def test_register_duplicate_email(self, client, app_context, db_session):
        """Registration with existing email returns 409."""
        client.post("/api/v1/auth/register", json={
            "email": "dupe@example.com",
            "password": "password123",
        })
        resp = client.post("/api/v1/auth/register", json={
            "email": "dupe@example.com",
            "password": "password456",
        })
        assert resp.status_code == 409
        data = resp.get_json()
        assert data["error"]["code"] == "EMAIL_IN_USE"

    def test_login_success(self, client, app_context, db_session):
        """POST /api/v1/auth/login succeeds with correct credentials."""
        client.post("/api/v1/auth/register", json={
            "email": "login@example.com",
            "password": "mypassword",
        })
        resp = client.post("/api/v1/auth/login", json={
            "email": "login@example.com",
            "password": "mypassword",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert "token" in data

    def test_login_wrong_password(self, client, app_context, db_session):
        """Login with wrong password returns 401."""
        client.post("/api/v1/auth/register", json={
            "email": "wrong@example.com",
            "password": "correctpass",
        })
        resp = client.post("/api/v1/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass",
        })
        assert resp.status_code == 401
        data = resp.get_json()
        assert data["error"]["code"] == "INVALID_CREDENTIALS"


class TestProtectedEndpoints:
    """Test that auth is required for protected endpoints."""

    def test_job_sites_requires_auth(self, client, app_context, db_session):
        """GET /api/v1/job-sites without token returns 401."""
        resp = client.get("/api/v1/job-sites")
        assert resp.status_code == 401

    def test_job_sites_with_invalid_token(self, client, app_context, db_session):
        """Invalid token returns 401."""
        resp = client.get("/api/v1/job-sites", headers={
            "Authorization": "Bearer invalid.token.here",
        })
        assert resp.status_code == 401

    def test_unapproved_user_gets_403(self, client, app, db_session, create_user):
        """Pending (unapproved) user gets 403 on protected endpoints."""
        from app.shared_auth import issue_token
        pending = create_user(email="pending@test.com", role="member", is_approved=False)

        with app.app_context():
            token = issue_token(str(pending.id))

        resp = client.get("/api/v1/job-sites", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 403
        data = resp.get_json()
        assert data["error"]["code"] == "NOT_APPROVED"


class TestJobSiteEndpoints:
    """Test /api/v1/job-sites endpoints."""

    def _get_auth(self, client):
        """Register and return token."""
        resp = client.post("/api/v1/auth/register", json={
            "email": f"user-{id(self)}@example.com",
            "password": "password123",
        })
        return resp.get_json()["token"]

    def test_create_job_site(self, client, app_context, db_session):
        """POST /api/v1/job-sites creates a site."""
        token = self._get_auth(client)
        resp = client.post("/api/v1/job-sites", json={
            "name": "Test Site",
            "address": "123 Main St",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["name"] == "Test Site"
        assert "id" in data

    def test_list_job_sites(self, client, app_context, db_session):
        """GET /api/v1/job-sites returns user's sites."""
        token = self._get_auth(client)
        headers = {"Authorization": f"Bearer {token}"}
        # Create two sites
        client.post("/api/v1/job-sites", json={"name": "Site A"}, headers=headers)
        client.post("/api/v1/job-sites", json={"name": "Site B"}, headers=headers)

        resp = client.get("/api/v1/job-sites", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2

    def test_delete_job_site(self, client, app_context, db_session):
        """DELETE /api/v1/job-sites/:id removes the site."""
        token = self._get_auth(client)
        headers = {"Authorization": f"Bearer {token}"}
        create_resp = client.post("/api/v1/job-sites", json={"name": "To Delete"}, headers=headers)
        site_id = create_resp.get_json()["id"]

        resp = client.delete(f"/api/v1/job-sites/{site_id}", headers=headers)
        assert resp.status_code == 204


class TestJobEndpoints:
    """Test /api/v1/job-sites/:id/jobs endpoints."""

    def _setup(self, client):
        """Register, create a site, return (token, site_id)."""
        resp = client.post("/api/v1/auth/register", json={
            "email": f"jobs-{id(self)}@example.com",
            "password": "password123",
        })
        token = resp.get_json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        site_resp = client.post("/api/v1/job-sites", json={"name": "Job Test Site"}, headers=headers)
        site_id = site_resp.get_json()["id"]
        return token, site_id

    def test_create_job(self, client, app_context, db_session):
        """POST /api/v1/job-sites/:id/jobs creates a job."""
        token, site_id = self._setup(client)
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.post(f"/api/v1/job-sites/{site_id}/jobs", json={
            "name": "Fix Plumbing",
            "status": "pending",
        }, headers=headers)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["name"] == "Fix Plumbing"
        assert data["status"] == "pending"

    def test_list_jobs(self, client, app_context, db_session):
        """GET /api/v1/job-sites/:id/jobs returns site's jobs."""
        token, site_id = self._setup(client)
        headers = {"Authorization": f"Bearer {token}"}
        client.post(f"/api/v1/job-sites/{site_id}/jobs",
                    json={"name": "Job 1"}, headers=headers)
        client.post(f"/api/v1/job-sites/{site_id}/jobs",
                    json={"name": "Job 2"}, headers=headers)

        resp = client.get(f"/api/v1/job-sites/{site_id}/jobs", headers=headers)
        assert resp.status_code == 200
        assert len(resp.get_json()) == 2


class TestEstimateEndpoints:
    """Test /api/v1/jobs/:id/estimates endpoints."""

    def _setup(self, client):
        """Register, create site + job, return (token, job_id)."""
        resp = client.post("/api/v1/auth/register", json={
            "email": f"est-{id(self)}@example.com",
            "password": "password123",
        })
        token = resp.get_json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        site_resp = client.post("/api/v1/job-sites", json={"name": "Est Site"}, headers=headers)
        site_id = site_resp.get_json()["id"]
        job_resp = client.post(f"/api/v1/job-sites/{site_id}/jobs",
                               json={"name": "Est Job"}, headers=headers)
        job_id = job_resp.get_json()["id"]
        return token, job_id

    def test_create_estimate(self, client, app_context, db_session):
        """POST /api/v1/jobs/:id/estimates creates an estimate."""
        token, job_id = self._setup(client)
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.post(f"/api/v1/jobs/{job_id}/estimates", json={
            "title": "Kitchen Estimate",
            "tax_rate": 8.5,
        }, headers=headers)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["title"] == "Kitchen Estimate"
        assert "id" in data

    def test_list_estimates(self, client, app_context, db_session):
        """GET /api/v1/jobs/:id/estimates returns job's estimates."""
        token, job_id = self._setup(client)
        headers = {"Authorization": f"Bearer {token}"}
        client.post(f"/api/v1/jobs/{job_id}/estimates",
                    json={"title": "Est 1"}, headers=headers)

        resp = client.get(f"/api/v1/jobs/{job_id}/estimates", headers=headers)
        assert resp.status_code == 200
        assert len(resp.get_json()) >= 1


class TestHealthEndpoint:
    """Test the health check endpoint."""

    def test_health(self, client, app_context, db_session):
        """GET /api/v1/health returns ok."""
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"
