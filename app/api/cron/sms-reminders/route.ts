import { secretMatches } from '@/lib/auth/shared-secret';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { sendTermiiSMS } from '@/lib/sms';

export async function GET(request: Request) {
  // Verify request is from Vercel Cron
  // Fails closed: if CRON_SECRET is unset, nobody can trigger this job.
  // (Before, the header "Bearer undefined" passed when the secret was missing.)
  const secret = process.env.CRON_SECRET;
  if (!secret || !secretMatches(request.headers.get('authorization'), `Bearer ${secret}`)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabaseAdmin = db;

  // Fetch recent purchases (e.g., from the last 30 days to optimize query)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: purchases } = await supabaseAdmin
    .from('purchases')
    .select('id, phone_number, created_at, plans(name, duration_seconds)')
    .eq('status', 'paid') // never text people who did not complete a payment
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (!purchases) return NextResponse.json({ success: true, processed: 0 });

  const now = new Date().getTime();
  let messagesSent = 0;

  for (const p of purchases) {
    const plan = Array.isArray(p.plans) ? p.plans[0] : p.plans;
    if (!plan || !p.phone_number) continue;

    const purchaseTime = new Date(p.created_at).getTime();
    const expiryTime = purchaseTime + (plan.duration_seconds * 1000);
    const timeRemainingMinutes = (expiryTime - now) / (1000 * 60);

    // 1. "About to Exhaust" Reminder (e.g., exactly between 30 and 90 minutes remaining)
    if (timeRemainingMinutes > 0 && timeRemainingMinutes <= 60) {
      const msg = `Connectly Alert: Your ${plan.name} will expire in less than an hour. Top up now at getconnectly.net to stay connected.`;
      await sendTermiiSMS(p.phone_number, msg);
      messagesSent++;
    }

    // 2. "Exhausted" Reminder (e.g., expired within the last 60 minutes)
    if (timeRemainingMinutes <= 0 && timeRemainingMinutes > -60) {
      const msg = `Connectly Alert: Your ${plan.name} has expired. Please visit getconnectly.net to purchase a new pass or data bundle.`;
      await sendTermiiSMS(p.phone_number, msg);
      messagesSent++;
    }
  }

  return NextResponse.json({ success: true, sent: messagesSent });
}