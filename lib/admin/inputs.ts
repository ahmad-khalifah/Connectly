// Server-side validation for admin create/edit forms.
// Every admin write goes through these, so the browser can never set a column
// the form does not offer, and the three generations of plan speed columns
// (download_limit_kbps, download_speed, speed_down_mbps) always agree.

import { normaliseNigerianMobile } from '@/lib/phone';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function slugify(input: string): string {
  return input.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 100);
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t.slice(0, max);
}

function int(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
}

// ---------------------------------------------------------------- plans

export type PlanInput = {
  name: string;
  priceNaira: number;
  durationMinutes: number;
  downloadMbps: number;
  uploadMbps: number;
  deviceLimit: number;
  dataLimitMb: number | null;
  allowedLocationIds: string[] | null; // null = every location
  isActive: boolean;
};

export function parsePlanInput(body: unknown): Parsed<PlanInput> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' };
  const b = body as Record<string, unknown>;

  const name = text(b.name, 100);
  if (!name) return { ok: false, error: 'Plan name is required.' };

  const priceNaira = int(b.priceNaira);
  if (priceNaira === null || priceNaira < 50 || priceNaira > 1_000_000)
    return { ok: false, error: 'Price must be a whole number of naira between ₦50 and ₦1,000,000.' };

  const durationMinutes = int(b.durationMinutes);
  if (durationMinutes === null || durationMinutes < 15 || durationMinutes > 60 * 24 * 366)
    return { ok: false, error: 'Duration must be between 15 minutes and 366 days.' };

  const downloadMbps = int(b.downloadMbps);
  const uploadMbps = int(b.uploadMbps);
  if (downloadMbps === null || downloadMbps < 1 || downloadMbps > 1000 || uploadMbps === null || uploadMbps < 1 || uploadMbps > 1000)
    return { ok: false, error: 'Speeds must be whole Mbps between 1 and 1000.' };

  const deviceLimit = b.deviceLimit === undefined || b.deviceLimit === '' ? 1 : int(b.deviceLimit);
  if (deviceLimit === null || deviceLimit < 1 || deviceLimit > 10)
    return { ok: false, error: 'Device limit must be between 1 and 10.' };

  let dataLimitMb: number | null = null;
  if (b.dataLimitMb !== undefined && b.dataLimitMb !== null && b.dataLimitMb !== '') {
    dataLimitMb = int(b.dataLimitMb);
    if (dataLimitMb === null || dataLimitMb < 1) return { ok: false, error: 'Data cap must be a positive number of MB, or empty for unlimited.' };
  }

  let allowedLocationIds: string[] | null = null;
  if (Array.isArray(b.allowedLocationIds) && b.allowedLocationIds.length > 0) {
    if (!b.allowedLocationIds.every(isUuid)) return { ok: false, error: 'Invalid location selection.' };
    allowedLocationIds = Array.from(new Set(b.allowedLocationIds as string[]));
  }

  return {
    ok: true,
    value: { name, priceNaira, durationMinutes, downloadMbps, uploadMbps, deviceLimit, dataLimitMb, allowedLocationIds, isActive: b.isActive !== false },
  };
}

/** Columns written for a plan. Keeps every legacy speed column in step. */
export function planRow(p: PlanInput) {
  const downKbps = p.downloadMbps * 1024;
  const upKbps = p.uploadMbps * 1024;
  return {
    name: p.name,
    price_kobo: p.priceNaira * 100,
    duration_seconds: p.durationMinutes * 60,
    duration_minutes: p.durationMinutes,
    download_limit_kbps: downKbps, // older copy, kept in step
    upload_limit_kbps: upKbps,
    download_speed: downKbps,      // legacy admin columns
    upload_speed: upKbps,
    speed_down_mbps: p.downloadMbps, // what the controller enforces on the router
    speed_up_mbps: p.uploadMbps,
    device_limit: p.deviceLimit,
    data_limit_mb: p.dataLimitMb,
    allowed_location_ids: p.allowedLocationIds,
    is_active: p.isActive,
  };
}

/**
 * Reads a plan row back into form values. speed_*_mbps comes first: it is what
 * the controller puts on the router (rate limit), so the admin sees what
 * customers actually get. The kbps columns are older copies kept in step.
 */
export function planToInput(row: Record<string, unknown>): PlanInput {
  const kbps = (a: unknown, b: unknown, mbps: unknown) =>
    Number(mbps) > 0 ? Number(mbps) : Number(a) > 0 ? Math.round(Number(a) / 1024) : Number(b) > 0 ? Math.round(Number(b) / 1024) : 1;
  return {
    name: String(row.name ?? ''),
    priceNaira: Math.round(Number(row.price_kobo ?? 0) / 100),
    durationMinutes: Number(row.duration_minutes) > 0 ? Number(row.duration_minutes) : Math.round(Number(row.duration_seconds ?? 0) / 60),
    downloadMbps: kbps(row.download_limit_kbps, row.download_speed, row.speed_down_mbps),
    uploadMbps: kbps(row.upload_limit_kbps, row.upload_speed, row.speed_up_mbps),
    deviceLimit: Number(row.device_limit) || 1,
    dataLimitMb: row.data_limit_mb == null ? null : Number(row.data_limit_mb),
    allowedLocationIds: Array.isArray(row.allowed_location_ids) && row.allowed_location_ids.length ? (row.allowed_location_ids as string[]) : null,
    isActive: row.is_active !== false,
  };
}

export function formatDuration(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'}`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'}`;
  return `${minutes} min`;
}

// ---------------------------------------------------------------- locations

export const LOCATION_TYPES = ['campus_facility', 'hostel', 'market', 'office', 'public_space', 'other'] as const;
export const LOCATION_STATUSES = ['active', 'degraded', 'offline'] as const;

export type LocationInput = {
  name: string;
  slug: string;
  building: string | null;
  address: string | null;
  contactPhone: string | null;
  locationType: string;
  status: (typeof LOCATION_STATUSES)[number];
  isActive: boolean;
  institutionId: string | null;
};

export function parseLocationInput(body: unknown): Parsed<LocationInput> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' };
  const b = body as Record<string, unknown>;

  const name = text(b.name, 255);
  if (!name) return { ok: false, error: 'Location name is required.' };

  const slug = text(b.slug, 100) ?? slugify(name);
  if (!SLUG_RE.test(slug)) return { ok: false, error: 'Slug may only contain lowercase letters, numbers and single hyphens.' };

  let contactPhone: string | null = null;
  const rawPhone = text(b.contactPhone, 30);
  if (rawPhone) {
    contactPhone = normaliseNigerianMobile(rawPhone);
    if (!contactPhone) return { ok: false, error: 'Contact phone must be a Nigerian mobile number.' };
  }

  const locationType = typeof b.locationType === 'string' && (LOCATION_TYPES as readonly string[]).includes(b.locationType) ? b.locationType : 'campus_facility';
  const status = typeof b.status === 'string' && (LOCATION_STATUSES as readonly string[]).includes(b.status)
    ? (b.status as LocationInput['status']) : 'active';

  let institutionId: string | null = null;
  if (b.institutionId) {
    if (!isUuid(b.institutionId)) return { ok: false, error: 'Invalid institution.' };
    institutionId = b.institutionId;
  }

  return {
    ok: true,
    value: {
      name, slug, building: text(b.building, 100), address: text(b.address, 500), contactPhone,
      locationType, status, isActive: b.isActive !== false, institutionId,
    },
  };
}

export function locationRow(l: LocationInput) {
  return {
    name: l.name,
    slug: l.slug,
    building: l.building,
    address: l.address,
    contact_phone: l.contactPhone,
    location_type: l.locationType,
    status: l.status,
    is_active: l.isActive,
    institution_id: l.institutionId,
  };
}

/** Postgres unique-violation → a message the admin can act on. */
export function friendlyDbError(error: { code?: string; message?: string } | null, fallback: string): string {
  if (!error) return fallback;
  if (error.code === '23505') return 'That slug is already used by another location.';
  if (error.code === '23503') return 'A linked record does not exist.';
  return fallback;
}

// ---------------------------------------------------------------- expenses

/** Matches the CHECK constraint on public.expenses.category. */
export const EXPENSE_CATEGORIES = ['backhaul', 'equipment', 'installation', 'repairs', 'power', 'staff', 'marketing', 'software', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseInput = {
  category: ExpenseCategory;
  amountNaira: number;
  locationId: string | null;
  description: string;
  expenseDate: string; // YYYY-MM-DD
};

/** Today's date in Lagos as YYYY-MM-DD. */
export function lagosToday(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
}

export function parseExpenseInput(body: unknown, now = new Date()): Parsed<ExpenseInput> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Missing expense details.' };
  const b = body as Record<string, unknown>;

  const category = String(b.category ?? '');
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: 'Choose a category.' };

  const amount = typeof b.amountNaira === 'number' ? b.amountNaira : Number(String(b.amountNaira ?? '').replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return { ok: false, error: 'Amount must be more than ₦0 and at most ₦100,000,000.' };
  if (Math.round(amount * 100) !== amount * 100) return { ok: false, error: 'Amount can have at most 2 decimal places (kobo).' };

  const description = String(b.description ?? '').trim();
  if (description.length < 3 || description.length > 300) return { ok: false, error: 'Description must be 3 to 300 characters.' };

  const expenseDate = String(b.expenseDate ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || Number.isNaN(Date.parse(`${expenseDate}T00:00:00Z`))) return { ok: false, error: 'Enter the expense date.' };
  if (expenseDate > lagosToday(now)) return { ok: false, error: 'Expense date cannot be in the future.' };
  if (expenseDate < '2020-01-01') return { ok: false, error: 'Expense date is too far in the past.' };

  const rawLoc = b.locationId;
  let locationId: string | null = null;
  if (rawLoc !== undefined && rawLoc !== null && rawLoc !== '') {
    if (!isUuid(rawLoc)) return { ok: false, error: 'Unknown location.' };
    locationId = rawLoc;
  }

  return { ok: true, value: { category: category as ExpenseCategory, amountNaira: amount, locationId, description, expenseDate } };
}

export function expenseRow(e: ExpenseInput, recordedBy: string) {
  return {
    category: e.category,
    amount_ngn: e.amountNaira,
    location_id: e.locationId,
    description: e.description,
    expense_date: e.expenseDate,
    recorded_by: recordedBy,
  };
}
