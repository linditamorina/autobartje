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
cp .env.example .env            # fill in DATABASE_URL, AUTH_SECRET, DATA_ENCRYPTION_KEY
docker compose up -d db minio   # Postgres + S3-compatible storage
npm install                     # also generates the Prisma client
npx prisma migrate dev          # create tables
npx prisma db seed              # roles, owner account, prices, cities, demo data
npm run dev                     # http://localhost:3000
```

The seed creates the owner account from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Two-factor
authentication is required for Owner and Admin and is set up on first login at `/admin/login`.
Generate the secrets with `openssl rand -base64 33` (AUTH_SECRET) and `openssl rand -base64 32` (DATA_ENCRYPTION_KEY,
which encrypts authenticator secrets at rest; changing it later forces every staff member to set up 2FA again).

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
src/app/admin/     back office: login + 2FA, orders, dispatch, fleet, prices, staff, settings, audit log
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
  Logo uploads go to the public R2 bucket, so `R2_PUBLIC_URL` must be set for the upload button to appear.
- **Privacy**: no analytics or marketing scripts load before cookie consent; "Reject" is as prominent as "Accept";
  each choice is logged in `Consent` with a truncated IP. Retention periods are settings.

## Messages (SMS and email)

Every customer, driver and office message is written to the `NotificationOutbox` table in the same
transaction as the order change, then sent right after the response and by `/api/cron/notifications`
every minute (Vercel Cron, see `vercel.json`; protect it with `CRON_SECRET`). Failed sends retry after
1, 5, 15 and 60 minutes; the admin page **Messages** shows every message and can resend failed ones.
Texts live in `src/server/notifications/templates.ts` (sq/en/de). SMS drop diacritics (ë→e, ç→c) so a
message fits 160 characters instead of 70. WhatsApp customers get SMS until the WhatsApp Business API
lands in phase 2. `/api/cron/daily` sends fleet paperwork reminders (30/7/1/0 days) and deletes data
past the retention periods set in Settings.

## Website content

- Service pages, the import guide, About and the legal pages ship with ready-made text in Albanian, English and German (`src/content/{sq,en,de}.ts`). Admin → Content edits a page per language; "Reset to original text" drops the edit. `{{company.legalName}}`, `{{contact.email}}` and other setting keys are filled in when the page is shown.
- FAQ entries, city pages (`/areas/<slug>`) and blog articles live in the database and are managed in the same screen. An article without a publish time is a draft; a future time schedules it.
- The legal texts are a starting point and should be checked by a lawyer before launch.
- `sitemap.xml` lists every page in every language with hreflang alternates, plus city pages and published articles. Pages carry breadcrumb, service and FAQ structured data.

## Driver app

- Drivers log in at `/admin/login` with their own account (role Driver) and land on `/driver`, a phone app they can add to the home screen. It lists today's jobs (urgent first) and the ones finished today. Demo login after seeding: `arben@example.com` / `driver-demo-password`.
- A job shows one big button for the next step: start driving → vehicle loaded → on the way → delivered (roadside help: start → arrived → done). Every step updates the order and messages the customer, and records the phone's position when the driver allows it.
- Loading needs the pickup inspection: photos from the front, rear and both sides (odometer, interior and damage are optional), odometer and fuel. Delivery needs the same photos plus the customer's name and finger signature. Photos are shrunk on the phone, stored privately with a SHA-256 checksum, and shown only to the office and the assigned driver. The office sees both inspections and the signature on the order page.
- Cash the driver takes is recorded on the job and matched to the invoice when the office issues it.
- Without R2, private files are written to `LOCAL_STORAGE_DIR` (or `.storage` in development). Set R2 or a persistent `LOCAL_STORAGE_DIR` in production; the photo upload refuses to work without either. Photos and signatures of closed orders are deleted after "Inspection photos" days in Settings → Data retention.

## Order tracking

- Every order has a private tracking link (`/track/<64 random hex characters>`). It is sent in the booking, confirmation, "driver on the way" and "vehicle loaded" messages, shown after booking, and on the admin order page for the office to share by phone or WhatsApp.
- Customers without the link can open `/track` and enter the order number and the phone they booked with (rate limited per address and per order number).
- The page shows the steps with times, the planned time, route, the driver's first name and truck, and the price. It refreshes itself every 20 seconds while open and the order is in progress. It never shows notes, staff or vehicle details, is not indexed, and stops showing details 30 days after the order is finished or as soon as the customer's data is anonymised.

## Online payments (Stripe)

- Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to turn them on. In the Stripe dashboard add a webhook to `https://<your domain>/api/stripe/webhook` with the events `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `charge.refunded`. Turn on the payment methods you want (cards, Apple Pay, Google Pay) under Settings → Payment methods.
- Once an order is confirmed with a final price, its tracking page shows "Pay €…". After the invoice is issued, the button asks for what is still open on the invoice. The invoice email links to the same page.
- Payment goes through Stripe Checkout. The webhook books the payment once (repeated events are ignored), counts it towards the open invoice, and messages the customer with Stripe's receipt link. A full refund in Stripe marks the payment refunded and reopens the amount; partial refunds are only written to the audit log for the office to handle.
- Card payments show on the admin order page with a link to the payment in Stripe.

## Deployment

**Vercel (recommended):** import the repo, add the environment variables from `.env.example`, use a Neon
Postgres database in an EU region, and run `npx prisma migrate deploy` as part of the build command.

**Docker:** `docker build -t autobartje .` then run with the same environment variables. The container applies
pending migrations on start.

## Phase plan

1. **MVP**: public site, quote calculator, booking, notifications, admin (orders, dispatch, fleet, pricing), invoicing, i18n.
2. Driver PWA with inspections, order tracking page, online payments, B2B portal.
3. Live GPS, advanced analytics, partner API.
