"""
Havlo Real Estate Platform — FastAPI Backend
============================================
Startup order:
  1. Create all DB tables (if not exists)
  2. Ensure Google Sheets tabs exist
  3. Register all routers
"""
from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from fastapi import FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db.database import Base, engine, HAS_DATABASE
from app.models import models  # noqa: F401 — ensures models are registered with Base
from app.models import agent_models  # noqa: F401 — registers agent tables with Base
from app.routers import (
    agent_dashboard,
    auth,
    bookings,
    buyer_network,
    elite_property,
    listings,
    messaging,
    onboarding,
    property_matching,
    public_forms,
    sale_audit,
    sell_faster,
    users,
)
from app.services import google_sheets

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="Havlo Real Estate Platform API",
    description="Backend API for the Havlo international property platform.",
    version="1.0.0",
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/redoc" if settings.APP_ENV != "production" else None,
)

allowed_origins = settings.allowed_origins_list
replit_domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
if replit_domain:
    allowed_origins.append(f"https://{replit_domain}")
replit_domains = os.environ.get("REPLIT_DOMAINS", "")
if replit_domains:
    for domain in replit_domains.split(","):
        domain = domain.strip()
        if domain:
            allowed_origins.append(f"https://{domain}")

for known in (
    "https://heyhavlo.com",
    "https://www.heyhavlo.com",
):
    allowed_origins.append(known)

resolved_origins = list(dict.fromkeys([o.strip() for o in allowed_origins if o.strip()]))
if not resolved_origins:
    resolved_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=resolved_origins,
    allow_origin_regex=r"https://([a-z0-9-]+\.)*(vercel\.app|heyhavlo\.com)",
    allow_credentials=resolved_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


DB_READY: bool = False
DB_ERROR: str | None = None


async def _seed_admin_user() -> None:
    """Idempotent admin seeding from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME env vars.
    On every startup: create the admin if missing; otherwise ensure is_admin=True
    and update the password hash so rotating ADMIN_PASSWORD takes effect."""
    email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    password = (os.environ.get("ADMIN_PASSWORD") or "").strip()
    full_name = (os.environ.get("ADMIN_NAME") or "Havlo Admin").strip()
    if not email or not password:
        logger.info("Admin seeding skipped — ADMIN_EMAIL/ADMIN_PASSWORD not set.")
        return

    parts = full_name.split(maxsplit=1)
    first = parts[0] if parts else "Havlo"
    last = parts[1] if len(parts) > 1 else "Admin"

    from sqlalchemy import select as _select
    from app.db.database import AsyncSessionLocal
    from app.models.models import User as _User, UserRole as _UserRole
    from app.services.local_auth import hash_password as _hash

    async with AsyncSessionLocal() as session:
        res = await session.execute(_select(_User).where(_User.email == email))
        user = res.scalar_one_or_none()
        if user is None:
            user = _User(
                email=email,
                password_hash=_hash(password),
                first_name=first,
                last_name=last,
                phone_country_code="+44",
                phone_number="0000000000",
                role=_UserRole.agent,
                is_admin=True,
                onboarding_complete=True,
            )
            session.add(user)
            await session.commit()
            logger.info("Admin user seeded: %s", email)
        else:
            user.is_admin = True
            user.password_hash = _hash(password)
            user.first_name = first
            user.last_name = last
            user.onboarding_complete = True
            await session.commit()
            logger.info("Admin user updated: %s", email)


@app.on_event("startup")
async def startup() -> None:
    global DB_READY, DB_ERROR
    logger.info("Starting Havlo API … (env=%s)", settings.APP_ENV)

    if HAS_DATABASE:
        try:
            from app.db.database import DATABASE_URL as _RESOLVED_URL
            safe_url = _RESOLVED_URL
            if "@" in safe_url:
                scheme_creds, host_part = safe_url.split("@", 1)
                if "//" in scheme_creds:
                    scheme, _ = scheme_creds.split("//", 1)
                    safe_url = f"{scheme}//***:***@{host_part}"
            logger.info("Attempting database connection to: %s", safe_url)

            # ── Step 1: create_all in its own isolated transaction ─────────────────
            # With --workers 4 on Railway, all workers start simultaneously and
            # call create_all at the same time. PostgreSQL raises a UniqueViolation
            # on pg_type when two processes try to register the same relation/type.
            # We catch that race here so workers 2-4 can continue normally — the
            # table was already created by whichever worker won the race.
            try:
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
            except Exception as _create_all_exc:
                _msg = str(_create_all_exc).lower()
                if any(k in _msg for k in ("already exists", "unique", "duplicate")):
                    logger.warning(
                        "create_all race condition (another worker won the race) — continuing: %s",
                        _create_all_exc,
                    )
                else:
                    raise

            # ── Step 2: idempotent ALTER TABLE migrations in a fresh transaction ──
            # This always runs regardless of which worker won the create_all race.
            async with engine.begin() as conn:
                from sqlalchemy import text
                # Uvicorn/Railway can start multiple workers together.  The
                # schema sync contains several ALTER TABLE statements, which
                # require an ACCESS EXCLUSIVE lock.  Without serializing this
                # block, workers wait on each other's DDL until PostgreSQL's
                # statement timeout cancels the transaction.
                if conn.dialect.name == "postgresql":
                    await conn.execute(text("SELECT pg_advisory_xact_lock(7483912051)"))
                    await conn.execute(text("SET LOCAL statement_timeout = '120s'"))
                # Idempotent schema sync: add any columns missing on pre-existing tables.
                # Safe to re-run; uses ADD COLUMN IF NOT EXISTS (Postgres >= 9.6).
                # Skip on non-Postgres backends (e.g. SQLite for local dev/tests).
                if conn.dialect.name == "postgresql":
                    await conn.execute(text("""
                        DO $$ BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
                                CREATE TYPE user_role AS ENUM ('buyer','seller','admin','agent');
                            END IF;
                        END $$;
                    """))
                    await conn.execute(text("""
                        DO $$ BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_sale_audit') THEN
                                CREATE TYPE payment_status_sale_audit AS ENUM ('pending','completed','failed');
                            END IF;
                        END $$;
                    """))
                    await conn.execute(text("""
                        ALTER TABLE sale_audit_requests
                            ADD COLUMN IF NOT EXISTS sumup_checkout_id VARCHAR(255),
                            ADD COLUMN IF NOT EXISTS sumup_checkout_url TEXT,
                            ADD COLUMN IF NOT EXISTS payment_status payment_status_sale_audit NOT NULL DEFAULT 'pending';
                    """))
                    await conn.execute(text("""
                        ALTER TABLE buyer_network_applications
                            ADD COLUMN IF NOT EXISTS sumup_checkout_id VARCHAR(255),
                            ADD COLUMN IF NOT EXISTS sumup_checkout_url TEXT,
                            ADD COLUMN IF NOT EXISTS payment_status payment_status NOT NULL DEFAULT 'pending';
                    """))
                    await conn.execute(text("""
                        ALTER TABLE conversations
                            ADD COLUMN IF NOT EXISTS is_admin_conversation BOOLEAN NOT NULL DEFAULT FALSE,
                            ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;
                    """))
                    await conn.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_one_admin_convo_per_user "
                        "ON conversations (user_id) WHERE is_admin_conversation = TRUE;"
                    ))
                    await conn.execute(text("""
                        ALTER TABLE messages
                            ADD COLUMN IF NOT EXISTS sender_id UUID,
                            ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE,
                            ADD COLUMN IF NOT EXISTS sms_notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
                            ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE,
                            ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
                            ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
                            ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(1024),
                            ADD COLUMN IF NOT EXISTS attachment_filename VARCHAR(512),
                            ADD COLUMN IF NOT EXISTS attachment_mime VARCHAR(255),
                            ADD COLUMN IF NOT EXISTS attachment_size INTEGER,
                            ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
                    """))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_messages_convo_created "
                        "ON messages (conversation_id, created_at);"
                    ))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_messages_conversation_id_created "
                        "ON messages (conversation_id, created_at ASC);"
                    ))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_messages_isread_sender "
                        "ON messages (is_read, sender_type);"
                    ))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_messages_unread "
                        "ON messages (conversation_id, is_read, sender_type);"
                    ))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_conversations_user_lastmsg "
                        "ON conversations (user_id, last_message_at);"
                    ))
                    await conn.execute(text("""
                        ALTER TABLE users
                            ADD COLUMN IF NOT EXISTS supabase_uid VARCHAR(255),
                            ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
                            ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(10) DEFAULT '+44',
                            ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30),
                            ADD COLUMN IF NOT EXISTS role user_role,
                            ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                            ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE,
                            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
                            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
                    """))
                    # Self-heal legacy NOT NULL constraints from the original
                    # Supabase Auth schema. These columns are nullable in the
                    # current ORM model (supabase_uid is unused on local-auth
                    # signups, password_hash is unused for any future SSO
                    # signups). DROP NOT NULL is idempotent — it succeeds
                    # whether the constraint is present or not. Without this,
                    # /auth/register fails on every fresh signup with a
                    # NotNullViolationError that was masked as "email
                    # already exists" by the IntegrityError handler.
                    await conn.execute(text("""
                        ALTER TABLE users
                            ALTER COLUMN supabase_uid DROP NOT NULL,
                            ALTER COLUMN password_hash DROP NOT NULL;
                    """))
                    # ── Agent dashboard tables ──────────────────────────────
                    await conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS agent_profile_links (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                            profile_url TEXT NOT NULL,
                            platform VARCHAR(50),
                            last_synced_at TIMESTAMPTZ,
                            created_at TIMESTAMPTZ DEFAULT NOW(),
                            updated_at TIMESTAMPTZ DEFAULT NOW()
                        );
                    """))
                    await conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS agent_listings (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            external_url TEXT,
                            title VARCHAR(500),
                            price VARCHAR(100),
                            description TEXT,
                            image_url TEXT,
                            bedrooms VARCHAR(50),
                            platform VARCHAR(50),
                            created_at TIMESTAMPTZ DEFAULT NOW()
                        );
                    """))
                    await conn.execute(text("""
                        ALTER TABLE agent_listings
                            ADD COLUMN IF NOT EXISTS address TEXT,
                            ADD COLUMN IF NOT EXISTS property_type VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS bathrooms VARCHAR(50),
                            ADD COLUMN IF NOT EXISTS listed_date VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS images_json TEXT,
                            ADD COLUMN IF NOT EXISTS features_json TEXT,
                            ADD COLUMN IF NOT EXISTS floor_area VARCHAR(100),
                            ADD COLUMN IF NOT EXISTS ai_report TEXT,
                            ADD COLUMN IF NOT EXISTS ai_report_generated_at TIMESTAMPTZ;
                    """))
                    await conn.execute(text("""
                        ALTER TABLE stale_listing_assessments
                            ADD COLUMN IF NOT EXISTS listing_image_url TEXT,
                            ADD COLUMN IF NOT EXISTS listing_snapshot_json TEXT;
                    """))
                    await conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS stale_listing_discovery_runs (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            status VARCHAR(40) NOT NULL DEFAULT 'queued',
                            dry_run BOOLEAN NOT NULL DEFAULT TRUE,
                            location_names TEXT,
                            min_price INTEGER NOT NULL DEFAULT 300001,
                            min_days_on_market INTEGER NOT NULL DEFAULT 180,
                            max_candidates INTEGER NOT NULL DEFAULT 25,
                            max_pages_per_location INTEGER NOT NULL DEFAULT 2,
                            candidates_seen INTEGER NOT NULL DEFAULT 0,
                            eligible_count INTEGER NOT NULL DEFAULT 0,
                            created_prospects_count INTEGER NOT NULL DEFAULT 0,
                            skipped_count INTEGER NOT NULL DEFAULT 0,
                            failed_count INTEGER NOT NULL DEFAULT 0,
                            result_json TEXT,
                            error_message TEXT,
                            started_by_user_id UUID,
                            started_at TIMESTAMPTZ,
                            completed_at TIMESTAMPTZ,
                            created_at TIMESTAMPTZ DEFAULT NOW(),
                            updated_at TIMESTAMPTZ DEFAULT NOW()
                        );
                    """))
                    await conn.execute(text("""
                        ALTER TABLE stale_listing_prospects
                            ADD COLUMN IF NOT EXISTS discovery_run_id UUID,
                            ADD COLUMN IF NOT EXISTS source_status VARCHAR(50),
                            ADD COLUMN IF NOT EXISTS skipped_reason VARCHAR(255),
                            ADD COLUMN IF NOT EXISTS last_error TEXT,
                            ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ,
                            ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
                            ADD COLUMN IF NOT EXISTS letter_sent_at TIMESTAMPTZ,
                            ADD COLUMN IF NOT EXISTS abandonment_sms_sent_at TIMESTAMPTZ;
                    """))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_stale_listing_discovery_runs_status "
                        "ON stale_listing_discovery_runs (status);"
                    ))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_stale_listing_prospects_discovery_run_id "
                        "ON stale_listing_prospects (discovery_run_id);"
                    ))
                    await conn.execute(text("""
                        ALTER TABLE stale_listing_prospects
                            ALTER COLUMN bedrooms TYPE INTEGER
                            USING NULLIF(regexp_replace(bedrooms::text, '[^0-9]', '', 'g'), '')::integer,
                            ALTER COLUMN bathrooms TYPE INTEGER
                            USING NULLIF(regexp_replace(bathrooms::text, '[^0-9]', '', 'g'), '')::integer;
                    """))
                    await conn.execute(text("DROP INDEX IF EXISTS ix_stale_listing_prospects_property_code;"))
                    await conn.execute(text("""
                        CREATE UNIQUE INDEX IF NOT EXISTS ux_stale_listing_prospects_active_property_code
                        ON stale_listing_prospects (property_code)
                        WHERE COALESCE(source_status, 'active') <> 'archived';
                    """))
                    await conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS agent_advanced_service_payments (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            listing_id UUID REFERENCES agent_listings(id) ON DELETE SET NULL,
                            listing_url TEXT,
                            listing_title VARCHAR(500),
                            property_price_raw VARCHAR(100),
                            service_fee_amount FLOAT NOT NULL,
                            currency VARCHAR(10) DEFAULT 'GBP',
                            sumup_checkout_id VARCHAR(255),
                            sumup_checkout_url TEXT,
                            payment_status VARCHAR(50) DEFAULT 'pending',
                            created_at TIMESTAMPTZ DEFAULT NOW()
                        );
                    """))
                    await conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS stale_listing_assessments (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            email VARCHAR(320) NOT NULL,
                            first_name VARCHAR(100) NOT NULL,
                            last_name VARCHAR(100) NOT NULL,
                            phone_country_code VARCHAR(10) DEFAULT '+44',
                            phone VARCHAR(30) NOT NULL,
                            package VARCHAR(50) NOT NULL,
                            property_address VARCHAR(500),
                            listing_url TEXT,
                            questions_data TEXT,
                            ai_report_json TEXT,
                            ai_report_generated_at TIMESTAMPTZ,
                            agent_notes TEXT,
                            agent_edited_report_json TEXT,
                            report_status VARCHAR(50) NOT NULL DEFAULT 'pending',
                            payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
                            listing_image_url TEXT,
                            listing_snapshot_json TEXT,
                            sumup_checkout_id VARCHAR(255),
                            sumup_checkout_url TEXT,
                            reference VARCHAR(20) NOT NULL,
                            created_at TIMESTAMPTZ DEFAULT NOW(),
                            updated_at TIMESTAMPTZ DEFAULT NOW()
                        );
                    """))
                    await conn.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_sl_reference ON stale_listing_assessments (reference);"
                    ))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_sl_email ON stale_listing_assessments (email);"
                    ))
                    # ── Rightmove listings table — add any columns missing on pre-existing tables.
                    # NOTE: Do NOT use CREATE TABLE here — the table is created by create_all above.
                    # Running CREATE TABLE IF NOT EXISTS concurrently across 4 uvicorn workers causes
                    # a pg_type race condition (UniqueViolationError) that rolls back the entire
                    # startup transaction. ALTER TABLE ADD COLUMN IF NOT EXISTS uses table-level
                    # locks and is safe for concurrent workers.
                    await conn.execute(text("""
                        ALTER TABLE rightmove_listings
                            ADD COLUMN IF NOT EXISTS region VARCHAR(100) NOT NULL DEFAULT '',
                            ADD COLUMN IF NOT EXISTS country VARCHAR(20) NOT NULL DEFAULT 'uk',
                            ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'rightmove',
                            ADD COLUMN IF NOT EXISTS price_native INTEGER NOT NULL DEFAULT 0,
                            ADD COLUMN IF NOT EXISTS price_currency VARCHAR(3) NOT NULL DEFAULT 'GBP',
                            ADD COLUMN IF NOT EXISTS property_type VARCHAR(100) NOT NULL DEFAULT '',
                            ADD COLUMN IF NOT EXISTS description TEXT,
                            ADD COLUMN IF NOT EXISTS images_json TEXT,
                            ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
                            ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ DEFAULT NOW(),
                            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
                    """))
                    await conn.execute(text("""
                        UPDATE rightmove_listings
                        SET
                            country = CASE
                                WHEN lower(coalesce(country, '')) IN ('america', 'usa', 'us') THEN 'america'
                                WHEN lower(coalesce(country, '')) IN ('dubai', 'uae') THEN 'dubai'
                                WHEN lower(coalesce(country, '')) = 'canada' THEN 'canada'
                                WHEN lower(coalesce(region, '')) IN ('america', 'usa', 'us') THEN 'america'
                                WHEN lower(coalesce(region, '')) IN ('dubai', 'uae') THEN 'dubai'
                                WHEN lower(coalesce(region, '')) = 'canada' THEN 'canada'
                                WHEN url ILIKE '%bayut%' OR url ILIKE '%propertyfinder%' THEN 'dubai'
                                WHEN url ILIKE '%realtor.ca%' THEN 'canada'
                                WHEN url ILIKE '%realtor.com%' OR url ILIKE '%zillow%' OR url ILIKE '%redfin%' THEN 'america'
                                ELSE 'uk'
                            END,
                            source = CASE
                                WHEN url ILIKE '%bayut%' THEN 'bayut'
                                WHEN url ILIKE '%realtor.ca%' THEN 'realtor_ca'
                                WHEN url ILIKE '%realtor.com%' THEN 'realtor_com'
                                ELSE source
                            END,
                            price_native = CASE WHEN price_native = 0 THEN price_gbp ELSE price_native END,
                            price_currency = CASE
                                WHEN url ILIKE '%bayut%' OR url ILIKE '%propertyfinder%' THEN 'AED'
                                WHEN url ILIKE '%realtor.ca%' THEN 'CAD'
                                WHEN url ILIKE '%realtor.com%' OR url ILIKE '%zillow%' OR url ILIKE '%redfin%' THEN 'USD'
                                ELSE price_currency
                            END
                        WHERE country = 'uk' OR price_native = 0;
                    """))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_rightmove_listings_city ON rightmove_listings (city);"
                    ))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_rightmove_listings_country ON rightmove_listings (country);"
                    ))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_rightmove_listings_country_city ON rightmove_listings (country, city);"
                    ))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_rightmove_listings_country_price ON rightmove_listings (country, price_gbp);"
                    ))
                    await conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_rightmove_listings_country_active_scraped "
                        "ON rightmove_listings (country, is_active, scraped_at DESC);"
                    ))
                else:
                    logger.info(
                        "Skipping Postgres-only schema sync on dialect=%s",
                        conn.dialect.name,
                    )
            DB_READY = True
            logger.info("Database tables verified ✓")

            # Idempotent admin seeding from env vars (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
            try:
                await _seed_admin_user()
            except Exception as exc:
                logger.error("Admin seeding failed (non-fatal): %s", exc)

            # Pre-warm one DB connection so the first /auth/login or /auth/register
            # response does not pay the asyncpg cold-connect penalty (~150-300ms
            # against the Supabase pooler from cold). Best effort only.
            try:
                from sqlalchemy import text as _text
                async with engine.connect() as _conn:
                    await _conn.execute(_text("SELECT 1"))
                logger.info("DB connection pool pre-warmed.")
            except Exception as exc:
                logger.warning("DB pre-warm skipped: %s", exc)
        except Exception as exc:
            DB_ERROR = f"{type(exc).__name__}: {exc}"
            logger.error("DATABASE STARTUP FAILED (non-fatal, app will keep running): %s", DB_ERROR)
    else:
        logger.warning("No database credentials configured — DB features will be unavailable.")

    import asyncio

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, google_sheets.ensure_tabs_exist)
    if google_sheets._tabs_verified:
        logger.info("Google Sheets tabs verified ✓")
    else:
        logger.warning("Google Sheets tab setup failed — check credentials (non-fatal).")

    # ── DB pool keep-alive ─────────────────────────────────────────────────
    # Run a tiny `SELECT 1` every ~4 minutes to keep at least one connection
    # in the pool warm. Without this, low-traffic windows let the pool drain
    # via Supabase's idle disconnect, and the next form submission pays the
    # asyncpg+SSL handshake cost (~200-800ms) — the main reason public form
    # submissions feel slow in production but instant in dev.
    if HAS_DATABASE:
        from sqlalchemy import text as _text

        async def _db_keepalive() -> None:
            interval_s = 240  # 4 min — well below pool_recycle (30 min)
            while True:
                try:
                    async with engine.connect() as conn:
                        await conn.execute(_text("SELECT 1"))
                except Exception as exc:  # noqa: BLE001
                    logger.warning("DB keep-alive ping failed: %s", exc)
                await asyncio.sleep(interval_s)

        # Stash the task on the app state so it isn't garbage-collected.
        app.state.db_keepalive_task = asyncio.create_task(_db_keepalive())
        logger.info("DB keep-alive ping scheduled (every 4 min).")

    # ── Marketplace scraper background loops ─────────────────────────
    def _env_enabled(name: str, default: bool) -> bool:
        raw = os.getenv(name, "").strip().lower()
        if raw in {"1", "true", "yes", "on"}:
            return True
        if raw in {"0", "false", "no", "off"}:
            return False
        return default

    if HAS_DATABASE and _env_enabled("ENABLE_MARKETPLACE_SCRAPERS", True):
        scraper_specs = [
            ("Rightmove", "DISABLE_RIGHTMOVE_SCRAPER", "app.services.rightmove_scraper"),
            ("Rightmove overseas", "DISABLE_RIGHTMOVE_OVERSEAS_SCRAPER", "app.services.rightmove_overseas_scraper"),
            # Canada listings now come from realtor.ca instead of Rightmove's
            # overseas section (see rightmove_overseas_scraper.py's COUNTRIES
            # tuple — "canada" was removed from it). This scraper already
            # existed but was never scheduled here.
            ("Realtor.ca", "DISABLE_REALTOR_CA_SCRAPER", "app.services.realtor_ca_scraper"),
        ]
        app.state.scraper_tasks = []
        import importlib
        for scraper_name, disable_env, module_name in scraper_specs:
            if _env_enabled(disable_env, False):
                logger.info("%s scraper loop disabled by %s.", scraper_name, disable_env)
                continue
            module = importlib.import_module(module_name)
            app.state.scraper_tasks.append(asyncio.create_task(module.start_scraper_loop()))
            logger.info("%s scraper loop scheduled.", scraper_name)
    elif HAS_DATABASE:
        logger.info("Marketplace scraper loops disabled by ENABLE_MARKETPLACE_SCRAPERS.")

    # ── Dedicated direct-Rightmove stale-listing scraper ─────────────────
    # This is intentionally not the marketplace inventory scraper. It searches
    # Rightmove directly and runs until the per-cycle prospect email target is
    # reached. A PostgreSQL advisory lock prevents duplicate work per cycle.
    if HAS_DATABASE and _env_enabled("ENABLE_STALE_LISTING_DISCOVERY", True):
        from app.services.stale_listing_scraper import start_stale_listing_scraper_loop

        app.state.scraper_tasks.append(asyncio.create_task(start_stale_listing_scraper_loop()))
        logger.info("Dedicated direct stale-listing scraper loop scheduled.")
    elif HAS_DATABASE:
        logger.info("Automatic stale-listing discovery disabled by ENABLE_STALE_LISTING_DISCOVERY.")

    # ── Pre-purchase / cart-abandonment email drip ────────────────────────
    # Twelve emails (30 min .. 60 days) for prospects who submitted "Your
    # Details" but never completed checkout. Same advisory-lock pattern as
    # the scrapers above, so it's safe to run under multiple uvicorn workers.
    if HAS_DATABASE and _env_enabled("ENABLE_STALE_PROSPECT_ABANDONMENT_EMAILS", True):
        from app.services.stale_prospect_abandonment import start_abandonment_email_loop

        app.state.scraper_tasks.append(asyncio.create_task(start_abandonment_email_loop()))
        logger.info("Stale-prospect abandonment email loop scheduled.")
    elif HAS_DATABASE:
        logger.info("Stale-prospect abandonment emails disabled by ENABLE_STALE_PROSPECT_ABANDONMENT_EMAILS.")

    # One-time SMS nudge (24h after "Your Details" without paying) — new and
    # unverified against the real Twilio account, so this defaults OFF
    # (unlike the email drip above) until confirmed working and approved to
    # go live for real prospects. Set ENABLE_STALE_PROSPECT_ABANDONMENT_SMS=true
    # once ready.
    if HAS_DATABASE and _env_enabled("ENABLE_STALE_PROSPECT_ABANDONMENT_SMS", False):
        from app.services.stale_prospect_abandonment import start_abandonment_sms_loop

        app.state.scraper_tasks.append(asyncio.create_task(start_abandonment_sms_loop()))
        logger.info("Stale-prospect abandonment SMS loop scheduled.")
    elif HAS_DATABASE:
        logger.info("Stale-prospect abandonment SMS disabled (ENABLE_STALE_PROSPECT_ABANDONMENT_SMS not set).")

    # ── Post-purchase nurture / upsell email drip ("phase two") ───────────
    # Twelve emails (immediately .. day 56) for prospects who completed
    # checkout, counted from unlocked_at. Same advisory-lock pattern.
    if HAS_DATABASE and _env_enabled("ENABLE_STALE_PROSPECT_POST_PURCHASE_EMAILS", True):
        from app.services.stale_prospect_post_purchase import start_post_purchase_email_loop

        app.state.scraper_tasks.append(asyncio.create_task(start_post_purchase_email_loop()))
        logger.info("Stale-prospect post-purchase email loop scheduled.")
    elif HAS_DATABASE:
        logger.info("Stale-prospect post-purchase emails disabled by ENABLE_STALE_PROSPECT_POST_PURCHASE_EMAILS.")


@app.on_event("shutdown")
async def shutdown() -> None:
    for attr in ("db_keepalive_task", "scraper_task"):
        task = getattr(app.state, attr, None)
        if task is not None:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
    for task in getattr(app.state, "scraper_tasks", []):
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass
    await engine.dispose()
    logger.info("Database connections closed.")


@app.get("/health", tags=["Health"])
async def health() -> JSONResponse:
    return JSONResponse({
        "status": "ok",
        "service": "havlo-api",
        "env": settings.APP_ENV,
        "db_ready": DB_READY,
        "db_error": DB_ERROR,
        "db_configured": HAS_DATABASE,
    })


@app.get("/api/v1/health", tags=["Health"])
async def health_v1() -> JSONResponse:
    return JSONResponse({
        "status": "ok",
        "service": "havlo-api",
        "env": settings.APP_ENV,
        "db_ready": DB_READY,
        "db_error": DB_ERROR,
        "db_configured": HAS_DATABASE,
    })


def _check_diag_token(request: Request) -> bool:
    """Allow diag endpoints in dev, or with a valid token in any env.

    In production the request must present a token equal to the ``DIAG_TOKEN``
    environment variable. The token can be supplied via either:
      * ``X-Diag-Token`` header (recommended for scripts), or
      * ``?token=...`` query string (handy for one-off browser tests).
    """
    settings = get_settings()
    if (getattr(settings, "APP_ENV", "development") or "development").lower() != "production":
        return True
    expected = os.environ.get("DIAG_TOKEN", "").strip()
    if not expected:
        return False
    provided = (
        request.headers.get("X-Diag-Token", "").strip()
        or request.query_params.get("token", "").strip()
        or request.query_params.get("diag_token", "").strip()
    )
    return bool(provided) and provided == expected


@app.get("/api/v1/diag/sheets", tags=["Health"])
async def diag_sheets(request: Request) -> JSONResponse:
    """Check Google Sheets configuration and connectivity."""
    return JSONResponse(google_sheets.diagnostics())


@app.post("/api/v1/diag/sheets/test", tags=["Health"])
async def diag_sheets_test(request: Request) -> JSONResponse:
    """Append a test row to the Registrations tab to confirm write access."""
    if not _check_diag_token(request):
        return JSONResponse({"error": "forbidden"}, status_code=403)
    if not google_sheets.is_configured():
        return JSONResponse({"ok": False, "error": "Google Sheets is not configured."}, status_code=400)
    try:
        google_sheets.append_test_row("Registrations")
        return JSONResponse({"ok": True, "message": "Test row appended to Registrations tab."})
    except Exception as e:
        return JSONResponse({"ok": False, "error": f"{type(e).__name__}: {e}"}, status_code=500)


@app.get("/api/v1/diag/email", tags=["Health"])
async def diag_email(request: Request) -> JSONResponse:
    """Show whether Resend is configured (without exposing the key)."""
    if not _check_diag_token(request):
        return JSONResponse({"error": "forbidden"}, status_code=403)
    from app.services import email_service as _es
    return JSONResponse(_es.diagnostics())


@app.api_route("/api/v1/diag/email/test", methods=["GET", "POST"], tags=["Health"])
async def diag_email_test(request: Request) -> JSONResponse:
    """Send a test email via Resend to verify credentials end-to-end.

    Accepts either:
      * POST with JSON body ``{"to": "you@example.com"}``
      * GET  with query string ``?to=you@example.com`` (handy for browser testing)
    """
    if not _check_diag_token(request):
        return JSONResponse({"error": "forbidden"}, status_code=403)
    from app.services import email_service as _es
    if not _es.is_configured():
        return JSONResponse({"ok": False, "error": "Resend is not configured."}, status_code=400)
    to = (request.query_params.get("to") or "").strip()
    if not to and request.method == "POST":
        try:
            body = await request.json()
        except Exception:
            body = {}
        to = (body.get("to") or "").strip()
    if not to:
        to = (settings.SUPPORT_EMAIL or "").strip()
    if not to:
        return JSONResponse(
            {"ok": False, "error": "Missing 'to' email address. Pass ?to=you@example.com or POST {\"to\": \"...\"}."},
            status_code=400,
        )
    sent = await asyncio.to_thread(_es.send_test_email, to)
    return JSONResponse({"ok": bool(sent), "to": to})


@app.get(
    "/api/v1/diag/email/preview/{template_name}",
    tags=["Health"],
    response_class=HTMLResponse,
    response_model=None,
)
async def diag_email_preview(template_name: str, request: Request):
    """Render a protected HTML preview for any production email template."""
    if not _check_diag_token(request):
        return JSONResponse({"error": "forbidden"}, status_code=403)
    from app.services import email_service as _es

    frontend_base = (request.query_params.get("frontend_base") or "").strip() or None
    try:
        html = _es.render_email_preview(template_name, frontend_base_url=frontend_base)
    except KeyError:
        return JSONResponse(
            {"error": "unknown_template", "templates": _es.preview_template_names()},
            status_code=404,
        )
    return HTMLResponse(content=html)


@app.get("/api/v1/config", tags=["Config"])
async def public_config() -> JSONResponse:
    """Return public frontend configuration values (no secrets)."""
    return JSONResponse({
        "calendly_link": settings.CALENDLY_LINK or "",
    })


@app.get("/api/v1/geo/home-target", tags=["Config"])
async def geo_home_target(
    cf_ipcountry: str | None = Header(None, alias="CF-IPCountry"),
    x_vercel_ip_country: str | None = Header(None, alias="X-Vercel-IP-Country"),
    x_country_code: str | None = Header(None, alias="X-Country-Code"),
) -> JSONResponse:
    """Return the best public homepage experience from proxy country headers."""
    country = (cf_ipcountry or x_vercel_ip_country or x_country_code or "").strip().upper()
    target_path = "/stale-listings" if country in {"GB", "UK"} else "/buyabroad/uk"
    return JSONResponse({"country": country or None, "target_path": target_path})


@app.options("/{full_path:path}", include_in_schema=False)
async def options_catch_all(full_path: str) -> JSONResponse:
    return JSONResponse({"ok": True})


@app.get("/api/v1/diag", tags=["Health"])
async def diag() -> JSONResponse:
    """Diagnostic endpoint that reveals what env-driven config the backend
    is actually using, with secrets masked. Use this to debug Railway env."""
    import os
    from app.db.database import DATABASE_URL as _RESOLVED_URL

    def mask(value: str | None) -> str:
        if not value:
            return ""
        if len(value) <= 4:
            return "*" * len(value)
        return f"{value[:2]}***{value[-2:]} (len={len(value)})"

    safe_url = _RESOLVED_URL or ""
    if "@" in safe_url:
        scheme_creds, host_part = safe_url.split("@", 1)
        if ":" in scheme_creds and "//" in scheme_creds:
            scheme, creds = scheme_creds.split("//", 1)
            user_part = creds.split(":", 1)[0]
            safe_url = f"{scheme}//{user_part}:***@{host_part}"

    import hashlib
    raw_pw = os.environ.get("SUPABASE_DB_PASSWORD", "")
    raw_db_url = os.environ.get("DATABASE_URL", "")

    def pw_fingerprint(pw: str) -> dict:
        if not pw:
            return {"len": 0, "sha256_prefix": "", "first": "", "last": "",
                    "has_whitespace": False, "has_quotes": False,
                    "has_dollar": False, "has_hash": False}
        return {
            "len": len(pw),
            "sha256_prefix": hashlib.sha256(pw.encode()).hexdigest()[:10],
            "first": pw[0] if pw else "",
            "last": pw[-1] if pw else "",
            "has_whitespace": pw != pw.strip(),
            "has_quotes": pw.startswith(('"', "'")) or pw.endswith(('"', "'")),
            "has_dollar": "$" in pw,
            "has_hash": "#" in pw,
        }

    # Reconstruct password being used to build DB URL (post-regex-extraction)
    from app.config import _extract_supabase_password_from_url
    used_pw = raw_pw
    if not used_pw:
        for cand in (raw_db_url, os.environ.get("SUPABASE_DATABASE_URL", "")):
            extracted = _extract_supabase_password_from_url(cand)
            if extracted:
                used_pw = extracted
                break

    return JSONResponse({
        "db_ready": DB_READY,
        "db_error": DB_ERROR,
        "resolved_database_url": safe_url,
        "env": {
            "APP_ENV": os.environ.get("APP_ENV", ""),
            "SUPABASE_DB_HOST": os.environ.get("SUPABASE_DB_HOST", ""),
            "SUPABASE_DB_USER": os.environ.get("SUPABASE_DB_USER", ""),
            "SUPABASE_DB_PORT": os.environ.get("SUPABASE_DB_PORT", ""),
            "SUPABASE_DB_NAME": os.environ.get("SUPABASE_DB_NAME", ""),
            "ALLOWED_ORIGINS": os.environ.get("ALLOWED_ORIGINS", ""),
            "DATABASE_URL_present": bool(raw_db_url),
        },
        "password_from_env": pw_fingerprint(raw_pw),
        "password_used_for_connection": pw_fingerprint(used_pw),
    })


API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(onboarding.router, prefix=API_PREFIX)
app.include_router(messaging.router, prefix=API_PREFIX)
app.include_router(bookings.router, prefix=API_PREFIX)
app.include_router(property_matching.router, prefix=API_PREFIX)
app.include_router(elite_property.router, prefix=API_PREFIX)
app.include_router(sell_faster.router, prefix=API_PREFIX)
app.include_router(sell_faster.public_router, prefix=API_PREFIX)
app.include_router(sale_audit.router, prefix=API_PREFIX)
app.include_router(buyer_network.router, prefix=API_PREFIX)
app.include_router(agent_dashboard.router, prefix=API_PREFIX)
app.include_router(buyer_network.public_router, prefix=API_PREFIX)
app.include_router(public_forms.router, prefix=API_PREFIX)

from app.routers import admin_debug  # noqa: E402
app.include_router(admin_debug.router, prefix=API_PREFIX)

from app.routers import admin_users  # noqa: E402
app.include_router(admin_users.router, prefix=API_PREFIX)

from app.routers import stale_listings  # noqa: E402
app.include_router(stale_listings.public_router, prefix=API_PREFIX)
app.include_router(stale_listings.admin_router, prefix=API_PREFIX)
from app.routers import product_access  # noqa: E402
app.include_router(product_access.router, prefix=API_PREFIX)

from app.routers import custom_offers  # noqa: E402
app.include_router(custom_offers.public_router, prefix=API_PREFIX)
app.include_router(custom_offers.admin_router, prefix=API_PREFIX)
app.include_router(listings.router)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "havlo_frontend" / "dist"

from fastapi.responses import PlainTextResponse, Response
from app.seo import lookup as seo_lookup, inject as seo_inject, PAGE_SEO, SITE_BASE
from datetime import date


@app.get("/robots.txt", include_in_schema=False)
async def robots_txt() -> PlainTextResponse:
    body = (
        "User-agent: *\n"
        "Allow: /\n"
        "Allow: /custom-offers\n"
        "Disallow: /api/\n"
        "Disallow: /dashboard\n"
        "Disallow: /admin\n"
        "Disallow: /checkout\n"
        "Disallow: /get-started\n"
        "Disallow: /custom-offers/proposal\n"
        "Disallow: /custom-offers/plan\n"
        "Disallow: /custom-offers/complete\n"
        "Disallow: /custom-offers/status\n"
        f"\nSitemap: {SITE_BASE}/sitemap.xml\n"
    )
    return PlainTextResponse(body, media_type="text/plain")


@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap_xml() -> Response:
    today = date.today().isoformat()
    priorities = {"/": "1.0"}
    changefreqs = {"/": "weekly"}
    legal_paths = {"/terms", "/privacy-policy", "/cookie-policy"}

    urls = []
    for path, seo in PAGE_SEO.items():
        prio = priorities.get(path, "0.6" if path in legal_paths else "0.8")
        freq = changefreqs.get(path, "yearly" if path in legal_paths else "monthly")
        urls.append(
            "  <url>\n"
            f"    <loc>{seo.canonical_url}</loc>\n"
            f"    <lastmod>{today}</lastmod>\n"
            f"    <changefreq>{freq}</changefreq>\n"
            f"    <priority>{prio}</priority>\n"
            "  </url>"
        )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(content=body, media_type="application/xml")


UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


# ── Socket.IO sub-mount ──────────────────────────────────────────────────────
# Mounted BEFORE the SPA catch-all so /socket.io/* is not swallowed in prod.
from app.services.socketio_server import sio as _sio  # noqa: E402
import socketio as _socketio_mod  # noqa: E402

app.mount("/socket.io", _socketio_mod.ASGIApp(_sio, socketio_path=""))


if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="static-assets")

    INDEX_HTML_PATH = FRONTEND_DIST / "index.html"

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        html = INDEX_HTML_PATH.read_text(encoding="utf-8")
        seo = seo_lookup("/" + full_path if full_path else "/")
        return HTMLResponse(seo_inject(html, seo))


