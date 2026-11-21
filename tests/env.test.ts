import { describe, it, expect, beforeEach, vi } from 'vitest';

const PROD_URL = 'https://plydltvxfozxflarrfrx.supabase.co';
const STAGING_URL = 'https://stagingref123.supabase.co';

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const k of ['APP_ENV', 'VERCEL_ENV', 'NEXT_PUBLIC_SUPABASE_URL', 'KORA_SECRET_KEY', 'NEXT_PUBLIC_APP_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'ALLOW_PRODUCTION_DB_OUTSIDE_PRODUCTION', 'VERCEL_AUTOMATION_BYPASS_SECRET']) delete process.env[k];
  Object.assign(process.env, env);
  return import('@/lib/env');
}

describe('environment guard', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('blocks a preview deployment pointed at the production database', async () => {
    const env = await load({ VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: PROD_URL, KORA_SECRET_KEY: 'sk_test_x' });
    expect(() => env.assertSafeEnvironment()).toThrow(/PRODUCTION database/);
  });
  it('blocks a live Korapay key outside production', async () => {
    const env = await load({ VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: STAGING_URL, KORA_SECRET_KEY: 'sk_live_x' });
    expect(() => env.assertSafeEnvironment()).toThrow(/LIVE Korapay key/);
  });
  it('blocks local development against production too', async () => {
    const env = await load({ NEXT_PUBLIC_SUPABASE_URL: PROD_URL });
    expect(() => env.assertSafeEnvironment()).toThrow(/development deployment/);
  });
  it('allows preview with staging + sandbox keys', async () => {
    const env = await load({ VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: STAGING_URL, KORA_SECRET_KEY: 'sk_test_x' });
    expect(() => env.assertSafeEnvironment()).not.toThrow();
  });
  it('allows production with the production database and warns on a test key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = await load({ VERCEL_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: PROD_URL, KORA_SECRET_KEY: 'sk_test_x' });
    expect(() => env.assertSafeEnvironment()).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/TEST key/));
  });
});

describe('APP_ENV (hosts other than Vercel, such as Cloudflare Workers)', () => {
  it('reads production and preview from APP_ENV', async () => {
    expect((await load({ APP_ENV: 'production' })).appEnv()).toBe('production');
    expect((await load({ APP_ENV: 'preview' })).appEnv()).toBe('preview');
  });
  it('takes precedence over VERCEL_ENV', async () => {
    expect((await load({ APP_ENV: 'preview', VERCEL_ENV: 'production' })).appEnv()).toBe('preview');
  });
  it('treats an unknown value as development, the most restrictive setting', async () => {
    const env = await load({ APP_ENV: 'prod', NEXT_PUBLIC_SUPABASE_URL: PROD_URL });
    expect(env.appEnv()).toBe('development');
    expect(() => env.assertSafeEnvironment()).toThrow(/PRODUCTION database/);
  });
  it('blocks an APP_ENV preview pointed at the production database', async () => {
    const env = await load({ APP_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: PROD_URL, KORA_SECRET_KEY: 'sk_test_x' });
    expect(() => env.assertSafeEnvironment()).toThrow(/PRODUCTION database/);
  });
  it('uses NEXT_PUBLIC_APP_URL for a preview with no Vercel branch URL', async () => {
    const env = await load({ APP_ENV: 'preview', NEXT_PUBLIC_APP_URL: 'https://connectly-web.example.workers.dev/' });
    expect(env.appUrl()).toBe('https://connectly-web.example.workers.dev');
    expect(env.korapayWebhookUrl()).toBe('https://connectly-web.example.workers.dev/api/webhooks/kora');
  });
});

describe('appUrl', () => {
  it('uses the stable branch URL on previews, never production', async () => {
    const env = await load({ VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'connectly-git-x.vercel.app', NEXT_PUBLIC_APP_URL: 'https://getconnectly.net' });
    expect(env.appUrl()).toBe('https://connectly-git-x.vercel.app');
  });
  it('uses NEXT_PUBLIC_APP_URL in production', async () => {
    const env = await load({ VERCEL_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://getconnectly.net/' });
    expect(env.appUrl()).toBe('https://getconnectly.net');
  });
});

describe('korapayWebhookUrl', () => {
  it('adds the Vercel bypass token on previews so Korapay reaches the protected preview', async () => {
    const env = await load({ VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'connectly-git-x.vercel.app', VERCEL_AUTOMATION_BYPASS_SECRET: 'abc123' });
    expect(env.korapayWebhookUrl()).toBe('https://connectly-git-x.vercel.app/api/webhooks/kora?x-vercel-protection-bypass=abc123');
  });
  it('never adds it in production, even if the variable exists', async () => {
    const env = await load({ VERCEL_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://getconnectly.net', VERCEL_AUTOMATION_BYPASS_SECRET: 'abc123' });
    expect(env.korapayWebhookUrl()).toBe('https://getconnectly.net/api/webhooks/kora');
  });
  it('plain URL on a preview without a token', async () => {
    const env = await load({ VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'connectly-git-x.vercel.app' });
    expect(env.korapayWebhookUrl()).toBe('https://connectly-git-x.vercel.app/api/webhooks/kora');
  });
});
