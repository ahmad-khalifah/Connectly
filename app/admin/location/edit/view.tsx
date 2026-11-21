'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { LocationInput } from '@/lib/admin/inputs';
import LocationForm from '../../locations/location-form';
import { PageHeader } from '@/components/admin/page-header';
import { NotFoundNotice, useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type Data = { institutions: { id: string; name: string }[]; location: { id: string; name: string; initial: LocationInput } };

export default function EditLocationView() {
  const id = useSearchParams().get('id');
  const { loaded, reload } = useAdminView<Data>(id ? viewUrl('location-form', { id }) : null);
  if (!id) return <NotFoundNotice what="Location" />;
  return (
    <ViewState loaded={loaded} reload={reload} what="Location">
      {({ location, institutions }) => (
        <div className="space-y-6">
          <PageHeader back={<Link prefetch={false} href={`/admin/location?id=${location.id}`} className="font-semibold text-muted hover:text-brand">{location.name}</Link>} title={`Edit ${location.name}`} />
          <LocationForm key={location.id} mode="edit" locationId={location.id} initial={location.initial} institutions={institutions} />
        </div>
      )}
    </ViewState>
  );
}
