"""Backfill Havlo Advisory conversations for users with none.

Usage:
  python scripts/backfill_missing_admin_conversations.py
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.models.models import Conversation, User


async def main() -> None:
    inserted = 0
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User.id))).scalars().all()
        for user_id in users:
            existing = (
                await db.execute(
                    select(Conversation.id).where(Conversation.user_id == user_id).limit(1)
                )
            ).scalar_one_or_none()
            if existing:
                continue
            db.add(
                Conversation(
                    user_id=user_id,
                    team_member_name="Havlo Advisory",
                    team_member_initials="HA",
                    team_member_color="#0052B4",
                    subject="Welcome to Havlo - we're here to help",
                    is_admin_conversation=True,
                    unread_count=0,
                )
            )
            inserted += 1
        await db.commit()
    print(f"Inserted conversations: {inserted}")

    print("Backfill complete.")


if __name__ == "__main__":
    asyncio.run(main())
