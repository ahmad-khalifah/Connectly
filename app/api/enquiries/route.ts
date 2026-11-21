import { db } from '@/lib/db/client';
import { enquiryTicket, parseEnquiry } from '@/lib/enquiries';

// Public: the website's site enquiry form. Stores the enquiry as a support
// ticket and returns its number. No personal data is returned. On Cloudflare
// the Worker's front door calls this handler directly (lib/http/customer-api.ts).
export async function POST(req: Request) {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > 20_000) return Response.json({ message: 'That is too long to send.' }, { status: 413 });

  const parsed = parseEnquiry(await req.json().catch(() => null));
  if (!parsed.ok) {
    // Spam gets the same answer as a real enquiry, so bots learn nothing.
    if ('spam' in parsed) return Response.json({ ok: true, reference: null });
    return Response.json({ message: parsed.error, field: parsed.field }, { status: 400 });
  }

  const { data, error } = await db.from('support_tickets').insert(enquiryTicket(parsed.value)).select('ticket_number').single();
  if (error || !data) {
    console.error('[ENQUIRY_INSERT_ERROR]', error);
    return Response.json({ message: 'Your enquiry was not sent. Try again, or email connectly.hq@outlook.com.' }, { status: 500 });
  }
  return Response.json({ ok: true, reference: data.ticket_number });
}
