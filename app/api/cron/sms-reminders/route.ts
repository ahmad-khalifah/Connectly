import { secretMatches } from '@/lib/auth/shared-secret';
import { NextResponse } from 'next/server';
import { sendExpiryReminders } from '@/lib/notifications/reminders';

// Expiry reminders. Called every 10 minutes by the Network Controller (its
// APP_TICK_URL setting) and once a day by Vercel Cron as a backstop. Each
// reminder goes out at most once per purchase, however often this runs.
// Fails closed: with CRON_SECRET unset, nobody can trigger it.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secretMatches(request.headers.get('authorization'), `Bearer ${secret}`)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  try {
    const summary = await sendExpiryReminders();
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error('[REMINDERS_ERROR]', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
