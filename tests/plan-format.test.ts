import { describe, expect, it } from 'vitest';
import { recommendedPlanId } from '@/lib/plan-format';

const DAY = 86400;
const plan = (id: string, price_kobo: number, days: number, device_limit: number | null) =>
  ({ id, price_kobo, duration_seconds: days * DAY, device_limit });

describe('recommendedPlanId', () => {
  it('picks the 30-day single-device plan, not the two-device one', () => {
    const plans = [plan('day', 35000, 1, 1), plan('d15', 450000, 15, 1), plan('d30', 800000, 30, 1), plan('duo', 1200000, 30, 2)];
    expect(recommendedPlanId(plans)).toBe('d30');
  });

  it('treats a missing device limit as one device', () => {
    expect(recommendedPlanId([plan('d30', 800000, 30, null)])).toBe('d30');
  });

  it('takes the cheapest when several match', () => {
    expect(recommendedPlanId([plan('b', 900000, 30, 1), plan('a', 800000, 30, 1)])).toBe('a');
  });

  it('marks nothing when no plan fits', () => {
    expect(recommendedPlanId([plan('day', 35000, 1, 1), plan('duo', 1200000, 30, 2)])).toBeNull();
    expect(recommendedPlanId([])).toBeNull();
    expect(recommendedPlanId([{ id: 'x', price_kobo: 1, duration_seconds: null, device_limit: 1 }])).toBeNull();
  });
});
