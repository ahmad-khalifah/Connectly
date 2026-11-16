/**
 * Normalises a Nigerian mobile number to international form without "+".
 * Accepts 080..., 23480..., +234 80..., with spaces, dashes or brackets.
 * Returns null for anything that is not a Nigerian mobile number.
 */
export function normaliseNigerianMobile(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[\s()-]/g, '').replace(/^\+/, '');
  const local = digits.startsWith('234') ? '0' + digits.slice(3) : digits;
  return /^0[789][01]\d{8}$/.test(local) ? '234' + local.slice(1) : null;
}
