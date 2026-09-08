"""Add letters-zip fields to stale_listing_discovery_runs -- backs both the
console's "Generate Folder" letters tab (an ad-hoc admin-picked selection of
prospects, tracked via a run row purely as existing job-tracking/polling
plumbing, same convention as location_names=["csv_upload"] already used for
bulk-upload runs) and the CSV bulk-upload flow's auto-generated ZIP of the
prospects it just created. The finished ZIP is stored as bytea directly on
the run row (not on disk) so any of the 4 uvicorn workers can serve the
download regardless of which one built it -- Railway's filesystem is
ephemeral and per-worker anyway, so a temp file wouldn't survive a request
landing on a different worker.

Revision ID: 20260908_0016
Revises: 20260905_0015
Create Date: 2026-09-08
"""

from __future__ import annotations

from alembic import op


revision = "20260908_0016"
down_revision = "20260905_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_discovery_runs
            ADD COLUMN IF NOT EXISTS letters_zip_status VARCHAR(20),
            ADD COLUMN IF NOT EXISTS letters_zip_data BYTEA,
            ADD COLUMN IF NOT EXISTS letters_zip_filename VARCHAR(200),
            ADD COLUMN IF NOT EXISTS letters_zip_error TEXT,
            ADD COLUMN IF NOT EXISTS letters_zip_total INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS letters_zip_done INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS letters_zip_generated_at TIMESTAMPTZ
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_discovery_runs
            DROP COLUMN IF EXISTS letters_zip_status,
            DROP COLUMN IF EXISTS letters_zip_data,
            DROP COLUMN IF EXISTS letters_zip_filename,
            DROP COLUMN IF EXISTS letters_zip_error,
            DROP COLUMN IF EXISTS letters_zip_total,
            DROP COLUMN IF EXISTS letters_zip_done,
            DROP COLUMN IF EXISTS letters_zip_generated_at
        """
    )
