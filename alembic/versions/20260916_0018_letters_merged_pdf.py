"""Add letters_pdf_data/letters_pdf_filename to stale_listing_discovery_runs
-- a single merged PDF of every letter in a run (e.g. 400 prospects -> one
800-page PDF), built alongside the existing letters-zip in the same pass so
a print shop can run one file through a duplex printer instead of 400
separate ones. Reuses the existing letters_zip_status/_total/_done/_error/
_generated_at columns as the shared progress state for both artifacts.

Revision ID: 20260916_0018
Revises: 20260909_0017
Create Date: 2026-09-16
"""

from __future__ import annotations

from alembic import op


revision = "20260916_0018"
down_revision = "20260909_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_discovery_runs
            ADD COLUMN IF NOT EXISTS letters_pdf_data BYTEA,
            ADD COLUMN IF NOT EXISTS letters_pdf_filename VARCHAR(200)
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_discovery_runs
            DROP COLUMN IF EXISTS letters_pdf_data,
            DROP COLUMN IF EXISTS letters_pdf_filename
        """
    )
