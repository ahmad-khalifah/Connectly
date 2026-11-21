// Client-safe: no server imports.

const OURS = /^CONN_[0-9a-f-]{36}$/i;

/**
 * Our payment reference (CONN_<uuid>) from the return address. Korapay
 * appends its own ?reference= to our redirect URL, so the page can receive
 * the parameter twice (found on staging, 18 Nov 2026).
 */
export function ourReference(values: readonly string[]): string | null {
  return values.find((r) => OURS.test(r)) ?? null;
}
