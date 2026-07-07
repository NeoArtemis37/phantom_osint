# PHANTOM — Cyber Surveillance & OSINT Platform

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Netlify](https://img.shields.io/badge/Netlify-Ready-00C7B7?logo=netlify)
![License](https://img.shields.io/badge/Author-artemis37-a855f7)

> **PHANTOM** is a full-stack cyber surveillance and OSINT (Open-Source Intelligence) workbench
> designed for investigators, threat analysts, and red-team operators. It unifies case management,
> an interactive entity-relationship graph, a 10-tab OSINT toolkit, evidence lockers with full chain
> of custody (Admiralty Code), cyber threat-intelligence feeds, live search-as-you-type, and a
> cyberpunk/neon UI into a single deployable Next.js application. Built by **artemis37** with the
> `z-ai-web-dev-sdk`, Prisma ORM, and Cytoscape graph engine — globally localized for **195 countries,
> 20 languages, 50+ regional platforms, and 45+ CERT/CTI sources**.

---

## Table of Contents

1. [Features Overview](#1-features-overview)
2. [Tech Stack](#2-tech-stack)
3. [Prerequisites](#3-prerequisites)
4. [Quick Start (Local Dev)](#4-quick-start-local-dev)
5. [Production Deployment (Netlify + Supabase)](#5-production-deployment-netlify--supabase)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [Database Schema](#7-database-schema)
8. [Global Coverage](#8-global-coverage-new)
9. [Architecture](#9-architecture)
10. [API Reference](#10-api-reference)
11. [Scripts](#11-scripts)
12. [Troubleshooting](#12-troubleshooting)
13. [Security Notes](#13-security-notes)
14. [Credits](#14-credits)

---

## 1. Features Overview

PHANTOM consolidates an end-to-end analyst workflow across cases, graphs, OSINT, evidence, and intelligence feeds.

| Area | Capabilities |
|------|--------------|
| **Case Management** | Full CRUD with access control (lead/analyst/viewer roles), sensitivity levels (unclassified → top-secret), intelligence levels (ALPHA/BETA/GAMMA), status workflow (active/closed/archived/cold), tags, target profiles, resolutions |
| **Entity Graph** | Cytoscape-powered interactive visualization, 11 entity types (person, username, location, device, organization, email, phone, url, image, cryptocurrency, media), 12 relationship types, drag-and-drop node positioning, neon cyberpunk styling, graph filters, layout engine |
| **Timeline View** | Chronological case events with type filters (info, alert, action, discovery, communication, capture, relocation, financial), entity linking |
| **OSINT Toolkit (10 tabs)** | Auto Recon · Username (merged Maigret + Sherlock + reverse search) · TikTok Tracker · Crawler · Image Search · Social Search · Deep Web · Reverse Lookup · Image Recon · Sherlock |
| **CyberWatch** | Cyber threat-intelligence feed with 45+ regional CERT sources, threat-category filters (ransomware, APT, zero-day, data breach, phishing, vulnerability, geopolitics, malware) |
| **Live Search** | Search-as-you-type with 450 ms debounce, in-memory cache, AbortController, categorized results (Social, Professional, Forums, Media) — usersearch.ai style |
| **Evidence Locker** | Chain of custody with Admiralty Code (A1–F6), SHA-256 content hashes, source attribution, legal review flag, confidence levels |
| **Alert System** | Tiered alerts (critical/urgent/routine), categories (location_confirmed, imminent_threat, opsec_breach, associate_arrested, financial, pattern_match, etc.), acknowledgement workflow |
| **Watchlist** | Active monitoring of keywords, usernames, emails, phones, domains, hashtags, crypto addresses with hit counts |
| **Transform Flows** | Multi-step analyst pipelines with draft/running/completed/failed status and JSON-structured step definitions |
| **Report Generator** | Case report assembly with export formats |
| **Analyst Notebook** | MDX editor for freeform analysis notes |
| **Network Analysis** | Centrality metrics (degree, betweenness, eigenvector), community detection, graph statistics |
| **OPSEC Status Bar** | Passive/active mode toggle, proxy rotation indicator, fingerprint randomization status — visible across all views |
| **Keyboard Shortcuts** | Global hotkey layer for case switching, view navigation, quick-add entity/relationship, panel toggles |
| **Global Coverage (NEW)** | 195 countries (ISO 3166-1 alpha-2 + flags + languages), 20 language translations for search keywords, 50+ regional platforms (VK, Weibo, Mixi, KakaoTalk, Zalo, OK.ru, Line, etc.), 45+ CERT/CTI sources (ANSSI, BSI, JPCERT/CC, KISA, CNCERT, etc.) |
| **UI Theme** | Cyberpunk/neon — deep-black backgrounds (#050810), cyan (#00e5ff) / purple (#a855f7) / green (#00ff9d) accents, glow effects, scan-line animations, cyber-grid backgrounds |

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, SSR + API routes) |
| **Language** | TypeScript 5 |
| **ORM** | Prisma 6 |
| **Database (dev)** | SQLite (`db/custom.db`) |
| **Database (prod)** | PostgreSQL 15 via Supabase (with PgBouncer pooler) |
| **Styling** | Tailwind CSS 4 + cyberpunk theme |
| **UI components** | shadcn/ui (Radix primitives) + lucide-react icons |
| **Graph engine** | Cytoscape 3.34 |
| **State** | Zustand 5 (client) + TanStack Query 5 (server cache) |
| **Forms** | react-hook-form + zod 4 |
| **Auth** | JWT (`jsonwebtoken`) with Bearer tokens + bcryptjs password hashing (12 rounds) |
| **OSINT engine** | `z-ai-web-dev-sdk` (web_search, images.search.create, page_reader, chat completions, VLM) |
| **Markdown editor** | @mdxeditor/editor |
| **Charts** | Recharts |
| **Deployment** | Netlify (`@netlify/plugin-nextjs`) |
| **Runtime** | Node.js 20+, Bun (recommended for dev) |

---

## 3. Prerequisites

- **Node.js 20+** or **Bun** (recommended — faster installs, native TS execution for seed script)
- A **Supabase** account (free tier is sufficient — 500 MB DB, 2 projects)
- A **Netlify** account (free tier OK for evaluation; **Pro required** for 26s function timeout on heavy OSINT sweeps)
- A **z-ai-web-dev-sdk** API key (powers all OSINT, web/image search, VLM, and CyberWatch routes)
- **Git** (for cloning and pushing to Netlify-connected repo)
- Optional: a WebSocket host (Railway / Render / Ably / Pusher) if you want realtime chat — see [§5 Step 8](#step-8-set-netlify-environment-variables) and [§12 Troubleshooting](#12-troubleshooting)

---

## 4. Quick Start (Local Dev)

Local dev runs against SQLite — no external services required.

```bash
# 1. Clone the repo
git clone <your-repo-url> phantom
cd phantom

# 2. Install dependencies (Bun recommended; npm/pnpm also work)
bun install

# 3. Copy env example — the SQLite defaults work out of the box for local dev
cp .env.example .env

# 4. Create the SQLite database + tables
bun run db:push

# 5. Seed the initial admin user
bun run db:seed

# 6. Start the dev server
bun run dev
```

Open **http://localhost:3000** and log in with:

```
Email:    admin@phantom.local
Password: ChangeMe!2024
```

> **Change this password immediately after first login.** Override the defaults for the seed by
> setting `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` in `.env` *before* running `db:seed`. The seed is idempotent — re-running skips an existing user.

---

## 5. Production Deployment (Netlify + Supabase)

This section walks through provisioning a managed PostgreSQL database on **Supabase** and deploying
the Next.js app to **Netlify**. The committed `prisma/schema.prisma` is SQLite (for local dev); the
production PostgreSQL schema lives at `prisma/schema.supabase.prisma` and is swapped in automatically
by the Netlify build command (`netlify.toml`).

> **Why Supabase?** Netlify Functions have an ephemeral filesystem — the local SQLite file cannot
> persist across invocations. Supabase gives you managed PostgreSQL 15 with PgBouncer pooling
> (essential for serverless) plus a SQL editor and free tier.

### Step 1: Create the Supabase project

1. Go to **https://supabase.com** → sign in → **New project**.
2. Pick a name (e.g. `phantom-osint`), set a strong DB password (save it — Supabase won't show it again), choose a region close to your Netlify deploy region (e.g. `us-east-1`).
3. Wait ~2 minutes for provisioning to finish.

### Step 2: Get the two connection strings

Supabase exposes **two** connection modes — you need both, because the pooler cannot run DDL.

1. In the Supabase dashboard → **Project Settings** → **Database** → **Connection string**.
2. You'll see two tabs:
   - **Transaction pooler** (port `6543`) → this becomes `DATABASE_URL` (app runtime)
   - **Direct connection** (port `5432`) → this becomes `DIRECT_URL` (Prisma CLI / migrations)

Copy each URL and replace `[YOUR_PASSWORD]` with your DB password.

```bash
# DATABASE_URL — Transaction pooler (PgBouncer) — used by the app at runtime
DATABASE_URL="postgresql://postgres.abcdefgh:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&prepared_statements=false"

# DIRECT_URL — Direct connection — used by Prisma CLI for migrations
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@db.abcdefgh.supabase.co:5432/postgres"
```

> **Why two URLs?** The transaction pooler (PgBouncer) multiplexes many short-lived serverless
> function invocations onto a small pool of real DB connections — essential for Netlify. But
> PgBouncer's transaction mode disables prepared statements and session-level features, so DDL
> (CREATE TABLE, ALTER, `prisma db push`) must go through the direct URL.

### Step 3: Apply the schema (one-time, from your local checkout)

The Netlify build swaps the schemas automatically — but the **first** schema push must be done
manually from your local machine so the tables exist before the first deploy.

```bash
# 1. Set DATABASE_URL + DIRECT_URL in .env to the Supabase values from Step 2
#    (uncomment the production block in .env.example)

# 2. Swap in the PostgreSQL schema
cp prisma/schema.supabase.prisma prisma/schema.prisma

# 3. Generate the Prisma client against the new PostgreSQL schema
bun run db:generate

# 4. Push the schema (creates all 15 tables, indexes, and constraints)
bun run db:push
```

You should see `Your database is now in sync with your Prisma schema.` Verify in the Supabase
dashboard → **Table Editor** — you'll see all 15 tables.

### Step 4: Seed the admin user

```bash
bun run db:seed
```

Creates the admin user (`admin@phantom.local` / `ChangeMe!2024` — override via `SEED_ADMIN_*` env
vars). Idempotent; safe to re-run.

### Step 5: Restore the local SQLite schema

```bash
git checkout prisma/schema.prisma
bun run db:generate
```

This keeps your local dev environment on SQLite while Netlify will swap in the Supabase schema at build time.

### Step 6: Push to Git

```bash
git add -A
git commit -m "configure production deployment"
git push origin main
```

### Step 7: Connect the Netlify repo

1. Go to **https://app.netlify.com** → **Add new site** → **Import an existing project**.
2. Pick your Git provider and select the PHANTOM repo.
3. Build settings are auto-detected from `netlify.toml`:
   - **Build command:** `cp prisma/schema.supabase.prisma prisma/schema.prisma && prisma generate && next build`
   - **Publish directory:** `.next`
   - **Plugin:** `@netlify/plugin-nextjs` (auto-installed from devDependencies)
4. Click **Deploy site**. The first build will fail until you set the env vars in Step 8 — that's expected.

### Step 8: Set Netlify environment variables

In the Netlify UI → **Site settings** → **Environment variables** → add each of the following
(set them for **Production**, **Deploy previews**, and **Branch deploys** — or use "All deploy contexts"):

| Key | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | `postgresql://postgres.REF:PASS@...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&prepared_statements=false` | Pooler URL — used by Netlify Functions at runtime |
| `DIRECT_URL` | `postgresql://postgres:PASS@db.REF.supabase.co:5432/postgres` | Direct URL — for any future CI migrations |
| `JWT_SECRET` | output of `openssl rand -base64 48` | 64+ random chars — used by `src/lib/jwt.ts` |
| `NEXTAUTH_SECRET` | output of `openssl rand -base64 48` | 64+ random chars — kept for legacy compatibility |
| `NEXTAUTH_URL` | `https://your-site-name.netlify.app` | Your Netlify site URL |
| `NEXTAUTH_TRUST_HOST` | `true` | Behind Netlify load balancer |
| `ZAI_API_KEY` | your z-ai console key | Powers ALL OSINT + CyberWatch routes |

Optional:

| Key | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_SOCKET_URL` | `wss://your-websocket-host` | For realtime chat (Ably / Pusher / Railway). Leave unset to disable. |

### Step 9: Deploy

```bash
git push   # triggers Netlify auto-deploy
```

Or click **Trigger deploy** → **Deploy site** in the Netlify UI. The `netlify.toml` build command
will:

1. Copy `prisma/schema.supabase.prisma` over `prisma/schema.prisma`.
2. Regenerate the Prisma client (so the bundled `@prisma/client` targets PostgreSQL).
3. Build Next.js.
4. The `@netlify/plugin-nextjs` plugin bundles every API route and SSR page as a serverless function
   that connects to Supabase via the pooler.

> **Full troubleshooting guide:** see [`supabase/README.md`](supabase/README.md) for connection
> errors, paused-project recovery, password URL-encoding, prepared-statement conflicts, and
> function-timeout mitigation.

---

## 6. Environment Variables Reference

| Variable | Required? | Description | Example |
|----------|-----------|-------------|---------|
| `DATABASE_URL` | **Yes** (both contexts) | SQLite file path (local dev) **or** Supabase pooler URL (prod). Must end with `?pgbouncer=true&connection_limit=1&prepared_statements=false` when pointing at Supabase. | `file:./db/custom.db` (dev) / `postgresql://postgres.REF:PASS@...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&prepared_statements=false` (prod) |
| `DIRECT_URL` | **Yes** (prod only) | Supabase direct connection URL — used by Prisma CLI for migrations / `db push`. **Cannot** use the pooler here. Not needed for local SQLite dev. | `postgresql://postgres:PASS@db.REF.supabase.co:5432/postgres` |
| `JWT_SECRET` | **Yes** | 64+ random chars. Signs/verifies access tokens via `src/lib/jwt.ts`. Generate with `openssl rand -base64 48`. | `phantom-osint-dev-secret-change-in-production` |
| `NEXTAUTH_SECRET` | **Yes** | 64+ random chars. Kept for legacy NextAuth compatibility. Generate with `openssl rand -base64 48`. | (random 48-byte base64) |
| `NEXTAUTH_URL` | **Yes** | Public URL of the deployed site. | `http://localhost:3000` (dev) / `https://your-site.netlify.app` (prod) |
| `NEXTAUTH_TRUST_HOST` | **Yes** (prod) | Trust `X-Forwarded-*` headers behind Caddy / Netlify load balancers. | `true` |
| `ZAI_API_KEY` | **Yes** | API key from the z-ai console. Powers all OSINT routes (`/api/search/*`, `/api/osint/*`, `/api/recon/*`, `/api/cyberwatch`). Without this, all OSINT endpoints return 503/500. | (your z-ai key) |
| `SEED_ADMIN_EMAIL` | No (seed-only) | Override the default admin email created by `prisma/seed.ts`. | `admin@phantom.local` |
| `SEED_ADMIN_PASSWORD` | No (seed-only) | Override the default admin password. **Change in production.** | `ChangeMe!2024` |
| `SEED_ADMIN_NAME` | No (seed-only) | Override the default admin display name. | `PHANTOM Admin` |
| `NEXT_PUBLIC_SOCKET_URL` | No (optional) | WebSocket URL for realtime chat. Netlify cannot host persistent sockets — host separately (Railway/Render/Ably/Pusher) and point this at it. Leave unset to disable chat features. | `wss://your-websocket-host` |

---

## 7. Database Schema

PHANTOM uses **15 Prisma models**. The dev schema (`prisma/schema.prisma`) targets **SQLite**; the
production schema (`prisma/schema.supabase.prisma`) targets **PostgreSQL** on Supabase. The Netlify
build swaps them automatically (`cp prisma/schema.supabase.prisma prisma/schema.prisma`).

| # | Model | Purpose |
|---|-------|---------|
| 1 | `User` | Authenticated analyst accounts with role (`admin`, `senior_analyst`, `analyst`, `viewer`) and clearance (`unclassified`, `confidential`, `secret`, `top-secret`) |
| 2 | `Case` | Top-level investigation container with status, sensitivity, intelligence level, tags, target profile, resolution |
| 3 | `Entity` | Nodes in the graph — 11 types (person, username, location, device, organization, email, phone, url, image, cryptocurrency, media), with confidence, threat level, x/y coordinates |
| 4 | `Relationship` | Directed edges between entities — 12 types (owns, communicated, located_at, associated, member_of, operates, linked, reported, finances, familial, operational, geographic) |
| 5 | `TimelineEvent` | Chronological case events with 8 event types and optional entity link |
| 6 | `CaseModule` | Per-case OSINT module toggles (social_searcher, qwant_gibiru, osint_industries, idcrawl, maigret, sherlock, ghost, specter, wraith, revenant, custom_scraper) |
| 7 | `Alert` | Tiered alerts (critical/urgent/routine) with 9 categories and acknowledgement workflow |
| 8 | `Evidence` | Evidence locker items with SHA-256 content hash, source attribution, Admiralty-Code-style chain of custody JSON array, legal-review flag |
| 9 | `TransformFlow` | Multi-step analyst transform pipelines with draft/running/completed/failed status |
| 10 | `WatchlistItem` | Active monitoring terms — 7 types (keyword, username, email, phone, domain, hashtag, crypto_address) with hit counts |
| 11 | `AuditLog` | Immutable audit trail of sensitive actions with userId, ipAddress, timestamp |
| 12 | `Account` | OAuth provider accounts (NextAuth-compatible schema) |
| 13 | `Session` | NextAuth-compatible sessions (legacy — current auth uses JWT) |
| 14 | `VerificationToken` | NextAuth-compatible verification tokens |
| 15 | `CaseAccess` | Per-case role grants (lead, analyst, viewer) — many-to-many between User and Case |

---

## 8. Global Coverage (NEW)

PHANTOM ships with full worldwide OSINT coverage — every search, recon, and CyberWatch call can be
scoped to a specific country and language without losing the default US/English behavior.

### What's included

| Dimension | Coverage |
|-----------|----------|
| **Countries** | All **195** UN-recognized countries with ISO 3166-1 alpha-2 codes, emoji flags, continent/region, primary language(s), Google region code (`gl=`), Wikipedia language code |
| **Languages** | **20** language translations for OSINT keywords (`profile`, `social media`, `lookup`, `posts`, `ransomware attack victim`, etc.) — English, French, Spanish, German, Russian, Chinese, Japanese, Korean, Portuguese, Arabic, Italian, Dutch, Polish, Turkish, Vietnamese, Thai, Indonesian, Hindi, Persian, Ukrainian |
| **Regional platforms** | **50+** platforms beyond the US defaults — VK / OK.ru / Mail.ru (RU), Weibo / QQ / WeChat / Zhihu / Bilibili / Douyin (CN), Mixi / Line / Ameblo (JP), KakaoTalk / Naver Cafe (KR), Zalo (VN), Taringa (AR/ES), Xing (DE), Viadeo (FR), Cloob (IR), Twoo (BE), Hattrick (EU), and more |
| **CERT / CTI sources** | **45+** national computer-emergency-response teams — ANSSI (FR), BSI (DE), JPCERT/CC (JP), KISA (KR), CNCERT/CC (CN), CERT-MX (MX), CERT.br (BR), US-CERT, NCSC (UK), ACSC (AU), and 35+ others |

### How the CountryLocaleSelector works

A reusable `<CountryLocaleSelector>` component (in `src/components/CountryLocaleSelector.tsx`) is
mounted in the OSINT toolbar. It reads/writes three Zustand store fields:

- `investigationCountry` — ISO 3166-1 alpha-2 (default `"US"`)
- `investigationLanguage` — BCP 47 language code (default `"en"`, auto-derived from country)
- `investigationLocale` — computed locale tag (e.g. `fr-FR`, `ja-JP`)

These persist to localStorage so the investigator's locale preference survives reloads. A compact
mode is available for tight toolbars; full mode adds a language override switch.

### How queries are localized

The backend uses `src/lib/osint-query.ts` (helper functions) to build queries in four parts:

1. **Country name** — appended to the query (e.g. `"shadowhunter profile Russia"`)
2. **Translated keywords** — looked up from the i18n dictionary in `src/lib/countries.ts`
   (e.g. for `fr` → `profile` becomes `profil`, `social media` becomes `réseaux sociaux`)
3. **Site-targeted queries** — per-country platform `site:vk.com OR site:ok.ru` clauses replace the
   US-only default of `site:instagram.com OR site:twitter.com`
4. **Image search `gl=` param** — passed natively to `images.search.create` via the SDK's
   `CreateImageSearchBody.gl` field

### Backward compatibility

If no country is selected, every query falls back to US/English defaults — existing behavior is
preserved. The country selector is **opt-in** at the panel level.

---

## 9. Architecture

```
phantom/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API route handlers (see §10)
│   │   ├── login/page.tsx        # Unauthenticated login route
│   │   ├── page.tsx              # Main authenticated workspace
│   │   ├── layout.tsx            # Root layout (ThemeProvider, fonts)
│   │   └── globals.css           # Cyberpunk theme tokens
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui primitives
│   │   ├── osint/                # 6 OSINT sub-panels
│   │   ├── GraphCanvas.tsx       # Cytoscape graph view
│   │   ├── OSINTTools.tsx        # 10-tab OSINT container
│   │   ├── TopBar / OPSECStatusBar / KeyboardShortcuts / ...
│   │   └── CountryLocaleSelector.tsx
│   ├── hooks/                    # use-live-search, use-toast, use-mobile
│   ├── lib/                      # api-client, jwt, db, audit, auth, osint-query,
│   │                             #   countries, osint-platforms, sherlock-platforms
│   ├── store/phantom-store.ts    # Zustand global store
│   ├── types/                    # TypeScript domain types
│   └── middleware.ts             # Page-route auth guard (cookie check)
├── prisma/
│   ├── schema.prisma             # SQLite (local dev)
│   ├── schema.supabase.prisma    # PostgreSQL (production — swapped in by netlify.toml)
│   └── seed.ts                   # Admin user seeder (idempotent)
├── examples/
│   └── websocket/server.ts       # Socket.IO mini-service (port 3003) — host separately
├── netlify.toml                  # Netlify build + plugin + headers config
├── Caddyfile                     # Local reverse proxy (gateway) config
├── supabase/README.md            # Detailed Supabase setup + troubleshooting
└── .env.example                  # All env vars with inline documentation
```

**Request flow:**

1. Browser → `src/middleware.ts` (page-route guard checking `access_token` cookie)
2. Page renders → React Server Components + Zustand store hydrate
3. API calls via `src/lib/api-client.ts` → attaches `Authorization: Bearer <jwt>` header
4. API route handler → `authenticateRequest(request)` verifies JWT, attaches `userId`
5. Prisma client (`src/lib/db.ts`) → Supabase pooler (prod) or SQLite file (dev)
6. OSINT routes call `z-ai-web-dev-sdk` (`web_search`, `images.search.create`, `page_reader`, VLM)
7. Sensitive actions write to `AuditLog` via `src/lib/audit.ts`

**Gateway:** Local dev can use the included `Caddyfile` for HTTPS / port forwarding; production
uses Netlify's edge network directly.

---

## 10. API Reference

All API routes live under `src/app/api/` and use the Next.js App Router route handler convention.
Every route (except where noted) calls `authenticateRequest(request)` from `src/lib/jwt.ts` to
verify the Bearer JWT and attach the userId for audit logging.

| Route group | Endpoints | Purpose |
|-------------|-----------|---------|
| `/api/auth` | `POST /login`, `POST /register`, `POST /logout`, `GET /me`, `GET/[...nextauth]` (legacy) | JWT-based auth + NextAuth fallback |
| `/api/cases` | `GET`, `POST`, `GET /[id]`, `PATCH /[id]`, `DELETE /[id]` | Case CRUD with access control |
| `/api/entities` | `GET`, `POST`, `GET /[id]`, `PATCH /[id]`, `DELETE /[id]`, `POST /merge` | Entity CRUD + entity-merge dialog |
| `/api/relationships` | `GET`, `POST`, `PATCH /[id]`, `DELETE /[id]` | Graph edge CRUD |
| `/api/timeline` | `GET`, `POST` | Timeline event creation + retrieval |
| `/api/transforms` | `GET`, `POST`, `GET /[id]`, `PATCH /[id]`, `DELETE /[id]` | Transform flow CRUD |
| `/api/watchlist` | `GET`, `POST`, `DELETE /[id]` | Watchlist management |
| `/api/search` | `POST` (general) | Full web search via `web_search` |
| `/api/search/live` | `POST` | Debounced live search-as-you-type with 60s in-memory cache |
| `/api/search/image` | `POST` | Image search via `images.search.create` with `gl=` support |
| `/api/graph/[caseId]` | `GET` | Full graph payload (entities + relationships) for a case |
| `/api/export` | `POST` | Case report export |
| `/api/modules` | `GET`, `POST`, `PATCH /[id]` | Per-case OSINT module toggles |
| `/api/alerts` | `GET`, `POST`, `PATCH /[id]`, `DELETE /[id]` | Alert management + acknowledgement |
| `/api/evidence` | `GET`, `POST`, `GET /[id]`, `PATCH /[id]`, `DELETE /[id]` | Evidence locker with chain of custody |
| `/api/osint/maigret` | `POST` | Maigret-style username enumeration across 150+ sites |
| `/api/osint/sherlock` | `POST` | Sherlock-style username probing with rank + errorType |
| `/api/osint/username-search` | `POST` | Merged Maigret + Sherlock + reverse username search |
| `/api/osint/social-search` | `POST` | Hashtag / mention / keyword social search |
| `/api/osint/uncensored-search` | `POST` | Deep-web / uncensored engine search |
| `/api/osint/reverse-lookup` | `POST` | Phone / email / username reverse lookup |
| `/api/osint/tiktok-tracker` | `POST` | TikTok profile tracker + full OSINT sweep |
| `/api/osint/image-recon` | `POST` | Image VLM analysis + reverse image search |
| `/api/cyberwatch` | `POST` | Cyber threat-intelligence feed aggregator (45+ CERT sources) |
| `/api/recon/auto` | `POST` | Auto-recon pipeline (target → enumerated entities) |
| `/api/recon/crawl` | `POST` | URL crawler with regex extraction (phones, emails, socials, images) |
| `/api/network/analysis` | `POST` | Graph centrality + community detection |
| `/api/audit` | `GET` | Audit log query |

> **Note:** `/api/search` is the only OSINT-adjacent route that historically omitted
> `authenticateRequest` — add it before production hardening (see [§13 Security Notes](#13-security-notes)).

---

## 11. Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Next.js dev server on port 3000 with `tee` to `dev.log` |
| `bun run build` | Production build (Next.js standalone + static/public copy for self-hosting) |
| `bun run start` | Run the production standalone server (`NODE_ENV=production bun .next/standalone/server.js`) |
| `bun run lint` | ESLint (Next.js + TypeScript config) |
| `bun run db:push` | Push Prisma schema to DB (creates/alters tables — use for prototyping) |
| `bun run db:generate` | Regenerate `@prisma/client` after schema changes |
| `bun run db:migrate` | Create + apply a Prisma migration (`prisma migrate dev`) |
| `bun run db:deploy` | Apply pending migrations in production (`prisma migrate deploy`) |
| `bun run db:reset` | Drop + recreate DB + re-run migrations + seed (destructive!) |
| `bun run db:seed` | Create the admin user via `prisma/seed.ts` (idempotent) |

> **Netlify note:** the `bun run build` script above is **not** used by Netlify — `netlify.toml`
> overrides it with a plain `next build` so the Next.js plugin can manage its own output bundle.

---

## 12. Troubleshooting

### `401 Unauthorized` on API calls
- Verify `JWT_SECRET` is set and identical across client/env/server.
- Check token expiry — access tokens expire after **12 hours** (`src/lib/jwt.ts`). Re-login to refresh.
- Confirm the client is sending `Authorization: Bearer <token>` (check `src/lib/api-client.ts`).
- If using middleware-protected page routes, ensure the `access_token` cookie is being set on login.

### Database connection errors
- **`Error: prepared statement "..." already exists`** → `DATABASE_URL` is missing
  `&prepared_statements=false`, or you're using the direct URL for the app instead of the pooler.
- **`Can't reach database server at db.xxxx.supabase.co:5432`** → Supabase pauses idle free-tier
  projects after 1 week. Go to the Supabase dashboard → **Restore project**. Set up a cron job
  (e.g. cron-job.org) to hit a lightweight Netlify endpoint every few days.
- **`PrismaClientInitializationError: Database connection error`** → URL-encode any special chars
  in the password (`@` → `%40`, etc.). Verify you're using the pooler for `DATABASE_URL` and the
  direct URL for `DIRECT_URL` — swapping them causes this error.
- **`permission denied` on migrations** → you're using the `postgres` user with the pooler URL.
  Migrations MUST use the direct URL (`DIRECT_URL`).

### `429 Too Many Requests` from ZAI SDK
- Rate limit hit. The OSINT toolkit fires parallel `web_search` calls; switch to
  `Promise.allSettled` (already used in most routes) so one rejection doesn't fail the batch.
- Add request throttling or exponential backoff at the route level for high-volume sweeps.

### Netlify function timeout (10s on free tier)
- Long-running OSINT routes (TikTok tracker full sweep, image recon, CyberWatch refresh) can take
  30–60 s. Netlify **free tier** caps functions at 10 s.
- **Upgrade to Netlify Pro** ($19/mo) for a 26 s timeout, OR
- Move long-running scrapers to a separate worker on Railway / Render / Fly.io and call them from
  Netlify Functions via HTTP.

### Socket.IO realtime chat doesn't work on Netlify
- Netlify Functions are stateless and short-lived — they cannot host a persistent Socket.IO server.
- **Options:**
  - Use a managed WebSocket gateway: **Ably**, **Pusher**, or **Socket.io Cloud**
  - Self-host the included `examples/websocket/server.ts` on Railway / Render / Fly.io and point
    `NEXT_PUBLIC_SOCKET_URL` at it
- The PHANTOM UI **degrades gracefully** without WebSockets (chat is the only consumer); all OSINT
  and dashboard features work over HTTPS.

### Schema swap confusion (SQLite ↔ PostgreSQL)
- `prisma/schema.prisma` is committed as SQLite for local dev.
- `prisma/schema.supabase.prisma` is the production PostgreSQL schema.
- The Netlify build runs `cp prisma/schema.supabase.prisma prisma/schema.prisma` before
  `prisma generate && next build` — this swap is automatic on Netlify.
- For local testing against Supabase, run the `cp` + `bun run db:generate` manually, then
  `git checkout prisma/schema.prisma && bun run db:generate` to restore local dev.

### Live search returns stale results
- The `/api/search/live` cache key includes the query + caseId + country + language. If you changed
  the country selector and results look stale, the cache TTL is 60 s — wait or restart the dev
  server. Production deploys spin up fresh function instances per cold start.

---

## 13. Security Notes

PHANTOM is built for sensitive investigative work. The following controls are in place — review
and harden before deploying to production.

| Control | Implementation |
|---------|----------------|
| **Authentication** | JWT access tokens (12-hour expiry) signed with `JWT_SECRET`. Login returns `{ accessToken, user }` — client stores token in `localStorage` + http cookie for middleware page-route guards. |
| **Password hashing** | `bcryptjs` with 12 rounds (see `src/app/api/auth/register/route.ts` and `/login/route.ts`). |
| **Middleware** | `src/middleware.ts` protects all page routes (checks `access_token` cookie). API routes are NOT middleware-guarded — each handler calls `authenticateRequest(request)` itself. |
| **API authorization** | Every OSINT / case / entity / evidence / alert route calls `authenticateRequest(request)` from `src/lib/jwt.ts`, which verifies the Bearer token and attaches the userId. (Exception: `/api/search` — add this before production hardening.) |
| **Audit logging** | Sensitive actions (search, case access, evidence creation, alert acknowledgement) write to the `AuditLog` table via `src/lib/audit.ts` with userId + ipAddress + timestamp. |
| **Case access control** | Per-case role grants via the `CaseAccess` model (lead / analyst / viewer). Verify your route handlers enforce these grants before returning case-scoped data. |
| **OPSEC mode** | The OPSEC status bar exposes passive/active mode, proxy rotation, and fingerprint randomization toggles. Wire these to your scraping layer to control traffic fingerprinting. |
| **Security headers** | `netlify.toml` ships `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo disabled), and `X-XSS-Protection`. HSTS is auto-injected by Netlify. CSP is intentionally omitted because PHANTOM loads remote OSINT images from arbitrary domains — tune per-deployment if hardening is required. |

### Hardening checklist before production

1. **Change the default admin password** immediately after first login (or override via
   `SEED_ADMIN_PASSWORD` before running `db:seed`).
2. **Rotate `JWT_SECRET` and `NEXTAUTH_SECRET`** regularly — generate fresh values with
   `openssl rand -base64 48`. Note that rotating `JWT_SECRET` invalidates all active sessions.
3. **Add `authenticateRequest` to `/api/search`** — it's the only OSINT-adjacent route missing it.
4. **Enforce `CaseAccess` grants** in any case-scoped route handler that doesn't already check.
5. **Tune a Content-Security-Policy** in `netlify.toml` if your deployment doesn't need to load
   arbitrary remote OSINT images.
6. **Audit log retention** — set up a periodic export / archival job; the `AuditLog` table grows
   unbounded by default.
7. **Rate-limit login** — `POST /api/auth/login` is currently unthrottled. Add IP-based rate
   limiting (Netlify Edge Functions or a middleware wrapper) to mitigate brute-force attacks.
8. **Restrict CORS** — confirm `NEXTAUTH_URL` matches your production domain exactly.
9. **Back up Supabase** — enable Supabase's daily backups (Pro plan) or set up PITR.

---

## 14. Credits

**Author:** artemis37

**Built with:**

- [`z-ai-web-dev-sdk`](https://www.npmjs.com/package/z-ai-web-dev-sdk) — OSINT engine (web search, image search, page reader, VLM, chat completions)
- [Next.js 16](https://nextjs.org/) — App Router framework
- [Prisma 6](https://www.prisma.io/) — type-safe ORM
- [Supabase](https://supabase.com/) — managed PostgreSQL with PgBouncer pooling
- [Netlify](https://www.netlify.com/) — serverless deployment via `@netlify/plugin-nextjs`
- [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) — component primitives
- [Tailwind CSS 4](https://tailwindcss.com/) — utility-first styling
- [Cytoscape](https://cytoscape.org/) — graph visualization engine
- [Zustand](https://zustand.docs.pmnd.rs/) + [TanStack Query](https://tanstack.com/query) — state management
- [lucide-react](https://lucide.dev/) — icon set
- [bcryptjs](https://www.npmjs.com/package/bcryptjs) + [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) — auth primitives

---

> **Disclaimer:** PHANTOM is an OSINT workbench intended for lawful investigations, threat
> intelligence, and authorized security research. Always comply with applicable laws and platform
> terms of service when collecting open-source intelligence. The author and contributors are not
> responsible for misuse of this software.
