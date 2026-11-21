// Logic in lib/http/customer-api.ts, shared with the Cloudflare Worker's front door.
import { handleKoraWebhook } from '@/lib/http/customer-api';

export const POST = handleKoraWebhook;
