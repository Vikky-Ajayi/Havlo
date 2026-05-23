from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ProductAccessToken
from app.services.product_access import (
    STALE_LISTINGS_REVIEW_SCOPE,
    build_stale_review_magic_link,
    create_stale_review_magic_token,
    hash_magic_token,
    normalize_email,
    review_link_storage_expiry,
)


async def issue_stale_review_magic_link(
    db: AsyncSession,
    *,
    recipient_email: str,
    assessment_id: str,
    reference: str,
) -> str:
    normalized_email = normalize_email(recipient_email)

    raw_token = create_stale_review_magic_token(
        normalized_email,
        assessment_id=assessment_id,
        reference=reference,
    )
    db.add(
        ProductAccessToken(
            email=normalized_email,
            product_scope=STALE_LISTINGS_REVIEW_SCOPE,
            token_hash=hash_magic_token(raw_token),
            expires_at=review_link_storage_expiry(),
        )
    )
    await db.commit()
    return build_stale_review_magic_link(raw_token)
