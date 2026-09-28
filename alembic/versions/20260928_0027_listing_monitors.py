"""Post-purchase monitoring dashboard: monitors and their events.

Revision ID: 20260928_0027
Revises: 20260928_0026
Create Date: 2026-09-28

Each purchased report gets a 90-day dashboard (stale_listing_monitors); every
change found on the listing or around it is a stale_listing_monitor_events
row. See app/services/listing_monitor.py.
"""
from alembic import op

revision = "20260928_0027"
down_revision = "20260928_0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS stale_listing_monitors (
            id UUID PRIMARY KEY,
            prospect_id UUID NOT NULL UNIQUE REFERENCES stale_listing_prospects(id) ON DELETE CASCADE,
            token_hashes VARCHAR(64)[] NOT NULL DEFAULT '{}',
            share_token_hashes VARCHAR(64)[] NOT NULL DEFAULT '{}',
            started_at TIMESTAMPTZ NOT NULL,
            ends_at TIMESTAMPTZ NOT NULL,
            listing_status VARCHAR(20) NOT NULL DEFAULT 'on_market',
            baseline_json TEXT,
            latest_json TEXT,
            nearby_baseline_json TEXT,
            nearby_json TEXT,
            seen_sale_ids VARCHAR(40)[] NOT NULL DEFAULT '{}',
            rightmove_location_id VARCHAR(40),
            checklist_json TEXT,
            next_listing_check_at TIMESTAMPTZ,
            last_listing_check_at TIMESTAMPTZ,
            last_nearby_check_at TIMESTAMPTZ,
            last_sold_check_at TIMESTAMPTZ,
            check_failures INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            sms_status VARCHAR(20),
            sms_sent_at TIMESTAMPTZ,
            last_viewed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_monitors_next_listing_check_at "
        "ON stale_listing_monitors (next_listing_check_at)"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS stale_listing_monitor_events (
            id UUID PRIMARY KEY,
            monitor_id UUID NOT NULL REFERENCES stale_listing_monitors(id) ON DELETE CASCADE,
            scope VARCHAR(10) NOT NULL,
            kind VARCHAR(40) NOT NULL,
            detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            data_json TEXT
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_monitor_events_monitor_at "
        "ON stale_listing_monitor_events (monitor_id, detected_at)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS stale_listing_monitor_events")
    op.execute("DROP TABLE IF EXISTS stale_listing_monitors")
