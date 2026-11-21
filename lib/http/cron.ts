import { secretMatches } from '@/lib/auth/shared-secret';
import { sendDueTexts, checkOnePending, TEXTS_PER_RUN } from '@/lib/notifications/sms-queue';

// Scheduled work.
//
// On Cloudflare a Cron Trigger (wrangler.jsonc "triggers") runs every minute
// and runScheduled does one slice: even minutes send due texts, odd minutes
// re-check one pending checkout. Two small slices rather than one, so a run
// stays inside Workers Free's 10 ms of CPU.
//
// GET /api/cron/sms-reminders sends due texts too, for callers on a timer of
// their own (the Network Controller's APP_TICK_URL, Vercel Cron). Fails
// closed: with CRON_SECRET unset, nobody can call it.

export type ScheduledResult =
  | ({ task: 'texts' } & Awaited<ReturnType<typeof sendDueTexts>>)
  | ({ task: 'pending' } & Awaited<ReturnType<typeof checkOnePending>>);

export async function runScheduled(scheduledTime: number): Promise<ScheduledResult> {
  const minute = Math.floor(scheduledTime / 60_000);
  if (minute % 2 === 0) return { task: 'texts', ...(await sendDueTexts({ now: new Date(scheduledTime) })) };
  return { task: 'pending', ...(await checkOnePending(Math.floor(minute / 2))) };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function handleCronTexts(request: Request, limit = TEXTS_PER_RUN): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secretMatches(request.headers.get('authorization'), `Bearer ${secret}`)) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    return json({ success: true, ...(await sendDueTexts({ limit })) });
  } catch (error) {
    console.error('[CRON_TEXTS_ERROR]', error);
    return json({ success: false }, 500);
  }
}

export function cronRoute(method: string, pathname: string): ((request: Request) => Promise<Response>) | null {
  if (pathname === '/api/cron/sms-reminders' && method === 'GET') return (r) => handleCronTexts(r);
  return null;
}
