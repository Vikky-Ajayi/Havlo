"""
FastAPI dependencies:
  - get_current_user   → returns the DB User for any authenticated request
  - require_roles      → factory that creates a role-gated dependency
"""
from __future__ import annotations

import logging
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.models.models import User
from app.services.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)
security = HTTPBearer()

# ── Role → allowed dashboard routes mapping ────────────────────────────────────
ROLE_ALLOWED_ROUTES: dict[str, set[str]] = {
    "buyer": {
        "dashboard",
        "dashboard/property-matching",
        "dashboard/inbox",
        "dashboard/settings",
        "book-session",
    },
    "seller": {
        "dashboard",
        "dashboard/elite-property",
        "dashboard/sell-faster",
        "dashboard/sale-audit",
        "dashboard/buyer-network",
        "dashboard/inbox",
        "dashboard/settings",
        "book-session",
    },
    "agent": {
        "dashboard",
        "dashboard/property-matching",
        "dashboard/elite-property",
        "dashboard/sell-faster",
        "dashboard/sale-audit",
        "dashboard/buyer-network",
        "dashboard/inbox",
        "dashboard/settings",
        "book-session",
    },
}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate the Supabase JWT and return the corresponding DB User."""
    token = credentials.credentials
    exc_401 = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        admin = get_supabase_admin()
        # Supabase admin client can verify JWTs issued by the project
        response = admin.auth.get_user(token)
        supabase_user = response.user
        if supabase_user is None:
            raise exc_401
    except Exception as exc:
        logger.warning("Token verification failed: %s", exc)
        raise exc_401

    result = await db.execute(
        select(User).where(User.supabase_uid == supabase_user.id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please complete registration.",
        )
    return user


def require_roles(*roles: str) -> Callable:
    """
    Dependency factory — ensures the authenticated user has one of the given roles.

    Usage:
        @router.get("/seller-only", dependencies=[Depends(require_roles("seller", "agent"))])
    """
    async def _check_role(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}",
            )
        return current_user

    return _check_role
