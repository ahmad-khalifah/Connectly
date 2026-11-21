import { db } from '@/lib/db/client';
import { requireAdminApi } from '@/lib/auth/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { isUuid, friendlyDbError } from '@/lib/admin/inputs';
import { HOTSPOT_COLUMNS, parseHotspotInput } from '@/lib/network/hotspot';

type Ctx = { params: Promise<{ id: string }> };
const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

// Saves the router's hotspot settings. Saving does not touch the router:
// "Apply to router" queues the controller job that does.
export async function PUT(req: Request, { params }: Ctx) {
  const { user, denied } = await requireAdminApi(req);
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return json(404, { message: 'Router not found.' });

  const { data: router } = await db.from('routers').select('id, name, location_id, lifecycle_status').eq('id', id).maybeSingle();
  if (!router) return json(404, { message: 'Router not found.' });
  if (router.lifecycle_status === 'retired') return json(409, { message: 'A retired router cannot be configured.' });

  const parsed = parseHotspotInput(await req.json().catch(() => null));
  if (!parsed.ok) return json(400, { message: 'Please correct the highlighted fields.', errors: parsed.errors });

  const { data, error } = await db
    .from('router_hotspot_settings')
    .upsert({ router_id: id, ...parsed.value, updated_by: user.email ?? 'admin' }, { onConflict: 'router_id' })
    .select(HOTSPOT_COLUMNS)
    .single();
  if (error) {
    console.error('[HOTSPOT_SAVE_ERROR]', error.code, error.message);
    return json(error.code === '23514' ? 400 : 500, { message: error.code === '23514' ? 'The database refused these settings (overlapping or invalid network).' : friendlyDbError(error, 'Could not save the hotspot settings.') });
  }

  await logAdminAction(user, 'router.hotspot_saved', `Hotspot settings saved for "${router.name}"`, id, {
    locationId: router.location_id,
    metadata: { ...parsed.value, version: (data as { version?: number } | null)?.version },
  });
  return json(200, { hotspot: data });
}
