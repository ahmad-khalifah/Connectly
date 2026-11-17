// Entry point: `node src/main.ts` (or `--check` to validate settings, keys
// and the database login without starting work).

import fs from 'node:fs';
import http from 'node:http';
import { loadConfig, ConfigError, type Config } from './config.ts';
import { createLogger } from './log.ts';
import { loadOrCreateCredentialKeys } from './keys.ts';
import { createPool, Db } from './db.ts';
import { RestRouterClient } from './routeros.ts';
import { Controller } from './worker.ts';
import { createBootstrapHandler } from './bootstrap.ts';

const log = createLogger();

async function publishKeys(cfg: Config, db: Db, keys: { publicPem: string; keyId: string }): Promise<void> {
  const current = await db.readPublishedKey();
  if (current.credential_key_id && current.credential_key_id !== keys.keyId && !cfg.replaceCredentialKey) {
    throw new ConfigError(
      `The database already holds credential key ${current.credential_key_id}, not this controller's ${keys.keyId}. ` +
      'Another controller may be using this database, or the key file was lost. Restore the key from backup, or set ' +
      'CONTROLLER_REPLACE_CREDENTIAL_KEY=yes knowing every router then needs a new credential.');
  }
  let wgPublicKey: string | null = null;
  if (cfg.wgPublicKeyFile) {
    wgPublicKey = fs.readFileSync(cfg.wgPublicKeyFile, 'utf8').trim();
    if (!/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/.test(wgPublicKey)) throw new ConfigError(`${cfg.wgPublicKeyFile} does not hold a WireGuard public key.`);
  }
  await db.publishKeys({ credentialPublicKey: keys.publicPem, credentialKeyId: keys.keyId, wgPublicKey, endpoint: cfg.controllerEndpoint });
}

async function main() {
  const cfg = loadConfig();
  const keys = loadOrCreateCredentialKeys(cfg.dataDir);
  if (keys.created) log.warn('keys.created', { key_id: keys.keyId, action: 'Back up the credential key file to offline storage now.' });

  const pool = createPool(cfg);
  pool.on('error', (e) => log.error('db.pool_error', { error: e }));
  const db = new Db(pool);

  const who = await pool.query<{ u: string }>('select current_user as u');
  log.info('db.connected', { user: who.rows[0]!.u, environment: cfg.environment });
  if (who.rows[0]!.u !== 'connectly_controller' && cfg.environment !== 'local') {
    throw new ConfigError('Outside local development the controller must log in as connectly_controller, never as an administrator.');
  }

  if (process.argv.includes('--check')) {
    await db.readTunnelSettings();
    log.info('check.ok', { key_id: keys.keyId, worker: cfg.workerId });
    await pool.end();
    return;
  }

  await publishKeys(cfg, db, keys);
  const ctx = {
    db, keys, log,
    connect: (t: { host: string; port: number; user: string; password: string; pinnedFingerprint: string | null }) =>
      new RestRouterClient({ ...t, timeoutMs: cfg.routerTimeoutMs }),
  };
  const controller = new Controller(ctx, { ...cfg, workerId: cfg.workerId });

  let server: http.Server | null = null;
  if (cfg.bootstrap) {
    server = http.createServer(createBootstrapHandler({ db, keys, log, controllerIp: async () => (await db.readTunnelSettings()).controller_tunnel_ip }));
    server.headersTimeout = 10_000;
    server.requestTimeout = 15_000;
    await new Promise<void>((resolve) => server!.listen(cfg.bootstrap!.port, cfg.bootstrap!.host, resolve));
    log.info('bootstrap.listening', cfg.bootstrap);
  }

  await controller.start();

  const shutdown = async (signal: string) => {
    log.info('controller.stopping', { signal });
    server?.close();
    await controller.stop();
    await pool.end();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((e) => {
  log.error('controller.fatal', { error: e });
  process.exit(1);
});
