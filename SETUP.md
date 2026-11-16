# MAVI AI — SaaS Platform Setup & Deployment Guide

**Tagline:** One AI. Unlimited Possibilities.

## 1. Architecture Overview
- **Frontend:** React 19, TypeScript, Tailwind CSS v4 (Liquid Glass dual Light/Dark themes), Lucide Icons.
- **Backend API Gateway:** Express server (`server.ts`) with Vite middleware in development and `dist/` static serving in production.
- **Database:** Cloud SQL (PostgreSQL) managed with Drizzle ORM (`src/db/schema.ts`, `src/db/index.ts`, `src/db/drizzle.config.ts`).
- **Authentication:** Firebase Authentication (Google Sign-In + session tokens verified server-side via `firebase-admin` in `src/middleware/auth.ts`).
- **AI Providers (`server/ai-gateway.ts`):**
  1. Google Gemini API (`gemini-4-hydrogen`, `gemini-3.1-flash-lite`)
  2. Ollama Local Models (`OLLAMA_BASE_URL`)
  3. OpenAI-Compatible Gateways (`COMPAT_AI_BASE_URL` + `COMPAT_AI_API_KEY`)
- **Subscriptions & Payments (`server/billing.ts`):**
  - **MAVI GO** — ₹199/month
  - **MAVI PLUS** — ₹499/month (Most Popular)
  - **MAVI PRO** — ₹999/month
  - Razorpay order creation, HMAC-SHA256 payment verification, and webhook handling.

## 2. Environment Variables
Configure the server secrets (never expose in client bundles):
- `GEMINI_API_KEY` — Google Gemini API key
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — Razorpay INR checkout & webhook verification
- `OLLAMA_BASE_URL`, `OLLAMA_DEFAULT_MODEL` — Optional local/remote Ollama endpoint
- `COMPAT_AI_BASE_URL`, `COMPAT_AI_API_KEY`, `COMPAT_AI_MODEL` — Optional OpenAI-compatible fallback
- `ADMIN_EMAILS` — Comma-separated emails granted `admin` role for the Admin Dashboard
- Cloud SQL runtime vars (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`) are injected by AI Studio Cloud SQL.

## 3. Database Schema & Verification
Schema tables in `src/db/schema.ts`:
`users`, `subscription_plans`, `user_subscriptions`, `usage_tracking`, `payments`, `conversations`, `stored_files`, `ai_providers`, `advertisements`, `activity_logs`.
Push schema updates via Drizzle Kit / Cloud SQL `UpdateSchema`.

## 4. Production Build & Start
```bash
npm run build
npm run start
```
