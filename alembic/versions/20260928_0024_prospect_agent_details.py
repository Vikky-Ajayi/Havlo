"""Stale-listing prospects: the estate agent marketing each listing.

Revision ID: 20260928_0024
Revises: 20260927_0023
Create Date: 2026-09-28

For the agent campaign (one letter per agency company listing its stale
properties): branch and company details from the Rightmove listing page.
"""
from alembic import op

revision = "20260928_0024"
down_revision = "20260927_0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            ADD COLUMN IF NOT EXISTS agent_branch_id VARCHAR(20),
            ADD COLUMN IF NOT EXISTS agent_company_name VARCHAR(300),
            ADD COLUMN IF NOT EXISTS agent_brand VARCHAR(200),
            ADD COLUMN IF NOT EXISTS agent_branch_name VARCHAR(300),
            ADD COLUMN IF NOT EXISTS agent_address TEXT,
            ADD COLUMN IF NOT EXISTS agent_phone VARCHAR(40),
            ADD COLUMN IF NOT EXISTS agent_logo_url TEXT,
            ADD COLUMN IF NOT EXISTS agent_profile_url TEXT,
            ADD COLUMN IF NOT EXISTS agent_checked_at TIMESTAMPTZ
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_agent_branch_id "
        "ON stale_listing_prospects (agent_branch_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_agent_company_name "
        "ON stale_listing_prospects (agent_company_name)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_agent_company_name")
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_agent_branch_id")
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            DROP COLUMN IF EXISTS agent_checked_at,
            DROP COLUMN IF EXISTS agent_profile_url,
            DROP COLUMN IF EXISTS agent_logo_url,
            DROP COLUMN IF EXISTS agent_phone,
            DROP COLUMN IF EXISTS agent_address,
            DROP COLUMN IF EXISTS agent_branch_name,
            DROP COLUMN IF EXISTS agent_brand,
            DROP COLUMN IF EXISTS agent_company_name,
            DROP COLUMN IF EXISTS agent_branch_id
        """
    )
