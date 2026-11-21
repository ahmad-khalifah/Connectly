# Running on Cloudflare Workers (free plan)

Status: **staging Worker deployed (21 Nov 2026); production still on Vercel.**
Nothing in production changes until each cutover step is approved.

The same Next.js app builds for Cloudflare Workers through the OpenNext adapter
(`@opennextjs/cloudflare`). Configuration lives in `wrangler.jsonc` and
`open-next.config.ts`. Only free-plan features are used: no R2, KV, Images or
other paid bindings.

## Commands

| Command | What it does |
| --- | --- |
| `npm run cf:build` | Checks the `.env` files for secrets, builds `.open-next/` (runs `next build` first), copies the static customer pages into the assets folder, then checks the built Worker for secrets |
| `npm run cf:preview` | Builds, then serves it locally on the Workers runtime |
| `npm run cf:size` | Builds and prints the upload size; must stay under 3 MB gzip (free limit) |

Measured on 21 Nov 2026: 1.9 MB gzip.

Deploy with Wrangler directly: `npx wrangler deploy --env=""` for staging,
`npx wrangler deploy --env production` for production.

## Environments

`APP_ENV` decides the environment on Cloudflare (`lib/env.ts`); Vercel's
`VERCEL_ENV` is used only when `APP_ENV` is absent.

| | Staging | Production |
| --- | --- | --- |
| Worker | `connectly-web` (`wrangler deploy`) | `connectly-web-production` (`wrangler deploy --env production`) |
| `APP_ENV` | `preview` (set in `wrangler.jsonc`) | `production` (set in `wrangler.jsonc`) |
| Supabase | staging project | production project |
| Korapay | sandbox key | live key at go-live |

`NEXT_PUBLIC_*` values are compiled into the build, so they must be present
when `cf:build` runs. Put them, and `ADMIN_EMAILS`, in `.env.production.local`
(git-ignored) and nothing else.

**Never build with secrets in a `.env` file.** OpenNext copies every value from
`.env`, `.env.production`, `.env.local` and `.env.production.local` into the
Worker's code (`.open-next/cloudflare/next-env.mjs`), so a service-role key in
`.env.local` would be uploaded inside the Worker. `scripts/cf-guard.mjs` stops
`cf:build` if any `.env` file holds anything other than `NEXT_PUBLIC_*` and
`ADMIN_EMAILS`, and checks the built file again afterwards. It prints names,
never values. Move `.env.local` out of the folder while building.

Secrets are set per Worker with `npx wrangler secret put NAME`
(add `--env production` for production) and never committed:
`SUPABASE_SERVICE_ROLE_KEY`, `KORA_SECRET_KEY`, `TERMII_API_KEY`, `CRON_SECRET`.
Plain variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_APP_URL` (the Worker's own address), `ADMIN_EMAILS`,
`TERMII_SENDER_ID`, `TERMII_BASE_URL`, `TERMII_CHANNEL`.

The production-database and live-key guard in `lib/env.ts` applies unchanged:
a staging Worker refuses to start against production data.

## Free-plan limits that matter

- 100,000 requests a day per account; static files are free and do not count.
- 10 ms of CPU per request. Cloudflare tolerates the odd overrun but stops
  Workers that exceed it consistently (error 1102).
- 3 MB compressed code.

## CPU per request, and why the customer pages are static

Measured on the staging Worker with `wrangler tail` on 21 Nov 2026, before
this design:

| Request | CPU |
| --- | --- |
| Prerendered page (home), static files | 2–10 ms |
| `/admin` redirect (Proxy only) | 2 ms |
| Pages rendered per request (`/connect`, `/success`, `/login`) | 19–55 ms warm, 110–260 ms on a new isolate |

Waiting for the database does not count; rendering React does. So the
customer path never renders on the server:

- `/portal`, `/connect` and `/success` are prerendered pages that read the
  address in the browser. `scripts/cf-static-pages.mjs` copies their HTML into
  the assets folder, so Cloudflare serves them as files without running the
  Worker (no CPU, not counted in the daily requests). The script fails the
  build if one of them stops being static.
- `worker.ts` is the Worker's entry point. It answers `GET /api/portal`,
  `POST /api/checkout`, `GET /api/purchase/status`, `POST /api/webhooks/kora`
  and the old `/status` link itself with `lib/http/customer-api.ts`, and passes
  every other request to the Next.js worker. The Next.js routes for the same
  paths use the same handlers, so local dev and Vercel behave identically.
- The public home page and `/wifi` are served as files the same way.
- The server's database client is PostgREST only (`lib/db/client.ts`), not
  the full supabase-js client, whose sign-in and realtime set-up cost CPU on
  every new Worker instance. Korapay's webhook arrives from abroad and
  usually starts a new instance (12 and 24 ms with the full client).
- CPU grows by roughly 1 ms per database or Korapay call. The webhook made
  11 (6 for the payment, 5 for the SMS), so it no longer sends the SMS: it
  stores the event, verifies with Korapay and confirms the payment, as before.
  The payment page then calls `POST /api/purchase/notify` once, which sends
  the SMS with the WiFi code; the notification row is claimed first, so a
  purchase gets at most one SMS whoever asks. A customer who closes the page
  within seconds of paying gets no SMS until the scheduled sweep (planned
  with the edge cron jobs) sends unsent confirmations. Admin re-checks still
  send the SMS directly.
- The staging banner is decided in the browser from the address
  (`components/env-banner.tsx`), since a static file is built once.

After the change (staging, 21 Nov 2026): `/api/portal` 2–7 ms,
`/api/purchase/status` 3–8 ms, `/api/checkout` 4 ms (14 ms on a new
instance), customer pages 0 (not run). Webhook 12 ms with the SMS; to be
re-measured without it.

The admin still renders per request and is the next part to move (same
approach: static pages plus small JSON handlers).

## Known warnings (expected)

- `Node.js middleware support is experimental in cloudflare`: the admin gate
  (`proxy.ts`) uses Node.js middleware. It ran correctly in a local Workers
  preview (`/admin` redirects to sign-in). The admin layout and every admin API
  route check the user again, so the gate is not the only protection.
- `StaticAssetsIncrementalCache: Failed to set to read-only cache`: Next.js
  tries to store a rendered page; the cache is read-only by design. Harmless.

## Staging test

1. Done: a free Cloudflare account (connectly.hq@outlook.com), no card.
2. Done: `connectly-web` at https://connectly-web.getconnectly.workers.dev with
   staging values and secrets.
3. In progress: CPU under 10 ms on every customer request, no 1102 errors,
   then a Korapay sandbox payment end to end.
4. Only then plan the production cutover (DNS, Korapay webhook address), each
   step approved separately. Vercel stays as the rollback for 30 days.
