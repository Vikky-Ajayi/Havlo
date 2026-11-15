"""When a promo-code customer's Trustpilot review invitation was requested.

Revision ID: 20261115_0040
Revises: 20261113_0039
Create Date: 2026-11-15

stale_listing_prospects.trustpilot_invited_at. See
app/services/trustpilot_invites.py.
"""
from alembic import op

revision = "20261115_0040"
down_revision = "20261113_0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS stale_listing_prospects ADD COLUMN IF NOT EXISTS trustpilot_invited_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS stale_listing_prospects DROP COLUMN IF EXISTS trustpilot_invited_at")
