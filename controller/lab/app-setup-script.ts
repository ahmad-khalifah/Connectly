// VERBATIM COPY of lib/network/setup-script.ts from the app (branch network/controller-local),
// so the WireGuard lab runs the exact script the admin dashboard gives the engineer.
// Do not edit here; edit the app's file and copy it again.

// The RouterOS script the engineer pastes into a router after registering
// it. It holds no password or private key: it sets the router's name and its
// WireGuard tunnel, then the router fetches the rest of its configuration
// (API user and password, HTTPS certificate, firewall, hotspot, walled
// garden) from the controller through that encrypted tunnel. The controller
// answers only the tunnel address assigned to this router.
//
// STATUS: run on MikroTik CHR 7.25.1 in the lab (17 Nov 2026); re-runs made safe
// after the lab showed a second run failing on the existing peer.

export type SetupInputs = {
  router: { id: string; name: string; identifier: string; connection_method: string; tunnel_ip: string | null; wg_public_key: string | null };
  settings: { controller_endpoint: string | null; controller_wg_public_key: string | null; controller_tunnel_ip: string; tunnel_cidr: string };
};

export type SetupScript = { ready: boolean; missing: string[]; script: string };

export const WG_INTERFACE = 'wg-connectly';
export const BOOTSTRAP_PORT = 8080;

// RouterOS quoted strings: escape backslash, double quote and $.
const ros = (s: string) => s.replace(/[\\"$]/g, (c) => `\\${c}`);

export function buildSetupScript({ router, settings }: SetupInputs): SetupScript {
  const missing: string[] = [];
  if (router.connection_method !== 'wireguard') {
    return { ready: false, missing: ['Direct HTTPS routers are configured by hand; no tunnel script applies.'], script: '' };
  }
  if (!router.wg_public_key) missing.push("the router's WireGuard public key (register it first)");
  if (!router.tunnel_ip) missing.push('a tunnel address');
  if (!settings.controller_endpoint) missing.push("the controller's address (set when the VPS is deployed)");
  if (!settings.controller_wg_public_key) missing.push("the controller's WireGuard public key (published by the controller at start-up)");

  const prefix = settings.tunnel_cidr.split('/')[1] ?? '22';
  const [host, port] = (settings.controller_endpoint ?? '<controller-host>:<port>').split(':');
  const controllerIp = settings.controller_tunnel_ip.split('/')[0];

  const script = [
    `# Connectly setup for "${ros(router.name)}" (${router.identifier})`,
    '# RouterOS 7. Contains no passwords: the controller sends the API',
    '# credential to this router through the tunnel in step 3.',
    '',
    '# 1. Router identity (must match the identifier registered in the portal)',
    `/system identity set name="${ros(router.identifier)}"`,
    '',
    `# 2. Tunnel to the Connectly controller. The ${WG_INTERFACE} interface was`,
    '#    created before registration, to read its public key.',
    '#    Safe to run again: an existing Connectly peer and address are updated.',
    `:if ([:len [/interface wireguard peers find comment="Connectly controller"]] = 0) do={ /interface wireguard peers add interface=${WG_INTERFACE} public-key="${ros(settings.controller_wg_public_key ?? '<controller-public-key>')}" endpoint-address=${host} endpoint-port=${port ?? '<port>'} allowed-address=${controllerIp}/32 persistent-keepalive=25s comment="Connectly controller" } else={ /interface wireguard peers set [find comment="Connectly controller"] interface=${WG_INTERFACE} public-key="${ros(settings.controller_wg_public_key ?? '<controller-public-key>')}" endpoint-address=${host} endpoint-port=${port ?? '<port>'} allowed-address=${controllerIp}/32 persistent-keepalive=25s }`,
    `:if ([:len [/ip address find comment="Connectly tunnel"]] = 0) do={ /ip address add address=${router.tunnel_ip ?? '<tunnel-ip>'}/${prefix} interface=${WG_INTERFACE} comment="Connectly tunnel" } else={ /ip address set [find comment="Connectly tunnel"] address=${router.tunnel_ip ?? '<tunnel-ip>'}/${prefix} interface=${WG_INTERFACE} }`,
    '',
    '# 3. Fetch and apply the rest of the configuration from the controller',
    '#    (API user and password, certificate, firewall, hotspot, walled garden).',
    ':delay 5s',
    `/tool fetch url="http://${controllerIp}:${BOOTSTRAP_PORT}/bootstrap/${router.id}" dst-path=connectly-bootstrap.rsc`,
    '/import file-name=connectly-bootstrap.rsc',
    '/file remove connectly-bootstrap.rsc',
  ].join('\n');

  return { ready: missing.length === 0, missing, script };
}

/** What the engineer runs on the router before registering it. */
export const PRE_REGISTRATION_STEPS = [
  `/interface wireguard add name=${WG_INTERFACE} listen-port=13231 comment="Connectly controller"`,
  `/interface wireguard print where name=${WG_INTERFACE}`,
].join('\n');
