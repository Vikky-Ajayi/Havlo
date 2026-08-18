"""Add country/source/currency columns to rightmove_listings.

Revision ID: 20260818_0006
Revises: 20260811_0005
Create Date: 2026-08-18
"""
from __future__ import annotations

from alembic import op


revision = "20260818_0006"
down_revision = "20260811_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE rightmove_listings
            ADD COLUMN IF NOT EXISTS country VARCHAR(20) NOT NULL DEFAULT 'uk',
            ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'rightmove',
            ADD COLUMN IF NOT EXISTS price_native INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS price_currency VARCHAR(3) NOT NULL DEFAULT 'GBP';
        """
    )
    op.execute(
        """
        UPDATE rightmove_listings
        SET
            country = CASE
                WHEN lower(coalesce(region, '')) IN ('america', 'usa', 'us') THEN 'america'
                WHEN lower(coalesce(region, '')) IN ('dubai', 'uae') THEN 'dubai'
                WHEN lower(coalesce(region, '')) = 'canada' THEN 'canada'
                WHEN url ILIKE '%bayut%' OR url ILIKE '%propertyfinder%' THEN 'dubai'
                WHEN url ILIKE '%realtor.ca%' THEN 'canada'
                WHEN url ILIKE '%realtor.com%' OR url ILIKE '%zillow%' OR url ILIKE '%redfin%' THEN 'america'
                ELSE 'uk'
            END,
            source = CASE
                WHEN url ILIKE '%bayut%' THEN 'bayut'
                WHEN url ILIKE '%realtor.ca%' THEN 'realtor_ca'
                WHEN url ILIKE '%realtor.com%' THEN 'realtor_com'
                ELSE 'rightmove'
            END,
            price_native = CASE WHEN price_native = 0 THEN price_gbp ELSE price_native END,
            price_currency = CASE
                WHEN url ILIKE '%bayut%' OR url ILIKE '%propertyfinder%' THEN 'AED'
                WHEN url ILIKE '%realtor.ca%' THEN 'CAD'
                WHEN url ILIKE '%realtor.com%' OR url ILIKE '%zillow%' OR url ILIKE '%redfin%' THEN 'USD'
                ELSE 'GBP'
            END
        WHERE country = 'uk' OR price_native = 0;
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_rightmove_listings_country ON rightmove_listings (country);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rightmove_listings_country_city ON rightmove_listings (country, city);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rightmove_listings_country_price ON rightmove_listings (country, price_gbp);"
    )


def downgrade() -> None:
    pass
