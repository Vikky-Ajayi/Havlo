"""Add code_looked_up_at to stale_listing_prospects -- the first time a
customer's code/token was actually looked up (see _get_prospect_by_access
in stale_listings.py). Earliest real signal of customer intent, ahead of
property_confirmed_at / contact_details_submitted_at, needed so the
Follow Up console tab can show "entered a code but didn't even confirm"
prospects instead of only ones who got as far as submitting details.

Revision ID: 20260905_0015
Revises: 20260903_0014
Create Date: 2026-09-05
"""

from __future__ import annotations

from alembic import op


revision = "20260905_0015"
down_revision = "20260903_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            ADD COLUMN IF NOT EXISTS code_looked_up_at TIMESTAMPTZ
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            DROP COLUMN IF EXISTS code_looked_up_at
        """
    )
