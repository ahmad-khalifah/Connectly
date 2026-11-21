import { db } from '@/lib/db/client';
import { requireAdminApi } from '@/lib/auth/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { isUuid } from '@/lib/admin/inputs';
import { parseRouterInput, routerRow } from '@/lib/network/routers';

// Edit a router's details. Only while Registered or Suspended: an Active
// router is serving customers, so it is suspended first.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, denied } = await requireAdminApi(req);
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return Response.json({ message: 'Router not found.' }, { status: 404 });

  const parsed = parseRouterInput(await req.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.error }, { status: 400 });

  const { data, error } = await db
    .from('routers')
    .update(routerRow(parsed.value))
    .eq('id', id)
    .in('lifecycle_status', ['registered', 'suspended'])
    .select('id');

  if (error) {
    if (error.code === '23505') return Response.json({ message: 'Another router already uses that identifier or WireGuard key.' }, { status: 409 });
    console.error('[ROUTER_UPDATE_ERROR]', error.code, error.message);
    return Response.json({ message: 'Could not update the router.' }, { status: 500 });
  }
  if (!data?.length) return Response.json({ message: 'Only a Registered or Suspended router can be edited.' }, { status: 409 });

  await logAdminAction(user, 'router.updated', `Router "${parsed.value.name}" updated`, id, {
    locationId: parsed.value.locationId,
    metadata: { identifier: parsed.value.identifier, connection_method: parsed.value.connectionMethod },
  });
  return Response.json({ success: true });
}
