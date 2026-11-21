// Serves the customer pages, the public home and /wifi pages, sign-in and
// the converted admin pages as plain files, so Cloudflare answers them from
// the assets folder without running the Worker (no CPU, and they do not
// count toward the free plan's daily requests).
//
// Next.js prerenders these pages at build time (they read the address in the
// browser). OpenNext would still route them through the Worker; copying the
// HTML into the assets folder lets Cloudflare serve /portal, /connect,
// /success, / and /wifi directly. Their scripts and styles are already there (_next/static).

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

// [route, file name in .next/server/app and in the assets folder]
const PAGES = [
  ['/portal', 'portal'], ['/connect', 'connect'], ['/success', 'success'], ['/', 'index'], ['/wifi', 'wifi'],
  // Admin pages (their data comes from /api/admin/view/*, checked per request) and sign-in.
  ['/login', 'login'], ['/admin', 'admin'], ['/admin/customer', 'admin/customer'],
];
const manifest = JSON.parse(readFileSync('.next/prerender-manifest.json', 'utf8'));

for (const [route, page] of PAGES) {
  const html = `.next/server/app/${page}.html`;
  if (!manifest.routes?.[route] || !existsSync(html)) {
    console.error(`cf-static-pages: ${route} was not prerendered, so it would be rendered on every request. Make it static again (no searchParams, cookies or headers on the server).`);
    process.exit(1);
  }
  const to = `.open-next/assets/${page}.html`;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(html, to);
}
console.log(`cf-static-pages: ${PAGES.map(([r]) => r).join(', ')} will be served as static files.`);
