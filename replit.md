# Havlo Real Estate Platform

## Overview
Havlo is an international real estate platform that facilitates property matching, "elite" property listings, and various seller services (Sell Faster, Sale Audit, etc.) with integrated payments and automated data logging.

## Architecture

### Frontend (`/havlo_frontend`)
- React 19 + TypeScript + Vite
- Tailwind CSS for styling
- React Router for navigation
- Runs on port 5000 in development (workflow: "Start application")
- All frontend features wired to real backend API via `src/lib/api.ts`
- Auth state managed via `AuthContext` with token in localStorage (`havlo_token`)
- Vite proxies `/api/v1` (including WebSocket) to `http://localhost:8000`
- Configured: `host: 0.0.0.0`, `allowedHosts: 'all'` for Replit proxy compatibility

### Backend (`/app`)
- FastAPI (Python 3.12)
- SQLAlchemy 2.0 + asyncpg for async PostgreSQL access
- Runs on port 8000 (workflow: "Backend API")
- CORS: wildcard `*` for Replit proxy compatibility
- Gracefully starts without DB credentials (shows warning, DB endpoints unavailable)

### Authentication
- **Local JWT auth** (no Supabase dependency): bcrypt password hashing + HS256 JWT tokens
- `app/services/local_auth.py`: hash_password, verify_password, create_access_token, decode_access_token
- `app/dependencies.py`: get_current_user (JWT → DB user), require_roles (role-gated dependency)
- Tokens expire after 7 days; stored in localStorage as `havlo_token`

### Database
- **Development**: PostgreSQL via Replit's built-in `DATABASE_URL` env var (host: `helium`)
- **Production**: Supabase PostgreSQL — requires `SUPABASE_DB_PASSWORD` env var; `app/config.py` builds the full connection URL from Supabase credentials
- `app/db/database.py` uses `get_settings()` from `app/config.py` to resolve the correct DATABASE_URL
- Strips `sslmode` param (incompatible with asyncpg) and converts to `postgresql+asyncpg://`
- Tables created via `Base.metadata.create_all` on startup
- `supabase_uid` column is nullable (legacy); `password_hash` column stores bcrypt hashes

### Role-Based Permissions
- Three roles: `buyer`, `seller`, `agent`
- `property-matching`: buyer, agent
- `elite-property`: seller, agent
- `sell-faster`: seller, agent
- `sale-audit`: seller, agent
- `buyer-network`: seller, agent
- `messaging`: all roles (any authenticated user)

### International Country Codes
- `havlo_frontend/src/lib/countryCodes.ts`: 60+ country codes with flags
- Used in `CreateAccountModal` and `BookSessionModal` with searchable dropdown

## Key Integrations
- **Google Sheets**: Form submission logging (non-fatal if not configured)
- **Twilio**: SMS notifications (optional)
- **SumUp**: Payments (optional — checkout creation fails without valid API key)
- **Calendly**: Session booking redirect (optional)

## Frontend-Backend Wiring Status

### Fully Wired Features
- **Auth**: Register, Login, Logout, token persistence, AuthContext, auth-aware Navbar, /auth/me
- **Onboarding**: Multi-step flow → `api.submitOnboarding`, redirects to dashboard
- **Dashboard Settings**: Profile loaded from AuthContext, saves via `api.updateProfile`, password change via `api.changePassword`
- **Dashboard Inbox**: Real conversations loaded from API, message sending, new conversation creation with error states
- **Dashboard Property Matching**: Form → `api.submitPropertyMatching`
- **Dashboard Elite Property**: Form → `api.submitEliteProperty`
- **Dashboard Sale Audit**: Form → `api.submitSaleAudit`
- **Dashboard Sell Faster**: Plan selection + drawer → `api.submitSellFaster` → opens checkout URL
- **Dashboard Buyer Network**: Package selection + drawer → `api.submitBuyerNetwork` → opens checkout URL
- **Forgot Password Modal**: Calls `api.forgotPassword`, shows success message
- **Book Session Modal**: Full form with date/time + country codes → `api.bookSession`

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (provided by Replit in dev)
- `SUPABASE_DB_PASSWORD` - Supabase database password (**required for production**)
- `SECRET_KEY` - JWT signing key (defaults to dev key)
- `ALLOWED_ORIGINS` - CORS origins (set to `*`)
- `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SPREADSHEET_ID` (optional)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (optional)
- `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE` (optional)
- `CALENDLY_LINK` (optional)

## Development Workflows
- **Frontend**: `cd havlo_frontend && npm run dev` → port 5000 (webview) — "Start application" workflow
- **Backend**: `uvicorn app.main:app --host localhost --port 8000 --reload` → port 8000 (console) — "Backend API" workflow

## Deployment (Replit)
- **Target**: autoscale
- **Build**: `cd havlo_frontend && npm run build`
- **Run**: `uvicorn app.main:app --host 0.0.0.0 --port 5000`

## Important Technical Notes
- Auth is fully local (JWT + bcrypt) — no Supabase dependency
- `database.py` strips `sslmode` from DATABASE_URL since asyncpg doesn't support it
- Uses `bcrypt` library directly (not passlib) to avoid version incompatibility issues
- Messaging WebSocket: `/api/v1/messaging/ws/inbox?token=<jwt>` — uses local JWT decode
- `POST /api/v1/messaging/conversations` takes `subject` as query param, not body
- Password validation: Min 8 chars on both frontend and backend
