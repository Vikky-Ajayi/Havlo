"""Async SQLAlchemy engine and session factory."""
from urllib.parse import quote_plus
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

_POOLER_HOST = "aws-0-eu-west-1.pooler.supabase.com"
_POOLER_PORT = 5432
_PROJECT_REF = "noeghrlsmecadfuukjma"
_POOLER_USER = f"postgres.{_PROJECT_REF}"

_user = quote_plus(_POOLER_USER)
_pw = quote_plus(settings.SUPABASE_DB_PASSWORD) if settings.SUPABASE_DB_PASSWORD else ""

# Determine if we have a real database configured
HAS_DATABASE = bool(settings.SUPABASE_DB_PASSWORD or settings.SUPABASE_DATABASE_URL)

if HAS_DATABASE:
    PSYCOPG_URL = (
        f"postgresql+psycopg://{_user}:{_pw}@{_POOLER_HOST}:{_POOLER_PORT}"
        f"/{settings.SUPABASE_DB_NAME}"
    )
    _connect_args = {
        "sslmode": "require",
        "prepare_threshold": None,
    }
    engine = create_async_engine(
        PSYCOPG_URL,
        echo=settings.APP_ENV == "development",
        poolclass=NullPool,
        connect_args=_connect_args,
    )
else:
    # No database credentials — create a null/dummy engine
    # Tables won't be created, API endpoints will return 503 when no DB is configured
    PSYCOPG_URL = "sqlite+aiosqlite:///:memory:"
    engine = create_async_engine(
        PSYCOPG_URL,
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
