import { timingSafeEqual } from 'crypto';

/**
 * Constant-time comparison of a presented secret with the expected one.
 * Fails closed: an unset or empty expected secret never matches.
 */
export function secretMatches(presented: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
