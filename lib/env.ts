// Which environment we are running in, and guards that keep staging and
// production apart. Vercel sets VERCEL_ENV to "production" or "preview";
// anything else (local dev, tests) counts as "development".
//
// Rules enforced at the first database call (see lib/db/client.ts):
//   * Non-production code must never use the production Supabase project.
//   * Non-production code must never use a live Korapay key.
// Production with a Korapay TEST key is allowed (that is today's setup)
// but logged loudly, so it is visible until live keys are configured.

export type AppEnv = 'production' | 'preview' | 'development';

/** Project ref of the live Supabase database (Connectly, eu-west-1). */
export const PRODUCTION_SUPABASE_REF = 'plydltvxfozxflarrfrx';

export class EnvironmentError extends Error {}

export function appEnv(): AppEnv {
  const v = process.env.VERCEL_ENV;
  return v === 'production' || v === 'preview' ? v : 'development';
}

/** Public base URL for Korapay redirect and webhook URLs. */
export function appUrl(): string {
  const strip = (u: string) => u.replace(/\/+$/, '');
  // Each preview branch gets a stable URL from Vercel; use it so test
  // payments return to (and notify) the same preview, never production.
  if (appEnv() === 'preview' && process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;
  if (process.env.NEXT_PUBLIC_APP_URL) return strip(process.env.NEXT_PUBLIC_APP_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:3000';
}

export function koraKeyMode(key = process.env.KORA_SECRET_KEY): 'live' | 'test' | 'missing' | 'unknown' {
  if (!key) return 'missing';
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  return 'unknown';
}

let checked = false;

/** Throws if this deployment is wired to the wrong database or payment keys. */
export function assertSafeEnvironment(): void {
  if (checked) return;
  const env = appEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const kora = koraKeyMode();

  if (env !== 'production') {
    if (supabaseUrl.includes(PRODUCTION_SUPABASE_REF) && process.env.ALLOW_PRODUCTION_DB_OUTSIDE_PRODUCTION !== 'true') {
      throw new EnvironmentError(
        `Refusing to use the PRODUCTION database from a ${env} deployment. Point NEXT_PUBLIC_SUPABASE_URL and keys at the staging project.`
      );
    }
    if (kora === 'live') {
      throw new EnvironmentError(`Refusing to use a LIVE Korapay key in a ${env} deployment. Use sk_test_ keys outside production.`);
    }
  } else if (kora === 'test') {
    console.warn('[ENV] Production is using a Korapay TEST key. No real money will be collected.');
  }
  checked = true;
}
