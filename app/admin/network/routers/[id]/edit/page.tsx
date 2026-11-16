import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import { isUuid } from '@/lib/admin/inputs';
import type { ConnectionMethod, RouterInput } from '@/lib/network/routers';
import RouterForm from '../../../router-form';

export const dynamic = 'force-dynamic';

export default async function EditRouterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [{ data: r }, { data: locations }] = await Promise.all([
    db.from('routers')
      .select('id, name, identifier, location_id, connection_method, lifecycle_status, wg_public_key, management_ip, hotspot_server_name, model')
      .eq('id', id).maybeSingle(),
    db.from('locations').select('id, name').order('name'),
  ]);
  if (!r) notFound();

  const editable = r.lifecycle_status === 'registered' || r.lifecycle_status === 'suspended';
  const initial: RouterInput = {
    name: r.name ?? r.identifier,
    locationId: r.location_id,
    identifier: r.identifier,
    connectionMethod: r.connection_method as ConnectionMethod,
    wgPublicKey: r.wg_public_key,
    managementHost: r.management_ip,
    hotspotServerName: r.hotspot_server_name ?? 'hs-main',
    model: r.model,
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/admin/network/routers/${id}`} className="text-sm font-bold text-slate-500 hover:text-[#6d1825]">&larr; Back to {initial.name}</Link>
      <h1 className="text-2xl font-bold text-slate-900">Edit router</h1>
      {editable ? (
        <RouterForm mode="edit" routerId={id} initial={initial} locations={locations ?? []} />
      ) : (
        <p className="text-sm text-slate-600">An {r.lifecycle_status} router cannot be edited. Suspend it first.</p>
      )}
    </div>
  );
}
