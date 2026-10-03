"""Competing-listings count for the ads funnel's Confirm Property summary.

Revision ID: 20261003_0033
Revises: 20261003_0032
Create Date: 2026-10-03

competition_json holds how many similar homes are for sale around the
property, from Rightmove's search (app/services/ads_funnel.py), or a
"pending" marker while that search runs.
"""
from alembic import op

revision = "20261003_0033"
down_revision = "20261003_0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS competition_json TEXT")
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS competition_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS competition_at")
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS competition_json")
