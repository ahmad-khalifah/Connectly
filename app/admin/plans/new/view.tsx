'use client';

import Link from 'next/link';
import PlanForm from '../../components/plan-form';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type Data = { locations: { id: string; name: string; is_active: boolean | null }[] };

export default function NewPlanView() {
  const { loaded, reload } = useAdminView<Data>(viewUrl('plan-form'));
  return (
    <div className="space-y-6">
      <PageHeader back={<Link prefetch={false} href="/admin/plans" className="font-semibold text-muted hover:text-brand">Plans</Link>} title="New plan" />
      <ViewState loaded={loaded} reload={reload}>{(d) => <PlanForm mode="create" locations={d.locations} />}</ViewState>
    </div>
  );
}
