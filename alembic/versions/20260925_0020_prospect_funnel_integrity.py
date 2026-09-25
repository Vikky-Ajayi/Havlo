"""Keep every QR token valid, and put every engaged prospect in the funnel.

qr_token_hashes: every QR token ever issued for a prospect. Only the latest
used to be accepted, so any letter regeneration (the admin-email loop,
re-downloads after a deploy wiped the files) silently broke the QR code on
letters already in the post.

code_looked_up_at backfill: the column was added on 2026-09-05 without one,
so anyone who confirmed, submitted details or paid before then was missing
from the Follow Up funnel entirely. They can only have done any of that
after entering their code, so the earliest of those timestamps is the best
available record of their first lookup.

Idempotent throughout: Railway's copy of this table may already have the
column (added by migrate_data.py while copying from Supabase).

Revision ID: 20260925_0020
Revises: 20260920_0019
Create Date: 2026-09-25
"""

from __future__ import annotations

from alembic import op


revision = "20260925_0020"
down_revision = "20260920_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS qr_token_hashes VARCHAR(64)[]")
    op.execute(
        """
        UPDATE stale_listing_prospects
        SET qr_token_hashes = array_append(COALESCE(qr_token_hashes, '{}'::VARCHAR(64)[]), qr_token_hash)
        WHERE qr_token_hashes IS NULL OR NOT (qr_token_hash = ANY(qr_token_hashes))
        """
    )
    op.execute("ALTER TABLE stale_listing_prospects ALTER COLUMN qr_token_hashes SET DEFAULT '{}'")
    op.execute("ALTER TABLE stale_listing_prospects ALTER COLUMN qr_token_hashes SET NOT NULL")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_qr_token_hashes "
        "ON stale_listing_prospects USING gin (qr_token_hashes)"
    )
    op.execute(
        """
        UPDATE stale_listing_prospects
        SET code_looked_up_at = LEAST(property_confirmed_at, contact_details_submitted_at, unlocked_at)
        WHERE code_looked_up_at IS NULL
          AND COALESCE(property_confirmed_at, contact_details_submitted_at, unlocked_at) IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_qr_token_hashes")
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS qr_token_hashes")
