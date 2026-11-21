'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { PlanInput } from '@/lib/admin/inputs';
import { naira, planData, planDuration } from '@/lib/plan-format';
import PlanStatusButton from '../components/plan-status-button';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, TableFrame, td, th, tr } from '@/components/admin/table';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type Data = { plans: (PlanInput & { id: string; paidCount: number })[]; locations: { id: string; name: string }[]; paidFailed: boolean; failed: boolean };

export default function PlansView() {
  const showArchived = useSearchParams().get('show') === 'all';
  const { loaded, reload } = useAdminView<Data>(viewUrl('plans'));
  const archivedCount = loaded.state === 'ready' ? loaded.data.plans.filter((p) => !p.isActive).length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="What customers can buy, at what price and where. Speed and device limits are enforced on the routers."
        actions={
          <>
            {archivedCount > 0 && (
              <Link prefetch={false} href={showArchived ? '/admin/plans' : '/admin/plans?show=all'} className="text-sm font-semibold text-muted hover:text-brand">
                {showArchived ? 'Hide plans off sale' : `Show plans off sale (${archivedCount})`}
              </Link>
            )}
            <ButtonLink href="/admin/plans/new">New plan</ButtonLink>
          </>
        }
      />
      <ViewState loaded={loaded} reload={reload}>
        {({ plans, locations, paidFailed, failed }) => {
          const locationName = new Map(locations.map((l) => [l.id, l.name]));
          const visible = showArchived ? plans : plans.filter((p) => p.isActive);
          return (
            <>
              {failed && <Notice tone="bad" title="Plans could not be loaded">The database did not answer. Refresh to try again.</Notice>}
              {paidFailed && <Notice tone="warn">Paid purchase counts could not be loaded.</Notice>}
              <TableFrame>
                <thead>
                  <tr>
                    <th className={th}>Plan</th>
                    <th className={`${th} text-right`}>Price</th>
                    <th className={th}>Duration</th>
                    <th className={th}>Data</th>
                    <th className={`${th} text-right`}>Devices</th>
                    <th className={th}>Speed (down / up)</th>
                    <th className={th}>Sold at</th>
                    <th className={`${th} text-right`}>Paid purchases</th>
                    <th className={th}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((plan) => (
                    <tr key={plan.id} className={tr}>
                      <td className={td}>
                        <span className="font-semibold text-ink">{plan.name}</span>
                        {!plan.isActive && <Badge className="ml-2">Off sale</Badge>}
                      </td>
                      <td className={`${td} tnum text-right font-semibold`}>{naira(plan.priceNaira)}</td>
                      <td className={td}>{planDuration(plan.durationMinutes * 60)}</td>
                      <td className={td}>{planData(plan.dataLimitMb).replace(' data', '')}</td>
                      <td className={`${td} tnum text-right`}>{plan.deviceLimit}</td>
                      <td className={`${td} tnum whitespace-nowrap`}>{plan.downloadMbps} / {plan.uploadMbps} Mbps</td>
                      <td className={`${td} max-w-[220px] text-muted`}>
                        {plan.allowedLocationIds ? plan.allowedLocationIds.map((id) => locationName.get(id) ?? 'Unknown location').join(', ') : 'Every location'}
                      </td>
                      <td className={`${td} tnum text-right`}>{plan.paidCount}</td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <span className="inline-flex items-center gap-4">
                          <Link prefetch={false} href={`/admin/plan?id=${plan.id}`} className="text-[13px] font-semibold text-brand hover:underline">Edit</Link>
                          <PlanStatusButton planId={plan.id} isActive={plan.isActive} />
                        </span>
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 && <EmptyRow cols={9}>No plans on sale. Create one so customers can pay.</EmptyRow>}
                </tbody>
              </TableFrame>
            </>
          );
        }}
      </ViewState>
    </div>
  );
}
