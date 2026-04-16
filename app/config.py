"""Application configuration loaded from environment variables."""
from functools import lru_cache
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
from pydantic import field_validator, model_validator
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
    # SUPABASE_DATABASE_URL is the preferred key (won't conflict with
    # Replit's managed DATABASE_URL which points to a local Helium DB).
    # Falls back to DATABASE_URL if SUPABASE_DATABASE_URL is not set.
    SUPABASE_DATABASE_URL: str = ""
    DATABASE_URL: str = ""

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
        """Pick the right DB URL and convert it to asyncpg format."""
        raw = self.SUPABASE_DATABASE_URL or self.DATABASE_URL
        if not raw:
            raise ValueError(
                "Either SUPABASE_DATABASE_URL or DATABASE_URL must be set"
            )
        self.DATABASE_URL = self._to_asyncpg(raw)
        return self

    @staticmethod
    def _to_asyncpg(url: str) -> str:
        """Convert a plain postgresql:// URL to postgresql+asyncpg:// removing sslmode."""
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

        # Strip sslmode from query string — asyncpg handles SSL via connect_args
        parsed = urlparse(url)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        qs.pop("sslmode", None)
        new_query = urlencode({k: v[0] for k, v in qs.items()})
        url = urlunparse(parsed._replace(query=new_query))
        return url

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
