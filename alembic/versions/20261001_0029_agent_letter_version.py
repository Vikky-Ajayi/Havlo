"""Agent letter test versions: which version each agency's letter is.

Revision ID: 20261001_0029
Revises: 20261001_0028
Create Date: 2026-10-01
"""
from alembic import op

revision = "20261001_0029"
down_revision = "20261001_0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE stale_agent_accounts ADD COLUMN IF NOT EXISTS letter_version INTEGER")


def downgrade() -> None:
    op.execute("ALTER TABLE stale_agent_accounts DROP COLUMN IF EXISTS letter_version")
