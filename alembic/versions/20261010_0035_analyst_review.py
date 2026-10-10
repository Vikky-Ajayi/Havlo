"""Analyst-review funnel (/review/...): when a paid report is due out, and when
it went out.

Revision ID: 20261010_0035
Revises: 20261007_0034
Create Date: 2026-10-10

analyst_review_due_at is set on payment for a /review/... lead (48 hours on);
report_released_at when the report is released to the customer, by the
release loop or "Release now" in the console; report_ready_emailed_at once
the "your report is ready" email is delivered (retried until then). NULL
on every other prospect.

marketing_opt_in: the analyst-review funnel's "send me occasional tips" box. False
keeps the person out of the marketing emails and texts; NULL (every funnel
that doesn't ask) changes nothing.
"""
from alembic import op

revision = "20261010_0035"
down_revision = "20261007_0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS analyst_review_due_at TIMESTAMPTZ")
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS report_released_at TIMESTAMPTZ")
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS report_ready_emailed_at TIMESTAMPTZ")
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_review_pending "
        "ON stale_listing_prospects (analyst_review_due_at) WHERE report_released_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_checkout_visited_at "
        "ON stale_listing_prospects (checkout_visited_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_checkout_visited_at")
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_review_pending")
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS marketing_opt_in")
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS report_ready_emailed_at")
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS report_released_at")
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS analyst_review_due_at")
