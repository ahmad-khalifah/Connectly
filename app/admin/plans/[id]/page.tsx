import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import { isUuid, planToInput } from '@/lib/admin/inputs';
import PlanForm from '../../components/plan-form';
import { PageHeader } from '@/components/admin/page-header';

export const dynamic = 'force-dynamic';

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [{ data: plan }, { data: locations }, { count: paidCount }] = await Promise.all([
    db.from('plans').select('*').eq('id', id).maybeSingle(),
    db.from('locations').select('id, name, is_active').order('name'),
    db.from('purchases').select('id', { count: 'exact', head: true }).eq('plan_id', id).eq('status', 'paid'),
  ]);
  if (!plan) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        back={<Link href="/admin/plans" className="font-semibold text-muted hover:text-brand">Plans</Link>}
        title={`Edit ${plan.name}`}
        description={`${paidCount ?? 0} paid purchase${paidCount === 1 ? '' : 's'} on this plan.`}
      />
      <PlanForm mode="edit" planId={id} initial={planToInput(plan)} locations={locations ?? []} />
    </div>
  );
}
