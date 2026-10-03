"""Meta-ads funnel: lead source on prospects, property-link reminder leads,
and the send logs for the ads email flows.

Revision ID: 20261003_0032
Revises: 20261002_0031
Create Date: 2026-10-03

lead_source marks a prospect that came in through an ads landing page
("meta_seller" for a homeowner, "meta_agent" for an agency's copy).
checkout_visited_at anchors the checkout-recovery emails and
property_closed_at records "my property has sold / been withdrawn".
"""
from alembic import op

revision = "20261003_0032"
down_revision = "20261002_0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS lead_source VARCHAR(30)")
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS checkout_visited_at TIMESTAMPTZ")
    op.execute("ALTER TABLE stale_listing_prospects ADD COLUMN IF NOT EXISTS property_closed_at TIMESTAMPTZ")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_lead_source ON stale_listing_prospects (lead_source)"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ads_url_reminder_leads (
            id UUID PRIMARY KEY,
            audience VARCHAR(10) NOT NULL,
            first_name VARCHAR(200) NOT NULL,
            email VARCHAR(255) NOT NULL,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            prospect_id UUID REFERENCES stale_listing_prospects(id) ON DELETE SET NULL,
            url_submitted_at TIMESTAMPTZ,
            unsubscribed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_ads_url_reminder_leads_email ON ads_url_reminder_leads (email)")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ads_url_reminder_emails (
            id UUID PRIMARY KEY,
            lead_id UUID NOT NULL REFERENCES ads_url_reminder_leads(id) ON DELETE CASCADE,
            stage INTEGER NOT NULL,
            sent_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_ads_url_reminder_emails_lead_stage UNIQUE (lead_id, stage)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ads_nurture_emails (
            id UUID PRIMARY KEY,
            prospect_id UUID NOT NULL REFERENCES stale_listing_prospects(id) ON DELETE CASCADE,
            flow VARCHAR(20) NOT NULL,
            stage INTEGER NOT NULL,
            sent_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_ads_nurture_emails_prospect_flow_stage UNIQUE (prospect_id, flow, stage)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_ads_nurture_emails_prospect_id ON ads_nurture_emails (prospect_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ads_nurture_emails")
    op.execute("DROP TABLE IF EXISTS ads_url_reminder_emails")
    op.execute("DROP TABLE IF EXISTS ads_url_reminder_leads")
    op.execute("DROP INDEX IF EXISTS ix_stale_listing_prospects_lead_source")
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS property_closed_at")
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS checkout_visited_at")
    op.execute("ALTER TABLE stale_listing_prospects DROP COLUMN IF EXISTS lead_source")
