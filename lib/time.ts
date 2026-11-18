/**
 * The current time, for server components that render once per request
 * (where reading the clock in render is correct). Client components should
 * keep time in state or effects instead.
 */
export function requestTime(): number {
  return Date.now();
}
