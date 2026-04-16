"""Async SQLAlchemy engine and session factory."""
from urllib.parse import quote_plus
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# ── psycopg3 async driver (PgBouncer-compatible) ──────────────────────────────
# asyncpg always uses prepared statements at the DBAPI level, which is
# incompatible with Supabase's PgBouncer-fronted connection pooler.
# psycopg3 supports prepare_threshold=None to disable all server-side
# prepared statements, making it fully compatible with PgBouncer.
#
# We always use the Supabase session pooler host on port 5432.
# The SUPABASE_DB_HOST/PORT env vars may point to the direct DB or the
# transaction pooler — we override them here with known-good session-pooler
# values to guarantee connectivity.

_POOLER_HOST = "aws-0-eu-west-1.pooler.supabase.com"
_POOLER_PORT = 5432  # session pooler — supports prepared statements & psycopg3
_PROJECT_REF = "noeghrlsmecadfuukjma"
_POOLER_USER = f"postgres.{_PROJECT_REF}"

_user = quote_plus(_POOLER_USER)
_pw = quote_plus(settings.SUPABASE_DB_PASSWORD)

# psycopg3 DSN — sslmode, prepare_threshold passed as connect_args
PSYCOPG_URL = (
    f"postgresql+psycopg://{_user}:{_pw}@{_POOLER_HOST}:{_POOLER_PORT}"
    f"/{settings.SUPABASE_DB_NAME}"
)

engine = create_async_engine(
    PSYCOPG_URL,
    echo=settings.APP_ENV == "development",
    poolclass=NullPool,
    connect_args={
        "sslmode": "require",
        "prepare_threshold": None,  # Disable server-side prepared statements
    },
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
