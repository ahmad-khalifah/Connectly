// The bootstrap endpoint routers call once, from the engineer's setup script
// (lib/network/setup-script.ts): GET /bootstrap/<router id>.
//
// It listens only on the controller's tunnel address (10.77.0.1:8080), so it
// is reachable only through WireGuard, and it answers a router only from that
// router's own tunnel address. Anything else gets the same plain 404, so the
// endpoint reveals nothing. The reply is a RouterOS script that creates the
// restricted API user with the decrypted password (WireGuard encrypts it in
// transit; the setup script deletes the file after import), a certificate for
// HTTPS, and limits the HTTPS API to the controller's tunnel address.
//
// STATUS: untested on RouterOS until the CHR stage.

import http from 'node:http';
import type { Db, RouterRow } from './db.ts';
import { decryptRouterPassword, KeyError, type CredentialKeys } from './keys.ts';
import type { Logger } from './log.ts';
import { ROUTER_API_USER } from './jobs.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WG_INTERFACE = 'wg-connectly';

const ros = (s: string) => s.replace(/[\\"$]/g, (c) => `\\${c}`);

export function bootstrapScript(router: RouterRow, password: string, controllerIp: string): string {
  const user = ROUTER_API_USER;
  return [
    `# Connectly bootstrap for ${ros(router.identifier)}. Contains the controller's API password:`,
    '# the setup script deletes this file after importing it.',
    `:if ([:len [/user group find name="${user}"]] = 0) do={ /user group add name="${user}" policy="read,write,api,rest-api,test" comment="Connectly controller" }`,
    `:if ([:len [/user find name="${user}"]] = 0) do={ /user add name="${user}" group="${user}" address=${controllerIp}/32 password="${ros(password)}" comment="Connectly controller" } else={ /user set [find name="${user}"] group="${user}" address=${controllerIp}/32 password="${ros(password)}" }`,
    // RouterOS 7 will not self-sign a tls-server certificate ("CA not found"),
    // so the router gets its own small CA, which then signs the HTTPS cert.
    // Found on CHR 7.25.1, 17 Nov 2026. Safe to re-run: signing an already
    // signed certificate fails harmlessly inside on-error.
    `:if ([:len [/certificate find name="connectly-ca"]] = 0) do={ /certificate add name="connectly-ca" common-name="connectly-ca-${ros(router.identifier)}" key-size=2048 days-valid=3650 key-usage=key-cert-sign,crl-sign; /certificate sign connectly-ca }`,
    ':delay 5s',
    `:if ([:len [/certificate find name="connectly-api"]] = 0) do={ /certificate add name="connectly-api" common-name="${ros(router.identifier)}" key-size=2048 days-valid=3650 key-usage=digital-signature,key-encipherment,tls-server }`,
    ':do { /certificate sign connectly-api ca=connectly-ca } on-error={ :log info "Connectly: HTTPS certificate already signed" }',
    ':delay 15s',
    `/ip service set www-ssl certificate=connectly-api disabled=no port=443 address=${controllerIp}/32`,
    `:if ([:len [/ip firewall filter find comment="Connectly controller API"]] = 0) do={ /ip firewall filter add chain=input action=accept protocol=tcp dst-port=443 src-address=${controllerIp} in-interface=${WG_INTERFACE} comment="Connectly controller API" }`,
    ':log info "Connectly bootstrap applied"',
  ].join('\n');
}

const stripV4Mapped = (a: string | undefined) => (a ?? '').replace(/^::ffff:/, '');

export type BootstrapDeps = { db: Db; keys: CredentialKeys; log: Logger; controllerIp: () => Promise<string> };

export function createBootstrapHandler(deps: BootstrapDeps): http.RequestListener {
  const hits = new Map<string, { n: number; since: number }>();
  const notFound = (res: http.ServerResponse) => {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found\n');
  };

  return async (req, res) => {
    const remote = stripV4Mapped(req.socket.remoteAddress);
    const now = Date.now();
    const h = hits.get(remote);
    if (h && now - h.since < 60_000 && h.n >= 10) return notFound(res);
    hits.set(remote, h && now - h.since < 60_000 ? { n: h.n + 1, since: h.since } : { n: 1, since: now });

    const m = /^\/bootstrap\/([^/?]+)$/.exec(req.url ?? '');
    if (req.method !== 'GET' || !m || !UUID.test(m[1]!)) return notFound(res);

    let router: RouterRow | null;
    try {
      router = await deps.db.getRouter(m[1]!);
    } catch (e) {
      deps.log.error('bootstrap.db_error', { error: e });
      res.writeHead(503).end();
      return;
    }
    if (!router || router.connection_method !== 'wireguard' || router.lifecycle_status === 'retired' || !router.tunnel_ip || router.tunnel_ip !== remote) {
      deps.log.warn('bootstrap.refused', { router_id: m[1], from: remote });
      return notFound(res);
    }

    try {
      if (!router.credential_ciphertext) throw new KeyError('no credential issued');
      const password = decryptRouterPassword(deps.keys, router.credential_ciphertext, router.credential_key_id);
      const script = bootstrapScript(router, password, await deps.controllerIp());
      res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
      res.end(script + '\n');
      deps.log.info('bootstrap.served', { router_id: router.id, identifier: router.identifier });
      await deps.db.logActivity('router.bootstrapped', 'info', router.id, router.location_id, `Router ${router.identifier} fetched its controller configuration`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      deps.log.warn('bootstrap.no_credential', { router_id: router.id, error: message });
      res.writeHead(409, { 'content-type': 'text/plain' });
      res.end(':log error "Connectly: no usable credential for this router. Issue one in the admin dashboard, then run the setup script again."\n');
    }
  };
}
