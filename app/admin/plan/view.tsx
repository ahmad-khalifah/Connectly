'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { PlanInput } from '@/lib/admin/inputs';
import PlanForm from '../components/plan-form';
import { PageHeader } from '@/components/admin/page-header';
import { NotFoundNotice, useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type Data = { locations: { id: string; name: string; is_active: boolean | null }[]; plan: { id: string; name: string; input: PlanInput; paidCount: number } };

export default function EditPlanView() {
  const id = useSearchParams().get('id');
  const { loaded, reload } = useAdminView<Data>(id ? viewUrl('plan-form', { id }) : null);
  const back = <Link prefetch={false} href="/admin/plans" className="font-semibold text-muted hover:text-brand">Plans</Link>;
  if (!id) return <NotFoundNotice what="Plan" />;
  return (
    <ViewState loaded={loaded} reload={reload} what="Plan">
      {({ plan, locations }) => (
        <div className="space-y-6">
          <PageHeader back={back} title={`Edit ${plan.name}`} description={`${plan.paidCount} paid purchase${plan.paidCount === 1 ? '' : 's'} on this plan.`} />
          <PlanForm key={plan.id} mode="edit" planId={plan.id} initial={plan.input} locations={locations} />
        </div>
      )}
    </ViewState>
  );
}
