import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import { isUuid, LOCATION_STATUSES, type LocationInput } from '@/lib/admin/inputs';
import LocationForm from '../../location-form';
import { PageHeader } from '@/components/admin/page-header';

export const dynamic = 'force-dynamic';

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [{ data: loc }, { data: institutions }] = await Promise.all([
    db.from('locations').select('*').eq('id', id).maybeSingle(),
    db.from('institutions').select('id, name').order('name'),
  ]);
  if (!loc) notFound();

  const initial: LocationInput = {
    name: loc.name,
    slug: loc.slug,
    building: loc.building,
    address: loc.address,
    contactPhone: loc.contact_phone,
    locationType: loc.location_type ?? 'campus_facility',
    status: (LOCATION_STATUSES as readonly string[]).includes(loc.status) ? loc.status : 'active',
    isActive: loc.is_active !== false,
    institutionId: loc.institution_id,
  };

  return (
    <div className="space-y-6">
      <PageHeader back={<Link href={`/admin/locations/${id}`} className="font-semibold text-muted hover:text-brand">{loc.name}</Link>} title={`Edit ${loc.name}`} />
      <LocationForm mode="edit" locationId={id} initial={initial} institutions={institutions ?? []} />
    </div>
  );
}
