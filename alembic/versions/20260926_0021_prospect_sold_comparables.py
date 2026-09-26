"""Stale-listing prospects: cached HM Land Registry comparable sales.

Revision ID: 20260926_0021
Revises: 20260925_0020
Create Date: 2026-09-26

Comparable sold prices on the assessment page, full report and letters now
come from HM Land Registry's Price Paid Data instead of the AI. Lookups take
several seconds, so each prospect keeps its latest result.
"""
from alembic import op

revision = "20260926_0021"
down_revision = "20260925_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            ADD COLUMN IF NOT EXISTS sold_comparables_json TEXT,
            ADD COLUMN IF NOT EXISTS sold_comparables_at TIMESTAMPTZ
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            DROP COLUMN IF EXISTS sold_comparables_at,
            DROP COLUMN IF EXISTS sold_comparables_json
        """
    )
