"""Add scraper_kv_state table for durable scraper cursor persistence.

Revision ID: 20260825_0008
Revises: 20260818_0007
Create Date: 2026-08-25

The stale-listing discovery cursor (per-location "resume from this page")
was persisted to an /tmp JSON file. On Railway, /tmp is local to the
container filesystem and is wiped on every deploy/restart, silently
resetting the cursor to page 0 for every location. Since deploys happen
often, this meant discovery frequently re-scanned the same front-of-list
inventory instead of making forward progress — this table gives scraper
state a home that survives restarts and redeploys.
"""

from __future__ import annotations

from alembic import op


revision = "20260825_0008"
down_revision = "20260818_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS scraper_kv_state (
            key VARCHAR(200) PRIMARY KEY,
            value_json TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS scraper_kv_state")
