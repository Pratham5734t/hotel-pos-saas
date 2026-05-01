# Hotel POS — Universal Multi-Tenant POS with Aggregator Integration

A self-hostable, multi-tenant Point-of-Sale system for hotels and restaurants.

Each hotel signs up, picks the modules they need (Restaurant, Bar, Banquet,
Lodging), and gets a tailored, touch-friendly POS with a built-in **adapter
layer for Zomato, Swiggy and other aggregators** — including a mock simulator
that lets you exercise the full inbound-order lifecycle without external
credentials.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Prisma 6** + **PostgreSQL** (production-ready; Supabase recommended)
- **NextAuth (credentials)** for multi-tenant auth
- **Tailwind CSS** + minimal shadcn-style UI primitives
- **Server-Sent Events** for live KOT and order updates

## Quickstart

### 1. Provision a Postgres database

The app expects a Postgres database (Supabase, Neon, Railway, RDS, or local Docker all work).

**Recommended: Supabase free tier**
1. Create a project at https://supabase.com/dashboard
2. Go to **Project Settings → Database → Connection string → Prisma**
3. Copy the **Transaction pooler** URL (port 6543) → this is your `DATABASE_URL`
4. Copy the **Direct connection** URL (port 5432) → this is your `DIRECT_URL`
5. Replace `[YOUR-PASSWORD]` in both with the DB password you set during project creation

**Alternative: local Docker**
```bash
docker run --name hotelpos -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
# Then in .env, set both URLs to:
# postgresql://postgres:postgres@localhost:5432/postgres
```

### 2. Run the app

```bash
pnpm install
cp .env.example .env       # then paste your DATABASE_URL + DIRECT_URL
pnpm db:push               # apply schema
pnpm db:seed               # adds Grand Demo Hotel + 26-item menu + 8 tables
pnpm dev                   # http://localhost:3000
```

Sign in with the seeded demo owner:

```
Hotel ID: grand-demo-hotel
Email:    owner@granddemohotel.com
Password: demo1234
```

Or click **Create your hotel** on the landing page to onboard a fresh tenant.

## What's included

| Area                 | Status |
| -------------------- | ------ |
| Multi-tenant signup with module picker | ✅ |
| Auth + roles (Owner / Manager / Cashier / Waiter / Kitchen) | ✅ |
| Touch POS — categories, items, table mode, take-away, KOT, billing, GST | ✅ |
| Live Kitchen Display (SSE) | ✅ |
| Orders list with channel + status filters | ✅ |
| Per-tenant invoice numbering, printable receipts | ✅ |
| Aggregator adapter — `OrderProvider` interface, generic webhook receiver | ✅ |
| Zomato + Swiggy provider scaffolding (HMAC-SHA256 verified) | ✅ |
| Mock provider with built-in simulator UI | ✅ |
| Outbound status push when orders move through KOT lifecycle | ✅ |
| Reports — today's sales, channel split, last 7 days, top items | ✅ |
| Settings — hotel profile, tables, team management | ✅ |
| Lodging (rooms, check-in/out, folio) | ⏳ planned |

## Aggregator integration

The integration layer lives entirely in [`src/lib/integrations/`](src/lib/integrations/):

- `types.ts` — shared `OrderProvider` interface and normalized order shape
- `zomato.ts`, `swiggy.ts`, `mock.ts` — provider implementations
- `registry.ts` — provider lookup
- `ingest.ts` — turns a normalized `ProviderOrder` into a real `Order` with
  KOT broadcast and an `IntegrationEvent` log entry

Webhook URL pattern (shown in the `/integrations` page):

```
POST /api/webhooks/{ZOMATO|SWIGGY|MOCK}?tenant={slug}
```

For real Zomato/Swiggy integration:
1. Sign the merchant agreement and obtain partner credentials.
2. Plug the credentials into the integration's `config` JSON
   (`apiBase`, `apiKey`, `outletId`, etc.) on the `/integrations` page.
3. Update the field paths in `parseOrder()` if Zomato/Swiggy publish a new
   schema version — the rest of the pipeline stays the same.

You can demo the full lifecycle today using the **Mock** provider:
**Integrations → Mock → Send test order**.

## Scripts

| Command              | Description |
| -------------------- | ----------- |
| `pnpm dev`           | Start the Next.js dev server |
| `pnpm build`         | Generate Prisma client and build for production |
| `pnpm start`         | Start the production server |
| `pnpm lint`          | Lint with ESLint |
| `pnpm typecheck`     | `tsc --noEmit` |
| `pnpm db:push`       | Apply Prisma schema to the DB |
| `pnpm db:seed`       | Seed Grand Demo Hotel |
| `pnpm db:reset`      | Drop and recreate the DB (dev only) |

## License

MIT.
