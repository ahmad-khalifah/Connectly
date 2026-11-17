// Controller settings, read once from the environment (an owner-only file
// loaded by systemd's EnvironmentFile on a server, or exported in a shell
// while developing). Nothing here is provider-specific: a laptop, a free VM
// and a paid VPS run the same build with a different settings file.

import os from 'node:os';
import fs from 'node:fs';

export type Environment = 'local' | 'staging' | 'production';

export type Config = {
  environment: Environment;
  version: string;
  workerId: string;
  database: {
    connectionString: string;
    /** PEM CA bundle that signs the database's TLS certificate (required outside local). */
    caPem: string | null;
    maxConnections: number;
  };
  /** Holds the credential private key. Owner-only (0700). */
  dataDir: string;
  /** host:port routers dial for WireGuard, published to network_settings. */
  controllerEndpoint: string | null;
  /** File holding the controller's WireGuard public key (written by `wg pubkey`). */
  wgPublicKeyFile: string | null;
  /** Where the router peer list is written for wg-peers-sync.sh (null: not managed here). */
  wgPeersFile: string | null;
  bootstrap: { host: string; port: number } | null;
  concurrency: number;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  sweepIntervalMs: number;
  healthIntervalMs: number;
  reconcileIntervalMs: number;
  routerTimeoutMs: number;
  /** Allow replacing a different credential key already published (makes old router credentials unreadable). */
  replaceCredentialKey: boolean;
  /** App endpoint the controller calls on a timer (expiry reminders), with its bearer secret. */
  appTick: { url: string; secret: string; intervalMs: number } | null;
};

export class ConfigError extends Error {}

/** The production Supabase project. A non-production controller must never point at it. */
export const PRODUCTION_PROJECT_REF = 'plydltvxfozxflarrfrx';

const ENVIRONMENTS: Environment[] = ['local', 'staging', 'production'];

function int(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new ConfigError(`${name} must be a whole number from ${min} to ${max}.`);
  return n;
}

function hostPort(raw: string, name: string): { host: string; port: number } {
  const m = /^([A-Za-z0-9.\-]+|\[[0-9a-fA-F:]+\]):(\d{1,5})$/.exec(raw);
  const port = m ? Number(m[2]) : NaN;
  if (!m || port < 1 || port > 65535) throw new ConfigError(`${name} must look like host:port.`);
  return { host: m[1]!, port };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, readFile: (p: string) => string = (p) => fs.readFileSync(p, 'utf8')): Config {
  const environment = (env.CONTROLLER_ENV ?? '') as Environment;
  if (!ENVIRONMENTS.includes(environment)) {
    throw new ConfigError('CONTROLLER_ENV must be local, staging or production.');
  }

  const connectionString = env.DATABASE_URL ?? '';
  if (!connectionString) throw new ConfigError('DATABASE_URL is required.');
  if (environment !== 'production' && connectionString.includes(PRODUCTION_PROJECT_REF)) {
    throw new ConfigError(`A ${environment} controller must not connect to the production database.`);
  }
  if (environment === 'production' && !connectionString.includes(PRODUCTION_PROJECT_REF)) {
    throw new ConfigError('A production controller must connect to the production database.');
  }

  let caPem: string | null = null;
  if (env.DATABASE_CA_FILE) caPem = readFile(env.DATABASE_CA_FILE);
  if (environment !== 'local' && !caPem) {
    throw new ConfigError('DATABASE_CA_FILE is required outside local development, so the database certificate is verified.');
  }

  const bootstrapRaw = env.BOOTSTRAP_LISTEN ?? '';
  const endpointRaw = env.CONTROLLER_ENDPOINT ?? '';
  if (endpointRaw) hostPort(endpointRaw, 'CONTROLLER_ENDPOINT');

  let appTick: Config['appTick'] = null;
  if (env.APP_TICK_URL) {
    let u: URL;
    try { u = new URL(env.APP_TICK_URL); } catch { throw new ConfigError('APP_TICK_URL must be a full URL.'); }
    if (u.protocol !== 'https:' && environment !== 'local') throw new ConfigError('APP_TICK_URL must use https outside local development.');
    if (!env.APP_TICK_SECRET_FILE) throw new ConfigError('APP_TICK_SECRET_FILE is required with APP_TICK_URL.');
    const secret = readFile(env.APP_TICK_SECRET_FILE).trim();
    if (secret.length < 32) throw new ConfigError('The secret in APP_TICK_SECRET_FILE must be at least 32 characters.');
    appTick = { url: u.toString(), secret, intervalMs: int(env, 'APP_TICK_INTERVAL_MS', 600_000, 60_000, 3_600_000) };
  }

  return {
    environment,
    version: env.CONTROLLER_VERSION || '0.1.0',
    workerId: (env.CONTROLLER_WORKER_ID || `${os.hostname()}:${process.pid}`).slice(0, 200),
    database: { connectionString, caPem, maxConnections: int(env, 'DATABASE_MAX_CONNECTIONS', 5, 2, 20) },
    dataDir: env.CONTROLLER_DATA_DIR || '/var/lib/connectly-controller',
    controllerEndpoint: endpointRaw || null,
    wgPublicKeyFile: env.WG_PUBLIC_KEY_FILE || null,
    wgPeersFile: env.WG_PEERS_FILE || null,
    bootstrap: bootstrapRaw ? hostPort(bootstrapRaw, 'BOOTSTRAP_LISTEN') : null,
    concurrency: int(env, 'CONTROLLER_CONCURRENCY', 2, 1, 16),
    pollIntervalMs: int(env, 'POLL_INTERVAL_MS', 2000, 200, 60_000),
    heartbeatIntervalMs: int(env, 'HEARTBEAT_INTERVAL_MS', 30_000, 1000, 120_000),
    sweepIntervalMs: int(env, 'SWEEP_INTERVAL_MS', 60_000, 1000, 600_000),
    healthIntervalMs: int(env, 'HEALTH_INTERVAL_MS', 60_000, 1000, 600_000),
    reconcileIntervalMs: int(env, 'RECONCILE_INTERVAL_MS', 900_000, 1000, 86_400_000),
    routerTimeoutMs: int(env, 'ROUTER_TIMEOUT_MS', 15_000, 1000, 60_000),
    replaceCredentialKey: env.CONTROLLER_REPLACE_CREDENTIAL_KEY === 'yes',
    appTick,
  };
}
