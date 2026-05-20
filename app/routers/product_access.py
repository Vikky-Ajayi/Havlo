from __future__ import annotations

import json
import uuid
from typing import Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.models import CustomOfferSubmission, ProductAccessToken, StaleListingAssessment
from app.schemas.schemas import (
    CustomOfferPortalItem,
    CustomOfferPortalResponse,
    ProductAccessConsumeRequest,
    ProductAccessConsumeResponse,
    ProductAccessRequest,
    ProductAccessRequestResponse,
    StaleListingAdminFinalizeRequest,
    StaleListingAdminItem,
    StaleListingPortalItem,
    StaleListingPortalResponse,
    StaleListingReviewConsumeResponse,
)
from app.services.email_service import (
    send_product_access_magic_link,
    send_stale_listing_report_ready_sync,
)
from app.services.product_access import (
    CUSTOM_OFFERS_SCOPE,
    STALE_LISTINGS_SCOPE,
    STALE_LISTINGS_REVIEW_SCOPE,
    build_magic_link,
    create_product_access_session,
    create_stale_review_session,
    decode_stale_review_magic_token,
    decode_stale_review_session,
    decode_product_access_session,
    ensure_scope,
    generate_magic_token,
    hash_magic_token,
    magic_link_expiry,
    normalize_email,
    scope_label,
    scope_portal_path,
    utcnow,
)

router = APIRouter(tags=["Product Access"])

Scope = Literal["stale-listings", "custom-offers"]


def _authorization_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return token.strip()


def _load_json(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _custom_offer_address(submission: CustomOfferSubmission) -> str:
    snapshot = _load_json(submission.property_snapshot_json)
    overrides = _load_json(submission.property_override_json)
    for field in ("address", "title"):
        value = str(overrides.get(field) or snapshot.get(field) or "").strip()
        if value:
            return value
    return "Property not confirmed"


def _serialize_stale_admin_item(item: StaleListingAssessment) -> StaleListingAdminItem:
    return StaleListingAdminItem(
        assessment_id=str(item.id),
        reference=item.reference,
        email=item.email,
        first_name=item.first_name,
        last_name=item.last_name,
        package=item.package,
        property_address=item.property_address,
        listing_url=item.listing_url,
        listing_image_url=item.listing_image_url,
        questions_data=item.questions_data,
        report_status=item.report_status,
        payment_status=item.payment_status,
        created_at=item.created_at.isoformat() if item.created_at else "",
        ai_report_json=item.ai_report_json,
        agent_edited_report_json=item.agent_edited_report_json,
        agent_notes=item.agent_notes,
    )


async def _request_magic_link(
    db: AsyncSession,
    *,
    scope: Scope,
    email: str,
) -> ProductAccessRequestResponse:
    normalized_email = normalize_email(email)
    now = utcnow()

    await db.execute(
        ProductAccessToken.__table__.update()
        .where(
            ProductAccessToken.product_scope == scope,
            func.lower(ProductAccessToken.email) == normalized_email,
            ProductAccessToken.used_at.is_(None),
            ProductAccessToken.expires_at > now,
        )
        .values(used_at=now)
    )

    raw_token = generate_magic_token()
    db.add(
        ProductAccessToken(
            email=normalized_email,
            product_scope=scope,
            token_hash=hash_magic_token(raw_token),
            expires_at=magic_link_expiry(),
        )
    )
    await db.commit()

    sent = await send_product_access_magic_link(
        normalized_email,
        scope_label=scope_label(scope),
        magic_link=build_magic_link(scope, raw_token),
    )
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="We couldn't send your sign-in email right now. Please try again.",
        )

    return ProductAccessRequestResponse(
        ok=True,
        message="If we found a matching record, we've sent a secure sign-in link to your email address.",
    )


async def _consume_magic_link(
    db: AsyncSession,
    *,
    scope: Scope,
    token: str,
) -> ProductAccessConsumeResponse:
    hashed = hash_magic_token(token)
    result = await db.execute(
        select(ProductAccessToken).where(
            ProductAccessToken.product_scope == scope,
            ProductAccessToken.token_hash == hashed,
        )
    )
    access_token = result.scalar_one_or_none()
    if not access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This magic link is invalid.")
    if access_token.used_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This magic link has already been used.")
    if access_token.expires_at <= utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This magic link has expired. Please request a new one.")

    access_token.used_at = utcnow()
    await db.commit()

    normalized_email = normalize_email(access_token.email)
    session_token = create_product_access_session(normalized_email, scope)

    if scope == STALE_LISTINGS_SCOPE:
        records_result = await db.execute(
            select(StaleListingAssessment)
            .where(func.lower(StaleListingAssessment.email) == normalized_email)
            .order_by(StaleListingAssessment.created_at.desc())
        )
        records = list(records_result.scalars().all())
        if len(records) == 1:
            reference = records[0].reference
            return ProductAccessConsumeResponse(
                scope=scope,
                email=normalized_email,
                session_token=session_token,
                redirect_path=f"/stale-listings/report/{reference}",
                outcome="single-record",
                records_count=1,
                reference=reference,
            )
    else:
        records_result = await db.execute(
            select(CustomOfferSubmission)
            .where(func.lower(CustomOfferSubmission.buyer_email) == normalized_email)
            .order_by(CustomOfferSubmission.created_at.desc())
        )
        records = list(records_result.scalars().all())
        if len(records) == 1:
            reference = records[0].reference
            return ProductAccessConsumeResponse(
                scope=scope,
                email=normalized_email,
                session_token=session_token,
                redirect_path=f"/custom-offers/status/{reference}",
                outcome="single-record",
                records_count=1,
                reference=reference,
            )

    return ProductAccessConsumeResponse(
        scope=scope,
        email=normalized_email,
        session_token=session_token,
        redirect_path=scope_portal_path(scope),
        outcome="portal",
        records_count=len(records),
        reference=None,
    )


def _session_email(authorization: str | None, *, scope: Scope) -> str:
    token = _authorization_token(authorization)
    try:
        payload = decode_product_access_session(token, expected_scope=scope)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return payload["email"]


def _review_session(authorization: str | None) -> dict[str, str]:
    token = _authorization_token(authorization)
    try:
        return decode_stale_review_session(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post(
    "/stale-listings/access/request",
    response_model=ProductAccessRequestResponse,
)
async def request_stale_listings_magic_link(
    payload: ProductAccessRequest,
    db: AsyncSession = Depends(get_db),
) -> ProductAccessRequestResponse:
    return await _request_magic_link(db, scope=STALE_LISTINGS_SCOPE, email=payload.email)


@router.post(
    "/stale-listings/access/consume",
    response_model=ProductAccessConsumeResponse,
)
async def consume_stale_listings_magic_link(
    payload: ProductAccessConsumeRequest,
    db: AsyncSession = Depends(get_db),
) -> ProductAccessConsumeResponse:
    return await _consume_magic_link(db, scope=STALE_LISTINGS_SCOPE, token=payload.token)


@router.get(
    "/stale-listings/access/records",
    response_model=StaleListingPortalResponse,
)
async def stale_listings_portal_records(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> StaleListingPortalResponse:
    email = _session_email(authorization, scope=STALE_LISTINGS_SCOPE)
    result = await db.execute(
        select(StaleListingAssessment)
        .where(func.lower(StaleListingAssessment.email) == email)
        .order_by(StaleListingAssessment.created_at.desc())
    )
    items = [
        StaleListingPortalItem(
            assessment_id=str(item.id),
            reference=item.reference,
            property_address=item.property_address or "Property not confirmed",
            package=item.package,
            payment_status=item.payment_status,
            report_status=item.report_status,
            created_at=item.created_at.isoformat() if item.created_at else "",
        )
        for item in result.scalars().all()
    ]
    return StaleListingPortalResponse(email=email, items=items)


@router.post(
    "/stale-listings/review-access/consume",
    response_model=StaleListingReviewConsumeResponse,
)
async def consume_stale_listings_review_magic_link(
    payload: ProductAccessConsumeRequest,
    db: AsyncSession = Depends(get_db),
) -> StaleListingReviewConsumeResponse:
    hashed = hash_magic_token(payload.token)
    result = await db.execute(
        select(ProductAccessToken).where(
            ProductAccessToken.product_scope == STALE_LISTINGS_REVIEW_SCOPE,
            ProductAccessToken.token_hash == hashed,
        )
    )
    access_token = result.scalar_one_or_none()
    if not access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This review link is invalid.")
    if access_token.used_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This review link has already been used.")
    if access_token.expires_at <= utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This review link has expired. Please request a new one.")

    try:
        decoded = decode_stale_review_magic_token(payload.token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    assessment_result = await db.execute(
        select(StaleListingAssessment).where(
            StaleListingAssessment.id == uuid.UUID(decoded["assessment_id"])
        )
    )
    assessment = assessment_result.scalar_one_or_none()
    if not assessment or assessment.reference != decoded["reference"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="The assessment for this review link could not be found.")

    access_token.used_at = utcnow()
    await db.commit()

    session_token = create_stale_review_session(
        decoded["email"],
        assessment_id=str(assessment.id),
        reference=assessment.reference,
    )
    return StaleListingReviewConsumeResponse(
        email=decoded["email"],
        session_token=session_token,
        redirect_path=f"/stale-listings/review-dashboard?assessment={assessment.id}",
        assessment_id=str(assessment.id),
        reference=assessment.reference,
    )


@router.get(
    "/stale-listings/review-access/assessment",
    response_model=StaleListingAdminItem,
)
async def stale_listings_review_assessment(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> StaleListingAdminItem:
    session = _review_session(authorization)
    result = await db.execute(
        select(StaleListingAssessment).where(
            StaleListingAssessment.id == uuid.UUID(session["assessment_id"])
        )
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found.")
    if assessment.reference != session["reference"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This review session is no longer valid.")
    return _serialize_stale_admin_item(assessment)


@router.put(
    "/stale-listings/review-access/assessment/finalize",
)
async def finalize_stale_listings_review_assessment(
    payload: StaleListingAdminFinalizeRequest,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    session = _review_session(authorization)
    result = await db.execute(
        select(StaleListingAssessment).where(
            StaleListingAssessment.id == uuid.UUID(session["assessment_id"])
        )
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found.")
    if assessment.reference != session["reference"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This review session is no longer valid.")

    if payload.agent_notes is not None:
        assessment.agent_notes = payload.agent_notes
    if payload.agent_edited_report_json is not None:
        assessment.agent_edited_report_json = payload.agent_edited_report_json

    prev_status = assessment.report_status
    assessment.report_status = payload.report_status
    await db.commit()

    if payload.report_status == "completed" and prev_status != "completed":
        background_tasks.add_task(
            send_stale_listing_report_ready_sync,
            to_email=assessment.email,
            first_name=assessment.first_name,
            reference=assessment.reference,
        )

    return {"ok": True, "report_status": assessment.report_status}


@router.post(
    "/custom-offers/access/request",
    response_model=ProductAccessRequestResponse,
)
async def request_custom_offers_magic_link(
    payload: ProductAccessRequest,
    db: AsyncSession = Depends(get_db),
) -> ProductAccessRequestResponse:
    return await _request_magic_link(db, scope=CUSTOM_OFFERS_SCOPE, email=payload.email)


@router.post(
    "/custom-offers/access/consume",
    response_model=ProductAccessConsumeResponse,
)
async def consume_custom_offers_magic_link(
    payload: ProductAccessConsumeRequest,
    db: AsyncSession = Depends(get_db),
) -> ProductAccessConsumeResponse:
    return await _consume_magic_link(db, scope=CUSTOM_OFFERS_SCOPE, token=payload.token)


@router.get(
    "/custom-offers/access/records",
    response_model=CustomOfferPortalResponse,
)
async def custom_offers_portal_records(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> CustomOfferPortalResponse:
    email = _session_email(authorization, scope=CUSTOM_OFFERS_SCOPE)
    result = await db.execute(
        select(CustomOfferSubmission)
        .where(func.lower(CustomOfferSubmission.buyer_email) == email)
        .order_by(CustomOfferSubmission.created_at.desc())
    )
    items = [
        CustomOfferPortalItem(
            submission_id=str(item.id),
            reference=item.reference,
            property_address=_custom_offer_address(item),
            plan_name=item.plan_name,
            payment_status=item.payment_status,
            proposal_status=item.proposal_status,
            created_at=item.created_at.isoformat() if item.created_at else "",
        )
        for item in result.scalars().all()
    ]
    return CustomOfferPortalResponse(email=email, items=items)
