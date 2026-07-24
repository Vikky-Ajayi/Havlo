"""Add uk_contact_form_submissions and uk_client_applications tables.

Revision ID: 20260724_0004
Revises: 20260706_0003
Create Date: 2026-07-24
"""
from __future__ import annotations

from alembic import op

revision = "20260724_0004"
down_revision = "20260706_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS uk_contact_form_submissions (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source              VARCHAR(64)  NOT NULL,
            first_name          VARCHAR(120) NOT NULL,
            last_name           VARCHAR(120) NOT NULL,
            email               VARCHAR(255) NOT NULL,
            phone_country_code  VARCHAR(8)   NOT NULL DEFAULT '',
            phone_number        VARCHAR(40)  NOT NULL DEFAULT '',
            country_of_residence VARCHAR(120),
            message             TEXT,
            sheets_recorded_at  TIMESTAMPTZ,
            created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS ix_uk_contact_source_created
            ON uk_contact_form_submissions (source, created_at);

        CREATE INDEX IF NOT EXISTS ix_uk_contact_email
            ON uk_contact_form_submissions (email);

        CREATE TABLE IF NOT EXISTS uk_client_applications (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            full_name       VARCHAR(160) NOT NULL,
            date_of_birth   VARCHAR(20)  NOT NULL,
            email           VARCHAR(255) NOT NULL,
            mobile          VARCHAR(40)  NOT NULL,
            address         VARCHAR(300) NOT NULL,
            occupation      VARCHAR(160) NOT NULL,
            uk_area         VARCHAR(200) NOT NULL,
            property_type   VARCHAR(60)  NOT NULL,
            bedrooms        VARCHAR(40)  NOT NULL,
            budget          VARCHAR(80)  NOT NULL,
            sheets_recorded_at TIMESTAMPTZ,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS ix_uk_client_applications_email
            ON uk_client_applications (email);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS uk_contact_form_submissions;
        DROP TABLE IF EXISTS uk_client_applications;
        """
    )
