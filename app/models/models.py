"""SQLAlchemy ORM models for Havlo backend."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


# ── Enums ──────────────────────────────────────────────────────────────────────

import enum as python_enum


class UserRole(str, python_enum.Enum):
    buyer = "buyer"
    seller = "seller"
    agent = "agent"


class MessageSenderType(str, python_enum.Enum):
    user = "user"
    team = "team"


class PaymentStatus(str, python_enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


# ── Models ─────────────────────────────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    supabase_uid: Mapped[str] = mapped_column(String(255), unique=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_country_code: Mapped[str] = mapped_column(String(10), nullable=False, default="+44")
    phone_number: Mapped[str] = mapped_column(String(30), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), nullable=False
    )
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    onboarding: Mapped[Optional["OnboardingData"]] = relationship(
        "OnboardingData", back_populates="user", uselist=False
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation", back_populates="user"
    )
    bookings: Mapped[list["SessionBooking"]] = relationship(
        "SessionBooking", back_populates="user"
    )
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="user")
    property_requests: Mapped[list["PropertyMatchingRequest"]] = relationship(
        "PropertyMatchingRequest", back_populates="user"
    )
    elite_applications: Mapped[list["ElitePropertyApplication"]] = relationship(
        "ElitePropertyApplication", back_populates="user"
    )
    sell_faster_applications: Mapped[list["SellFasterApplication"]] = relationship(
        "SellFasterApplication", back_populates="user"
    )
    sale_audit_requests: Mapped[list["SaleAuditRequest"]] = relationship(
        "SaleAuditRequest", back_populates="user"
    )
    buyer_network_applications: Mapped[list["BuyerNetworkApplication"]] = relationship(
        "BuyerNetworkApplication", back_populates="user"
    )

    @property
    def full_phone(self) -> str:
        return f"{self.phone_country_code}{self.phone_number}"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class OnboardingData(Base):
    __tablename__ = "onboarding_data"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )
    services: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    countries: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    property_type: Mapped[str] = mapped_column(String(100), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(100), nullable=False)
    budget_amount: Mapped[Optional[str]] = mapped_column(String(50))
    budget_currency: Mapped[str] = mapped_column(String(10), default="GBP")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="onboarding")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    team_member_name: Mapped[str] = mapped_column(String(255), nullable=False)
    team_member_initials: Mapped[str] = mapped_column(String(10), nullable=False)
    team_member_color: Mapped[str] = mapped_column(String(20), default="#0052B4")
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation", order_by="Message.created_at"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sender_type: Mapped[MessageSenderType] = mapped_column(
        Enum(MessageSenderType, name="message_sender_type"), nullable=False
    )
    sender_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sms_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="messages"
    )


class SessionBooking(Base):
    __tablename__ = "session_bookings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_country_code: Mapped[str] = mapped_column(String(10), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(30), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    preferred_date: Mapped[str] = mapped_column(String(50), nullable=False)
    preferred_time: Mapped[str] = mapped_column(String(50), nullable=False)
    sumup_checkout_id: Mapped[Optional[str]] = mapped_column(String(255))
    sumup_checkout_url: Mapped[Optional[str]] = mapped_column(Text)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"), default=PaymentStatus.pending
    )
    calendly_url: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[Optional["User"]] = relationship("User", back_populates="bookings")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    checkout_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status_payments"), default=PaymentStatus.pending
    )
    reference_type: Mapped[str] = mapped_column(String(50))  # e.g. "session_booking", "sell_faster"
    reference_id: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[Optional["User"]] = relationship("User", back_populates="payments")


class PropertyMatchingRequest(Base):
    __tablename__ = "property_matching_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    property_type: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    budget_amount: Mapped[Optional[str]] = mapped_column(String(50))
    budget_currency: Mapped[str] = mapped_column(String(10), default="GBP")
    bedrooms: Mapped[Optional[str]] = mapped_column(String(20))
    bathrooms: Mapped[Optional[str]] = mapped_column(String(20))
    additional_requirements: Mapped[Optional[str]] = mapped_column(Text)
    contact_preference: Mapped[str] = mapped_column(String(50), default="email")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="property_requests")


class ElitePropertyApplication(Base):
    __tablename__ = "elite_property_applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    property_address: Mapped[str] = mapped_column(Text, nullable=False)
    property_type: Mapped[str] = mapped_column(String(100), nullable=False)
    asking_price: Mapped[Optional[str]] = mapped_column(String(50))
    asking_price_currency: Mapped[str] = mapped_column(String(10), default="GBP")
    description: Mapped[Optional[str]] = mapped_column(Text)
    target_buyer_profile: Mapped[Optional[str]] = mapped_column(Text)
    additional_info: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="elite_applications")


class SellFasterApplication(Base):
    __tablename__ = "sell_faster_applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    plan_id: Mapped[str] = mapped_column(String(50), nullable=False)
    plan_name: Mapped[str] = mapped_column(String(100), nullable=False)
    property_address: Mapped[str] = mapped_column(Text, nullable=False)
    property_type: Mapped[str] = mapped_column(String(100), nullable=False)
    asking_price: Mapped[Optional[str]] = mapped_column(String(50))
    target_countries: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    contact_preference: Mapped[str] = mapped_column(String(50), default="you")
    agent_name: Mapped[Optional[str]] = mapped_column(String(255))
    agent_email: Mapped[Optional[str]] = mapped_column(String(255))
    agent_phone: Mapped[Optional[str]] = mapped_column(String(50))
    additional_info: Mapped[Optional[str]] = mapped_column(Text)
    sumup_checkout_id: Mapped[Optional[str]] = mapped_column(String(255))
    sumup_checkout_url: Mapped[Optional[str]] = mapped_column(Text)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status_sell_faster"), default=PaymentStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="sell_faster_applications")


class SaleAuditRequest(Base):
    __tablename__ = "sale_audit_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    listing_url: Mapped[Optional[str]] = mapped_column(Text)
    time_on_market: Mapped[Optional[str]] = mapped_column(String(100))
    number_of_viewings: Mapped[Optional[str]] = mapped_column(String(50))
    number_of_offers: Mapped[Optional[str]] = mapped_column(String(50))
    original_asking_price: Mapped[Optional[str]] = mapped_column(String(50))
    current_asking_price: Mapped[Optional[str]] = mapped_column(String(50))
    price_currency: Mapped[str] = mapped_column(String(10), default="GBP")
    estate_agent_name: Mapped[Optional[str]] = mapped_column(String(255))
    property_description: Mapped[Optional[str]] = mapped_column(Text)
    main_challenges: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="sale_audit_requests")


class BuyerNetworkApplication(Base):
    __tablename__ = "buyer_network_applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    package_id: Mapped[str] = mapped_column(String(50), nullable=False)
    package_name: Mapped[str] = mapped_column(String(100), nullable=False)
    company_name: Mapped[Optional[str]] = mapped_column(String(255))
    number_of_properties: Mapped[Optional[str]] = mapped_column(String(50))
    property_types: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    target_markets: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    contact_preference: Mapped[str] = mapped_column(String(50), default="email")
    additional_info: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="buyer_network_applications")
