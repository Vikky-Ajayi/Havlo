"""Add letter_first_downloaded_at to stale_listing_prospects — the anchor
timestamp for the date printed on the letter PDF, set once on the first
actual download from the prospects console and never reset after (see
download_console_letter_pdf).

Revision ID: 20260903_0014
Revises: 20260830_0013
Create Date: 2026-09-03
"""

from __future__ import annotations

from alembic import op


revision = "20260903_0014"
down_revision = "20260830_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            ADD COLUMN IF NOT EXISTS letter_first_downloaded_at TIMESTAMPTZ
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            DROP COLUMN IF EXISTS letter_first_downloaded_at
        """
    )
