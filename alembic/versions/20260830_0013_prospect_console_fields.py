"""Add city, treated_at, agent_edited_report_json, is_manual to
stale_listing_prospects for the new unauthenticated prospects ops console.

city is backfilled for existing rows from listing_snapshot_json (every
prospect's snapshot has always carried a "city" key — see _merge_snapshot
in stale_listing_discovery.py).

Revision ID: 20260830_0013
Revises: 20260830_0012
Create Date: 2026-08-30
"""

from __future__ import annotations

from alembic import op


revision = "20260830_0013"
down_revision = "20260830_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            ADD COLUMN IF NOT EXISTS city VARCHAR(100),
            ADD COLUMN IF NOT EXISTS treated_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS agent_edited_report_json TEXT,
            ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_city "
        "ON stale_listing_prospects (city)"
    )
    # Per-row exception handling rather than one bulk UPDATE: every prospect's
    # listing_snapshot_json has always been written by json.dumps() in
    # Python, so it should always cast to jsonb cleanly — but if even one
    # legacy/edge-case row doesn't, a single bulk UPDATE's ::jsonb cast
    # failing on that one row aborts the entire statement (and since this
    # runs as part of `alembic upgrade head && uvicorn ...` at deploy time,
    # that means the whole app fails to start). Looping with a per-row
    # EXCEPTION WHEN OTHERS means one bad row is skipped, not fatal.
    op.execute(
        """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN
                SELECT id, listing_snapshot_json
                FROM stale_listing_prospects
                WHERE city IS NULL
                  AND listing_snapshot_json IS NOT NULL
                  AND listing_snapshot_json != ''
            LOOP
                BEGIN
                    UPDATE stale_listing_prospects
                    SET city = NULLIF(r.listing_snapshot_json::jsonb ->> 'city', '')
                    WHERE id = r.id;
                EXCEPTION WHEN OTHERS THEN
                    NULL;
                END;
            END LOOP;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_city")
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            DROP COLUMN IF EXISTS city,
            DROP COLUMN IF EXISTS treated_at,
            DROP COLUMN IF EXISTS agent_edited_report_json,
            DROP COLUMN IF EXISTS is_manual
        """
    )
