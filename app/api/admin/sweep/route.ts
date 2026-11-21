// Logic in lib/http/admin-api.ts, shared with the Cloudflare Worker's front door.
import { handleAdminSweep } from '@/lib/http/admin-api';

export const POST = handleAdminSweep;
