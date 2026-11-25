"""Meta Conversions API tracking for the /assess/seller funnel.

Revision ID: 20261124_0041
Revises: 20261115_0040
Create Date: 2026-11-24

stale_listing_prospects.meta_tracking_json / meta_purchase_sent_at and
stale_prospect_addon_orders.meta_sent_at. See app/services/meta_capi.py.
"""
from alembic import op

revision = "20261124_0041"
down_revision = "20261115_0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS stale_listing_prospects ADD COLUMN IF NOT EXISTS meta_tracking_json TEXT")
    op.execute("ALTER TABLE IF EXISTS stale_listing_prospects ADD COLUMN IF NOT EXISTS meta_purchase_sent_at TIMESTAMPTZ")
    op.execute("ALTER TABLE IF EXISTS stale_prospect_addon_orders ADD COLUMN IF NOT EXISTS meta_sent_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS stale_prospect_addon_orders DROP COLUMN IF EXISTS meta_sent_at")
    op.execute("ALTER TABLE IF EXISTS stale_listing_prospects DROP COLUMN IF EXISTS meta_purchase_sent_at")
    op.execute("ALTER TABLE IF EXISTS stale_listing_prospects DROP COLUMN IF EXISTS meta_tracking_json")
