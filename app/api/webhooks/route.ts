import { NextResponse } from 'next/server';
import { sendTermiiSMS } from '@/app/actions/sms';

export async function POST(request: Request) {
  try {
    // Kora sends the payload as JSON
    const body = await request.json();
    
    // Log the incoming webhook to your terminal for debugging
    console.log("🔔 KORA WEBHOOK RECEIVED:", JSON.stringify(body, null, 2));

    // Kora successful payments send the 'charge.success' event
    if (body.event === 'charge.success') {
      const data = body.data;
      const metadata = data.metadata || {};
      
      const phone = metadata.customer_phone;
      const routerId = metadata.router_id;
      const planId = metadata.plan_id;
      const reference = data.reference;

      console.log(`Processing payment for Reference: ${reference}`);

      // TODO: 1. Verify Kora webhook signature (security)
      // TODO: 2. Update Supabase database record to 'paid'
      
      // 3. Generate MikroTik Voucher (Mocked for now)
      const voucherCode = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`Generated Wi-Fi Voucher [${voucherCode}] for Router [${routerId}]`);

      // 4. Send the SMS via Termii
      if (phone) {
        const smsText = `Payment successful! Your Connectly Wi-Fi PIN is: ${voucherCode}. Connect and enter this PIN to browse.`;
        await sendTermiiSMS(phone, smsText);
      }
    }

    // Always return a 200 OK fast so Kora knows you received it and doesn't retry
    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json({ status: 'error', message: 'Server error' }, { status: 500 });
  }
}