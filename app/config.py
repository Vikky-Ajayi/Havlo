"""Application configuration loaded from environment variables."""
from functools import lru_cache
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
    DATABASE_URL: str  # asyncpg URL

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

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
