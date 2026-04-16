# Havlo Backend — Deployment Guide

## Architecture Overview

```
Frontend (Vercel)  ──HTTPS──►  Backend API (Railway)  ──►  PostgreSQL (Supabase)
                                     │
                                     ├──► Supabase Auth
                                     ├──► Google Sheets API
                                     ├──► Twilio SMS
                                     └──► SumUp Payments
```

---

## Part 1 — Supabase Setup

### 1.1 Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a region close to your users (e.g. **Europe West**)
3. Set a strong database password — save it

### 1.2 Collect Your Supabase Credentials
In your project dashboard → **Settings → API**:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | "Project URL" e.g. `https://abcxyz.supabase.co` |
| `SUPABASE_ANON_KEY` | "anon public" key |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role" key (keep secret!) |

### 1.3 Get Your Database URL
In **Settings → Database → Connection string → URI** — select **asyncpg** mode:
```
postgresql+asyncpg://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```
Save this as `DATABASE_URL`.

> **Note:** Supabase uses row-level security (RLS) on tables by default. Our backend uses the **service role key** which bypasses RLS — the auth logic lives in FastAPI, not Supabase policies.

---

## Part 2 — Google Sheets Setup

### 2.1 Create the Spreadsheet
1. Go to [sheets.google.com](https://sheets.google.com) → **Blank spreadsheet**
2. Rename it: **"Havlo CRM Data"**
3. Copy the Spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/  ►THIS_PART◄  /edit
   ```
   Save as `GOOGLE_SPREADSHEET_ID`

> **The backend will automatically create all 8 tabs on first startup.** You do not need to create them manually.

### 2.2 Create a Service Account
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **Google Sheets API** and **Google Drive API**
4. **IAM & Admin → Service Accounts → Create Service Account**
   - Name: `havlo-sheets`
   - Role: **Editor**
5. Click the service account → **Keys → Add Key → JSON**
6. Download the JSON file — this is your `GOOGLE_SERVICE_ACCOUNT_JSON`

### 2.3 Share the Spreadsheet with the Service Account
1. Open the JSON file — copy the `client_email` field
   (looks like: `havlo-sheets@your-project.iam.gserviceaccount.com`)
2. Open your Google Sheet → **Share** → paste the email → **Editor** → **Send**

### 2.4 Set the Environment Variable
**Option A (Recommended for Railway):** Paste the entire JSON as a string:
```bash
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"-----BEGIN...-----END...","client_email":"...",...}'
```

**Option B:** Upload the file and set the path:
```bash
GOOGLE_SERVICE_ACCOUNT_JSON=/app/service-account.json
```

---

## Part 3 — Twilio Setup

1. Go to [twilio.com](https://twilio.com) → Create account
2. Get a phone number (SMS-capable, e.g. UK or US)
3. From the Console dashboard collect:

| Variable | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | Starts with `AC...` |
| `TWILIO_AUTH_TOKEN` | Under Account SID |
| `TWILIO_PHONE_NUMBER` | Your Twilio number in E.164 e.g. `+441234567890` |

> **Trial accounts:** Can only send SMS to verified numbers. Upgrade to a paid account for production.

---

## Part 4 — SumUp Setup

1. Log into [developer.sumup.com](https://developer.sumup.com)
2. Create an **API Key** with scopes: `payments`, `payment_instruments`, `transactions.history`
3. Find your **Merchant Code** in your SumUp business profile

| Variable | Value |
|---|---|
| `SUMUP_API_KEY` | Your API key |
| `SUMUP_MERCHANT_CODE` | Your merchant code |

---

## Part 5 — Calendly Setup

1. Create/log into your [Calendly](https://calendly.com) account
2. Create a **One-on-One** event type (e.g. "Property Advisory Session")
3. Copy your booking link:
   ```
   https://calendly.com/your-username/advisory-session
   ```
4. Set `CALENDLY_LINK` to this URL

---

## Part 6 — Deploy Backend to Railway

### 6.1 Push Code to GitHub
```bash
cd havlo-backend
git init
git add .
git commit -m "Initial Havlo backend"
# Create a repo on GitHub (e.g. havlo-backend) then:
git remote add origin https://github.com/YOUR_USERNAME/havlo-backend.git
git push -u origin main
```

### 6.2 Create Railway Service
1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Select your `havlo-backend` repository
3. Railway will auto-detect the `Procfile` and start building

### 6.3 Set Environment Variables in Railway
In your Railway project → **Variables → Add all of the following:**

```env
APP_ENV=production
SECRET_KEY=<generate a strong random 64-char string>
ALLOWED_ORIGINS=https://your-app.vercel.app

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

DATABASE_URL=postgresql+asyncpg://postgres:password@db.your-project.supabase.co:5432/postgres

GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GOOGLE_SPREADSHEET_ID=your-spreadsheet-id

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+441234567890

SUMUP_API_KEY=your-sumup-api-key
SUMUP_MERCHANT_CODE=your-merchant-code

CALENDLY_LINK=https://calendly.com/yourname/advisory-session

SESSION_FEE_AMOUNT=200
SESSION_FEE_CURRENCY=USD

FRONTEND_URL=https://your-app.vercel.app
```

### 6.4 Get Your Railway URL
After deployment: **Settings → Domains → Generate Domain**
Your API will be at: `https://havlo-backend.up.railway.app`

---

## Part 7 — Deploy Frontend to Vercel

### 7.1 Set Vercel Environment Variables
In your Vercel project → **Settings → Environment Variables**:

```env
VITE_API_URL=https://havlo-backend.up.railway.app/api/v1
VITE_WS_URL=wss://havlo-backend.up.railway.app/api/v1/messaging/ws/inbox
```

### 7.2 Update Frontend API Calls
All fetch calls in the frontend should use `import.meta.env.VITE_API_URL` as the base URL.

### 7.3 Update CORS
Once you know your Vercel domain, update `ALLOWED_ORIGINS` in Railway:
```
ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.your-domain.com
```

---

## Part 8 — API Reference

### Base URL
```
https://your-backend.up.railway.app/api/v1
```

### Authentication
All protected endpoints require:
```
Authorization: Bearer <supabase_jwt_token>
```

### Endpoints

#### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Login, returns JWT |
| POST | `/auth/logout` | Yes | Invalidate session |
| GET | `/auth/me` | Yes | Get current user profile |
| POST | `/auth/forgot-password` | No | Send reset email |
| POST | `/auth/reset-password` | Token | Reset password |

#### Users
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| PATCH | `/users/profile` | All | Update name/phone |
| POST | `/users/change-password` | All | Change password |

#### Onboarding
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/onboarding` | All | Submit 5-step form |
| GET | `/onboarding` | All | Get onboarding status |

#### Messaging
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/messaging/conversations` | All | List conversations |
| POST | `/messaging/conversations` | All | Start new conversation |
| GET | `/messaging/conversations/{id}` | All | Get conversation + messages |
| POST | `/messaging/conversations/{id}/messages` | All | Send a message |
| POST | `/messaging/admin/conversations/{id}/send` | Internal | Team sends message → triggers SMS + WS push |
| WS | `/messaging/ws/inbox?token=<jwt>` | All | Real-time inbox |

#### Session Bookings
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/bookings/session` | All | Book session → SumUp checkout |
| GET | `/bookings/session/{id}/status` | All | Poll payment → Calendly link on success |

#### Property Matching
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/property-matching` | buyer, agent | Submit matching request |

#### Elite Property
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/elite-property/apply` | seller, agent | Submit application |

#### Sell Faster
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/sell-faster` | seller, agent | Apply → SumUp checkout (setup + month 1) |
| GET | `/sell-faster/{id}/status` | seller, agent | Poll payment status |

#### Sale Audit
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/sale-audit` | seller, agent | Submit audit request |

#### Buyer Network
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/buyer-network` | seller, agent | Apply → SumUp checkout (setup + month 1) |
| GET | `/buyer-network/{id}/status` | seller, agent | Poll payment status |

---

## Part 9 — WebSocket Usage (Frontend)

```javascript
// Connect to inbox WebSocket
const token = localStorage.getItem('access_token');
const wsUrl = `${import.meta.env.VITE_WS_URL}?token=${token}`;
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  console.log('Inbox connected');
  // Send keepalive ping every 20s
  setInterval(() => ws.send(JSON.stringify({ type: 'ping' })), 20000);
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.event === 'new_message') {
    // data.conversation_id, data.message
    // Update your conversation state here
  }
};

ws.onclose = () => {
  // Reconnect logic
  setTimeout(() => connectWebSocket(), 3000);
};
```

---

## Part 10 — Payment Flow (Frontend)

### Session Booking
```javascript
// 1. POST /bookings/session → get checkout_url + booking_id
// 2. Redirect user to checkout_url (SumUp payment page)
// 3. SumUp redirects back to: /dashboard?payment=session&ref=HAVLO-SESSION-xxx
// 4. On return, poll: GET /bookings/session/{booking_id}/status
// 5. When paid=true → redirect_url is the Calendly link
window.location.href = statusResponse.redirect_url; // → Calendly
```

### Sell Faster / Buyer Network
```javascript
// 1. POST /sell-faster → get checkout_url + application_id
// 2. Redirect to checkout_url
// 3. SumUp redirects to: /dashboard/sell-faster?payment=success&ref=HAVLO-SF-xxx
// 4. Poll: GET /sell-faster/{application_id}/status until paid=true
```

---

## Part 11 — Google Sheets Tabs (Auto-Created)

The backend creates these 8 tabs on first startup:

| Tab | Triggered by |
|-----|-------------|
| Registrations | POST /auth/register |
| Onboarding | POST /onboarding |
| Property Matching | POST /property-matching |
| Elite Property | POST /elite-property/apply |
| Sell Faster | POST /sell-faster |
| Sale Audit | POST /sale-audit |
| Buyer Network | POST /buyer-network |
| Session Bookings | POST /bookings/session |

---

## Part 12 — Role-Based Access Summary

| Dashboard Page | buyer | seller | agent |
|---|:---:|:---:|:---:|
| `/dashboard` | ✅ | ✅ | ✅ |
| `/dashboard/property-matching` | ✅ | ❌ | ✅ |
| `/dashboard/elite-property` | ❌ | ✅ | ✅ |
| `/dashboard/sell-faster` | ❌ | ✅ | ✅ |
| `/dashboard/sale-audit` | ❌ | ✅ | ✅ |
| `/dashboard/buyer-network` | ❌ | ✅ | ✅ |
| `/dashboard/inbox` | ✅ | ✅ | ✅ |
| `/dashboard/settings` | ✅ | ✅ | ✅ |
| Book Session | ✅ | ✅ | ✅ |

The API enforces these permissions — 403 Forbidden is returned if a role tries to access a restricted endpoint.

---

## Part 13 — Monitoring & Logs

- Railway provides live logs in the dashboard
- API docs (Swagger UI): `https://your-backend.up.railway.app/docs` *(disabled in production — set `APP_ENV=development` temporarily to access)*
- Health check: `GET /health` returns `{"status": "ok"}`

---

## Common Issues

| Problem | Fix |
|---------|-----|
| `502 Bad Gateway` on SumUp | Check `SUMUP_API_KEY` and `SUMUP_MERCHANT_CODE` are correct |
| SMS not sending | Ensure `TWILIO_PHONE_NUMBER` is in E.164 format (`+countrycode...`) |
| Google Sheets `403` | Make sure you shared the sheet with the service account email |
| `401 Unauthorized` | JWT token expired — frontend needs to re-login |
| DB connection timeout | Check `DATABASE_URL` format uses `postgresql+asyncpg://` (not `postgresql://`) |
| CORS errors | Add your Vercel domain to `ALLOWED_ORIGINS` (no trailing slash) |
