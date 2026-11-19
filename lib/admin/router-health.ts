import type { BadgeTone } from '@/components/ui/badge';

/** The controller checks every active router once a minute. A reading older
 *  than this means nobody has checked lately (usually the controller is not
 *  running), so the last stored status is no longer shown as current. */
export const HEALTH_STALE_MS = 5 * 60_000;

export type RouterHealth = { label: string; tone: BadgeTone; stale: boolean };

export function routerHealth(status: string | null, lastSeen: string | null, now: number): RouterHealth {
  if (!lastSeen) return { label: 'Never seen', tone: 'neutral', stale: true };
  if (now - Date.parse(lastSeen) > HEALTH_STALE_MS) return { label: 'No recent check', tone: 'warn', stale: true };
  if (status === 'online') return { label: 'Online', tone: 'ok', stale: false };
  if (status === 'degraded') return { label: 'Degraded', tone: 'warn', stale: false };
  return { label: 'Offline', tone: 'bad', stale: false };
}
