import { requireAdminPage } from '@/lib/auth/admin';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import { isUuid } from '@/lib/admin/inputs';
import type { ConnectionMethod, RouterInput } from '@/lib/network/routers';
import RouterForm from '../../../router-form';
import { PageHeader } from '@/components/admin/page-header';
import { Notice } from '@/components/ui/notice';

export const dynamic = 'force-dynamic';

export default async function EditRouterPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
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
    <div className="space-y-6">
      <PageHeader back={<Link href={`/admin/network/routers/${id}`} className="font-semibold text-muted hover:text-brand">{initial.name}</Link>} title="Edit router" />
      {editable ? (
        <RouterForm mode="edit" routerId={id} initial={initial} locations={locations ?? []} />
      ) : (
        <Notice tone="info" title={`An ${r.lifecycle_status} router cannot be edited`}>Suspend it first.</Notice>
      )}
    </div>
  );
}
