from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ProductAccessToken
from app.services.product_access import (
    STALE_LISTINGS_REVIEW_SCOPE,
    build_stale_review_magic_link,
    create_stale_review_magic_token,
    hash_magic_token,
    magic_link_expiry,
    normalize_email,
    utcnow,
)


async def issue_stale_review_magic_link(
    db: AsyncSession,
    *,
    recipient_email: str,
    assessment_id: str,
    reference: str,
) -> str:
    normalized_email = normalize_email(recipient_email)
    now = utcnow()

    await db.execute(
        ProductAccessToken.__table__.update()
        .where(
            ProductAccessToken.product_scope == STALE_LISTINGS_REVIEW_SCOPE,
            func.lower(ProductAccessToken.email) == normalized_email,
            ProductAccessToken.used_at.is_(None),
            ProductAccessToken.expires_at > now,
        )
        .values(used_at=now)
    )

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
            expires_at=magic_link_expiry(),
        )
    )
    await db.commit()
    return build_stale_review_magic_link(raw_token)
