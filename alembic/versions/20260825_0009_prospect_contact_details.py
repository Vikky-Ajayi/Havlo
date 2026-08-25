"""Add contact details, property confirmation, and payment method to
stale_listing_prospects for the new QR-code landing-page wizard flow.

Revision ID: 20260825_0009
Revises: 20260825_0008
Create Date: 2026-08-25
"""

from __future__ import annotations

from alembic import op


revision = "20260825_0009"
down_revision = "20260825_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            ADD COLUMN IF NOT EXISTS contact_name VARCHAR(200),
            ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
            ADD COLUMN IF NOT EXISTS property_confirmed_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30),
            ADD COLUMN IF NOT EXISTS bank_transfer_reference VARCHAR(50)
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_contact_email "
        "ON stale_listing_prospects (contact_email)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_contact_email")
    op.execute(
        """
        ALTER TABLE stale_listing_prospects
            DROP COLUMN IF EXISTS contact_name,
            DROP COLUMN IF EXISTS contact_email,
            DROP COLUMN IF EXISTS contact_phone,
            DROP COLUMN IF EXISTS property_confirmed_at,
            DROP COLUMN IF EXISTS payment_method,
            DROP COLUMN IF EXISTS bank_transfer_reference
        """
    )
