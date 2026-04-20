# Havlo Real Estate Platform

## Overview
Havlo is an international real estate platform that facilitates property matching, elite property listings, and various seller services with integrated payments and automated data logging.

## Architecture

### Frontend (`/havlo_frontend`)
- React 19 + TypeScript + Vite
- Tailwind CSS for styling
- React Router for navigation
- Runs on port 5000 in development via the `Start application` workflow
- All frontend features wired to real backend API via `src/lib/api.ts`
- Auth state managed via `AuthContext` with token in localStorage (`havlo_token`)
- Vite proxies `/api/v1` and WebSocket traffic to `http://localhost:8000`
- Configured with `host: 0.0.0.0` and `allowedHosts: true` for Replit preview proxy compatibility

### Backend (`/app`)
- FastAPI (Python 3.12)
- SQLAlchemy 2.0 + asyncpg for async PostgreSQL access
- Started by `start.sh` on localhost port 8000 so it does not conflict with the frontend webview port
- CORS wildcard enabled for Replit preview proxy compatibility
- Gracefully starts without external integration credentials; optional services are non-fatal if unconfigured

### Authentication
- Local JWT auth: bcrypt password hashing + HS256 JWT tokens
- `app/services/local_auth.py`: hash_password, verify_password, create_access_token, decode_access_token
- `app/dependencies.py`: get_current_user (JWT to DB user), require_roles (role-gated dependency)
- Tokens expire after 7 days and are stored in localStorage as `havlo_token`

### Database
- Development: PostgreSQL via Replit's built-in `DATABASE_URL` env var (host: `helium`)
- Production: Supabase PostgreSQL requires `SUPABASE_DB_PASSWORD`; `app/config.py` builds the full connection URL from Supabase credentials
- `app/db/database.py` uses `get_settings()` from `app/config.py` to resolve `DATABASE_URL`
- Strips SSL query params incompatible with asyncpg and converts URLs to `postgresql+asyncpg://`
- Tables are created via `Base.metadata.create_all` on startup
- `supabase_uid` column is nullable; `password_hash` column stores bcrypt hashes

## Key Integrations
- Google Sheets: form submission logging (optional, non-fatal if not configured)
- Twilio: SMS notifications (optional)
- SumUp: payments (optional; checkout creation fails explicitly without valid API key)
- Calendly: session booking redirect (optional)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string, provided by Replit in development
- `SUPABASE_DB_PASSWORD` - Supabase database password for production
- `SECRET_KEY` - JWT signing key, defaults to a dev key
- `ALLOWED_ORIGINS` - CORS origins
- `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SPREADSHEET_ID` - optional Google Sheets logging
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - optional SMS notifications
- `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE` - optional payments
- `CALENDLY_LINK` - optional booking redirect

## Development Workflow
- `Start application`: runs `bash start.sh`
- `start.sh` launches `uvicorn app.main:app --host localhost --port 8000 --reload` in the background, then runs `cd havlo_frontend && npm run dev`
- Frontend is served on port 5000 for the Replit web preview; backend remains on localhost:8000 behind the Vite proxy

## Deployment (Replit)
- Target: autoscale
- Build: `bash -c "cd havlo_frontend && npm ci && npm run build"`
- Run: `uvicorn app.main:app --host 0.0.0.0 --port 5000`
- In production, FastAPI serves the built frontend from `havlo_frontend/dist` when present

## Important Technical Notes
- Auth is fully local (JWT + bcrypt), no Supabase auth dependency
- `database.py` strips unsupported SSL params from `DATABASE_URL` for asyncpg compatibility
- Messaging WebSocket path: `/api/v1/messaging/ws/inbox?token=<jwt>`
- `POST /api/v1/messaging/conversations` takes `subject` as a query param
- Password validation requires at least 8 characters on both frontend and backend
