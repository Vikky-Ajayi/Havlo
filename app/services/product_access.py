from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from jose import JWTError, jwt

from app.config import get_settings

STALE_LISTINGS_SCOPE = "stale-listings"
CUSTOM_OFFERS_SCOPE = "custom-offers"
STALE_LISTINGS_REVIEW_SCOPE = "stale-listings-review"
PRODUCT_ACCESS_SCOPES = {STALE_LISTINGS_SCOPE, CUSTOM_OFFERS_SCOPE}

MAGIC_LINK_EXPIRY_MINUTES = 30
SESSION_EXPIRY_DAYS = 14
REVIEW_MAGIC_STORAGE_EXPIRY_DAYS = 36500
SESSION_AUDIENCE = "havlo-product-access"
SESSION_TYPE = "product-access-session"
REVIEW_MAGIC_AUDIENCE = "havlo-stale-review-magic"
REVIEW_MAGIC_TYPE = "stale-review-magic"
REVIEW_SESSION_AUDIENCE = "havlo-stale-review-session"
REVIEW_SESSION_TYPE = "stale-review-session"
REVIEW_SESSION_EXPIRY_DAYS = 7


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def ensure_scope(scope: str) -> str:
    if scope not in PRODUCT_ACCESS_SCOPES:
        raise ValueError(f"Unsupported product access scope: {scope}")
    return scope


def generate_magic_token() -> str:
    return secrets.token_urlsafe(32)


def hash_magic_token(raw_token: str) -> str:
    return hashlib.sha256((raw_token or "").encode("utf-8")).hexdigest()


def magic_link_expiry() -> datetime:
    return utcnow() + timedelta(minutes=MAGIC_LINK_EXPIRY_MINUTES)


def review_link_storage_expiry() -> datetime:
    return utcnow() + timedelta(days=REVIEW_MAGIC_STORAGE_EXPIRY_DAYS)


def _frontend_base_url() -> str:
    settings = get_settings()
    return (getattr(settings, "FRONTEND_URL", None) or "https://www.heyhavlo.com").rstrip("/")


def scope_label(scope: str) -> str:
    if scope == STALE_LISTINGS_SCOPE:
        return "Stale Listings"
    if scope == CUSTOM_OFFERS_SCOPE:
        return "Custom Offers"
    return scope


def scope_portal_path(scope: str) -> str:
    ensure_scope(scope)
    return "/stale-listings/portal" if scope == STALE_LISTINGS_SCOPE else "/custom-offers/portal"


def scope_access_path(scope: str) -> str:
    ensure_scope(scope)
    return "/stale-listings/access" if scope == STALE_LISTINGS_SCOPE else "/custom-offers/access"


def build_magic_link(scope: str, raw_token: str) -> str:
    ensure_scope(scope)
    return f"{_frontend_base_url()}{scope_access_path(scope)}?token={quote(raw_token)}"


def build_stale_review_magic_link(raw_token: str) -> str:
    return f"{_frontend_base_url()}/stale-listings/review-access?token={quote(raw_token)}"


def create_product_access_session(email: str, scope: str) -> str:
    ensure_scope(scope)
    settings = get_settings()
    issued_at = utcnow()
    payload = {
        "sub": normalize_email(email),
        "scope": scope,
        "type": SESSION_TYPE,
        "aud": SESSION_AUDIENCE,
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + timedelta(days=SESSION_EXPIRY_DAYS)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_product_access_session(token: str, expected_scope: str | None = None) -> dict[str, str]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
            audience=SESSION_AUDIENCE,
        )
    except JWTError as exc:
        raise ValueError("Invalid product access session.") from exc

    token_type = str(payload.get("type") or "")
    email = normalize_email(str(payload.get("sub") or ""))
    scope = str(payload.get("scope") or "")

    if token_type != SESSION_TYPE or not email:
        raise ValueError("Invalid product access session.")
    ensure_scope(scope)
    if expected_scope and scope != expected_scope:
        raise ValueError("Invalid product access scope.")

    return {"email": email, "scope": scope}


def create_stale_review_magic_token(email: str, assessment_id: str, reference: str) -> str:
    settings = get_settings()
    issued_at = utcnow()
    payload = {
        "sub": normalize_email(email),
        "assessment_id": assessment_id,
        "reference": reference,
        "scope": STALE_LISTINGS_REVIEW_SCOPE,
        "type": REVIEW_MAGIC_TYPE,
        "aud": REVIEW_MAGIC_AUDIENCE,
        "iat": int(issued_at.timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_stale_review_magic_token(token: str) -> dict[str, str]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
            audience=REVIEW_MAGIC_AUDIENCE,
            options={"verify_exp": False},
        )
    except JWTError as exc:
        raise ValueError("This review link is invalid.") from exc

    token_type = str(payload.get("type") or "")
    scope = str(payload.get("scope") or "")
    email = normalize_email(str(payload.get("sub") or ""))
    assessment_id = str(payload.get("assessment_id") or "")
    reference = str(payload.get("reference") or "")

    if token_type != REVIEW_MAGIC_TYPE or scope != STALE_LISTINGS_REVIEW_SCOPE or not email or not assessment_id or not reference:
        raise ValueError("This review link is invalid.")

    return {
        "email": email,
        "assessment_id": assessment_id,
        "reference": reference,
    }


def create_stale_review_session(email: str, assessment_id: str, reference: str) -> str:
    settings = get_settings()
    issued_at = utcnow()
    payload = {
        "sub": normalize_email(email),
        "assessment_id": assessment_id,
        "reference": reference,
        "scope": STALE_LISTINGS_REVIEW_SCOPE,
        "type": REVIEW_SESSION_TYPE,
        "aud": REVIEW_SESSION_AUDIENCE,
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + timedelta(days=REVIEW_SESSION_EXPIRY_DAYS)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_stale_review_session(token: str) -> dict[str, str]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
            audience=REVIEW_SESSION_AUDIENCE,
        )
    except JWTError as exc:
        raise ValueError("Invalid review session.") from exc

    token_type = str(payload.get("type") or "")
    scope = str(payload.get("scope") or "")
    email = normalize_email(str(payload.get("sub") or ""))
    assessment_id = str(payload.get("assessment_id") or "")
    reference = str(payload.get("reference") or "")

    if token_type != REVIEW_SESSION_TYPE or scope != STALE_LISTINGS_REVIEW_SCOPE or not email or not assessment_id or not reference:
        raise ValueError("Invalid review session.")

    return {
        "email": email,
        "assessment_id": assessment_id,
        "reference": reference,
    }
