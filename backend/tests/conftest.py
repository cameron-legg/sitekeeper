"""Pytest configuration and shared fixtures for the backend test suite.

On each test session:
1. Drops and recreates the test database (clean slate)
2. Runs Alembic migrations to get the current schema
3. Each test runs inside a transaction that is rolled back afterward

This ensures tests always run against the real schema produced by migrations.
"""

import os
import subprocess
import uuid

import pytest
from sqlalchemy import create_engine, text

from app import create_app
from app.config import TestingConfig
from app.extensions import db as _db
from app.models import (
    Contact,
    DocumentNumber,
    Estimate,
    Invoice,
    InvoiceStatusHistory,
    Job,
    JobSite,
    LineItem,
    LineItemEntry,
    Note,
    SavedItem,
    SavedItemEntry,
    User,
)

# ---------------------------------------------------------------------------
# Test database URL — matches docker-compose db_test service on port 5433
# ---------------------------------------------------------------------------
TEST_DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://sitekeeper:sitekeeper@localhost:5433/sitekeeper_test",
)
# URL to connect to postgres itself (not the test db) for drop/create
_parts = TEST_DB_URL.rsplit("/", 1)
ADMIN_DB_URL = _parts[0] + "/postgres"
TEST_DB_NAME = _parts[1].split("?")[0]  # strip query params if any


# ---------------------------------------------------------------------------
# Session-scoped: drop/create DB and run migrations once per test session
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session", autouse=True)
def _setup_test_database():
    """Drop and recreate the test database, then run Alembic migrations."""
    # Connect to 'postgres' db to issue DROP/CREATE
    engine = create_engine(ADMIN_DB_URL, isolation_level="AUTOCOMMIT")
    with engine.connect() as conn:
        # Terminate existing connections to the test DB
        conn.execute(text(
            f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            f"WHERE datname = '{TEST_DB_NAME}' AND pid <> pg_backend_pid()"
        ))
        conn.execute(text(f"DROP DATABASE IF EXISTS {TEST_DB_NAME}"))
        conn.execute(text(f"CREATE DATABASE {TEST_DB_NAME}"))
    engine.dispose()

    # Run Alembic migrations against the fresh test database
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    result = subprocess.run(
        [
            os.path.join(backend_dir, "venv", "bin", "alembic"),
            "-c", os.path.join(backend_dir, "alembic.ini"),
            "upgrade", "head",
        ],
        cwd=backend_dir,
        env={**os.environ, "DATABASE_URL": TEST_DB_URL},
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Alembic migration failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )


@pytest.fixture(scope="session")
def app(_setup_test_database):
    """Create a Flask application instance configured for testing."""
    # Ensure the app uses the test database URL
    os.environ["DATABASE_URL"] = TEST_DB_URL
    flask_app = create_app(TestingConfig)
    yield flask_app


@pytest.fixture(autouse=True)
def db_session(app):
    """Provide a clean database state for each test by truncating all tables.

    This approach works correctly with Flask test client (which commits
    within request handlers) by clearing all data after each test.
    """
    with app.app_context():
        yield _db.session

        # After each test, truncate all tables to restore a clean state
        _db.session.remove()
        tables = _db.metadata.sorted_tables
        with _db.engine.connect() as conn:
            conn.execute(text("SET session_replication_role = 'replica'"))  # disable FK checks
            for table in tables:
                conn.execute(text(f'TRUNCATE TABLE "{table.name}" CASCADE'))
            conn.execute(text("SET session_replication_role = 'origin'"))  # re-enable FK checks
            conn.commit()


@pytest.fixture()
def client(app):
    """Return a Flask test client for making HTTP requests."""
    return app.test_client()


@pytest.fixture()
def app_context(app):
    """Push an application context."""
    with app.app_context():
        yield app


# ---------------------------------------------------------------------------
# Factory fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def create_user(db_session):
    """Factory fixture to create test users."""

    def _create(
        email=None,
        password_hash="$2b$12$LJ3m4sMKfVg1lFQHSy1VTOH2TpQoZwB2B0nTThCZCZPFsYjPfWkHK",  # "password"
        name="Test User",
        phone="555-0100",
        role="admin",
        is_approved=True,
    ):
        user = User(
            id=uuid.uuid4(),
            email=email or f"test-{uuid.uuid4().hex[:8]}@example.com",
            password_hash=password_hash,
            name=name,
            phone=phone,
            role=role,
            is_approved=is_approved,
        )
        db_session.add(user)
        db_session.flush()
        return user

    return _create


@pytest.fixture()
def admin_user(create_user):
    """Pre-built admin user for convenience."""
    return create_user(email="admin@test.com", role="admin", is_approved=True)


@pytest.fixture()
def member_user(create_user):
    """Pre-built approved member user."""
    return create_user(email="member@test.com", role="member", is_approved=True)


@pytest.fixture()
def pending_user(create_user):
    """Pre-built pending (unapproved) member user."""
    return create_user(email="pending@test.com", role="member", is_approved=False)


@pytest.fixture()
def create_job_site(db_session):
    """Factory fixture to create job sites."""

    def _create(user_id, name="Test Site", description=None, address="123 Main St"):
        site = JobSite(
            id=uuid.uuid4(),
            user_id=user_id,
            name=name,
            description=description,
            address=address,
        )
        db_session.add(site)
        db_session.flush()
        return site

    return _create


@pytest.fixture()
def create_job(db_session):
    """Factory fixture to create jobs."""

    def _create(job_site_id, name="Test Job", status="pending", description=None):
        job = Job(
            id=uuid.uuid4(),
            job_site_id=job_site_id,
            name=name,
            status=status,
            description=description,
        )
        db_session.add(job)
        db_session.flush()
        return job

    return _create


@pytest.fixture()
def create_estimate(db_session):
    """Factory fixture to create estimates."""

    def _create(job_id, title="Test Estimate", tax_rate=None, delivered=False):
        estimate = Estimate(
            id=uuid.uuid4(),
            job_id=job_id,
            title=title,
            delivered=delivered,
            tax_rate=tax_rate,
        )
        db_session.add(estimate)
        db_session.flush()
        return estimate

    return _create


@pytest.fixture()
def create_invoice(db_session):
    """Factory fixture to create invoices."""

    def _create(job_id, title="Test Invoice", tax_rate=None, delivered=False,
                status="drafting", source_estimate_id=None):
        invoice = Invoice(
            id=uuid.uuid4(),
            job_id=job_id,
            title=title,
            delivered=delivered,
            tax_rate=tax_rate,
            status=status,
            source_estimate_id=source_estimate_id,
        )
        db_session.add(invoice)
        db_session.flush()
        return invoice

    return _create


@pytest.fixture()
def create_line_item(db_session):
    """Factory fixture to create line items."""

    def _create(parent_id, parent_type="estimate", name="Test Item",
                hourly_rate=None, notes=None, sort_order=0):
        from decimal import Decimal
        item = LineItem(
            id=uuid.uuid4(),
            parent_id=parent_id,
            parent_type=parent_type,
            name=name,
            notes=notes,
            hourly_rate=hourly_rate if hourly_rate is not None else Decimal("75.00"),
            sort_order=sort_order,
        )
        db_session.add(item)
        db_session.flush()
        return item

    return _create


@pytest.fixture()
def create_entry(db_session):
    """Factory fixture to create line item entries."""

    def _create(line_item_id, entry_type="material", name="Test Entry",
                unit_price=None, quantity=None, hours=None, notes=None,
                url=None, sort_order=0):
        from decimal import Decimal
        entry = LineItemEntry(
            id=uuid.uuid4(),
            line_item_id=line_item_id,
            entry_type=entry_type,
            name=name,
            notes=notes,
            url=url,
            unit_price=unit_price if unit_price is not None else (Decimal("10.00") if entry_type in ("material", "fee") else None),
            quantity=quantity if quantity is not None else (Decimal("1") if entry_type in ("material", "fee") else None),
            hours=hours if hours is not None else (Decimal("1") if entry_type == "hours" else None),
            sort_order=sort_order,
        )
        db_session.add(entry)
        db_session.flush()
        return entry

    return _create


@pytest.fixture()
def create_contact(db_session):
    """Factory fixture to create contacts."""

    def _create(name="John Doe", phone="555-1234", email="john@example.com",
                mailing_address=None, notes=None):
        contact = Contact(
            id=uuid.uuid4(),
            name=name,
            phone=phone,
            email=email,
            mailing_address=mailing_address,
            notes=notes,
        )
        db_session.add(contact)
        db_session.flush()
        return contact

    return _create


@pytest.fixture()
def create_saved_item(db_session):
    """Factory fixture to create saved items (Item Library)."""

    def _create(user_id, name="Saved Item", notes=None, hourly_rate=None):
        from decimal import Decimal
        item = SavedItem(
            id=uuid.uuid4(),
            user_id=user_id,
            name=name,
            notes=notes,
            hourly_rate=hourly_rate or Decimal("50.00"),
        )
        db_session.add(item)
        db_session.flush()
        return item

    return _create


@pytest.fixture()
def create_saved_entry(db_session):
    """Factory fixture to create saved item entries."""

    def _create(saved_item_id=None, user_id=None, entry_type="material",
                name="Saved Entry", unit_price=None, quantity=None,
                hours=None, notes=None, url=None, sort_order=0):
        from decimal import Decimal
        entry = SavedItemEntry(
            id=uuid.uuid4(),
            saved_item_id=saved_item_id,
            user_id=user_id,
            entry_type=entry_type,
            name=name,
            notes=notes,
            url=url,
            unit_price=unit_price or (Decimal("25.00") if entry_type in ("material", "fee") else None),
            quantity=quantity or (Decimal("2") if entry_type in ("material", "fee") else None),
            hours=hours or (Decimal("3") if entry_type == "hours" else None),
            sort_order=sort_order,
        )
        db_session.add(entry)
        db_session.flush()
        return entry

    return _create


@pytest.fixture()
def create_document_number(db_session):
    """Factory fixture to create document number trackers."""

    def _create(document_type="estimate", next_number=1):
        doc_num = DocumentNumber(
            id=uuid.uuid4(),
            document_type=document_type,
            next_number=next_number,
        )
        db_session.add(doc_num)
        db_session.flush()
        return doc_num

    return _create


@pytest.fixture()
def sample_job_hierarchy(admin_user, create_job_site, create_job):
    """Create a complete job site → job hierarchy for convenience."""
    site = create_job_site(user_id=admin_user.id, name="123 Oak Lane")
    job = create_job(job_site_id=site.id, name="Bathroom Remodel")
    return {"user": admin_user, "site": site, "job": job}


@pytest.fixture()
def auth_headers(app, admin_user):
    """Generate valid auth headers for the admin user."""
    from app.auth.email_password import EmailPasswordAuthService

    with app.app_context():
        auth_service = EmailPasswordAuthService()
        token = auth_service._issue_token(str(admin_user.id))
    return {"Authorization": f"Bearer {token}"}
