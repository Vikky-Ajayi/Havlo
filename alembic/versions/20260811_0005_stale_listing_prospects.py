"""Add stale listing prospects table.

Revision ID: 20260811_0005
Revises: 20260724_0004
Create Date: 2026-08-11
"""

from __future__ import annotations

from alembic import op


revision = "20260811_0005"
down_revision = "20260724_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS stale_listing_prospects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            property_code VARCHAR(12) NOT NULL,
            qr_token_hash VARCHAR(64) NOT NULL,
            property_address VARCHAR(500) NOT NULL,
            rightmove_url TEXT NOT NULL,
            rightmove_id VARCHAR(100),
            asking_price DOUBLE PRECISION,
            listing_duration_days INTEGER,
            listed_date TIMESTAMPTZ,
            property_type VARCHAR(120),
            bedrooms VARCHAR(40),
            bathrooms VARCHAR(40),
            listing_snapshot_json TEXT,
            report_json TEXT,
            preview_json TEXT,
            letter_pdf_path TEXT,
            processing_status VARCHAR(50) NOT NULL DEFAULT 'pending',
            payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
            sumup_checkout_id VARCHAR(120),
            sumup_checkout_url TEXT,
            unlocked_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_stale_listing_prospects_property_code "
        "ON stale_listing_prospects (property_code)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_stale_listing_prospects_qr_token_hash "
        "ON stale_listing_prospects (qr_token_hash)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_rightmove_id "
        "ON stale_listing_prospects (rightmove_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_rightmove_url "
        "ON stale_listing_prospects (rightmove_url)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS stale_listing_prospects")
