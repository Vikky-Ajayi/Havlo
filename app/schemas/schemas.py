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


class VerifyResetOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)


class VerifyResetOtpResponse(BaseModel):
    message: str
    reset_token: str


class ResetPasswordRequest(BaseModel):
    reset_token: str = Field(..., min_length=16)
    new_password: str = Field(..., min_length=8)


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
    package: str = Field(..., pattern="^(quick_insight|professional_review|premium_strategy|listing_recovery_assessment|free_trial_assessment)$")
    property_address: Optional[str] = Field(None, max_length=500)
    listing_url: Optional[str] = Field(None, max_length=2000)
    questions_data: dict = Field(default_factory=dict)
    redirect_url: Optional[str] = Field(None, max_length=2000)
    promo_code: Optional[str] = Field(None, max_length=100)


class StaleListingSubmitResponse(BaseModel):
    assessment_id: str
    reference: str
    checkout_url: str
    checkout_id: str
    amount: float
    message: str


class StaleListingPromoVerifyRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100)
    package: str = Field(..., pattern="^(quick_insight|professional_review|premium_strategy|listing_recovery_assessment|free_trial_assessment)$")


class StaleListingPromoVerifyResponse(BaseModel):
    valid: bool
    message: str


class AgencyPricingRequest(BaseModel):
    agency_name: str = Field(..., min_length=1, max_length=200)
    website: Optional[str] = Field(None, max_length=500)
    contact_person: str = Field(..., min_length=1, max_length=200)
    phone: str = Field(..., min_length=4, max_length=50)
    email: EmailStr
    preferred_callback_time: str = Field(..., min_length=1, max_length=200)


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


class StaleListingListingSnapshot(BaseModel):
    title: str = ""
    address: str = ""
    price: str = ""
    image: str = ""
    bedrooms: str = ""
    bathrooms: str = ""
    property_type: str = ""
    platform: str = ""


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
    listing_image_url: Optional[str] = None
    listing_snapshot: Optional[StaleListingListingSnapshot] = None
    report_status: str
    payment_status: str
    report_data: Optional[StaleListingReportData]
    preview_mode: bool = False
    agent_notes: Optional[str] = None
    created_at: str


class StaleProspectLookupRequest(BaseModel):
    property_code: str = Field(..., min_length=4, max_length=12)


class StaleProspectCheckoutRequest(BaseModel):
    token: Optional[str] = Field(None, max_length=200)
    property_code: Optional[str] = Field(None, min_length=4, max_length=12)
    redirect_url: Optional[str] = Field(None, max_length=2000)
    promo_code: Optional[str] = Field(None, max_length=100)
    payment_method: str = Field("card", pattern="^(card|bank_transfer)$")


class StaleProspectConfirmRequest(BaseModel):
    token: Optional[str] = Field(None, max_length=200)
    property_code: Optional[str] = Field(None, min_length=4, max_length=12)


class StaleProspectDetailsRequest(BaseModel):
    token: Optional[str] = Field(None, max_length=200)
    property_code: Optional[str] = Field(None, min_length=4, max_length=12)
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    confirm_email: EmailStr
    mobile_number: str = Field(..., min_length=5, max_length=50)


class StaleProspectAdminCreateRequest(BaseModel):
    rightmove_url: str = Field(..., min_length=8, max_length=2000)
    property_address: Optional[str] = Field(None, max_length=500)
    listing_duration_days: int = Field(180, ge=180)
    asking_price: Optional[float] = Field(None, ge=500000)


class StaleProspectPreviewResponse(BaseModel):
    prospect_id: str
    property_code: str
    property_address: str
    rightmove_url: str
    asking_price: Optional[float] = None
    listing_duration_days: Optional[int] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    listing_snapshot: dict = Field(default_factory=dict)
    preview: dict = Field(default_factory=dict)
    payment_status: str
    is_unlocked: bool
    # Lets the frontend wizard resume at the right step on reload instead of
    # forcing every visit back through Confirm Property / Your Details.
    property_confirmed: bool = False
    has_contact_details: bool = False


class StaleProspectCheckoutResponse(BaseModel):
    prospect_id: str
    property_code: str
    checkout_url: str
    checkout_id: str
    amount: float
    currency: str
    unlocked: bool = False
    payment_method: str = "card"
    bank_transfer_reference: Optional[str] = None
    bank_transfer_account_name: Optional[str] = None
    bank_transfer_account_number: Optional[str] = None
    bank_transfer_bank_name: Optional[str] = None


class StaleProspectConfirmResponse(BaseModel):
    prospect_id: str
    property_code: str
    confirmed: bool


class StaleProspectDetailsResponse(BaseModel):
    prospect_id: str
    property_code: str
    contact_name: str


class StaleProspectReportResponse(BaseModel):
    prospect_id: str
    property_code: str
    property_address: str
    rightmove_url: str
    asking_price: Optional[float] = None
    listing_duration_days: Optional[int] = None
    listing_snapshot: dict = Field(default_factory=dict)
    report_data: dict = Field(default_factory=dict)
    payment_status: str


class StaleProspectAdminCreateResponse(BaseModel):
    prospect_id: str
    property_code: str
    qr_url: str
    preview_url: str
    letter_pdf_path: Optional[str] = None
    email_sent: bool = False


class StaleProspectDiscoveryRunRequest(BaseModel):
    dry_run: bool = True
    location_names: Optional[list[str]] = None
    max_candidates: int = Field(25, ge=1, le=250)
    max_pages_per_location: int = Field(2, ge=1, le=10)
    min_price: int = Field(500000, ge=500000)
    min_days_on_market: int = Field(180, ge=180)


class StaleProspectDiscoveryRunResponse(BaseModel):
    run_id: str
    status: str
    dry_run: bool
    location_names: list[str] = Field(default_factory=list)
    min_price: int
    min_days_on_market: int
    max_candidates: int
    max_pages_per_location: int
    candidates_seen: int = 0
    eligible_count: int = 0
    created_prospects_count: int = 0
    skipped_count: int = 0
    failed_count: int = 0
    results: dict = Field(default_factory=dict)
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: Optional[str] = None


class StaleListingAdminItem(BaseModel):
    assessment_id: str
    reference: str
    email: str
    first_name: str
    last_name: str
    package: str
    property_address: Optional[str]
    listing_url: Optional[str]
    listing_image_url: Optional[str] = None
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


class ProductAccessRequest(BaseModel):
    email: EmailStr


class ProductAccessConsumeRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=512)


class ProductAccessRequestResponse(BaseModel):
    ok: bool = True
    message: str


class ProductAccessConsumeResponse(BaseModel):
    scope: str
    email: EmailStr
    session_token: str
    redirect_path: str
    outcome: str
    records_count: int
    reference: Optional[str] = None


class StaleListingReviewConsumeResponse(BaseModel):
    email: EmailStr
    session_token: str
    redirect_path: str
    assessment_id: str
    reference: str


class StaleListingPortalItem(BaseModel):
    assessment_id: str
    reference: str
    property_address: str = ""
    package: str
    payment_status: str
    report_status: str
    created_at: str


class StaleListingPortalResponse(BaseModel):
    email: EmailStr
    items: list[StaleListingPortalItem] = Field(default_factory=list)


class CustomOfferPortalItem(BaseModel):
    submission_id: str
    reference: str
    property_address: str = ""
    plan_name: str
    payment_status: str
    proposal_status: str
    created_at: str


class CustomOfferPortalResponse(BaseModel):
    email: EmailStr
    items: list[CustomOfferPortalItem] = Field(default_factory=list)


# - Custom Offers -------------------------------------------------------------

class CustomOfferPropertySnapshot(BaseModel):
    title: str = ""
    address: str = ""
    price: str = ""
    description: str = ""
    url: str = ""
    images: list[str] = Field(default_factory=list)
    image: str = ""
    bedrooms: str = ""
    bathrooms: str = ""
    property_type: str = ""
    listed_date: str = ""
    features: list[str] = Field(default_factory=list)
    floor_area: str = ""
    platform: str = ""
    blocked: bool = False


class CustomOfferPropertyOverrides(BaseModel):
    title: Optional[str] = None
    address: Optional[str] = None
    price: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    bedrooms: Optional[str] = None
    bathrooms: Optional[str] = None
    property_type: Optional[str] = None


class CustomOfferStepAnswers(BaseModel):
    property_interest: str = ""
    proposal_type: str = ""
    proposed_offer: str = ""
    seller_consideration: str = ""
    flexible_terms: list[str] = Field(default_factory=list)
    buyer_status: str = ""
    proceed_timing: str = ""
    viewed_state: str = ""
    presentation_primary: str = ""
    presentation_risk: str = ""
    presentation_style: str = ""
    full_name: str = ""
    email: EmailStr
    phone: str = Field(..., min_length=4, max_length=50)
    confirm_responses_not_guaranteed: bool = False
    confirm_non_refundable: bool = False
    confirm_information_accurate: bool = False


class CustomOfferScrapeRequest(BaseModel):
    listing_url: str = Field(..., min_length=8, max_length=2000)


class CustomOfferScrapeResponse(BaseModel):
    status: str
    platform: str
    message: str
    property: CustomOfferPropertySnapshot
    missing_fields: list[str] = Field(default_factory=list)


class CustomOfferSubmitRequest(BaseModel):
    listing_url: Optional[str] = Field(None, max_length=2000)
    property_address: Optional[str] = Field(None, max_length=500)
    property_snapshot: CustomOfferPropertySnapshot
    property_overrides: CustomOfferPropertyOverrides = Field(default_factory=CustomOfferPropertyOverrides)
    proposal_data: CustomOfferStepAnswers
    plan_id: str = Field(..., pattern="^(connect|standout|advantage)$")
    redirect_url: Optional[str] = Field(None, max_length=2000)


class CustomOfferSubmitResponse(BaseModel):
    submission_id: str
    reference: str
    checkout_url: str = ""
    checkout_id: str = ""
    amount: float
    currency: str
    message: str


class CustomOfferStatusResponse(BaseModel):
    submission_id: str
    reference: str
    created_at: str
    listing_url: str
    listing_platform: str
    plan_id: str
    plan_name: str
    payment_status: str
    proposal_status: str
    property: CustomOfferPropertySnapshot
    property_overrides: CustomOfferPropertyOverrides
    answers: CustomOfferStepAnswers
    buyer_name: str


class CustomOfferAdminItem(CustomOfferStatusResponse):
    updated_at: str
    buyer_email: str
    buyer_phone: str
    admin_notes: Optional[str] = None


class CustomOfferPaymentVerifyResponse(BaseModel):
    payment_status: str
    proposal_status: str
    reference: str
    portal_session_token: Optional[str] = None
    portal_session_email: Optional[EmailStr] = None
    portal_redirect_path: Optional[str] = None


class CustomOfferAdminUpdateRequest(BaseModel):
    proposal_status: Optional[str] = Field(
        None,
        pattern="^(submitted|awaiting_seller_review|seller_interested|seller_not_interested|closed)$",
    )
    admin_notes: Optional[str] = None
