// Logic in lib/http/admin-api.ts, shared with the Cloudflare Worker's front door.
import { handleAdminView } from '@/lib/http/admin-api';

export async function GET(request: Request) {
  return handleAdminView(request);
}
