import { requireAdminPage } from '@/lib/auth/admin';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import { paidTotals } from '@/lib/admin/metrics-loader';
import { appUrl } from '@/lib/env';
import { isUuid } from '@/lib/admin/inputs';
import { requestTime } from '@/lib/time';
import { PageHeader } from '@/components/admin/page-header';
import { Stat, StatGrid } from '@/components/admin/stat-grid';
import { EmptyRow, lagos, TableFrame, td, th, tr } from '@/components/admin/table';
import { Panel } from '@/components/ui/panel';
import { routerHealth } from '@/lib/admin/router-health';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const PAY: Record<string, { label: string; tone: BadgeTone }> = { paid: { label: 'Paid', tone: 'ok' }, pending: { label: 'Not completed', tone: 'warn' }, failed: { label: 'Failed', tone: 'bad' } };
const uptime = (s: number | null) => {
  if (!s) return null;
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  return d ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`;
};

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [locationRes, routersRes, purchasesRes, plansRes, paid] = await Promise.all([
    db.from('locations').select('*, institutions(name)').eq('id', id).maybeSingle(),
    db.from('routers').select('id, name, identifier, lifecycle_status, status, management_ip, routeros_version, board_name, uptime_seconds, cpu_usage_pct, memory_usage_pct, last_seen_at').eq('location_id', id).neq('lifecycle_status', 'retired').order('name'),
    db.from('purchases').select('id, status, amount_paid, amount_kobo, created_at, phone_number, plans(name)').eq('location_id', id).order('created_at', { ascending: false }).limit(10),
    db.from('plans').select('id, name, price_kobo, duration_seconds, allowed_location_ids').eq('is_active', true).order('price_kobo'),
    paidTotals({ from: null, to: new Date(), locationId: id }).catch(() => null),
  ]);

  const location = locationRes.data;
  if (!location) notFound();

  const routers = routersRes.data ?? [];
  const routerIds = routers.map((r) => r.id);
  const now = new Date(requestTime()).toISOString();
  const { count: running } = routerIds.length
    ? await db.from('network_authorizations').select('id', { count: 'exact', head: true }).in('router_id', routerIds).in('status', ['active', 'pending_device']).gt('expires_at', now)
    : { count: 0 };

  const revenue = paid ? paid.reduce((s, p) => s + p.revenue, 0) : null;
  const plansHere = (plansRes.data ?? []).filter((p) => !p.allowed_location_ids?.length || p.allowed_location_ids.includes(id));
  const active = routers.filter((r) => r.lifecycle_status === 'active');
  const infoLink = `${appUrl()}/connect?loc=${location.slug}`;
  const inst = one(location.institutions as { name: string } | { name: string }[] | null);

  return (
    <div className="space-y-6">
      <PageHeader
        back={<Link href="/admin/locations" className="font-semibold text-muted hover:text-brand">Locations</Link>}
        title={location.name}
        description={[inst?.name, location.building, location.address].filter(Boolean).join(', ') || 'No address recorded'}
        actions={
          <>
            {location.is_active === false ? <Badge>Not selling</Badge> : <Badge tone="ok">Selling</Badge>}
            <ButtonLink href={`/admin/locations/${id}/edit`} variant="secondary">Edit</ButtonLink>
          </>
        }
      />

      <StatGrid cols={4}>
        <Stat label="Plans running now" value={running ?? 0} how="Paid codes on this location's routers whose end time is still ahead and that were not revoked." />
        <Stat label="Routers online" value={active.length ? `${active.filter((r) => routerHealth(r.status, r.last_seen_at, Date.parse(now)).label === 'Online').length} of ${active.length}` : 'None active'} how="Active routers the controller found online in the last 5 minutes." />
        <Stat label="Paid revenue, all time" value={revenue === null ? '—' : `₦${revenue.toLocaleString('en-NG')}`} note={revenue === null ? 'Could not be loaded' : undefined} />
        <Stat label="Paid purchases" value={paid?.length ?? '—'} />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Routers" description="Health and load come from the router itself, read by the controller every minute." flush
          action={<Link href="/admin/network/routers/new" className="text-sm font-semibold text-brand hover:underline">Register a router</Link>}>
          <ul className="divide-y divide-line">
            {routers.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <Link href={`/admin/network/routers/${r.id}`} className="font-semibold text-ink hover:text-brand">{r.name ?? r.identifier}</Link>
                  <span className="block text-[12.5px] text-muted">
                    {[r.identifier, r.board_name, r.routeros_version && `RouterOS ${r.routeros_version}`].filter(Boolean).join(', ')}
                  </span>
                  {r.lifecycle_status === 'active' && (
                    <span className="tnum block text-[12.5px] text-subtle">
                      {[r.cpu_usage_pct !== null && `CPU ${r.cpu_usage_pct}%`, r.memory_usage_pct !== null && `memory ${r.memory_usage_pct}%`, uptime(r.uptime_seconds) && `up ${uptime(r.uptime_seconds)}`, `seen ${lagos(r.last_seen_at)}`].filter(Boolean).join(', ')}
                    </span>
                  )}
                </span>
                {r.lifecycle_status === 'active' ? <Badge tone={routerHealth(r.status, r.last_seen_at, Date.parse(now)).tone}>{routerHealth(r.status, r.last_seen_at, Date.parse(now)).label}</Badge> : <Badge>Not active yet</Badge>}
              </li>
            ))}
            {routers.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No router here yet.</li>}
          </ul>
        </Panel>

        <Panel title="Plans on sale here" flush action={<Link href="/admin/plans" className="text-sm font-semibold text-brand hover:underline">Manage plans</Link>}>
          <ul className="divide-y divide-line">
            {plansHere.map((p) => (
              <li key={p.id} className="flex justify-between px-5 py-3 text-sm">
                <span className="font-semibold text-ink">{p.name}</span>
                <span className="tnum">₦{(p.price_kobo / 100).toLocaleString('en-NG')}</span>
              </li>
            ))}
            {plansHere.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No plans on sale here, so customers cannot pay.</li>}
          </ul>
        </Panel>
      </div>

      <Panel title="Information link" description="For posters and QR codes. It tells people to join the WiFi; plans are bought on the WiFi sign-in page.">
        <a href={infoLink} target="_blank" rel="noreferrer" className="break-all text-sm font-semibold text-brand hover:underline">{infoLink}</a>
      </Panel>

      <section className="space-y-3" aria-labelledby="recent">
        <div className="flex items-baseline justify-between">
          <h2 id="recent" className="text-lg font-bold text-ink">Recent purchases</h2>
          <Link href="/admin/transactions" className="text-sm font-semibold text-brand hover:underline">All payments</Link>
        </div>
        <TableFrame>
          <thead>
            <tr><th className={th}>Started</th><th className={th}>Customer</th><th className={th}>Plan</th><th className={th}>Status</th><th className={`${th} text-right`}>Amount</th></tr>
          </thead>
          <tbody>
            {(purchasesRes.data ?? []).map((p) => {
              const st = PAY[p.status] ?? { label: p.status, tone: 'neutral' as BadgeTone };
              return (
                <tr key={p.id} className={tr}>
                  <td className={`${td} tnum whitespace-nowrap text-muted`}>{lagos(p.created_at)}</td>
                  <td className={`${td} tnum`}>{p.phone_number ? `+${p.phone_number}` : '—'}</td>
                  <td className={td}>{one(p.plans as { name: string } | { name: string }[] | null)?.name ?? '—'}</td>
                  <td className={td}><Badge tone={st.tone}>{st.label}</Badge></td>
                  <td className={`${td} tnum text-right`}>₦{(p.amount_paid !== null ? Number(p.amount_paid) : (p.amount_kobo ?? 0) / 100).toLocaleString('en-NG')}</td>
                </tr>
              );
            })}
            {(purchasesRes.data ?? []).length === 0 && <EmptyRow cols={5}>No purchases here yet.</EmptyRow>}
          </tbody>
        </TableFrame>
      </section>
    </div>
  );
}
