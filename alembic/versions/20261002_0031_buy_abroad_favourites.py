"""Buy Abroad favourites saved to the visitor's account.

Revision ID: 20261002_0031
Revises: 20261001_0030
Create Date: 2026-10-02

Favourites used to live only in the browser; each row here is one home a
user saved (listing_id is the listing's rightmove_id).
"""
from alembic import op

revision = "20261002_0031"
down_revision = "20261001_0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS buy_abroad_favourites (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            listing_id VARCHAR(50) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_buy_abroad_favourites_user_listing UNIQUE (user_id, listing_id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_buy_abroad_favourites_user_id ON buy_abroad_favourites (user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS buy_abroad_favourites")
