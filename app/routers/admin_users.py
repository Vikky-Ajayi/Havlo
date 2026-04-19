"""Admin user management — list and delete users with cascade."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.dependencies import require_admin
from app.models.models import (
    BuyerNetworkApplication,
    Conversation,
    ElitePropertyApplication,
    Message,
    OnboardingData,
    Payment,
    PropertyMatchingRequest,
    SaleAuditRequest,
    SellFasterApplication,
    SessionBooking,
    User,
)

router = APIRouter(prefix="/admin", tags=["admin-users"])


class AdminUserRow(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    full_name: str
    role: str
    is_admin: bool
    phone: str
    created_at: datetime


@router.get("/users", response_model=list[AdminUserRow])
async def list_all_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[AdminUserRow]:
    rows = (
        await db.execute(select(User).order_by(User.created_at.desc()))
    ).scalars().all()
    return [
        AdminUserRow(
            id=str(u.id),
            email=u.email,
            first_name=u.first_name,
            last_name=u.last_name,
            full_name=u.full_name,
            role=u.role.value,
            is_admin=bool(u.is_admin),
            phone=u.full_phone,
            created_at=u.created_at,
        )
        for u in rows
    ]


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user ID.")

    if uid == admin.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You cannot delete your own admin account.",
        )

    target = (
        await db.execute(select(User).where(User.id == uid))
    ).scalar_one_or_none()
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")

    target_email = target.email

    # Delete messages tied to this user's conversations first
    convo_ids_rows = (
        await db.execute(select(Conversation.id).where(Conversation.user_id == uid))
    ).scalars().all()
    if convo_ids_rows:
        await db.execute(
            delete(Message).where(Message.conversation_id.in_(convo_ids_rows))
        )
        await db.execute(delete(Conversation).where(Conversation.user_id == uid))

    # Delete every other related row
    for model in (
        OnboardingData,
        SessionBooking,
        Payment,
        PropertyMatchingRequest,
        ElitePropertyApplication,
        SellFasterApplication,
        SaleAuditRequest,
        BuyerNetworkApplication,
    ):
        await db.execute(delete(model).where(model.user_id == uid))

    # Finally delete the user
    await db.execute(delete(User).where(User.id == uid))
    await db.commit()

    return {"deleted": True, "email": target_email, "id": str(uid)}
