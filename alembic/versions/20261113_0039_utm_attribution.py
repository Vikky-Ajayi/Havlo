"""Where each lead and sale came from (UTM tags).

Revision ID: 20261113_0039
Revises: 20261104_0038
Create Date: 2026-11-13

stale_listing_prospects.lead_utm_json / purchase_utm_json: the UTM tags of
the visit that submitted the property and of the visit that started the
checkout. stale_prospect_addon_orders.utm_json: the same for an add-on order.
See app/services/attribution.py.
"""
from alembic import op

revision = "20261113_0039"
down_revision = "20261104_0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS stale_listing_prospects ADD COLUMN IF NOT EXISTS lead_utm_json TEXT")
    op.execute("ALTER TABLE IF EXISTS stale_listing_prospects ADD COLUMN IF NOT EXISTS purchase_utm_json TEXT")
    op.execute("ALTER TABLE IF EXISTS stale_prospect_addon_orders ADD COLUMN IF NOT EXISTS utm_json TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS stale_prospect_addon_orders DROP COLUMN IF EXISTS utm_json")
    op.execute("ALTER TABLE IF EXISTS stale_listing_prospects DROP COLUMN IF EXISTS purchase_utm_json")
    op.execute("ALTER TABLE IF EXISTS stale_listing_prospects DROP COLUMN IF EXISTS lead_utm_json")
