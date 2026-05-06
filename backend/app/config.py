"""Application configuration loaded from environment variables."""

import os


class Config:
    """Base configuration class.

    All settings are read from environment variables with sensible defaults
    for local development. In production, set these via the environment or
    a secrets manager — never commit real secrets to source control.
    """

    # Database
    SQLALCHEMY_DATABASE_URI: str = os.environ.get(
        "DATABASE_URL",
        "postgresql://sitekeeper:sitekeeper@localhost:5434/sitekeeper",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False

    # JWT
    JWT_SECRET: str = os.environ.get("JWT_SECRET", "change-me-in-production")
    JWT_EXPIRY_SECONDS: int = int(os.environ.get("JWT_EXPIRY_SECONDS", "8640000"))

    # CORS — comma-separated list of allowed origins, or "*" for all
    CORS_ORIGINS: str = os.environ.get("CORS_ORIGINS", "*")

    # MinIO (S3-compatible blob storage for PDFs)
    MINIO_ENDPOINT: str = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET_NAME: str = os.environ.get("MINIO_BUCKET_NAME", "sitekeeper-pdfs")
    MINIO_USE_SSL: bool = os.environ.get("MINIO_USE_SSL", "false").lower() in (
        "true",
        "1",
        "yes",
    )

    # Flask
    SECRET_KEY: str = os.environ.get("SECRET_KEY", JWT_SECRET)
    TESTING: bool = False
    DEBUG: bool = os.environ.get("FLASK_DEBUG", "0") == "1"


class TestingConfig(Config):
    """Configuration used during automated tests."""

    TESTING = True
    # Use the test database by default; override via DATABASE_URL env var
    SQLALCHEMY_DATABASE_URI: str = os.environ.get(
        "DATABASE_URL",
        "postgresql://sitekeeper:sitekeeper@localhost:5433/sitekeeper_test",
    )
