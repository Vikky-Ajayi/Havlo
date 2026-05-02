"""Agent-specific ORM models."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base


class AgentProfileLink(Base):
    """Stores an agent's listing platform profile URL."""
    __tablename__ = "agent_profile_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    profile_url: Mapped[str] = mapped_column(Text, nullable=False)
    platform: Mapped[Optional[str]] = mapped_column(String(50))
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AgentListing(Base):
    """A listing fetched from an agent's profile on an external platform."""
    __tablename__ = "agent_listings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    external_url: Mapped[Optional[str]] = mapped_column(Text)
    title: Mapped[Optional[str]] = mapped_column(String(500))
    price: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    image_url: Mapped[Optional[str]] = mapped_column(Text)
    bedrooms: Mapped[Optional[str]] = mapped_column(String(50))
    platform: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AgentAdvancedServicePayment(Base):
    """Payment record for 0.25% advanced services fee for a listing."""
    __tablename__ = "agent_advanced_service_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    listing_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_listings.id"), nullable=True)
    listing_url: Mapped[Optional[str]] = mapped_column(Text)
    listing_title: Mapped[Optional[str]] = mapped_column(String(500))
    property_price_raw: Mapped[Optional[str]] = mapped_column(String(100))
    service_fee_amount: Mapped[float] = mapped_column(nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="GBP")
    sumup_checkout_id: Mapped[Optional[str]] = mapped_column(String(255))
    sumup_checkout_url: Mapped[Optional[str]] = mapped_column(Text)
    payment_status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
