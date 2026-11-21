# Running on Cloudflare Workers (free plan)

Status: **prepared, not deployed.** Production still runs on Vercel. Nothing here
changes until each step below is approved.

The same Next.js app builds for Cloudflare Workers through the OpenNext adapter
(`@opennextjs/cloudflare`). Configuration lives in `wrangler.jsonc` and
`open-next.config.ts`. Only free-plan features are used: no R2, KV, Images or
other paid bindings.

## Commands

| Command | What it does |
| --- | --- |
| `npm run cf:build` | Builds `.open-next/` for Workers (runs `next build` first) |
| `npm run cf:preview` | Builds, then serves it locally on the Workers runtime |
| `npm run cf:size` | Builds and prints the upload size; must stay under 3 MB gzip (free limit) |

Measured on 21 Nov 2026: 1.85 MB gzip.

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
when `cf:build` runs (build variables), as well as at runtime.

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
- 10 ms of CPU per request. **Not yet measured for this app**: this is the gate
  for the staging test (see below).
- 3 MB compressed code.

## Known warnings (expected)

- `Node.js middleware support is experimental in cloudflare`: the admin gate
  (`proxy.ts`) uses Node.js middleware. It ran correctly in a local Workers
  preview (`/admin` redirects to sign-in). The admin layout and every admin API
  route check the user again, so the gate is not the only protection.
- `StaticAssetsIncrementalCache: Failed to set to read-only cache`: Next.js
  tries to store a rendered page; the cache is read-only by design. Harmless.

## Staging test (needs approval, not started)

1. A free Cloudflare account with two-factor sign-in and no card.
2. Deploy `connectly-web` to its workers.dev address with staging values.
3. Check every page and API route in Cloudflare's metrics: CPU per request
   under 10 ms, no 1102 errors. Run a Korapay sandbox payment end to end.
4. Only then plan the production cutover (DNS, Korapay webhook address), each
   step approved separately. Vercel stays as the rollback for 30 days.
