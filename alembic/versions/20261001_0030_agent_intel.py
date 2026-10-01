"""Agent report figures cached on an agency's copy of a listing.

Revision ID: 20261001_0030
Revises: 20261001_0029
Create Date: 2026-10-01
"""
from alembic import op

revision = "20261001_0030"
down_revision = "20261001_0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS agent_intel_json TEXT")
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS agent_intel_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS agent_intel_at")
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS agent_intel_json")
