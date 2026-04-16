# Havlo Real Estate Platform

## Overview
Havlo is an international real estate platform that facilitates property matching, "elite" property listings, and various seller services (Sell Faster, Sale Audit, etc.) with integrated payments and automated data logging.

## Architecture

### Frontend (`/havlo_frontend`)
- React 19 + TypeScript + Vite
- Tailwind CSS for styling
- React Router for navigation
- Runs on port 5000 in development (workflow: "Start application")
- Currently a UI prototype with hardcoded mock data (no live API calls wired yet)

### Backend (`/app`)
- FastAPI (Python 3.12)
- SQLAlchemy 2.0 + **psycopg3** (`psycopg[binary]`) for async PostgreSQL access
- Runs on port 8000 (workflow: "Backend API")
- **IMPORTANT**: Uses psycopg3 (NOT asyncpg) because Supabase uses PgBouncer which is incompatible with asyncpg's prepared statements. psycopg3 with `prepare_threshold=None` disables server-side prepared statements and is fully PgBouncer-compatible.

### Database
- PostgreSQL via Supabase **session pooler**: `aws-0-eu-west-1.pooler.supabase.com:5432`
- User: `postgres.noeghrlsmecadfuukjma`
- Direct host (`db.*.supabase.co`) is NOT reachable from Replit — always use the pooler
- Password has special chars and must be `quote_plus`-encoded in DSNs
- `app/db/database.py` builds the psycopg3 URL from `SUPABASE_DB_*` env vars

## Key Integrations
- **Supabase**: Authentication + PostgreSQL database
- **Google Sheets**: Form submission logging
- **Twilio**: SMS notifications
- **SumUp**: Payments
- **Calendly**: Session booking

## Environment Variables Required
All secrets are stored in Replit secrets. Key ones:
- `SECRET_KEY` - App secret key
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_HOST` = `aws-0-eu-west-1.pooler.supabase.com`
- `SUPABASE_DB_USER` = `postgres.noeghrlsmecadfuukjma`
- `SUPABASE_DB_PASSWORD` - DB password (special chars, URL-encoded in code)
- `SUPABASE_DB_PORT` = `5432`
- `SUPABASE_DB_NAME` = `postgres`
- `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SPREADSHEET_ID`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`
- `CALENDLY_LINK`

Non-secret env vars (set in Replit):
- `APP_ENV=development`
- `ALLOWED_ORIGINS` - Comma-separated CORS origins
- `FRONTEND_URL=https://www.heyhavlo.com`

## Development Workflows
- **Frontend**: `cd havlo_frontend && npm run dev` → port 5000 (webview)
- **Backend**: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info` → port 8000 (console)

## Deployment
- **Frontend**: Deployed on **Vercel** — builds with `cd havlo_frontend && npm run build`, output in `havlo_frontend/dist`
- **Backend**: Deployed on **Railway** — configured via `railway.json` and `Procfile`, runs `uvicorn app.main:app`
- The frontend calls the Railway backend API via `VITE_API_URL` env var

## Important Technical Notes
- `DATABASE_URL` secret in Replit points to a local Helium DB — NOT used. Always derive DB URL from `SUPABASE_DB_*` params.
- The backend hardcodes the pooler host (`aws-0-eu-west-1.pooler.supabase.com`) in `app/db/database.py` to guarantee correct connectivity regardless of env var values.
- On startup, the backend verifies DB tables (create_all) and Google Sheets tabs.
