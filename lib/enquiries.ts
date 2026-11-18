// Website enquiries from organisations that want managed WiFi at a site.
// Stored as support tickets (category "other") so they appear on the admin
// Support page without a new table. The subject starts with a fixed tag so
// they are easy to tell apart from customer problems.

export const ENQUIRY_TAG = '[WiFi for your site]';

export const SITE_TYPES = ['Market or shopping centre', 'University or college', 'Student accommodation', 'School', 'Estate or housing', 'Office or business', 'Event or conference', 'Community or public space', 'Other'] as const;
export const USER_RANGES = ['Under 100 people a day', '100 to 500 people a day', '500 to 2,000 people a day', 'More than 2,000 people a day', 'Not sure yet'] as const;

export type Enquiry = {
  name: string;
  organisation: string;
  email: string;
  phone: string | null;
  message: string;
  siteType?: string;
  siteLocation?: string;
  users?: string;
};

type Parsed = { ok: true; value: Enquiry } | { ok: false; error: string; field?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const longText = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');
const oneOf = <T extends readonly string[]>(list: T, v: unknown): string | undefined => (typeof v === 'string' && (list as readonly string[]).includes(v) ? v : undefined);

/** Minimum seconds between the form opening and sending; bots post instantly. */
export const MIN_FILL_SECONDS = 3;

export function parseEnquiry(body: unknown, now = Date.now()): Parsed | { ok: false; spam: true } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Missing details.' };
  const b = body as Record<string, unknown>;

  // Honeypot (a field people never see) and fill time: quietly accept and drop.
  if (typeof b.website === 'string' && b.website.trim() !== '') return { ok: false, spam: true };
  const started = Number(b.startedAt);
  if (!Number.isFinite(started) || now - started < MIN_FILL_SECONDS * 1000) return { ok: false, spam: true };

  const name = text(b.name, 120);
  if (name.length < 2) return { ok: false, error: 'Enter your name.', field: 'name' };
  const organisation = text(b.organisation, 160);
  if (organisation.length < 2) return { ok: false, error: 'Enter your organisation or site name.', field: 'organisation' };
  const email = text(b.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter an email address we can reply to.', field: 'email' };
  const phone = text(b.phone, 30) || null;
  if (phone && !/^[+\d][\d\s()-]{6,}$/.test(phone)) return { ok: false, error: 'Check the phone number.', field: 'phone' };
  const message = longText(b.message, 3000);
  if (message.length < 10) return { ok: false, error: 'Tell us a little about the site (at least a sentence).', field: 'message' };

  return {
    ok: true,
    value: {
      name, organisation, email, phone, message,
      siteType: oneOf(SITE_TYPES, b.siteType),
      siteLocation: text(b.siteLocation, 200) || undefined,
      users: oneOf(USER_RANGES, b.users),
    },
  };
}

/** The support ticket an enquiry becomes. */
export function enquiryTicket(e: Enquiry): { category: 'other'; subject: string; description: string } {
  const lines = [
    `From: ${e.name}, ${e.organisation}`,
    `Email: ${e.email}`,
    `Phone: ${e.phone ?? 'not given'}`,
    `Type of site: ${e.siteType ?? 'not given'}`,
    `Where: ${e.siteLocation ?? 'not given'}`,
    `People a day: ${e.users ?? 'not given'}`,
    '',
    e.message,
  ];
  return { category: 'other', subject: `${ENQUIRY_TAG} ${e.organisation}`.slice(0, 200), description: lines.join('\n') };
}
