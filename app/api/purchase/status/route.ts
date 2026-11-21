// Logic in lib/http/customer-api.ts, shared with the Cloudflare Worker's front door.
import { handlePurchaseStatus } from '@/lib/http/customer-api';

export const GET = handlePurchaseStatus;
