"""Ads funnel: which ads a property-link reminder sign-up came from, and
when a prospect's listing was logged to the Google Sheet.

Revision ID: 20261007_0034
Revises: 20261003_0033
Create Date: 2026-10-07

"meta" (the /assess/... pages) or "google" (/property-assessment/...), so
the reminder emails link back to the page the visitor came from. Existing
rows are Meta, the only ads running until now.

stale_listing_prospects.ads_sheet_logged_at: set once the listing is on the
"Ads Funnel Listings" tab, so pasting the same link again adds no new row.
"""
from alembic import op

revision = "20261007_0034"
down_revision = "20261003_0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE ads_url_reminder_leads ADD COLUMN IF NOT EXISTS channel VARCHAR(10) NOT NULL DEFAULT 'meta'"
    )
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS ads_sheet_logged_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS ads_sheet_logged_at")
    op.execute("ALTER TABLE ads_url_reminder_leads DROP COLUMN IF EXISTS channel")
