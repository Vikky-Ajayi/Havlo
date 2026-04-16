"""
Havlo Real Estate Platform — FastAPI Backend
============================================
Startup order:
  1. Create all DB tables (if not exists)
  2. Ensure Google Sheets tabs exist
  3. Register all routers
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db.database import Base, engine, HAS_DATABASE
from app.models import models  # noqa: F401 — ensures models are registered with Base
from app.routers import (
    auth,
    bookings,
    buyer_network,
    elite_property,
    messaging,
    onboarding,
    property_matching,
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


DB_READY: bool = False
DB_ERROR: str | None = None


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

            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            DB_READY = True
            logger.info("Database tables verified ✓")
        except Exception as exc:
            DB_ERROR = f"{type(exc).__name__}: {exc}"
            logger.error("DATABASE STARTUP FAILED (non-fatal, app will keep running): %s", DB_ERROR)
    else:
        logger.warning("No database credentials configured — DB features will be unavailable.")

    import asyncio

    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, google_sheets.ensure_tabs_exist)
        logger.info("Google Sheets tabs verified ✓")
    except Exception as exc:
        logger.error("Google Sheets setup failed (non-fatal): %s", exc)


@app.on_event("shutdown")
async def shutdown() -> None:
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
app.include_router(sale_audit.router, prefix=API_PREFIX)
app.include_router(buyer_network.router, prefix=API_PREFIX)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "havlo_frontend" / "dist"

if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))
