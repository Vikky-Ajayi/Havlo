"""Local copy of HM Land Registry Price Paid Data for comparable sales.

Revision ID: 20260927_0023
Revises: 20260926_0022
Create Date: 2026-09-27

Land Registry's SPARQL endpoint started refusing the server (HTTP 403), so
comparable sales now come from this table, filled from Land Registry's
yearly bulk files by app/services/price_paid_data.py.
"""
from alembic import op

revision = "20260927_0023"
down_revision = "20260926_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS land_registry_sales (
            transaction_id UUID PRIMARY KEY,
            price INTEGER NOT NULL,
            sale_date DATE NOT NULL,
            postcode VARCHAR(8) NOT NULL,
            property_type VARCHAR(1) NOT NULL,
            paon TEXT,
            saon TEXT,
            street TEXT
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_land_registry_sales_postcode_date "
        "ON land_registry_sales (postcode, sale_date)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS land_registry_sales")
