import Link from 'next/link';
import { db } from '@/lib/db/client';
import { fetchAll } from '@/lib/db/fetch-all';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, lagos, Pager, SearchBox, TableFrame, td, th, tr } from '@/components/admin/table';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { requestTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

const PER_PAGE = 20;

type Row = {
  id: string;
  customer_id: string | null;
  phone_number: string | null;
  amount_paid: number | string | null;
  amount_kobo: number | null;
  created_at: string;
  expires_at: string | null;
  plans: { name: string } | { name: string }[] | null;
  locations: { name: string } | { name: string }[] | null;
  network_authorizations: { status: string; revoked_at: string | null }[] | { status: string; revoked_at: string | null } | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** "0803..." and "+234 803..." both find 234803... */
function phoneNeedle(q: string): string {
  const d = q.replace(/\D/g, '');
  return d.startsWith('0') ? '234' + d.slice(1) : d;
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const search = (sp.search ?? '').trim();

  let rows: Row[] = [];
  let failed = false;
  try {
    rows = await fetchAll<Row>((f, t) =>
      db.from('purchases')
        .select('id, customer_id, phone_number, amount_paid, amount_kobo, created_at, expires_at, plans(name), locations(name), network_authorizations(status, revoked_at)')
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .range(f, t)
    );
  } catch (e) {
    console.error('[CUSTOMERS_FETCH_ERROR]', e);
    failed = true;
  }

  // One row per phone number; the newest purchase decides the current plan.
  const now = requestTime();
  const byPhone = new Map<string, { key: string; customerId: string | null; phone: string; count: number; spent: number; plan: string; location: string; ends: string | null; running: boolean }>();
  for (const p of rows) {
    const phone = p.phone_number ?? 'Unknown';
    const spent = p.amount_paid !== null && p.amount_paid !== undefined ? Number(p.amount_paid) : (p.amount_kobo ?? 0) / 100;
    const existing = byPhone.get(phone);
    if (existing) {
      existing.count += 1;
      existing.spent += spent;
      existing.customerId ||= p.customer_id;
      continue;
    }
    const grants = (Array.isArray(p.network_authorizations) ? p.network_authorizations : p.network_authorizations ? [p.network_authorizations] : []);
    // Access revoked early counts as ended, whatever the paid end time says.
    const revoked = grants.length > 0 && grants.every((g) => g.revoked_at || g.status === 'revoked');
    byPhone.set(phone, {
      key: p.id,
      customerId: p.customer_id,
      phone,
      count: 1,
      spent,
      plan: one(p.plans)?.name ?? 'Unknown plan',
      location: one(p.locations)?.name ?? '—',
      ends: p.expires_at,
      running: Boolean(p.expires_at && Date.parse(p.expires_at) > now && !revoked),
    });
  }

  let customers = [...byPhone.values()];
  if (search) {
    const needle = phoneNeedle(search);
    customers = customers.filter((c) => (needle ? c.phone.includes(needle) : c.phone.includes(search)));
  }
  const total = customers.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const shown = customers.slice((page - 1) * PER_PAGE, page * PER_PAGE);
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
