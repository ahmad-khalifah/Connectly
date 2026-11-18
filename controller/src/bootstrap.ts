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
// Direct-HTTPS routers (no WireGuard) can collect their credential only when
// the controller is started with BOOTSTRAP_ALLOW_DIRECT=yes, and only when the
// router's management address, the address it calls from and the controller
// address it called are all private (10/8, 172.16/12, 192.168/16): the reply
// is plain HTTP, so it must never cross the internet. The API user and the
// firewall rule are then limited to the controller address the router used.
//
// STATUS: bootstrap script proven on RouterOS 7.25.1 (CHR, 17 Nov 2026).

import http from 'node:http';
import type { Db, RouterRow } from './db.ts';
import { decryptRouterPassword, KeyError, type CredentialKeys } from './keys.ts';
import type { Logger } from './log.ts';
import { ROUTER_API_USER } from './jobs.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WG_INTERFACE = 'wg-connectly';

const ros = (s: string) => s.replace(/[\\"$]/g, (c) => `\\${c}`);

/** True for RFC 1918 IPv4 addresses. */
export function isPrivateIpv4(a: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
  if (!m || m.slice(1).some((o) => Number(o) > 255)) return false;
  const [x, y] = [Number(m[1]), Number(m[2])];
  return x === 10 || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168);
}

export function bootstrapScript(router: RouterRow, password: string, controllerIp: string): string {
  const user = ROUTER_API_USER;
  // Through WireGuard the API is also limited to the tunnel interface; a direct router is limited by address only.
  const inInterface = router.connection_method === 'wireguard' ? ` in-interface=${WG_INTERFACE}` : '';
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
    // RouterOS 7.2x renamed the service's "address" to "available-from"; use whichever this version has.
    `:do { /ip service set www-ssl certificate=connectly-api disabled=no port=443 available-from=${controllerIp}/32 } on-error={ /ip service set www-ssl certificate=connectly-api disabled=no port=443 address=${controllerIp}/32 }`,
    `:if ([:len [/ip firewall filter find comment="Connectly controller API"]] = 0) do={ /ip firewall filter add chain=input action=accept protocol=tcp dst-port=443 src-address=${controllerIp}${inInterface} comment="Connectly controller API" }`,
    // A new rule goes to the end of the chain, after the default "drop all not coming from LAN"
    // that physical MikroTik routers ship with, so it would never match: move it to the top.
    // (The CHR lab has no default firewall, so it could not show this.)
    `/ip firewall filter move [find comment="Connectly controller API"] destination=0`,
    ':log info "Connectly bootstrap applied"',
  ].join('\n');
}

const stripV4Mapped = (a: string | undefined) => (a ?? '').replace(/^::ffff:/, '');

export type BootstrapDeps = {
  db: Db; keys: CredentialKeys; log: Logger;
  /** The controller's tunnel address (WireGuard routers). */
  controllerIp: () => Promise<string>;
  /** Serve direct-HTTPS routers on private networks (BOOTSTRAP_ALLOW_DIRECT=yes). */
  allowDirect?: boolean;
};

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
    const local = stripV4Mapped(req.socket.localAddress);
    const viaTunnel = router?.connection_method === 'wireguard' && !!router.tunnel_ip && router.tunnel_ip === remote;
    const direct = router?.connection_method === 'direct_https' && deps.allowDirect === true
      && !!router.management_ip && router.management_ip === remote && isPrivateIpv4(remote) && isPrivateIpv4(local);
    if (!router || router.lifecycle_status === 'retired' || !(viaTunnel || direct)) {
      deps.log.warn('bootstrap.refused', { router_id: m[1], from: remote });
      return notFound(res);
    }

    try {
      if (!router.credential_ciphertext) throw new KeyError('no credential issued');
      const password = decryptRouterPassword(deps.keys, router.credential_ciphertext, router.credential_key_id);
      const script = bootstrapScript(router, password, direct ? local : await deps.controllerIp());
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
