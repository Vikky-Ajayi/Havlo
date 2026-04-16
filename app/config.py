"""Application configuration loaded from environment variables."""
from functools import lru_cache
from urllib.parse import quote_plus
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── App ──────────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # ── Supabase ─────────────────────────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # ── PostgreSQL ───────────────────────────────────────────────────────
    SUPABASE_DB_HOST: str = "aws-0-eu-west-1.pooler.supabase.com"
    SUPABASE_DB_PORT: int = 5432
    SUPABASE_DB_USER: str = "postgres.noeghrlsmecadfuukjma"
    SUPABASE_DB_PASSWORD: str = ""
    SUPABASE_DB_NAME: str = "postgres"

    SUPABASE_DATABASE_URL: str = ""
    DATABASE_URL: str = ""

    _resolved_db_url: str = ""

    # ── Google Sheets ────────────────────────────────────────────────────
    GOOGLE_SERVICE_ACCOUNT_JSON: str = ""
    GOOGLE_SPREADSHEET_ID: str = ""

    # ── Twilio ───────────────────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # ── SumUp ────────────────────────────────────────────────────────────
    SUMUP_API_KEY: str = ""
    SUMUP_MERCHANT_CODE: str = ""

    # ── Calendly ─────────────────────────────────────────────────────────
    CALENDLY_LINK: str = ""

    # ── Session fee ──────────────────────────────────────────────────────
    SESSION_FEE_AMOUNT: float = 200.0
    SESSION_FEE_CURRENCY: str = "USD"

    # ── Frontend ─────────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:5173"

    @model_validator(mode="after")
    def resolve_database_url(self) -> "Settings":
        """Build the asyncpg URL, properly encoding credentials."""
        if self.SUPABASE_DB_PASSWORD:
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
