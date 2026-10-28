from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_pn(value: str) -> str:
    """Uppercase and drop everything except letters/digits,
    so '1K0-615-301', '1k0 615 301' and '1K0615301' are the same part."""
    return re.sub(r"[^A-Z0-9]", "", value.upper())


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(128), default="")
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default="worker")  # admin | worker
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Vehicle(Base):
    """A make/model over a range of model years. variant "" means 'all variants'."""

    __tablename__ = "vehicles"
    __table_args__ = (
        UniqueConstraint("make", "model", "year_from", "year_to", "variant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    make: Mapped[str] = mapped_column(String(64), index=True)
    model: Mapped[str] = mapped_column(String(64), index=True)
    year_from: Mapped[int] = mapped_column(Integer)
    year_to: Mapped[int] = mapped_column(Integer)
    variant: Mapped[str] = mapped_column(String(64), default="")


class Part(Base):
    __tablename__ = "parts"

    id: Mapped[int] = mapped_column(primary_key=True)
    part_number: Mapped[str] = mapped_column(String(64))
    pn_norm: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(64), default="", index=True)
    condition: Mapped[str] = mapped_column(String(16), default="good")  # good | fair | poor
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    # Free text for now; replaced by Location/RfidTag in the RFID phase
    location_note: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    fitments: Mapped[list[Fitment]] = relationship(
        back_populates="part", cascade="all, delete-orphan"
    )


class Fitment(Base):
    """Part X fits vehicle Y."""

    __tablename__ = "fitments"
    __table_args__ = (UniqueConstraint("part_id", "vehicle_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    part_id: Mapped[int] = mapped_column(
        ForeignKey("parts.id", ondelete="CASCADE"), index=True
    )
    vehicle_id: Mapped[int] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"), index=True
    )
    notes: Mapped[str] = mapped_column(String(255), default="")

    part: Mapped[Part] = relationship(back_populates="fitments")
    vehicle: Mapped[Vehicle] = relationship(lazy="joined")


class PartInterchange(Base):
    """Two parts are interchangeable. Stored once with part_a_id < part_b_id.
    Links are direct only (A~B and B~C does NOT imply A~C)."""

    __tablename__ = "part_interchanges"
    __table_args__ = (UniqueConstraint("part_a_id", "part_b_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    part_a_id: Mapped[int] = mapped_column(ForeignKey("parts.id", ondelete="CASCADE"), index=True)
    part_b_id: Mapped[int] = mapped_column(ForeignKey("parts.id", ondelete="CASCADE"), index=True)


# --- RFID phase: tables exist so the schema is ready, no endpoints yet -------------


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(16), default="shelf")  # shelf | heap | zone
    notes: Mapped[str] = mapped_column(String(255), default="")


class RfidTag(Base):
    __tablename__ = "rfid_tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    epc: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    part_id: Mapped[int | None] = mapped_column(ForeignKey("parts.id", ondelete="SET NULL"), nullable=True)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
