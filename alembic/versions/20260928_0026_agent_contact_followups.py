"""Agent campaign: agency contact details (collected once) and follow-ups.

Revision ID: 20260928_0026
Revises: 20260928_0025
Create Date: 2026-09-28

An agency gives its details once; later properties are pre-filled from the
account, and follow-ups go once per agency (stale_agent_followups records
each one sent).
"""
from alembic import op

revision = "20260928_0026"
down_revision = "20260928_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_agent_accounts
            ADD COLUMN IF NOT EXISTS contact_name VARCHAR(200),
            ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
            ADD COLUMN IF NOT EXISTS contact_details_submitted_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS sms_unsubscribed_at TIMESTAMPTZ
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS stale_agent_followups (
            id UUID PRIMARY KEY,
            account_id UUID NOT NULL,
            channel VARCHAR(10) NOT NULL,
            stage INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_stale_agent_followup_stage UNIQUE (account_id, channel, stage)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_stale_agent_followups_account_id ON stale_agent_followups (account_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS stale_agent_followups")
    op.execute(
        """
        ALTER TABLE stale_agent_accounts
            DROP COLUMN IF EXISTS sms_unsubscribed_at,
            DROP COLUMN IF EXISTS unsubscribed_at,
            DROP COLUMN IF EXISTS contact_details_submitted_at,
            DROP COLUMN IF EXISTS contact_phone,
            DROP COLUMN IF EXISTS contact_email,
            DROP COLUMN IF EXISTS contact_name
        """
    )
