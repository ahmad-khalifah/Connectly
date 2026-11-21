import { describe, it, expect } from 'vitest';
import { routerHealth, HEALTH_STALE_MS } from '@/lib/admin/router-health';

const NOW = Date.parse('2026-11-19T06:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('routerHealth', () => {
  it('shows the stored status while the check is recent', () => {
    expect(routerHealth('online', ago(60_000), NOW)).toMatchObject({ label: 'Online', tone: 'ok', stale: false });
    expect(routerHealth('offline', ago(60_000), NOW)).toMatchObject({ label: 'Offline', tone: 'bad' });
    expect(routerHealth('degraded', ago(60_000), NOW).label).toBe('Degraded');
  });
  it('does not call a router online when nobody has checked it for 5 minutes', () => {
    expect(routerHealth('online', ago(HEALTH_STALE_MS + 1000), NOW)).toMatchObject({ label: 'No recent check', tone: 'warn', stale: true });
    expect(routerHealth('online', ago(10 * 3_600_000), NOW).label).toBe('No recent check');
  });
  it('says never seen when there is no check at all', () => {
    expect(routerHealth('online', null, NOW)).toMatchObject({ label: 'Never seen', stale: true });
  });
});
