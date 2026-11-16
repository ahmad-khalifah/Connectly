import Link from 'next/link';
import { db } from '@/lib/db/client';
import PlanForm from '../../components/plan-form';

export const dynamic = 'force-dynamic';

export default async function NewPlanPage() {
  const { data: locations } = await db.from('locations').select('id, name, is_active').order('name');
  return (
    <div className="max-w-2xl mx-auto space-y-6 mt-8">
      <Link href="/admin/plans" className="text-sm font-bold text-slate-500 hover:text-[#6d1825] transition-colors">
        &larr; Back to Plans
      </Link>
      <PlanForm mode="create" locations={locations ?? []} />
    </div>
  );
}
