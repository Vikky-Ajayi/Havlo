"""Add listing snapshot storage to stale listings assessments.

Revision ID: 20260520_0002
Revises: 20260520_0001
Create Date: 2026-05-20
"""
from __future__ import annotations

from alembic import op


revision = "20260520_0002"
down_revision = "20260520_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_assessments
        ADD COLUMN IF NOT EXISTS listing_snapshot_json TEXT;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_assessments
        DROP COLUMN IF EXISTS listing_snapshot_json;
        """
    )
