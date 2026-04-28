"""
Async SQLAlchemy engine and session factory.

Connection pooling notes:
  We deliberately use a real pool (AsyncAdaptedQueuePool) instead of NullPool.
  With NullPool, every request opens & closes a fresh PG connection — over a
  Supabase pooler with SSL handshake that costs 200-800ms per request and was
  the dominant bottleneck for /auth/login, /auth/me, and every authed request.

  asyncpg + Supabase pooler (pgbouncer) require:
    statement_cache_size=0          → disable client-side prepared cache
    prepared_statement_cache_size=0 → disable server-side prepared statements
"""
import ssl as _ssl

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import get_settings

settings = get_settings()
DATABASE_URL = settings.DATABASE_URL

HAS_DATABASE = bool(DATABASE_URL)


def _is_supabase_pooler(url: str) -> bool:
    return "pooler.supabase.com" in url or "pgbouncer" in url


if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
    parsed = urlparse(DATABASE_URL)
    qs = parse_qs(parsed.query)
    sslmode_val = qs.get("sslmode", [""])[0].lower()
    ssl_val = qs.get("ssl", [""])[0].lower()
    needs_ssl = ssl_val in ("require", "true", "1") or sslmode_val in (
        "require",
        "verify-ca",
        "verify-full",
        "prefer",
    )
    qs.pop("sslmode", None)
    qs.pop("ssl", None)
    clean_query = urlencode(qs, doseq=True)
    DATABASE_URL = urlunparse(parsed._replace(query=clean_query))

    connect_args: dict = {}
    if needs_ssl:
        ssl_ctx = _ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = _ssl.CERT_NONE
        connect_args["ssl"] = ssl_ctx

    # Disable prepared statements entirely — required for pgbouncer/Supabase pooler.
    if _is_supabase_pooler(DATABASE_URL):
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_cache_size"] = 0

    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        # NOTE: peak DB connections = (pool_size + max_overflow) * uvicorn workers.
        # With 4 workers this is (5+10)*4 = 60 — a safe ceiling for the
        # Supabase transaction pooler (which fronts the real Postgres).
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        # Recycle connections every 30 min instead of 5. With 5-min recycle the
        # pool routinely cycled to empty during low-traffic windows, so the
        # next form submission paid the full asyncpg+SSL handshake cost
        # (~200-800ms against Supabase's pgbouncer). 30 min keeps connections
        # warm across normal idle periods, and pool_pre_ping still guards
        # against actually-stale sockets.
        pool_recycle=1800,
        pool_timeout=10,             # wait up to 10s for a free connection
        connect_args=connect_args,
    )
else:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=NullPool,
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
