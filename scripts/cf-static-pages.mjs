// Serves the customer pages as plain files, so Cloudflare answers them from
// the assets folder without running the Worker (no CPU, and they do not
// count toward the free plan's daily requests).
//
// Next.js prerenders these pages at build time (they read the address in the
// browser). OpenNext would still route them through the Worker; copying the
// HTML into the assets folder lets Cloudflare serve /portal, /connect and
// /success directly. Their scripts and styles are already there (_next/static).

import { copyFileSync, existsSync, readFileSync } from 'node:fs';

const PAGES = ['portal', 'connect', 'success'];
const manifest = JSON.parse(readFileSync('.next/prerender-manifest.json', 'utf8'));

for (const page of PAGES) {
  const route = `/${page}`;
  const html = `.next/server/app/${page}.html`;
  if (!manifest.routes?.[route] || !existsSync(html)) {
    console.error(`cf-static-pages: ${route} was not prerendered, so it would be rendered on every request. Make it static again (no searchParams, cookies or headers on the server).`);
    process.exit(1);
  }
  copyFileSync(html, `.open-next/assets/${page}.html`);
}
console.log(`cf-static-pages: ${PAGES.map((p) => '/' + p).join(', ')} will be served as static files.`);
