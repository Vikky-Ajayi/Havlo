"""Application configuration loaded from environment variables."""
import re
from functools import lru_cache
from urllib.parse import quote_plus
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_SUPABASE_URL_RE = re.compile(
    r"^postgres(?:ql)?(?:\+\w+)?://"
    r"(?P<user>[^:@/]+)"
    r":"
    r"(?P<password>.+)"
    r"@"
    r"(?P<host>[^:/@]+\.supabase\.(?:co|com))"
    r"(?::(?P<port>\d+))?"
    r"/(?P<db>[^?]+)"
    r"(?:\?.*)?$"
)


def _extract_supabase_password_from_url(url: str) -> str | None:
    """Extract the password from a possibly malformed Supabase DATABASE_URL.

    Standard URL parsers split on the first '@' or '#', which breaks when the
    password contains those characters (very common with Supabase passwords).
    We use a greedy regex anchored on the supabase host suffix so the
    password match captures everything between the user and the real host.
    """
    if not url:
        return None
    m = _SUPABASE_URL_RE.match(url.strip())
    if not m:
        return None
    return m.group("password")


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

    # SendGrid (transactional email)
    SENDGRID_API_KEY: str = ""
    # "global" (default, api.sendgrid.com) or "eu" (api.eu.sendgrid.com).
    # EU-residency SendGrid accounts MUST set this to "eu" or every send
    # returns HTTP 401 Unauthorized.
    SENDGRID_REGION: str = "global"
    EMAIL_FROM: str = ""
    EMAIL_FROM_NAME: str = "Havlo"
    EMAIL_REPLY_TO: str = ""
    SUPPORT_EMAIL: str = "support@Havlo.com"
    # Where to send "new sheet entry" notifications.
    ADMIN_NOTIFY_EMAIL: str = "myhavloservices@gmail.com"

    # ── SumUp ────────────────────────────────────────────────────────────
    SUMUP_API_KEY: str = ""
    SUMUP_MERCHANT_CODE: str = ""

    # ── Calendly ─────────────────────────────────────────────────────────
    CALENDLY_LINK: str = ""

    # ── Admin (used for X-Admin-Secret on messaging admin endpoints) ─────
    ADMIN_SECRET: str = ""

    # ── Session fee ──────────────────────────────────────────────────────
    SESSION_FEE_AMOUNT: float = 200.0
    SESSION_FEE_CURRENCY: str = "USD"

    # ── Frontend ─────────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:5173"

    @model_validator(mode="after")
    def resolve_database_url(self) -> "Settings":
        """Build the asyncpg URL, properly encoding credentials.

        Priority:
        - In development (APP_ENV != production): prefer the existing
          DATABASE_URL (e.g. Replit local DB) if it points to a local host.
        - In production or when no local DB is available: build the Supabase URL.
        """
        import os
        is_local_db = (
            self.DATABASE_URL
            and ("helium" in self.DATABASE_URL or "localhost" in self.DATABASE_URL)
            and os.environ.get("PGHOST") in ("helium", "localhost", "127.0.0.1")
        )

        if is_local_db and self.APP_ENV != "production":
            return self

        password = self.SUPABASE_DB_PASSWORD

        if not password:
            for candidate in (self.DATABASE_URL, self.SUPABASE_DATABASE_URL):
                extracted = _extract_supabase_password_from_url(candidate)
                if extracted:
                    password = extracted
                    break

        if password:
            host = self.SUPABASE_DB_HOST
            user = self.SUPABASE_DB_USER
            project_ref = "noeghrlsmecadfuukjma"

            if not host or host.startswith("db."):
                host = "aws-0-eu-west-1.pooler.supabase.com"
            if not user or user == "postgres":
                user = f"postgres.{project_ref}"

            password_enc = quote_plus(password)
            user_enc = quote_plus(user)
            port = self.SUPABASE_DB_PORT
            db = self.SUPABASE_DB_NAME or "postgres"
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{user_enc}:{password_enc}@{host}:{port}/{db}?ssl=require"
            )
            self.SUPABASE_DB_PASSWORD = password
        elif self.SUPABASE_DATABASE_URL:
            url = self.SUPABASE_DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://") and "+asyncpg" not in url:
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            self.DATABASE_URL = url

        return self

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
