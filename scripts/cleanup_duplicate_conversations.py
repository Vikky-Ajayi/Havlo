"""Run once to clean up duplicate admin conversations.

Keeps the oldest admin conversation per user and deletes the rest.
"""
import asyncio

from sqlalchemy import delete, select

from app.db.database import AsyncSessionLocal
from app.models.models import Conversation


async def cleanup() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Conversation)
            .where(Conversation.is_admin_conversation.is_(True))
            .order_by(Conversation.user_id, Conversation.created_at.asc())
        )
        convos = result.scalars().all()

        seen_users = set()
        to_delete = []
        for conv in convos:
            if conv.user_id in seen_users:
                to_delete.append(conv.id)
            else:
                seen_users.add(conv.user_id)

        if to_delete:
            await db.execute(delete(Conversation).where(Conversation.id.in_(to_delete)))
            await db.commit()
            print(f"Deleted {len(to_delete)} duplicate conversations")
        else:
            print("No duplicates found")


if __name__ == "__main__":
    asyncio.run(cleanup())
