"""Stop texting numbers that can't receive texts.

Revision ID: 20261022_0037
Revises: 20261015_0036
Create Date: 2026-10-22

stale_listing_prospects.sms_stopped_at / sms_stopped_reason: set when the
abandonment SMS series stops a number itself (invalid, landline, made-up,
or Twilio reports it failed for good), so it's never charged for again.
"""
from alembic import op

revision = "20261022_0037"
down_revision = "20261015_0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS sms_stopped_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS sms_stopped_reason VARCHAR(120)")


def downgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS sms_stopped_reason")
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS sms_stopped_at")
