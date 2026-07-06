"""Create and migrate rightmove_listings table.

Revision ID: 20260706_0003
Revises: 20260520_0002
Create Date: 2026-07-06
"""
from __future__ import annotations

from alembic import op


revision = "20260706_0003"
down_revision = "20260520_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS rightmove_listings (
            id UUID PRIMARY KEY,
            rightmove_id VARCHAR(50) NOT NULL,
            url TEXT NOT NULL,
            title VARCHAR(500) NOT NULL,
            price_gbp INTEGER NOT NULL,
            address VARCHAR(500) NOT NULL,
            city VARCHAR(100) NOT NULL,
            region VARCHAR(100) NOT NULL DEFAULT '',
            bedrooms INTEGER NOT NULL DEFAULT 0,
            bathrooms INTEGER,
            property_type VARCHAR(100) NOT NULL DEFAULT '',
            description TEXT,
            images_json TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            scraped_at TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'rightmove_listings_rightmove_id_key'
            ) THEN
                ALTER TABLE rightmove_listings ADD CONSTRAINT rightmove_listings_rightmove_id_key UNIQUE (rightmove_id);
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        ALTER TABLE rightmove_listings
            ADD COLUMN IF NOT EXISTS region VARCHAR(100) NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS bedrooms INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS property_type VARCHAR(100) NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS images_json TEXT,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rightmove_listings_city ON rightmove_listings (city);"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_rightmove_listings_rightmove_id ON rightmove_listings (rightmove_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rightmove_listings_is_active ON rightmove_listings (is_active);"
    )


def downgrade() -> None:
    pass
