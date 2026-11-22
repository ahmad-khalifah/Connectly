// Serves pages as plain files, so Cloudflare answers them from the assets
// folder without running the Worker (no CPU, and they do not count toward
// the free plan's daily requests).
//
// Next.js prerenders these pages at build time (they read the address and
// load their data in the browser). OpenNext would still route them through
// the Worker; copying the HTML into the assets folder lets Cloudflare serve
// them directly. Their scripts and styles are already there (_next/static).
//
// Every admin page must be static: the build fails if one is not, because a
// page rendered per request would exceed the free plan's CPU limit.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const PUBLIC = ['/', '/about', '/solutions', '/industries', '/partnerships', '/contact', '/portal', '/connect', '/success', '/login'];
const manifest = JSON.parse(readFileSync('.next/prerender-manifest.json', 'utf8'));
const appPaths = JSON.parse(readFileSync('.next/server/app-paths-manifest.json', 'utf8'));

// Every admin page route, from the build (e.g. "/admin/plans/new/page" -> "/admin/plans/new").
const adminPages = Object.keys(appPaths)
  .filter((k) => k.endsWith('/page') && (k === '/admin/page' || k.startsWith('/admin/')))
  .map((k) => k.slice(0, -'/page'.length));

const problems = [];
const copied = [];
for (const route of [...PUBLIC, ...adminPages]) {
  const file = route === '/' ? 'index' : route.slice(1);
  const html = `.next/server/app/${file}.html`;
  if (!manifest.routes?.[route]) {
    problems.push(`${route} is rendered on every request (it reads searchParams, params, cookies or headers on the server). Make it static.`);
    continue;
  }
  if (!existsSync(html)) continue; // a static redirect (e.g. /admin/apis): no page to copy, answered by Next.js
  const to = `.open-next/assets/${file}.html`;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(html, to);
  copied.push(route);
}
if (problems.length) {
  console.error(['cf-static-pages: STOPPED.', ...problems.map((p) => `  ${p}`)].join('\n'));
  process.exit(1);
}
console.log(`cf-static-pages: ${copied.length} pages will be served as static files: ${copied.join(', ')}.`);
