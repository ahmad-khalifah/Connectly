import Link from 'next/link';
import { db } from '@/lib/db/client';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, lagos, Pager, SearchBox, TableFrame, td, th, tr } from '@/components/admin/table';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { requestTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

const PER_PAGE = 20;

type Row = {
  latest_id: string;
  customer_id: string | null;
  phone: string;
  purchases: number;
  spent: number | string;
  plan_name: string;
  location_name: string;
  ends: string | null;
  running: boolean;
};

/** "0803..." and "+234 803..." both find 234803... */
function phoneNeedle(q: string): string {
  const d = q.replace(/\D/g, '');
  return d.startsWith('0') ? '234' + d.slice(1) : d;
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const search = (sp.search ?? '').trim();

  // One row per phone number, grouped and paged by the database
  // (admin_customer_page); the newest purchase decides the current plan.
  let customers: Row[] = [];
  let total = 0;
  let failed = false;
  const { data, error } = await db.rpc('admin_customer_page', {
    p_search: search ? phoneNeedle(search) || search : '',
    p_limit: PER_PAGE,
    p_offset: (page - 1) * PER_PAGE,
    p_now: new Date(requestTime()).toISOString(),
  });
  if (error) {
    console.error('[CUSTOMERS_FETCH_ERROR]', error);
    failed = true;
  } else {
    const result = (data ?? {}) as { total?: number; rows?: Row[] };
    customers = result.rows ?? [];
    total = Number(result.total ?? 0);
  }
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const shown = customers.map((c) => ({
    key: c.latest_id,
    customerId: c.customer_id,
    phone: c.phone,
    count: Number(c.purchases),
    spent: Number(c.spent),
    plan: c.plan_name,
    location: c.location_name,
    ends: c.ends,
    running: c.running,
  }));
  const href = (n: number) => `?${new URLSearchParams({ page: String(n), ...(search ? { search } : {}) }).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Everyone who has paid, by phone number. Status and plan come from their latest purchase."
        actions={<SearchBox defaultValue={search} placeholder="Search by phone number" />}
      />
      {failed && <Notice tone="bad" title="Customers could not be loaded">The database did not answer. Refresh to try again.</Notice>}
      <TableFrame footer={<Pager page={page} pages={pages} total={total} noun="customer" href={href} />}>
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
          {shown.map((c) => (
            <tr key={c.key} className={tr}>
              <td className={`${td} tnum font-semibold text-ink`}>+{c.phone}</td>
              <td className={td}>{c.plan}</td>
              <td className={td}>{c.running ? <Badge tone="ok">Plan running</Badge> : <Badge>Ended</Badge>}</td>
              <td className={`${td} tnum whitespace-nowrap text-muted`}>{lagos(c.ends)}</td>
              <td className={`${td} text-muted`}>{c.location}</td>
              <td className={`${td} tnum text-right`}>{c.count}</td>
              <td className={`${td} tnum text-right`}>₦{c.spent.toLocaleString('en-NG')}</td>
              <td className={`${td} text-right`}>
                {c.customerId ? (
                  <Link href={`/admin/customers/${c.customerId}`} className="font-semibold text-brand hover:underline">History</Link>
                ) : <span className="text-subtle">No profile</span>}
              </td>
            </tr>
          ))}
          {shown.length === 0 && <EmptyRow cols={8}>{search ? `No customer matches "${search}".` : 'No paying customers yet.'}</EmptyRow>}
        </tbody>
      </TableFrame>
    </div>
  );
}
