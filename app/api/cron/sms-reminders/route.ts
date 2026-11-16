import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTermiiSMS } from '@/lib/sms';

export async function GET(request: Request) {
  // Verify request is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch recent purchases (e.g., from the last 30 days to optimize query)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: purchases } = await supabaseAdmin
    .from('purchases')
    .select('id, phone_number, created_at, plans(name, duration_seconds)')
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
    // You must flag rows in the DB if an SMS was already sent to avoid spamming them every hour.
    // For MVP, you can filter strictly by the time window.
    if (timeRemainingMinutes > 0 && timeRemainingMinutes <= 60) {
      const msg = `Connectly Alert: Your ${plan.name} will expire in less than an hour. Top up now at connectly.net/login to stay connected.`;
      await sendTermiiSMS(...{
        to: p.phone_number,
        message: msg,
      });
      messagesSent++;
    }

    // 2. "Exhausted" Reminder (e.g., expired within the last 60 minutes)
    if (timeRemainingMinutes <= 0 && timeRemainingMinutes > -60) {
      const msg = `Connectly Alert: Your ${plan.name} has expired. Please visit connectly.net/login to purchase a new pass or data bundle.`;
      await sendTermiiSMS(...{
        to: p.phone_number,
        message: msg,
      });
      messagesSent++;
    }
  }

  return NextResponse.json({ success: true, sent: messagesSent });
}