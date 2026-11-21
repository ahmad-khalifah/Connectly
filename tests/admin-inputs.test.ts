import { describe, expect, it } from 'vitest';
import { parseLocationInput, parsePlanInput, planRow, planToInput, slugify, formatDuration } from '@/lib/admin/inputs';

const LOC = '7c42e724-0000-4000-8000-000000000001';
const base = { name: 'Day Pass', priceNaira: '500', durationMinutes: 1440, downloadMbps: '10', uploadMbps: 3 };

describe('parsePlanInput', () => {
  it('accepts a valid plan and keeps every speed column in step', () => {
    const r = parsePlanInput({ ...base, allowedLocationIds: [LOC, LOC] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.allowedLocationIds).toEqual([LOC]);
    const row = planRow(r.value);
    expect(row).toMatchObject({
      price_kobo: 50000, duration_seconds: 86400, duration_minutes: 1440,
      download_limit_kbps: 10240, download_speed: 10240, speed_down_mbps: 10,
      upload_limit_kbps: 3072, upload_speed: 3072, speed_up_mbps: 3, device_limit: 1, is_active: true,
    });
  });

  it('treats an empty location list as "every location"', () => {
    const r = parsePlanInput({ ...base, allowedLocationIds: [] });
    expect(r.ok && r.value.allowedLocationIds).toBeNull();
  });

  it.each([
    [{ ...base, name: '  ' }, 'name'],
    [{ ...base, priceNaira: 10 }, 'Price'],
    [{ ...base, priceNaira: 99.5 }, 'Price'],
    [{ ...base, durationMinutes: 5 }, 'Duration'],
    [{ ...base, downloadMbps: 0 }, 'Speeds'],
    [{ ...base, deviceLimit: 20 }, 'Device'],
    [{ ...base, dataLimitMb: -1 }, 'Data cap'],
    [{ ...base, allowedLocationIds: ['not-a-uuid'] }, 'location'],
  ])('rejects %o', (body, word) => {
    const r = parsePlanInput(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(word);
  });

  it('ignores columns the form does not offer', () => {
    const r = parsePlanInput({ ...base, organization_id: 'x', price_kobo: 1 });
    expect(r.ok && planRow(r.value).price_kobo).toBe(50000);
    expect(r.ok && 'organization_id' in planRow(r.value)).toBe(false);
  });

  it('reads legacy rows that only set one generation of speed columns', () => {
    expect(planToInput({ name: 'Old', price_kobo: 20000, duration_seconds: 3600, download_speed: 7168, upload_speed: 3072 }))
      .toMatchObject({ priceNaira: 200, durationMinutes: 60, downloadMbps: 7, uploadMbps: 3, allowedLocationIds: null, isActive: true });
    expect(planToInput({ name: 'Old', price_kobo: 1, duration_seconds: 60, speed_down_mbps: 5, speed_up_mbps: 2, is_active: false }))
      .toMatchObject({ downloadMbps: 5, uploadMbps: 2, isActive: false });
  });
});

describe('parseLocationInput', () => {
  it('derives the slug and normalises the contact phone', () => {
    const r = parseLocationInput({ name: 'Silver Hostel — Block B', contactPhone: '0803 123 4567', isActive: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ slug: 'silver-hostel-block-b', contactPhone: '2348031234567', isActive: false, status: 'active', locationType: 'campus_facility' });
  });

  it('rejects bad slugs, phones and institutions', () => {
    expect(parseLocationInput({ name: 'A', slug: 'Bad Slug' }).ok).toBe(false);
    expect(parseLocationInput({ name: 'A', contactPhone: '12345' }).ok).toBe(false);
    expect(parseLocationInput({ name: 'A', institutionId: 'x' }).ok).toBe(false);
    expect(parseLocationInput({ slug: 'a' }).ok).toBe(false);
  });

  it('falls back to safe defaults for unknown enum values', () => {
    const r = parseLocationInput({ name: 'A', status: 'hacked', locationType: 'nope' });
    expect(r.ok && [r.value.status, r.value.locationType]).toEqual(['active', 'campus_facility']);
  });
});

describe('helpers', () => {
  it('slugify and formatDuration', () => {
    expect(slugify('  Garki Market!! ')).toBe('garki-market');
    expect(formatDuration(60)).toBe('1 hour');
    expect(formatDuration(2880)).toBe('2 days');
    expect(formatDuration(90)).toBe('90 min');
  });
});

describe('plan speed shown in the console', () => {
  it('is the speed the controller enforces (speed_*_mbps) when older copies disagree', () => {
    // Like the staging seed: kbps columns say 7/3, the enforced columns say 5/2.
    expect(planToInput({ name: 'Seeded', price_kobo: 20000, duration_seconds: 3600, download_limit_kbps: 7168, upload_limit_kbps: 3072, speed_down_mbps: 5, speed_up_mbps: 2 }))
      .toMatchObject({ downloadMbps: 5, uploadMbps: 2 });
  });
});
