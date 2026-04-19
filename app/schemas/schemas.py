"""Pydantic request/response schemas for all API endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Shared ─────────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str


# ── Auth ───────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone_country_code: str = Field(..., min_length=1, max_length=10)
    phone_number: str = Field(..., min_length=4, max_length=30)
    role: str = Field(..., pattern="^(buyer|seller|agent)$")
    password: str = Field(..., min_length=8)

    @field_validator("phone_country_code")
    @classmethod
    def code_must_start_with_plus(cls, v: str) -> str:
        if not v.startswith("+"):
            v = "+" + v
        return v


class RegisterResponse(BaseModel):
    message: str
    user_id: str
    role: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    onboarding_complete: bool
    is_admin: bool = False


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)
    # access_token from Supabase magic link / OTP is sent in Authorization header


# ── User / Profile ─────────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    id: str
    supabase_uid: str
    email: str
    first_name: str
    last_name: str
    phone_country_code: str
    phone_number: str
    full_phone: str
    role: str
    onboarding_complete: bool
    is_admin: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Admin Messaging ────────────────────────────────────────────────────────────

class AdminUserOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    full_name: str
    email: str
    role: str
    phone: str
    created_at: datetime
    conversation_count: int
    last_message_at: Optional[datetime] = None
    has_unread: bool = False
    unread_count: int = 0


class AdminStartConversationRequest(BaseModel):
    user_id: str
    subject: str = Field(..., min_length=1, max_length=500)
    initial_message: Optional[str] = Field(None, max_length=5000)
    sender_name: str = Field(default="Havlo Advisory", max_length=255)
    team_member_initials: str = Field(default="HA", max_length=10)
    team_member_color: str = Field(default="#0052B4", max_length=20)


class AdminSendRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    sender_name: str = Field(default="Havlo Advisory", max_length=255)


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone_country_code: Optional[str] = Field(None, min_length=1, max_length=10)
    phone_number: Optional[str] = Field(None, min_length=4, max_length=30)

    @field_validator("phone_country_code")
    @classmethod
    def code_must_start_with_plus(cls, v: Optional[str]) -> Optional[str]:
        if v and not v.startswith("+"):
            v = "+" + v
        return v


class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


# ── Onboarding ─────────────────────────────────────────────────────────────────

class OnboardingRequest(BaseModel):
    services: list[str] = Field(..., min_length=1)
    countries: list[str] = Field(..., min_length=1)
    property_type: str = Field(..., min_length=1)
    timeframe: str = Field(..., min_length=1)
    budget_amount: Optional[str] = None
    budget_currency: str = "GBP"


class OnboardingResponse(BaseModel):
    message: str
    onboarding_id: str


# ── Messaging ──────────────────────────────────────────────────────────────────

class ConversationOut(BaseModel):
    id: str
    team_member_name: str
    team_member_initials: str
    team_member_color: str
    subject: str
    last_message_at: datetime
    last_message_snippet: Optional[str] = None
    unread_count: int = 0

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: str
    content: str
    sender_type: str
    sender_name: str
    created_at: datetime
    is_me: bool  # True when sender_type == "user"

    model_config = {"from_attributes": True}


class ConversationDetailOut(BaseModel):
    id: str
    team_member_name: str
    team_member_initials: str
    team_member_color: str
    subject: str
    messages: list[MessageOut]

    model_config = {"from_attributes": True}


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class SendMessageResponse(BaseModel):
    message: MessageOut


# ── Session Booking ────────────────────────────────────────────────────────────

class BookSessionRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone_country_code: str = Field(..., min_length=1, max_length=10)
    phone_number: str = Field(..., min_length=4, max_length=30)
    email: EmailStr
    preferred_date: str
    preferred_time: str

    @field_validator("phone_country_code")
    @classmethod
    def code_must_start_with_plus(cls, v: str) -> str:
        if not v.startswith("+"):
            v = "+" + v
        return v


class BookSessionResponse(BaseModel):
    booking_id: str
    checkout_url: str
    checkout_id: str
    amount: float
    currency: str
    message: str


class PaymentStatusResponse(BaseModel):
    checkout_id: str
    status: str
    paid: bool
    redirect_url: Optional[str] = None  # Calendly link after successful payment


# ── Property Matching ──────────────────────────────────────────────────────────

class PropertyMatchingRequest(BaseModel):
    property_type: str = Field(..., min_length=1)
    location: str = Field(..., min_length=1)
    budget_amount: Optional[str] = None
    budget_currency: str = "GBP"
    bedrooms: Optional[str] = None
    bathrooms: Optional[str] = None
    additional_requirements: Optional[str] = None
    contact_preference: str = "email"


class PropertyMatchingResponse(BaseModel):
    request_id: str
    message: str


# ── Elite Property ─────────────────────────────────────────────────────────────

class ElitePropertyRequest(BaseModel):
    property_address: str = Field(..., min_length=1)
    property_type: str = Field(..., min_length=1)
    asking_price: Optional[str] = None
    asking_price_currency: str = "GBP"
    description: Optional[str] = None
    target_buyer_profile: Optional[str] = None
    additional_info: Optional[str] = None


class ElitePropertyResponse(BaseModel):
    application_id: str
    message: str


# ── Sell Faster ────────────────────────────────────────────────────────────────

class SellFasterRequest(BaseModel):
    plan_id: str = Field(..., pattern="^(global|global-plus|worldwide|private-client)$")
    plan_name: str
    property_address: str = Field(..., min_length=1)
    property_type: str = Field(..., min_length=1)
    asking_price: Optional[str] = None
    target_countries: list[str] = Field(..., min_length=1)
    contact_preference: str = "you"
    agent_name: Optional[str] = None
    agent_email: Optional[str] = None
    agent_phone: Optional[str] = None
    additional_info: Optional[str] = None


class SellFasterResponse(BaseModel):
    application_id: str
    checkout_url: str
    checkout_id: str
    total_amount: float
    currency: str
    message: str


# ── Sale Audit ─────────────────────────────────────────────────────────────────

class SaleAuditRequest(BaseModel):
    listing_url: Optional[str] = None
    time_on_market: Optional[str] = None
    number_of_viewings: Optional[str] = None
    number_of_offers: Optional[str] = None
    original_asking_price: Optional[str] = None
    current_asking_price: Optional[str] = None
    price_currency: str = "GBP"
    estate_agent_name: Optional[str] = None
    property_description: Optional[str] = None
    main_challenges: Optional[str] = None


class SaleAuditResponse(BaseModel):
    request_id: str
    checkout_url: str
    checkout_id: str
    amount: float
    currency: str
    message: str


# ── Buyer Network ──────────────────────────────────────────────────────────────

class BuyerNetworkRequest(BaseModel):
    package_id: str = Field(..., pattern="^(partner|growth|private)$")
    package_name: str
    company_name: Optional[str] = None
    number_of_properties: Optional[str] = None
    property_types: list[str] = Field(..., min_length=1)
    target_markets: list[str] = Field(..., min_length=1)
    contact_preference: str = "email"
    additional_info: Optional[str] = None


class BuyerNetworkResponse(BaseModel):
    application_id: str
    checkout_url: str
    checkout_id: str
    total_amount: float
    currency: str
    message: str
