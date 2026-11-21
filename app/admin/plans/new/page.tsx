import { requireAdminPage } from '@/lib/auth/admin';
import Link from 'next/link';
import { db } from '@/lib/db/client';
import PlanForm from '../../components/plan-form';
import { PageHeader } from '@/components/admin/page-header';

export const dynamic = 'force-dynamic';

export default async function NewPlanPage() {
  await requireAdminPage();
  const { data: locations } = await db.from('locations').select('id, name, is_active').order('name');
  return (
    <div className="space-y-6">
      <PageHeader back={<Link href="/admin/plans" className="font-semibold text-muted hover:text-brand">Plans</Link>} title="New plan" />
      <PlanForm mode="create" locations={locations ?? []} />
    </div>
  );
}
