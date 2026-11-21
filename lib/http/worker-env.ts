/**
 * Puts the Worker's settings into process.env the way OpenNext does for a
 * request (.open-next/cloudflare/init.js populateProcessEnv): the Worker's
 * variables and secrets first, then the public settings built into
 * next-env.mjs for the mode, without overwriting. Used by the scheduled
 * handler, which has no request to start OpenNext's context with.
 */
export function applyWorkerEnv(
  env: Record<string, unknown>,
  nextEnv: Record<string, Record<string, string> | undefined>,
  target: Record<string, string | undefined> = process.env
): void {
  for (const [key, value] of Object.entries(env)) if (typeof value === 'string') target[key] = value;
  const mode = typeof env.NEXTJS_ENV === 'string' ? env.NEXTJS_ENV : 'production';
  for (const [key, value] of Object.entries(nextEnv[mode] ?? {})) target[key] ??= value;
}
