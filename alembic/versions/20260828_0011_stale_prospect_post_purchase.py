"""Add a stale_prospect_post_purchase_emails table to track the post-purchase
nurture/upsell email drip ("phase two" — immediately after purchase through
day 56, anchored on stale_listing_prospects.unlocked_at rather than
contact_details_submitted_at). No new columns needed on
stale_listing_prospects: unlocked_at and unsubscribed_at already exist.

Revision ID: 20260828_0011
Revises: 20260828_0010
Create Date: 2026-08-28
"""

from __future__ import annotations

from alembic import op


revision = "20260828_0011"
down_revision = "20260828_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS stale_prospect_post_purchase_emails (
            id UUID PRIMARY KEY,
            prospect_id UUID NOT NULL REFERENCES stale_listing_prospects(id) ON DELETE CASCADE,
            stage INTEGER NOT NULL,
            sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_stale_prospect_post_purchase_emails_prospect_stage "
        "ON stale_prospect_post_purchase_emails (prospect_id, stage)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_prospect_post_purchase_emails_prospect_id "
        "ON stale_prospect_post_purchase_emails (prospect_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS stale_prospect_post_purchase_emails")
