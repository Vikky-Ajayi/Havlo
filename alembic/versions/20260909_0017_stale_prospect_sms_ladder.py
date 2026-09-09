"""Replace the one-time 24h abandonment SMS with a full Day 0 -> Day 90
SMS ladder (31 stages, every 3 days) -- see stale_prospect_abandonment.py.

- Drops abandonment_sms_sent_at (the old one-shot idempotency column) --
  superseded by the per-stage stale_prospect_abandonment_sms table below,
  same (prospect_id, stage) pattern as stale_prospect_abandonment_emails.
- Adds sms_unsubscribed_at as its OWN opt-out, deliberately separate from
  unsubscribed_at (which only ever governed the email drip) -- per product
  decision, opting out of SMS must not silently opt someone out of email
  and vice versa.

Revision ID: 20260909_0017
Revises: 20260908_0016
Create Date: 2026-09-09
"""

from __future__ import annotations

from alembic import op


revision = "20260909_0017"
down_revision = "20260908_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            DROP COLUMN IF EXISTS abandonment_sms_sent_at,
            ADD COLUMN IF NOT EXISTS sms_unsubscribed_at TIMESTAMPTZ
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS stale_prospect_abandonment_sms (
            id UUID PRIMARY KEY,
            prospect_id UUID NOT NULL REFERENCES stale_listing_prospects(id) ON DELETE CASCADE,
            stage INTEGER NOT NULL,
            sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_stale_prospect_abandonment_sms_prospect_stage "
        "ON stale_prospect_abandonment_sms (prospect_id, stage)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_prospect_abandonment_sms_prospect_id "
        "ON stale_prospect_abandonment_sms (prospect_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS stale_prospect_abandonment_sms")
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            DROP COLUMN IF EXISTS sms_unsubscribed_at,
            ADD COLUMN IF NOT EXISTS abandonment_sms_sent_at TIMESTAMPTZ
        """
    )
