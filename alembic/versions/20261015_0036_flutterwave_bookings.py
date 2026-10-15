"""Buy Abroad consultation deposits through Flutterwave.

Revision ID: 20261015_0036
Revises: 20261010_0035
Create Date: 2026-10-15

session_bookings.payment_provider ("flutterwave") and provider_reference
(Flutterwave's tx_ref) for bookings paid through /bookings/buy-abroad/...
Both NULL for the advisory session bookings, which still use SumUp.
"""
from alembic import op

revision = "20261015_0036"
down_revision = "20261010_0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE session_bookings ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(20)")
    op.execute("ALTER TABLE session_bookings ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(100)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_session_bookings_provider_reference ON session_bookings (provider_reference)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_session_bookings_provider_reference")
    op.execute("ALTER TABLE session_bookings DROP COLUMN IF EXISTS provider_reference")
    op.execute("ALTER TABLE session_bookings DROP COLUMN IF EXISTS payment_provider")
