"""Shared password hashing — used by both tenant and portal auth.

Wraps flask-bcrypt so hashing logic is centralized. If we ever
switch hashing algorithms, only this file needs to change.
"""

from ..extensions import bcrypt


def hash_password(password: str) -> str:
    """Hash a password using bcrypt. Returns the hash string."""
    return bcrypt.generate_password_hash(password).decode("utf-8")


def check_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.check_password_hash(password_hash, password)
