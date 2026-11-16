import type { User } from '@supabase/supabase-js';
import { db } from '@/lib/db/client';

/** Records who changed what. Never blocks the change if logging fails. */
export async function logAdminAction(
  user: User,
  eventType: string,
  message: string,
  entityId: string,
  extra: { locationId?: string | null; metadata?: Record<string, unknown> } = {}
) {
  try {
    await db.from('activity_logs').insert({
      event_type: eventType,
      severity: 'info',
      entity_id: entityId,
      location_id: extra.locationId ?? null,
      message,
      metadata: { operator: user.email, ...(extra.metadata ?? {}) },
    });
  } catch (err) {
    console.error('[AUDIT_LOG_ERROR]', err);
  }
}
