// Logic in lib/http/customer-api.ts, shared with the Cloudflare Worker's front door.
import { handlePhoneLookup } from '@/lib/http/customer-api';

export const dynamic = 'force-dynamic';
export const POST = handlePhoneLookup;
