"""Document vault models for secure customer KYC and collateral file tracking."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Document(Base):
    """Customer uploaded file metadata, storage location, and verification status."""

    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint(
            "file_size_bytes > 0",
            name="chk_documents_file_size_positive",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    document_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    storage_path: Mapped[str] = mapped_column(
        String(500),
        unique=True,
        nullable=False,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    sha256_hash: Mapped[str] = mapped_column(
        String(64),
        index=True,
        nullable=False,
    )
    verification_status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING_REVIEW",
        index=True,
        nullable=False,
    )
    verified_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    rejection_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    customer: Mapped[Customer] = relationship(
        back_populates="documents",
    )
    verified_by: Mapped[User | None] = relationship()


# Late imports for relationships
from app.db.models.auth import User  # noqa: E402
from app.db.models.crm import Customer  # noqa: E402
