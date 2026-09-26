"""Retry sold-comparables lookups that were saved as "none found".

Revision ID: 20260926_0022
Revises: 20260926_0021
Create Date: 2026-09-26

The first version treated a postcodes.io error as "postcode not found" and
saved it as "no sales" for 30 days. Those empty results are cleared so the
backfill looks them up again; genuine "none found" results simply get
re-confirmed.
"""
from alembic import op

revision = "20260926_0022"
down_revision = "20260926_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE stale_listing_prospects
        SET sold_comparables_json = NULL, sold_comparables_at = NULL
        WHERE sold_comparables_json = '[]'
        """
    )


def downgrade() -> None:
    pass
