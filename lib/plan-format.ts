// How a plan reads to a customer. Shared by the portal and the admin.

/** "1 day", "3 hours", "30 minutes". */
export function planDuration(sec: number | null | undefined): string | null {
  if (!sec || sec <= 0) return null;
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (sec % 604800 === 0) return unit(sec / 604800, 'week');
  if (sec % 86400 === 0) return unit(sec / 86400, 'day');
  if (sec % 3600 === 0) return unit(sec / 3600, 'hour');
  return unit(Math.round(sec / 60), 'minute');
}

/** "Unlimited data" or "2 GB data" / "500 MB data". */
export function planData(mb: number | null | undefined): string {
  if (!mb || mb <= 0) return 'Unlimited data';
  if (mb >= 1024 && mb % 1024 === 0) return `${mb / 1024} GB data`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB data`;
  return `${mb} MB data`;
}

export function planDevices(n: number | null | undefined): string {
  const d = Math.max(1, n ?? 1);
  return `${d} device${d === 1 ? '' : 's'}`;
}

export function planSpeed(mbps: number | null | undefined): string | null {
  return mbps && mbps > 0 ? `Up to ${mbps} Mbps` : null;
}

const THIRTY_DAYS_SECONDS = 30 * 86400;

/**
 * The plan the portal marks "Recommended": the 30-day plan for one device
 * (the cheapest, if there are several). Decided here from the plan's own
 * duration and device limit, so it follows the plan if its name or price changes.
 */
export function recommendedPlanId(
  plans: { id: string; price_kobo: number; duration_seconds: number | null; device_limit: number | null }[],
): string | null {
  const matches = plans
    .filter((p) => p.duration_seconds === THIRTY_DAYS_SECONDS && Math.max(1, p.device_limit ?? 1) === 1)
    .sort((a, b) => a.price_kobo - b.price_kobo);
  return matches[0]?.id ?? null;
}

export function naira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}
