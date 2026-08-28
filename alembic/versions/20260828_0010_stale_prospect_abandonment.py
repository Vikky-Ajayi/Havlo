"""Add contact_details_submitted_at / unsubscribed_at to
stale_listing_prospects and a stale_prospect_abandonment_emails table to
track the pre-purchase / cart-abandonment email drip.

Revision ID: 20260828_0010
Revises: 20260825_0009
Create Date: 2026-08-28
"""

from __future__ import annotations

from alembic import op


revision = "20260828_0010"
down_revision = "20260825_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            ADD COLUMN IF NOT EXISTS contact_details_submitted_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS stale_prospect_abandonment_emails (
            id UUID PRIMARY KEY,
            prospect_id UUID NOT NULL REFERENCES stale_listing_prospects(id) ON DELETE CASCADE,
            stage INTEGER NOT NULL,
            sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_stale_prospect_abandonment_emails_prospect_stage "
        "ON stale_prospect_abandonment_emails (prospect_id, stage)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_prospect_abandonment_emails_prospect_id "
        "ON stale_prospect_abandonment_emails (prospect_id)"
    )
    # Backfill: existing prospects who already have contact details keep
    # contact_details_submitted_at NULL, which the drip loop treats as "not
    # eligible" — per decision, only submissions from here on enter the
    # sequence. No backfill statement needed.


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS stale_prospect_abandonment_emails")
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            DROP COLUMN IF EXISTS contact_details_submitted_at,
            DROP COLUMN IF EXISTS unsubscribed_at
        """
    )
