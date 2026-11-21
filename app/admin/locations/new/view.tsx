'use client';

import Link from 'next/link';
import LocationForm from '../location-form';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type Data = { institutions: { id: string; name: string }[] };

export default function NewLocationView() {
  const { loaded, reload } = useAdminView<Data>(viewUrl('location-form'));
  return (
    <div className="space-y-6">
      <PageHeader back={<Link prefetch={false} href="/admin/locations" className="font-semibold text-muted hover:text-brand">Locations</Link>} title="New location"
        description="After creating it, register the site's router and choose which plans are sold here." />
      <ViewState loaded={loaded} reload={reload}>{(d) => <LocationForm mode="create" institutions={d.institutions} />}</ViewState>
    </div>
  );
}
