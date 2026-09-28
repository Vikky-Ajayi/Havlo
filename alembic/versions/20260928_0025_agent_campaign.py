"""Agent campaign: agency accounts, and agent copies of prospects.

Revision ID: 20260928_0025
Revises: 20260928_0024
Create Date: 2026-09-28

One letter per estate agency company listing its stale properties; the
agency enters its code at /check/agent, sees those properties, and opening
one makes its own copy of the prospect (audience = 'agent') that goes
through the normal funnel separately from the owner's.
"""
from alembic import op

revision = "20260928_0025"
down_revision = "20260928_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            ADD COLUMN IF NOT EXISTS audience VARCHAR(10) NOT NULL DEFAULT 'owner',
            ADD COLUMN IF NOT EXISTS agent_account_id UUID,
            ADD COLUMN IF NOT EXISTS parent_prospect_id UUID
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_agent_account_id "
        "ON stale_listing_prospects (agent_account_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_parent_prospect_id "
        "ON stale_listing_prospects (parent_prospect_id)"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS stale_agent_accounts (
            id UUID PRIMARY KEY,
            company_key VARCHAR(300) NOT NULL UNIQUE,
            company_name VARCHAR(300) NOT NULL,
            company_names_json TEXT NOT NULL DEFAULT '[]',
            brand VARCHAR(200),
            agent_code VARCHAR(8) NOT NULL UNIQUE,
            qr_token_hashes VARCHAR(64)[] NOT NULL DEFAULT '{}',
            letter_branch_id VARCHAR(20),
            letter_branch_name VARCHAR(300),
            letter_address TEXT,
            letter_phone VARCHAR(40),
            logo_url TEXT,
            listing_count INTEGER NOT NULL DEFAULT 0,
            letter_first_downloaded_at TIMESTAMPTZ,
            code_looked_up_at TIMESTAMPTZ,
            last_viewed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS stale_agent_accounts")
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_parent_prospect_id")
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_agent_account_id")
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            DROP COLUMN IF EXISTS parent_prospect_id,
            DROP COLUMN IF EXISTS agent_account_id,
            DROP COLUMN IF EXISTS audience
        """
    )
