"""Add country ('UK' | 'US') to stale_listing_prospects and
stale_listing_discovery_runs, for the America (Zillow) prospects console.
Every existing row is a UK/Rightmove row, so the constant default backfills
them all with no table rewrite.

Revision ID: 20260920_0019
Revises: 20260916_0018
Create Date: 2026-09-20
"""

from __future__ import annotations

from alembic import op


revision = "20260920_0019"
down_revision = "20260916_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'UK'")
    op.execute("ALTER TABLE stale_listing_discovery_runs ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'UK'")


def downgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS country")
    op.execute("ALTER TABLE stale_listing_discovery_runs DROP COLUMN IF EXISTS country")
