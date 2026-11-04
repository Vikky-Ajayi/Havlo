"""Full report from £49 to £99, with existing leads kept at £49.

Revision ID: 20261104_0038
Revises: 20261022_0037
Create Date: 2026-11-04

stale_listing_prospects.unlock_price / stale_agent_accounts.unlock_price:
the full-report price locked in for a lead or an agency. Every row that
exists when this runs (everyone already in the funnel, who has been shown
£49) gets 49; rows created afterwards stay NULL and pay today's price,
stale_prospect_service.UNLOCK_PRICE (£99).
"""
from alembic import op

revision = "20261104_0038"
down_revision = "20261022_0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("stale_listing_prospects", "stale_agent_accounts"):
        op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS unlock_price DOUBLE PRECISION")
        op.execute(f"UPDATE {table} SET unlock_price = 49 WHERE unlock_price IS NULL")


def downgrade() -> None:
    for table in ("stale_agent_accounts", "stale_listing_prospects"):
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS unlock_price")
