# PHANTOM × Supabase — Complete Setup Guide

This guide walks you through provisioning a **Supabase PostgreSQL** database
for the PHANTOM OSINT platform and connecting it to your **Netlify** deployment.

> **Why Supabase?** Netlify Functions have an ephemeral filesystem, so the
> local SQLite file (`db/custom.db`) cannot persist. Supabase gives you a
> managed PostgreSQL 15 database with a generous free tier (500MB, 2
> projects), automatic connection pooling (PgBouncer), and a SQL editor —
> perfect for a serverless Next.js app.

---

## 1. Create the Supabase project

1. Go to **https://supabase.com** → sign in → **New project**.
2. Pick a name (e.g. `phantom-osint`), set a strong DB password, choose a
   region close to your Netlify deploy region (e.g. `us-east-1` for most users).
3. Wait ~2 min for provisioning to finish.

---

## 2. Grab your two connection strings

Supabase exposes **two** connection modes — you need both because the pooler
cannot run migrations.

1. In your Supabase dashboard → **Project Settings** → **Database**.
2. Scroll to **Connection string** and you'll see tabs:
   - **Transaction pooler** (port `6543`) → this is your `DATABASE_URL`
   - **Direct connection** (port `5432`) → this is your `DIRECT_URL`
3. Copy each URL and replace `[YOUR_PASSWORD]` with your DB password.

They'll look like this:

```bash
# DATABASE_URL — Transaction pooler (PgBouncer) — used by the app at runtime
DATABASE_URL="postgresql://postgres.abcdefgh:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&prepared_statements=false"

# DIRECT_URL — Direct connection — used by Prisma CLI for migrations
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@db.abcdefgh.supabase.co:5432/postgres"
```

> **Why two URLs?** The transaction pooler (PgBouncer) multiplexes many app
> connections onto a small pool of real DB connections — essential for
> serverless (Netlify spins up many short-lived function instances). But
> PgBouncer's transaction mode disables prepared statements and session-level
> features, so DDL (CREATE TABLE, ALTER, etc.) must go through the direct URL.

---

## 3. Apply the schema

The committed `prisma/schema.prisma` is **SQLite** (for local dev). The Supabase
production schema lives in **`prisma/schema.supabase.prisma`** (PostgreSQL).
The Netlify build swaps them automatically — but for manual setup you need to
swap them yourself first.

From your local checkout (with both `DATABASE_URL` and `DIRECT_URL` set in
`.env`, pointing at Supabase):

```bash
# 1. Swap in the PostgreSQL schema
cp prisma/schema.supabase.prisma prisma/schema.prisma

# 2. Generate the Prisma client against the new PostgreSQL schema
bun run db:generate

# 3. Push the schema (creates all 14 tables, indexes, and constraints)
bun run db:push
```

You should see `🚀 Your database is now in sync with your Prisma schema.`

> 💡  When you're done, restore the local SQLite schema for dev:
> ```bash
> git checkout prisma/schema.prisma
> bun run db:generate
> ```

Verify in the Supabase dashboard → **Table Editor** — you'll see tables:
`User`, `Account`, `Session`, `VerificationToken`, `Case`, `CaseAccess`,
`Entity`, `Relationship`, `TimelineEvent`, `CaseModule`, `Alert`,
`Evidence`, `TransformFlow`, `WatchlistItem`, `AuditLog`.

---

## 4. Seed the initial admin user

```bash
bun run db:seed
```

This creates an admin user you can log in with immediately:

```
Email:     admin@phantom.local
Password:  ChangeMe!2024
```

> ⚠️  **Change this password immediately after first login** (or override the
> defaults with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars before
> running the seed).

The seed is idempotent — safe to re-run; it skips if the user already exists.

---

## 5. Configure Netlify environment variables

In the Netlify UI → **Site settings** → **Environment variables** → add:

| Key | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.REF:PASS@...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&prepared_statements=false` | Pooler URL — runtime |
| `DIRECT_URL` | `postgresql://postgres:PASS@db.REF.supabase.co:5432/postgres` | Direct URL — for any future CI migrations |
| `JWT_SECRET` | `openssl rand -base64 48` output | 64+ random chars |
| `NEXTAUTH_SECRET` | `openssl rand -base64 48` output | 64+ random chars |
| `NEXTAUTH_URL` | `https://your-site.netlify.app` | Your Netlify URL |
| `NEXTAUTH_TRUST_HOST` | `true` | Behind Netlify load balancer |
| `ZAI_API_KEY` | your z-ai console key | Powers all OSINT routes |

> 💡  Set these for **Production**, **Deploy previews**, and **Branch
> deploys** contexts (or use "All deploy contexts" if you don't need
> per-environment secrets).

---

## 6. Deploy

```bash
git push   # triggers Netlify auto-deploy
```

The `netlify.toml` build command (`prisma generate && next build`) will:

1. Regenerate the Prisma client (so the bundled `@prisma/client` knows about
   the PostgreSQL schema).
2. Build Next.js.
3. The `@netlify/plugin-nextjs` plugin bundles every API route and SSR page
   as a serverless function that connects to Supabase via the pooler.

---

## 7. Migrating existing SQLite data (optional)

If you've been developing locally with the SQLite file (`db/custom.db`) and
have data you want to preserve:

```bash
# 1. Export SQLite to JSON (run a quick script using Prisma against the SQLite schema)
#    Switch to sqlite schema temporarily:
cp prisma/schema.sqlite.prisma prisma/schema.prisma
DATABASE_URL="file:./db/custom.db" bun run scripts/export-sqlite.ts   # ← you'll need to write this

# 2. Switch back to postgres schema
git checkout prisma/schema.prisma

# 3. Import into Supabase (write a matching import script, or just re-seed)
bun run db:seed
```

For most fresh deployments, you can skip this — just run `db:seed` to get a
clean admin user and start fresh on Supabase.

---

## Troubleshooting

### `Error: prepared statement "..." already exists`
You're using the direct URL in the app instead of the pooler, OR the pooler
URL is missing `&prepared_statements=false`. Double-check `DATABASE_URL`
ends with `?pgbouncer=true&connection_limit=1&prepared_statements=false`.

### `Can't reach database server at db.xxxx.supabase.co:5432`
Supabase pauses idle projects on the free tier after 1 week of inactivity.
Go to the Supabase dashboard → click **Restore project**. To avoid this,
set up a cron job (e.g. via cron-job.org) to hit a lightweight endpoint on
your Netlify site every few days.

### `PrismaClientInitializationError: Database connection error`
- Verify the password in the URL is URL-encoded (e.g. `@` → `%40`).
- Make sure you're using the pooler for `DATABASE_URL` and direct for
  `DIRECT_URL` — swapping them causes this error.
- Check the Supabase project isn't paused.

### Migrations fail with `permission denied`
You're using the `postgres` user with the pooler URL. Migrations MUST use the
direct URL — that's why `DIRECT_URL` exists. Verify `prisma/schema.prisma`
has `directUrl = env("DIRECT_URL")`.

### Functions time out on Netlify (10s limit on free tier)
Some PHANTOM OSINT routes (TikTok tracker, FULL OSINT SWEEP, image recon)
take 30–60s. On Netlify **free tier** functions max out at 10s — upgrade to
**Netlify Pro** ($19/mo) for 26s timeout. Alternatively, move long-running
scrapers to a separate Railway/Render worker.

---

## Quick reference — full env block for Netlify

```bash
DATABASE_URL="postgresql://postgres.REF:PASS@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&prepared_statements=false"
DIRECT_URL="postgresql://postgres:PASS@db.REF.supabase.co:5432/postgres"
JWT_SECRET="<64+ random chars>"
NEXTAUTH_SECRET="<64+ random chars>"
NEXTAUTH_URL="https://your-site.netlify.app"
NEXTAUTH_TRUST_HOST="true"
ZAI_API_KEY="<your z-ai key>"
```
