"""Add postcode to stale_listing_prospects.

Rightmove's public displayAddress never includes a full postcode (outcode
at most) — the PAGE_MODEL address object underneath it separately carries
outcode and incode though, since they drive the map pin, so the scraper
now combines them into a real postcode at detail-scrape time (see
_combine_postcode in listing_scraper.py). Needed to actually address the
physical letters — property_address alone isn't enough for that.

Revision ID: 20260830_0012
Revises: 20260828_0011
Create Date: 2026-08-30
"""

from __future__ import annotations

from alembic import op


revision = "20260830_0012"
down_revision = "20260828_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS postcode VARCHAR(10)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS postcode")
