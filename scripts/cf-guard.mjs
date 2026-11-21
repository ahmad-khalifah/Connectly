// Keeps secrets out of the Cloudflare build.
//
// OpenNext copies the values in .env, .env.production, .env.local and
// .env.production.local into the Worker's code (.open-next/cloudflare/next-env.mjs),
// where anyone who can download the deployed code could read them. Secrets
// belong in `wrangler secret put` only. This check runs before the build
// (on the .env files) and after it (on what was actually built), and stops
// the build if anything but public settings would be included.
//
// Prints key names only, never values.
//
//   node scripts/cf-guard.mjs          check the .env files
//   node scripts/cf-guard.mjs --built  check .open-next/cloudflare/next-env.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs';

const ALLOWED = (key) => key.startsWith('NEXT_PUBLIC_') || key === 'ADMIN_EMAILS';
const BUILT = '.open-next/cloudflare/next-env.mjs';

function fail(lines) {
  console.error(['', 'cf-guard: STOPPED. This would put secrets into the Worker code:', ...lines, ''].join('\n'));
  process.exit(1);
}

if (process.argv.includes('--built')) {
  if (!existsSync(BUILT)) fail([`  ${BUILT} is missing (did the build run?)`]);
  const keys = [...new Set(readFileSync(BUILT, 'utf8').match(/"[A-Z][A-Z0-9_]+"(?=\s*:)/g) ?? [])].map((k) => k.slice(1, -1));
  const bad = keys.filter((k) => !ALLOWED(k));
  if (bad.length) fail(bad.map((k) => `  ${k} is in the built Worker. Delete .open-next, fix the .env files, build again.`));
  console.log(`cf-guard: built Worker contains only public settings (${keys.sort().join(', ') || 'none'}).`);
} else {
  const files = readdirSync('.').filter((f) => /^\.env(\..+)?$/.test(f) && f !== '.env.example');
  const bad = [];
  for (const f of files) {
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (m && !ALLOWED(m[1])) bad.push(`  ${m[1]} in ${f}`);
    }
  }
  if (bad.length) {
    fail([
      ...bad,
      '',
      'Move those files out of this folder for the build (for example: mv .env.local ~/connectly-env-local-moved),',
      'put public settings in .env.production.local, and set secrets with: npx wrangler secret put NAME',
    ]);
  }
  console.log(`cf-guard: .env files hold only public settings (${files.join(', ') || 'no .env files'}).`);
}
