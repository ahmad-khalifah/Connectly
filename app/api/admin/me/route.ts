// Logic in lib/http/admin-api.ts, shared with the Cloudflare Worker's front door.
import { handleAdminMe } from '@/lib/http/admin-api';

export const GET = handleAdminMe;
