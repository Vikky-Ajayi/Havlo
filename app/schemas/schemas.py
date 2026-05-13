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
    access_token: str
    token_type: str = "bearer"
    onboarding_complete: bool = False
    is_admin: bool = False
    profile: "LoginUserProfile | None" = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginUserProfile(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    phone_country_code: str
    phone_number: str
    role: str
    onboarding_complete: bool
    is_admin: bool = False


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    onboarding_complete: bool
    is_admin: bool = False
    profile: LoginUserProfile


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
    last_message_at: Optional[datetime] = None
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
    is_edited: bool = False
    edited_at: Optional[datetime] = None
    is_deleted: bool = False
    attachment_url: Optional[str] = None
    attachment_filename: Optional[str] = None
    attachment_mime: Optional[str] = None
    attachment_size: Optional[int] = None
    read_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EditMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


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
    plan_id: str = Field(..., pattern="^(launch|global|global-plus|worldwide|private-client)$")
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
    discount_code: Optional[str] = None


class PropertyDemandCheckRequest(BaseModel):
    property_address: str = Field(..., min_length=1, max_length=500)
    city: str = Field(..., min_length=1, max_length=200)
    postcode: str = Field(..., min_length=1, max_length=50)
    listing_url: Optional[str] = Field(None, max_length=1000)


class PropertyDemandCheckResponse(BaseModel):
    ok: bool = True
    city: str
    markets: list[str]


class BuyerNetworkResponse(BaseModel):
    application_id: str
    checkout_url: str
    checkout_id: str
    total_amount: float
    currency: str
    message: str


class PublicAssessRequest(BaseModel):
    property_url: Optional[str] = Field(None, max_length=2000)
    property_address: Optional[str] = Field(None, max_length=500)
    email: str = Field(..., min_length=1, max_length=320)
    phone: str = Field(..., min_length=1, max_length=30)
    phone_country_code: str = Field("+44", max_length=10)
    property_title: Optional[str] = Field(None, max_length=500)
    property_price: Optional[str] = Field(None, max_length=100)
    property_bedrooms: Optional[str] = Field(None, max_length=50)
    property_description: Optional[str] = Field(None, max_length=5000)
    property_listing_link: Optional[str] = Field(None, max_length=2000)
    property_image_url: Optional[str] = Field(None, max_length=2000)


class PublicAssessProperty(BaseModel):
    title: str
    address: str
    price: str
    image: str
    bedrooms: str
    bathrooms: str
    property_type: str


class PublicAssessPricing(BaseModel):
    plan_id: str
    plan_name: str
    setup_fee: str
    monthly_from: str
    is_custom: bool = False


class PublicAssessResponse(BaseModel):
    session_id: str
    report: str
    property: PublicAssessProperty
    pricing: PublicAssessPricing


# ── Stale Listings ──────────────────────────────────────────────────────────────

class StaleListingSubmitRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone_country_code: str = Field("+44", max_length=10)
    phone: str = Field(..., min_length=4, max_length=30)
    package: str = Field(..., pattern="^(quick_insight|professional_review|premium_strategy)$")
    property_address: Optional[str] = Field(None, max_length=500)
    listing_url: Optional[str] = Field(None, max_length=2000)
    questions_data: dict = Field(default_factory=dict)
    redirect_url: Optional[str] = Field(None, max_length=2000)


class StaleListingSubmitResponse(BaseModel):
    assessment_id: str
    reference: str
    checkout_url: str
    checkout_id: str
    amount: float
    message: str


class StaleListingScores(BaseModel):
    photos: int = 50
    pricing: int = 50
    description: int = 50
    positioning: int = 50


class StaleListingKeyFinding(BaseModel):
    title: str
    description: str
    type: str
    icon: Optional[str] = None


class StaleListingComparableSale(BaseModel):
    address: str
    beds: int = 0
    property_type: str = ""
    sold_asking: str = ""
    is_subject: bool = False


class StaleListingActionItem(BaseModel):
    priority: str
    title: str
    description: str
    bullets: list[str] = Field(default_factory=list)


class StaleListingReportData(BaseModel):
    overall_score: int = 50
    scores: StaleListingScores = Field(default_factory=StaleListingScores)
    key_findings: list[StaleListingKeyFinding] = Field(default_factory=list)
    action_plan: list[StaleListingActionItem] = Field(default_factory=list)
    comparable_sales: list[StaleListingComparableSale] = Field(default_factory=list)
    pricing_recommendation: str = ""
    pricing_recommendation_detail: str = ""
    executive_summary: str = ""
    days_on_market: Optional[int] = None


class StaleListingReportResponse(BaseModel):
    assessment_id: str
    reference: str
    email: str
    package: str
    property_address: Optional[str]
    listing_url: Optional[str]
    report_status: str
    payment_status: str
    report_data: Optional[StaleListingReportData]
    created_at: str


class StaleListingAdminItem(BaseModel):
    assessment_id: str
    reference: str
    email: str
    first_name: str
    last_name: str
    package: str
    property_address: Optional[str]
    listing_url: Optional[str]
    questions_data: Optional[str] = None
    report_status: str
    payment_status: str
    created_at: str
    ai_report_json: Optional[str]
    agent_edited_report_json: Optional[str] = None
    agent_notes: Optional[str]


class StaleListingAdminFinalizeRequest(BaseModel):
    agent_notes: Optional[str] = None
    agent_edited_report_json: Optional[str] = None
    report_status: str = "completed"
