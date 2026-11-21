import { db } from '@/lib/db/client';
import { requireAdminApi } from '@/lib/auth/admin';
import { friendlyDbError, isUuid, locationRow, parseLocationInput } from '@/lib/admin/inputs';
import { logAdminAction } from '@/lib/admin/audit';

// Edit a location. There is no delete: deactivating (is_active = false) stops
// new payments and keeps every purchase, router and QR code linked to it.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, denied } = await requireAdminApi(req);
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return Response.json({ message: 'Location not found.' }, { status: 404 });

  const parsed = parseLocationInput(await req.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.error }, { status: 400 });

  const { data, error } = await db.from('locations').update(locationRow(parsed.value)).eq('id', id).select('id');
  if (error) {
    console.error('[LOCATION_UPDATE_ERROR]', error);
    return Response.json({ message: friendlyDbError(error, 'Could not update the location.') }, { status: error.code === '23505' ? 409 : 500 });
  }
  if (!data?.length) return Response.json({ message: 'Location not found.' }, { status: 404 });

  await logAdminAction(user, 'location.updated', `Location "${parsed.value.name}" updated`, id, {
    locationId: id,
    metadata: locationRow(parsed.value),
  });
  return Response.json({ success: true });
}
