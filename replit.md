# Havlo Real Estate Platform

## Overview
Havlo is an international real estate platform that facilitates property matching, "elite" property listings, and various seller services (Sell Faster, Sale Audit, etc.) with integrated payments and automated data logging.

## Architecture

### Frontend (`/havlo_frontend`)
- React 19 + TypeScript + Vite
- Tailwind CSS for styling
- React Router for navigation
- Runs on port 5000 in development

### Backend (`/app`)
- FastAPI (Python 3.12)
- SQLAlchemy + asyncpg for async PostgreSQL access
- Alembic for database migrations
- Runs on a separate port (8000 recommended for local dev)

### Database
- PostgreSQL (via Supabase or direct connection)

## Key Integrations
- **Supabase**: Authentication
- **Google Sheets**: Form submission logging
- **Twilio**: SMS notifications
- **SumUp**: Payments
- **Calendly**: Session booking

## Environment Variables Required
See `.env.example` for all required variables. Key secrets needed:
- `SECRET_KEY` - App secret key
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` - PostgreSQL asyncpg connection string
- `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SPREADSHEET_ID`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`
- `CALENDLY_LINK`
- `ALLOWED_ORIGINS` - Comma-separated allowed CORS origins
- `FRONTEND_URL`

## Development Workflow
- Frontend workflow: `cd havlo_frontend && npm run dev` (port 5000)
- Backend (manual): `uvicorn app.main:app --host localhost --port 8000 --reload`
- DB migrations: `alembic upgrade head`

## Deployment
- **Frontend**: Deployed on **Vercel** — builds with `cd havlo_frontend && npm run build`, output in `havlo_frontend/dist`
- **Backend**: Deployed on **Railway** — configured via `railway.json` and `Procfile`, runs `uvicorn app.main:app`
- These are two separate deployment targets; the frontend calls the Railway backend API via `VITE_API_URL` or similar env var
