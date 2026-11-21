import { db } from '@/lib/db/client';
import { requireAdminApi } from '@/lib/auth/admin';
import { friendlyDbError, locationRow, parseLocationInput } from '@/lib/admin/inputs';
import { logAdminAction } from '@/lib/admin/audit';

export async function POST(req: Request) {
  const { user, denied } = await requireAdminApi(req);
  if (denied) return denied;

  const parsed = parseLocationInput(await req.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.error }, { status: 400 });

  const { data, error } = await db.from('locations').insert(locationRow(parsed.value)).select('id, name').single();
  if (error || !data) {
    console.error('[LOCATION_CREATE_ERROR]', error);
    return Response.json({ message: friendlyDbError(error, 'Could not create the location.') }, { status: error?.code === '23505' ? 409 : 500 });
  }

  await logAdminAction(user, 'location.created', `Location "${data.name}" created`, data.id, { locationId: data.id });
  return Response.json({ data }, { status: 201 });
}
