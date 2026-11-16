import Link from 'next/link';
import { Server } from 'lucide-react';
import { db } from '@/lib/db/client';
import RouterForm from '../../router-form';

export const dynamic = 'force-dynamic';

export default async function NewRouterPage() {
  const { data: locations } = await db.from('locations').select('id, name').eq('is_active', true).order('name');
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/admin/network" className="text-sm font-bold text-slate-500 hover:text-[#6d1825]">&larr; Back to Network</Link>
      <div className="flex items-center gap-2">
        <Server className="h-6 w-6 text-[#6d1825]" />
        <h1 className="text-2xl font-bold text-slate-900">Register a router</h1>
      </div>
      {locations?.length ? (
        <RouterForm mode="create" locations={locations} />
      ) : (
        <p className="text-sm text-slate-600">Create an active location first; every router belongs to one.</p>
      )}
    </div>
  );
}
