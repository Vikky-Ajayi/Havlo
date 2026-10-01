"""Letter test versions: which version each prospect's letter is.

Revision ID: 20261001_0028
Revises: 20260928_0027
Create Date: 2026-10-01

Direct-mail A/B test: each prospect in the batch is assigned a letter
version (1-5); NULL keeps the standard letter.
"""
from alembic import op

revision = "20261001_0028"
down_revision = "20260928_0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS letter_version INTEGER")


def downgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS letter_version")
