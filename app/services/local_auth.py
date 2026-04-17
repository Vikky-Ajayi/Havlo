"""Local JWT authentication — used when Supabase is not configured."""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings


def hash_password(password: str) -> str:
    """Synchronous bcrypt hash — use `hash_password_async` from request handlers."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Synchronous bcrypt verify — use `verify_password_async` from request handlers."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


async def hash_password_async(password: str) -> str:
    """Run bcrypt hashing in a worker thread so the event loop is not blocked."""
    return await asyncio.to_thread(hash_password, password)


async def verify_password_async(plain: str, hashed: str) -> bool:
    """Run bcrypt verification in a worker thread so the event loop is not blocked."""
    return await asyncio.to_thread(verify_password, plain, hashed)


def create_access_token(user_id: str, expires_minutes: int = 60 * 24 * 7) -> str:
    settings = get_settings()
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=expires_minutes),
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> dict | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        return None
