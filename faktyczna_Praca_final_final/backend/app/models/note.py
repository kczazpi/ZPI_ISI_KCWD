import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


def utc_now() -> datetime:
    return datetime.now(UTC)


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (UniqueConstraint("id", "nonce_iv", name="uq_note_nonce"),)

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Zero-Knowledge fields: server stores only ciphertext and AEAD parameters
    ciphertext: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    nonce_iv: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
    )
    auth_tag: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
    )
    crypto_version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    # Optimistic concurrency versioning
    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationship
    user: Mapped["User"] = relationship(
        "User",
        back_populates="notes",
    )
