"""Ensure messaging columns/indexes exist in the current database.

Usage:
  python scripts/ensure_messaging_columns.py
"""
from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.db.database import engine


STATEMENTS = [
    """
    ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS is_admin_conversation BOOLEAN NOT NULL DEFAULT FALSE;
    """,
    """
    ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_one_admin_convo_per_user
    ON conversations (user_id)
    WHERE is_admin_conversation = TRUE;
    """,
    """
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
    """,
    """
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS sms_notification_sent BOOLEAN NOT NULL DEFAULT FALSE;
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_messages_conversation_id_created
    ON messages (conversation_id, created_at ASC);
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_messages_unread
    ON messages (conversation_id, is_read, sender_type);
    """,
]


CHECKS = [
    ("conversations", "is_admin_conversation"),
    ("conversations", "unread_count"),
    ("messages", "is_read"),
    ("messages", "sms_notification_sent"),
]


async def main() -> None:
    async with engine.begin() as conn:
        if conn.dialect.name != "postgresql":
            raise RuntimeError("This script is intended for PostgreSQL databases.")

        for sql in STATEMENTS:
            await conn.execute(text(sql))

        for table_name, column_name in CHECKS:
            exists = await conn.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = :table_name
                          AND column_name = :column_name
                    ) AS present
                    """
                ),
                {"table_name": table_name, "column_name": column_name},
            )
            present = bool(exists.scalar_one())
            print(f"{table_name}.{column_name}: {'OK' if present else 'MISSING'}")

    print("Messaging schema checks completed.")


if __name__ == "__main__":
    asyncio.run(main())
