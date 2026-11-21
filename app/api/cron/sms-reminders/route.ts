import { handleCronTexts } from '@/lib/http/cron';

// Due texts (payment confirmations never asked for, expiry reminders). On
// Cloudflare the Worker's front door answers this path itself
// (lib/http/cron.ts) and this route is not reached. Elsewhere (Vercel, local)
// it answers here, with a larger batch since there is no 10 ms CPU limit.
export async function GET(request: Request) {
  return handleCronTexts(request, 50);
}
