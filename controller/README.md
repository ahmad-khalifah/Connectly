# Connectly Network Controller

A small Node.js service that does every router action the admin dashboard and payments ask for. It takes jobs from the database queue, talks to each MikroTik over WireGuard, and writes the results back. The app on Vercel never talks to a router.

Plan and costs: see the *Zero-Cost Development and Testing Plan* doc. Nothing here needs paid hosting.

## Status (17 Nov 2026)

| Part | State |
| --- | --- |
| Job worker: Test Connection, provision, revoke/expiry, disconnect | Built; tested against a local database and a simulated router |
| Retries, crash recovery, reclaim after 5 min, back-off | Built; tested |
| Health polling (offline after 3 misses), reconciliation | Built; tested |
| Bootstrap endpoint (credential only to the router's own tunnel address) | Built; tested with a simulated request |
| WireGuard peer list + root sync script | Built; script checks tested with a fake `wg`, not on a real hub |
| RouterOS REST client with certificate pinning | Built; tested against a simulated HTTPS router |
| **Anything on real RouterOS** (REST field names, bootstrap script, hotspot behaviour) | **Untested until the CHR stage** |
| `router.sync_profiles`, `access.login` jobs | Not built; such jobs fail clearly with "not handled yet" |
| install.sh, systemd units | Written; **never run on a machine** |

## Layout

- `src/main.ts`: entry point (`--check` validates settings, key and database login, then exits)
- `src/worker.ts`: loops, timers, start order after downtime
- `src/jobs.ts`: what each job does on a router (every action is safe to repeat)
- `src/health.ts`: health polling and reconciliation
- `src/bootstrap.ts`: `GET /bootstrap/<router id>` on the tunnel address only
- `src/routeros.ts`: RouterOS REST client
- `src/db.ts`: every query; only what the `connectly_controller` role may touch
- `src/keys.ts`: credential key (RSA 3072, owner-only file) and decryption
- `src/wg-peers.ts`: router peer list for the WireGuard hub
- `deploy/`: systemd units, example settings, install and peer-sync scripts

## Run the tests (local, free)

Needs Node 22.18+ and a local PostgreSQL (16 or 17). The tests create and drop their own database, apply `supabase/baseline` and every migration, and log in as the real `connectly_controller` role.

```bash
cd controller && npm ci
# an admin URL for a LOCAL server, never Supabase:
export CONTROLLER_TEST_PG=postgres://postgres:<local-password>@127.0.0.1:5432/postgres
npm test            # 30 tests; database tests are skipped without CONTROLLER_TEST_PG
npm run typecheck
```

## Settings

All settings come from environment variables; see `deploy/controller.env.example`. Safety checks at start-up:

- `CONTROLLER_ENV` other than `production` refuses the production database, and `production` refuses any other database.
- Outside `local`, the database certificate must be verified (`DATABASE_CA_FILE`), and the login must be `connectly_controller`.
- If the database already holds a different credential key, start-up stops rather than making every router credential unreadable.
- The key file and data directory must be owner-only.

## Moving hosts

Copy `controller.env`, `credential-key.pem` and the WireGuard key to the new machine, run `deploy/install.sh`, and point the DNS name in `CONTROLLER_ENDPOINT` at it. Routers need no change.
