"""Platform portal models — stored in the sk_platform database.

These models use a separate SQLAlchemy MetaData instance so that
Alembic can target them independently from tenant models.
"""

import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.types import TIMESTAMP


class PlatformBase(DeclarativeBase):
    """Base class for all platform portal models.

    Uses its own MetaData separate from the tenant models so Alembic
    environments don't interfere with each other.
    """

    pass


# ---------------------------------------------------------------------------
# PlatformUser
# ---------------------------------------------------------------------------


class PlatformUser(PlatformBase):
    """A user account on the platform (control plane).

    Platform users can create and manage tenants. Their credentials are
    copied into tenant databases at provisioning time.
    """

    __tablename__ = "platform_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)
    name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)  # future billing
    created_at = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    tenants = relationship("Tenant", back_populates="owner", lazy="dynamic")

    def __repr__(self):
        return f"<PlatformUser {self.email}>"


# ---------------------------------------------------------------------------
# Tenant
# ---------------------------------------------------------------------------


class Tenant(PlatformBase):
    """A tenant (client organization) registered on the platform.

    Each tenant maps to:
    - A PostgreSQL database (sk_<slug>)
    - A MinIO bucket (<slug>)
    - A subdomain (<slug>.jobsyte.app)
    """

    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("platform_users.id", ondelete="SET NULL"),
        nullable=True,  # nullable for legacy tenants migrated from tenants.json
    )
    status = Column(String(20), nullable=False, default="active")
    # Statuses: active, provisioning, suspended, deleted
    plan = Column(String(20), nullable=False, default="free")
    # Plans: free, pro, enterprise (future)
    database_name = Column(String(100), nullable=False)  # e.g. sk_nocoresources
    bucket = Column(String(100), nullable=False)  # e.g. nocoresources
    domain = Column(String(255), nullable=False)  # e.g. nocoresources.jobsyte.app
    enabled_utilities = Column(JSONB, nullable=True)  # null = all enabled
    # When true, this tenant's users receive detailed error responses
    # (error type + stack trace). Most tenants see only a generic message.
    debug_errors = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Relationships
    owner = relationship("PlatformUser", back_populates="tenants")
    metrics = relationship(
        "TenantMetrics", back_populates="tenant", lazy="dynamic"
    )

    def __repr__(self):
        return f"<Tenant {self.slug} ({self.status})>"

    @property
    def is_active(self) -> bool:
        return self.status == "active"


# ---------------------------------------------------------------------------
# TenantMetrics
# ---------------------------------------------------------------------------


class TenantMetrics(PlatformBase):
    """Daily usage metrics snapshot for a tenant.

    Populated by a nightly cron job that queries each tenant's database
    and MinIO bucket.
    """

    __tablename__ = "tenant_metrics"
    __table_args__ = (
        UniqueConstraint("tenant_id", "recorded_at", name="uq_tenant_metrics_daily"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    recorded_at = Column(Date, nullable=False)
    users_count = Column(Integer, nullable=False, default=0)
    logins_30d = Column(Integer, nullable=False, default=0)
    job_sites_count = Column(Integer, nullable=False, default=0)
    jobs_count = Column(Integer, nullable=False, default=0)
    storage_bytes = Column(BigInteger, nullable=False, default=0)

    # Relationships
    tenant = relationship("Tenant", back_populates="metrics")

    def __repr__(self):
        return f"<TenantMetrics tenant={self.tenant_id} date={self.recorded_at}>"
