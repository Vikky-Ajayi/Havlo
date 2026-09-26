"""Alembic migration environment — async SQLAlchemy."""
from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.db import database
from app.db.database import Base
from app.models import models  # noqa: F401 — register all models

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    # Migrate exactly the database the app connects to, through the same
    # driver. app/db/database.py resolves DATABASE_URL / SUPABASE_DB_* and
    # rewrites postgres:// and postgresql:// to postgresql+asyncpg://. Using
    # the raw env var here sent Railway's postgresql:// URL to SQLAlchemy's
    # default psycopg2 driver, which isn't installed, and crashed the deploy.
    if not database.HAS_DATABASE:
        raise RuntimeError(
            "DATABASE_URL is not set and could not be resolved from SUPABASE_DB_* variables."
        )
    return database.DATABASE_URL


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    # Same SSL / pooler settings as the app; no per-query timeout, since a
    # migration can legitimately run longer than a request.
    engine = create_async_engine(get_url(), connect_args=database._connect_args(None))
    async with engine.begin() as conn:
        await conn.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
