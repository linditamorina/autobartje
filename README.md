# autobartje

Website, booking system and back office for a 24/7 towing and car transport company in Pejë, Kosovo:
emergency towing, roadside assistance, domestic transport and car import from Germany, Switzerland and Austria.

The architecture, database design and phase plan were reviewed and approved before coding
([review document](https://claude.ai/artifact/GnWNdwFRvhAf2BeQUSxsVM)).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 + shadcn/ui-style components · PostgreSQL 16 + Prisma 7 ·
Auth.js · next-intl (sq default, en, de) · Cloudflare R2 · Resend · SMS provider abstraction (Infobip) ·
Google Maps · Cloudflare Turnstile · Sentry · Vitest · Playwright.

## Getting started

Requirements: Node 22, Docker (or a local PostgreSQL 16).

```bash
cp .env.example .env            # fill in at least DATABASE_URL and AUTH_SECRET
docker compose up -d db minio   # Postgres + S3-compatible storage
npm install                     # also generates the Prisma client
npx prisma migrate dev          # create tables
npx prisma db seed              # roles, owner account, prices, cities, demo data
npm run dev                     # http://localhost:3000
```

The seed creates the owner account from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Two-factor
authentication is required for Owner and Admin and is set up on first login.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit tests (pricing engine, invoicing, permissions, translations) |
| `npm run test:e2e` | Playwright tests at 360px and desktop (builds must exist: run `npm run build` first) |
| `npm run typecheck` / `npm run lint` | Type check / lint |
| `npm run db:migrate` / `npm run db:seed` | Prisma migrations / seed |

## Project layout

```text
prisma/            schema.prisma, migrations, seed.ts
messages/          UI translations (sq, en, de)
src/app/[locale]/  public website (localised routes; sq has no URL prefix)
src/app/admin/     back office (coming in phase 1)
src/app/api/       route handlers: consent log, uploads, webhooks, cron
src/components/    ui/ primitives, marketing/, shared/
src/server/        business logic without React: pricing, invoicing, settings, auth, db
src/lib/           shared helpers: money, contact links, consent, SEO
tests/e2e/         Playwright tests
```

## Key design decisions

- **Money** is stored as integer euro cents. VAT (18 %) is calculated and rounded per invoice line.
- **Pricing rules are data**, edited in admin. `src/server/pricing/engine.ts` is a pure function with unit tests
  covering base fee, €/km, night/weekend/holiday surcharges, options, minimum price, discount codes,
  B2B contract prices and fixed international route tariffs.
- **Brand name, logo and colour** are settings (`brand.*` in the `Setting` table), editable in admin and
  shown on the site, invoices and emails. Until changed, the built-in logo and the name "autobartje" are used.
- **Privacy**: no analytics or marketing scripts load before cookie consent; "Reject" is as prominent as "Accept";
  each choice is logged in `Consent` with a truncated IP. Retention periods are settings.

## Deployment

**Vercel (recommended):** import the repo, add the environment variables from `.env.example`, use a Neon
Postgres database in an EU region, and run `npx prisma migrate deploy` as part of the build command.

**Docker:** `docker build -t autobartje .` then run with the same environment variables. The container applies
pending migrations on start.

## Phase plan

1. **MVP**: public site, quote calculator, booking, notifications, admin (orders, dispatch, fleet, pricing), invoicing, i18n.
2. Driver PWA with inspections, order tracking page, online payments, B2B portal.
3. Live GPS, advanced analytics, partner API.
