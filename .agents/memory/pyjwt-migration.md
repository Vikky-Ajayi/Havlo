---
name: PyJWT migration
description: python-jose is blocked by Replit security firewall; project uses PyJWT instead
---

Replit's package firewall blocks `python-jose==3.3.0` with a 403 (CVE policy).

**Rule:** Use `PyJWT` (import as `import jwt; from jwt import PyJWTError as JWTError`) instead of `from jose import JWTError, jwt`.

**Why:** python-jose is flagged by Replit security policy and cannot be installed. PyJWT provides a compatible API.

**How to apply:** The three files that use JWT are `app/services/local_auth.py`, `app/routers/auth.py`, and `app/services/product_access.py`. All have been migrated. The `requirements.txt` entry is `PyJWT==2.13.0`. PyJWT's `jwt.decode` accepts `audience=` and `options={"verify_exp": False}` just like python-jose.
