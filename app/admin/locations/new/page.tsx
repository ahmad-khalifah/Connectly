import Link from 'next/link';
import { db } from '@/lib/db/client';
import LocationForm from '../location-form';
import { PageHeader } from '@/components/admin/page-header';

export const dynamic = 'force-dynamic';

export default async function NewLocationPage() {
  const { data: institutions } = await db.from('institutions').select('id, name').order('name');
  return (
    <div className="space-y-6">
      <PageHeader back={<Link href="/admin/locations" className="font-semibold text-muted hover:text-brand">Locations</Link>} title="New location"
        description="After creating it, register the site's router and choose which plans are sold here." />
      <LocationForm mode="create" institutions={institutions ?? []} />
    </div>
  );
}
