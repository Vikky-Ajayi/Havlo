"""Add stale listing discovery runs.

Revision ID: 20260818_0007
Revises: 20260818_0006
Create Date: 2026-08-18
"""

from __future__ import annotations

from alembic import op


revision = "20260818_0007"
down_revision = "20260818_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS stale_listing_discovery_runs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            status VARCHAR(40) NOT NULL DEFAULT 'queued',
            dry_run BOOLEAN NOT NULL DEFAULT TRUE,
            location_names TEXT,
            min_price INTEGER NOT NULL DEFAULT 300001,
            min_days_on_market INTEGER NOT NULL DEFAULT 180,
            max_candidates INTEGER NOT NULL DEFAULT 25,
            max_pages_per_location INTEGER NOT NULL DEFAULT 2,
            candidates_seen INTEGER NOT NULL DEFAULT 0,
            eligible_count INTEGER NOT NULL DEFAULT 0,
            created_prospects_count INTEGER NOT NULL DEFAULT 0,
            skipped_count INTEGER NOT NULL DEFAULT 0,
            failed_count INTEGER NOT NULL DEFAULT 0,
            result_json TEXT,
            error_message TEXT,
            started_by_user_id UUID,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_discovery_runs_status "
        "ON stale_listing_discovery_runs (status)"
    )
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            ADD COLUMN IF NOT EXISTS discovery_run_id UUID,
            ADD COLUMN IF NOT EXISTS source_status VARCHAR(50),
            ADD COLUMN IF NOT EXISTS skipped_reason VARCHAR(255),
            ADD COLUMN IF NOT EXISTS last_error TEXT,
            ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS letter_sent_at TIMESTAMPTZ
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_discovery_run_id "
        "ON stale_listing_prospects (discovery_run_id)"
    )
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            ALTER COLUMN bedrooms TYPE INTEGER
            USING NULLIF(regexp_replace(bedrooms::text, '[^0-9]', '', 'g'), '')::integer,
            ALTER COLUMN bathrooms TYPE INTEGER
            USING NULLIF(regexp_replace(bathrooms::text, '[^0-9]', '', 'g'), '')::integer
        """
    )
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_property_code")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_stale_listing_prospects_active_property_code
        ON stale_listing_prospects (property_code)
        WHERE COALESCE(source_status, 'active') <> 'archived'
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_discovery_url "
        "ON stale_listing_prospects (rightmove_url)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rightmove_listings_country_active_scraped "
        "ON rightmove_listings (country, is_active, scraped_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_discovery_url")
    op.execute("DROP INDEX IF EXISTS ix_rightmove_listings_country_active_scraped")
    op.execute("DROP INDEX IF EXISTS ux_stale_listing_prospects_active_property_code")
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_discovery_run_id")
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            DROP COLUMN IF EXISTS discovery_run_id,
            DROP COLUMN IF EXISTS source_status,
            DROP COLUMN IF EXISTS skipped_reason,
            DROP COLUMN IF EXISTS last_error,
            DROP COLUMN IF EXISTS discovered_at,
            DROP COLUMN IF EXISTS processed_at,
            DROP COLUMN IF EXISTS letter_sent_at
        """
    )
    op.execute("DROP TABLE IF EXISTS stale_listing_discovery_runs")
