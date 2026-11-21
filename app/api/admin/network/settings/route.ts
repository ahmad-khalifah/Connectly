import { db } from '@/lib/db/client';
import { requireAdminApi } from '@/lib/auth/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { parsePortalSettings, requeueHotspotEverywhere } from '@/lib/network/settings';

// Portal address and network-wide walled garden. Saving queues the hotspot
// job on every configured router, so routers pick the change up.
export async function PUT(req: Request) {
  const { user, denied } = await requireAdminApi(req);
  if (denied) return denied;

  const parsed = parsePortalSettings(await req.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: 'Please correct the highlighted fields.', errors: parsed.errors }, { status: 400 });

  const { data: before } = await db.from('network_settings').select('portal_url, walled_garden_hosts').maybeSingle();
  const { error } = await db.from('network_settings').update({ ...parsed.value, updated_at: new Date().toISOString() }).eq('id', true);
  if (error) {
    console.error('[NETWORK_SETTINGS_SAVE_ERROR]', error.code, error.message);
    return Response.json({ message: 'Could not save the network settings.' }, { status: 500 });
  }
  const queued = await requeueHotspotEverywhere(user.email ?? 'admin');
  await logAdminAction(user, 'network.settings_saved', 'Portal address / walled garden changed', 'network_settings', {
    metadata: { before, after: parsed.value, routers_requeued: queued },
  });
  return Response.json({ saved: true, routersQueued: queued });
}
