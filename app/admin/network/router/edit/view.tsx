'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Lifecycle, RouterInput } from '@/lib/network/routers';
import RouterForm from '../../router-form';
import { PageHeader } from '@/components/admin/page-header';
import { Notice } from '@/components/ui/notice';
import { NotFoundNotice, useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type Data = { locations: { id: string; name: string }[]; router: { id: string; lifecycle: Lifecycle; editable: boolean; initial: RouterInput } };

export default function EditRouterView() {
  const id = useSearchParams().get('id');
  const { loaded, reload } = useAdminView<Data>(id ? viewUrl('router-form', { id }) : null);
  if (!id) return <NotFoundNotice what="Router" />;
  return (
    <ViewState loaded={loaded} reload={reload} what="Router">
      {({ router, locations }) => (
        <div className="space-y-6">
          <PageHeader back={<Link prefetch={false} href={`/admin/network/router?id=${router.id}`} className="font-semibold text-muted hover:text-brand">{router.initial.name}</Link>} title="Edit router" />
          {router.editable ? (
            <RouterForm key={router.id} mode="edit" routerId={router.id} initial={router.initial} locations={locations} />
          ) : (
            <Notice tone="info" title={`An ${router.lifecycle} router cannot be edited`}>Suspend it first.</Notice>
          )}
        </div>
      )}
    </ViewState>
  );
}
