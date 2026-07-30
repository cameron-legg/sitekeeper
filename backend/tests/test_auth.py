"""Tests for authentication — registration, login, token validation, errors."""

import pytest

from app.auth.email_password import EmailPasswordAuthService
from app.auth.interface import AuthError
from app.models import User


class TestRegistration:
    """Test user registration."""

    def test_register_first_user_is_admin(self, app_context, db_session):
        """First user in a tenant gets admin role and is auto-approved."""
        service = EmailPasswordAuthService()
        result = service.register("first@example.com", "securepass123")

        assert result.user_id is not None
        assert result.token is not None
        assert result.role == "admin"
        assert result.is_approved is True

    def test_register_second_user_is_pending_member(self, app_context, db_session, create_user):
        """Second user gets member role and is not approved."""
        # Create an existing user first
        create_user(email="existing@example.com")

        service = EmailPasswordAuthService()
        result = service.register("second@example.com", "securepass123")

        assert result.role == "member"
        assert result.is_approved is False

    def test_register_invalid_email_raises(self, app_context, db_session):
        """Invalid email format raises AuthError."""
        service = EmailPasswordAuthService()

        with pytest.raises(AuthError) as exc_info:
            service.register("not-an-email", "password123")
        assert exc_info.value.code == "INVALID_EMAIL"

    def test_register_duplicate_email_raises(self, app_context, db_session, create_user):
        """Duplicate email raises AuthError."""
        create_user(email="dupe@example.com")

        service = EmailPasswordAuthService()
        with pytest.raises(AuthError) as exc_info:
            service.register("dupe@example.com", "password123")
        assert exc_info.value.code == "EMAIL_IN_USE"

    def test_register_email_is_lowercased(self, app_context, db_session):
        """Email is normalized to lowercase."""
        service = EmailPasswordAuthService()
        result = service.register("Test.User@Example.COM", "password123")

        user = User.query.filter_by(id=result.user_id).first()
        assert user.email == "test.user@example.com"

    def test_register_email_is_trimmed(self, app_context, db_session):
        """Leading/trailing whitespace in email is stripped."""
        service = EmailPasswordAuthService()
        result = service.register("  spaces@example.com  ", "password123")

        user = User.query.filter_by(id=result.user_id).first()
        assert user.email == "spaces@example.com"


class TestLogin:
    """Test user login."""

    def test_login_success(self, app_context, db_session):
        """Successful login returns token and user info."""
        service = EmailPasswordAuthService()
        # Register first, then login
        service.register("login@example.com", "mypassword")

        result = service.login("login@example.com", "mypassword")
        assert result.user_id is not None
        assert result.token is not None
        assert result.role == "admin"

    def test_login_wrong_password_raises(self, app_context, db_session):
        """Wrong password raises INVALID_CREDENTIALS."""
        service = EmailPasswordAuthService()
        service.register("user@example.com", "correctpass")

        with pytest.raises(AuthError) as exc_info:
            service.login("user@example.com", "wrongpass")
        assert exc_info.value.code == "INVALID_CREDENTIALS"

    def test_login_nonexistent_email_raises(self, app_context, db_session):
        """Nonexistent email raises INVALID_CREDENTIALS (doesn't reveal which field)."""
        service = EmailPasswordAuthService()

        with pytest.raises(AuthError) as exc_info:
            service.login("nobody@example.com", "password")
        assert exc_info.value.code == "INVALID_CREDENTIALS"

    def test_login_email_case_insensitive(self, app_context, db_session):
        """Login works regardless of email case."""
        service = EmailPasswordAuthService()
        service.register("casee@example.com", "password123")

        result = service.login("CASEE@Example.COM", "password123")
        assert result.user_id is not None


class TestTokenValidation:
    """Test JWT token validation."""

    def test_valid_token(self, app_context, db_session):
        """Valid token returns user_id."""
        service = EmailPasswordAuthService()
        reg_result = service.register("token@example.com", "password123")

        user_id = service.validate_token(reg_result.token)
        assert user_id == reg_result.user_id

    def test_invalid_token_raises(self, app_context, db_session):
        """Garbage token raises TOKEN_INVALID."""
        service = EmailPasswordAuthService()

        with pytest.raises(AuthError) as exc_info:
            service.validate_token("not.a.valid.token")
        assert exc_info.value.code == "TOKEN_INVALID"

    def test_expired_token_raises(self, app_context, db_session):
        """Expired token raises TOKEN_EXPIRED."""
        import jwt as pyjwt
        from datetime import datetime, timezone, timedelta
        from flask import current_app

        secret = current_app.config["JWT_SECRET"]
        # Create token that expired 1 hour ago
        payload = {
            "sub": "some-user-id",
            "iat": datetime.now(tz=timezone.utc) - timedelta(hours=2),
            "exp": datetime.now(tz=timezone.utc) - timedelta(hours=1),
        }
        expired_token = pyjwt.encode(payload, secret, algorithm="HS256")

        service = EmailPasswordAuthService()
        with pytest.raises(AuthError) as exc_info:
            service.validate_token(expired_token)
        assert exc_info.value.code == "TOKEN_EXPIRED"

    def test_tampered_token_raises(self, app_context, db_session):
        """Token signed with wrong secret raises TOKEN_INVALID."""
        import jwt as pyjwt
        from datetime import datetime, timezone, timedelta

        payload = {
            "sub": "some-user-id",
            "iat": datetime.now(tz=timezone.utc),
            "exp": datetime.now(tz=timezone.utc) + timedelta(hours=1),
        }
        bad_token = pyjwt.encode(payload, "wrong-secret", algorithm="HS256")

        service = EmailPasswordAuthService()
        with pytest.raises(AuthError) as exc_info:
            service.validate_token(bad_token)
        assert exc_info.value.code == "TOKEN_INVALID"


class TestPasswordHashing:
    """Test bcrypt password security."""

    def test_password_is_hashed_not_plaintext(self, app_context, db_session):
        """Stored password is a bcrypt hash, not the plaintext."""
        service = EmailPasswordAuthService()
        service.register("hash@example.com", "myplaintext")

        user = User.query.filter_by(email="hash@example.com").first()
        assert user.password_hash != "myplaintext"
        assert user.password_hash.startswith("$2b$")

    def test_different_users_same_password_different_hash(self, app_context, db_session):
        """Bcrypt per-password salt ensures different hashes."""
        service = EmailPasswordAuthService()
        service.register("user1@example.com", "samepassword")
        service.register("user2@example.com", "samepassword")

        user1 = User.query.filter_by(email="user1@example.com").first()
        user2 = User.query.filter_by(email="user2@example.com").first()
        assert user1.password_hash != user2.password_hash
