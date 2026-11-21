'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, lagos, Pager, SearchBox, TableFrame, td, th, tr } from '@/components/admin/table';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

const PER_PAGE = 20; // lib/admin/views.ts CUSTOMERS_PER_PAGE

type Row = {
  latest_id: string; customer_id: string | null; phone: string; purchases: number; spent: number | string;
  plan_name: string; location_name: string; ends: string | null; running: boolean;
};
type Data = { rows: Row[]; total: number; failed: boolean };

export default function CustomersView() {
  const sp = useSearchParams();
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const search = (sp.get('search') ?? '').trim();
  const { loaded, reload } = useAdminView<Data>(viewUrl('customers', { page: String(page), search }));
  const href = (n: number) => `?${new URLSearchParams({ page: String(n), ...(search ? { search } : {}) }).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Everyone who has paid, by phone number. Status and plan come from their latest purchase."
        actions={<SearchBox defaultValue={search} placeholder="Search by phone number" />}
      />
      <ViewState loaded={loaded} reload={reload}>
        {({ rows, total, failed }) => (
          <>
            {failed && <Notice tone="bad" title="Customers could not be loaded">The database did not answer. Refresh to try again.</Notice>}
            <TableFrame footer={<Pager page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} noun="customer" href={href} />}>
              <thead>
                <tr>
                  <th className={th}>Phone number</th>
                  <th className={th}>Latest plan</th>
                  <th className={th}>Status</th>
                  <th className={th}>Ends</th>
                  <th className={th}>Location</th>
                  <th className={`${th} text-right`}>Purchases</th>
                  <th className={`${th} text-right`}>Total paid</th>
                  <th className={th}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.latest_id} className={tr}>
                    <td className={`${td} tnum font-semibold text-ink`}>+{c.phone}</td>
                    <td className={td}>{c.plan_name}</td>
                    <td className={td}>{c.running ? <Badge tone="ok">Plan running</Badge> : <Badge>Ended</Badge>}</td>
                    <td className={`${td} tnum whitespace-nowrap text-muted`}>{lagos(c.ends)}</td>
                    <td className={`${td} text-muted`}>{c.location_name}</td>
                    <td className={`${td} tnum text-right`}>{Number(c.purchases)}</td>
                    <td className={`${td} tnum text-right`}>₦{Number(c.spent).toLocaleString('en-NG')}</td>
                    <td className={`${td} text-right`}>
                      {c.customer_id ? (
                        <Link prefetch={false} href={`/admin/customer?id=${c.customer_id}`} className="font-semibold text-brand hover:underline">History</Link>
                      ) : <span className="text-subtle">No profile</span>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <EmptyRow cols={8}>{search ? `No customer matches "${search}".` : 'No paying customers yet.'}</EmptyRow>}
              </tbody>
            </TableFrame>
          </>
        )}
      </ViewState>
    </div>
  );
}
