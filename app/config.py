"""Application configuration loaded from environment variables."""
from functools import lru_cache
from urllib.parse import quote_plus
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── App ──────────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    SECRET_KEY: str
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # ── Supabase ─────────────────────────────────────────────────────────
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # ── PostgreSQL ───────────────────────────────────────────────────────
    # Individual Supabase DB connection params (preferred — avoids URL encoding issues)
    SUPABASE_DB_HOST: str = "aws-0-eu-west-1.pooler.supabase.com"
    SUPABASE_DB_PORT: int = 5432        # Supabase session pooler (supports prepared statements)
    SUPABASE_DB_USER: str = "postgres.noeghrlsmecadfuukjma"
    SUPABASE_DB_PASSWORD: str = ""
    SUPABASE_DB_NAME: str = "postgres"

    # SUPABASE_DATABASE_URL is accepted as fallback but may fail if password
    # contains special chars — use individual params above when possible.
    SUPABASE_DATABASE_URL: str = ""
    DATABASE_URL: str = ""              # Replit-managed; not used for Supabase

    # Resolved asyncpg URL built by model_validator below
    _resolved_db_url: str = ""

    # ── Google Sheets ────────────────────────────────────────────────────
    GOOGLE_SERVICE_ACCOUNT_JSON: str  # path to JSON or raw JSON string
    GOOGLE_SPREADSHEET_ID: str

    # ── Twilio ───────────────────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_PHONE_NUMBER: str  # E.164 format e.g. +12025551234

    # ── SumUp ────────────────────────────────────────────────────────────
    SUMUP_API_KEY: str
    SUMUP_MERCHANT_CODE: str

    # ── Calendly ─────────────────────────────────────────────────────────
    CALENDLY_LINK: str

    # ── Session fee ──────────────────────────────────────────────────────
    SESSION_FEE_AMOUNT: float = 200.0
    SESSION_FEE_CURRENCY: str = "USD"

    # ── Frontend ─────────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:5173"

    @model_validator(mode="after")
    def resolve_database_url(self) -> "Settings":
        """Build the asyncpg URL, properly encoding credentials."""
        if self.SUPABASE_DB_PASSWORD:
            # Always use the Supabase transaction pooler — it's reachable on port 6543
            # and avoids issues with special chars in passwords by encoding them.
            # The host/user defaults above may be overridden by env secrets, so we
            # always fall back to the known-working pooler values if the host looks
            # like a direct DB host (db.<ref>.supabase.co).
            host = self.SUPABASE_DB_HOST
            user = self.SUPABASE_DB_USER
            project_ref = "noeghrlsmecadfuukjma"

            if not host or host.startswith("db."):
                host = "aws-0-eu-west-1.pooler.supabase.com"
            if not user or user == "postgres":
                user = f"postgres.{project_ref}"

            password = quote_plus(self.SUPABASE_DB_PASSWORD)
            user_enc = quote_plus(user)
            port = self.SUPABASE_DB_PORT
            db = self.SUPABASE_DB_NAME
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{user_enc}:{password}@{host}:{port}/{db}"
            )
        elif self.SUPABASE_DATABASE_URL:
            # Fallback: try to use the composite URL as-is (works only if password
            # has no special chars, or is already percent-encoded)
            url = self.SUPABASE_DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://") and "+asyncpg" not in url:
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            self.DATABASE_URL = url
        # else: DATABASE_URL may already be set (e.g. Replit local DB) — leave it

        return self

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
