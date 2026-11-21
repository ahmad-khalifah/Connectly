'use client';

import Link from 'next/link';
import RouterForm from '../../router-form';
import { PageHeader } from '@/components/admin/page-header';
import { Notice } from '@/components/ui/notice';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type Data = { locations: { id: string; name: string }[] };

export default function NewRouterView() {
  const { loaded, reload } = useAdminView<Data>(viewUrl('router-form'));
  return (
    <div className="space-y-6">
      <PageHeader back={<Link prefetch={false} href="/admin/network" className="font-semibold text-muted hover:text-brand">Routers</Link>} title="Register a router"
        description="Register it here first; the router page then shows the engineer exactly what to type." />
      <ViewState loaded={loaded} reload={reload}>
        {({ locations }) =>
          locations.length ? (
            <RouterForm mode="create" locations={locations} />
          ) : (
            <Notice tone="warn" title="Create a location first">Every router belongs to a location that is selling plans.</Notice>
          )
        }
      </ViewState>
    </div>
  );
}
