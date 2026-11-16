import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { db } from '@/lib/db/client';
import LocationForm from '../location-form';

export const dynamic = 'force-dynamic';

export default async function NewLocationPage() {
  const { data: institutions } = await db.from('institutions').select('id, name').order('name');
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/admin/locations" className="text-sm font-bold text-slate-500 hover:text-[#6d1825] transition-colors">
        &larr; Back to Locations
      </Link>
      <div className="flex items-center gap-2">
        <MapPin className="h-6 w-6 text-[#6d1825]" />
        <h1 className="text-2xl font-bold text-slate-900">Add New Facility</h1>
      </div>
      <LocationForm mode="create" institutions={institutions ?? []} />
    </div>
  );
}
