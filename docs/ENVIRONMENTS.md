# Environments

Connectly runs in three environments. They never share a database or payment keys.

| | Production | Preview (staging) | Local development |
| --- | --- | --- | --- |
| Where | `getconnectly.net` (Vercel **Production**) | Every non-`main` branch (Vercel **Preview**) | `npm run dev` |
| Supabase | Production project `plydltvxfozxflarrfrx` | **Staging** project (separate) | Staging project |
| Korapay | Live keys (`sk_live_…`) once go-live is approved | Sandbox keys (`sk_test_…`) only | Sandbox keys only |
| Termii | Production sender | Same account; test numbers only | Optional |
| Banner | none | Yellow "PREVIEW ENVIRONMENT" bar | Yellow "DEVELOPMENT ENVIRONMENT" bar |

## Enforced in code (`lib/env.ts`)

At the first database call, the app refuses to run if:

- a **preview or local** deployment points at the production Supabase project, or
- a **preview or local** deployment has a **live** Korapay key.

Production with a Korapay **test** key is allowed but logged as a warning, so it stays visible until live keys are configured.

Korapay redirect and webhook URLs come from `appUrl()`. On previews this is Vercel's stable branch URL (`VERCEL_BRANCH_URL`), so a sandbox payment always returns to, and notifies, the preview that started it, never production.

## Vercel environment variables

Set each variable separately for **Production** and **Preview** in Vercel → Project → Settings → Environment Variables.

| Variable | Production | Preview |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | production project URL | **staging** project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | production anon key | **staging** anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | production service role | **staging** service role |
| `ADMIN_EMAILS` | `connectly.hq@outlook.com` | `connectly.hq@outlook.com` |
| `NEXT_PUBLIC_APP_URL` | `https://getconnectly.net` | leave unset (branch URL is used) |
| `KORA_SECRET_KEY` | live key at go-live | sandbox `sk_test_…` |
| `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_BASE_URL`, `TERMII_CHANNEL` | production values | same, or unset to skip SMS |
| `CRON_SECRET` | random, 32+ chars | different random value |

Never paste keys into chat, issues or commits. Rotate any key that was.

## Setting up the staging database

1. Create the staging Supabase project (separate from production).
2. Apply, in order: `supabase/baseline/20261116_production_public_schema.sql`, then each file in `supabase/migrations/` by name **that has been approved for staging**. A migration not yet approved stays unapplied, even though its file is in the repo.
3. Create the staging admin user (`connectly.hq@outlook.com`) in staging Auth with its own password.
4. Seed test locations and plans through the admin dashboard (not from production data).
5. Turn off public sign-ups in staging Auth too.

## Korapay webhooks on previews

Vercel may protect preview URLs with a login, which blocks Korapay's webhook. The customer return page re-checks each payment with Korapay's verify API, so payments still complete. To test real webhook delivery on a preview, enable Vercel's *Protection Bypass for Automation* for the project and include its token in the notification URL. That step is configured when staging is set up.

## Cloudflare Workers (prepared, not live)

The app can also be built for Cloudflare Workers' free plan. There, `APP_ENV`
(`preview` or `production`) replaces Vercel's `VERCEL_ENV`, and the same guards
apply. See `docs/cloudflare.md`.
