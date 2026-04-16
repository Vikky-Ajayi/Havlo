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


@app.on_event("startup")
async def startup() -> None:
    logger.info("Starting Havlo API …")

    if HAS_DATABASE:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified ✓")
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
    return JSONResponse({"status": "ok", "service": "havlo-api"})


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
