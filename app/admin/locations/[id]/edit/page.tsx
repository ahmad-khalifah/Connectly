import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { db } from '@/lib/db/client';
import { isUuid, LOCATION_STATUSES, type LocationInput } from '@/lib/admin/inputs';
import LocationForm from '../../location-form';

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
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/admin/locations/${id}`} className="text-sm font-bold text-slate-500 hover:text-[#6d1825] transition-colors">
        &larr; Back to {loc.name}
      </Link>
      <div className="flex items-center gap-2">
        <MapPin className="h-6 w-6 text-[#6d1825]" />
        <h1 className="text-2xl font-bold text-slate-900">Edit Facility</h1>
      </div>
      <LocationForm mode="edit" locationId={id} initial={initial} institutions={institutions ?? []} />
    </div>
  );
}
