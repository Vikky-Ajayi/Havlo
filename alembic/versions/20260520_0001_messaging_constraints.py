"""Add messaging constraints and indexes.

Revision ID: 20260520_0001
Revises:
Create Date: 2026-05-20
"""
from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260520_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS is_admin_conversation BOOLEAN NOT NULL DEFAULT FALSE;
        """
    )
    op.execute(
        """
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_one_admin_convo_per_user
        ON conversations (user_id)
        WHERE is_admin_conversation = TRUE;
        """
    )
    op.execute(
        """
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
        """
    )
    op.execute(
        """
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS sms_notification_sent BOOLEAN NOT NULL DEFAULT FALSE;
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_messages_conversation_id_created
        ON messages (conversation_id, created_at ASC);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_messages_unread
        ON messages (conversation_id, is_read, sender_type);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_messages_unread;")
    op.execute("DROP INDEX IF EXISTS ix_messages_conversation_id_created;")
    op.execute("DROP INDEX IF EXISTS uq_one_admin_convo_per_user;")
