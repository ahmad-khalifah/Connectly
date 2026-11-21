'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/admin/page-header';
import { Stat, StatGrid } from '@/components/admin/stat-grid';
import { EmptyRow, lagos, TableFrame, td, th, tr } from '@/components/admin/table';
import { Panel } from '@/components/ui/panel';
import { routerHealth } from '@/lib/admin/router-health';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { NotFoundNotice, useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type RouterRow = {
  id: string; name: string | null; identifier: string; lifecycle_status: string; status: string | null; routeros_version: string | null; board_name: string | null;
  uptime_seconds: number | null; cpu_usage_pct: number | null; memory_usage_pct: number | null; last_seen_at: string | null;
};
type Data = {
  location: { id: string; name: string; slug: string; is_active: boolean | null; description: string };
  infoLink: string;
  routers: RouterRow[];
  purchases: { id: string; status: string; amount_paid: number | string | null; amount_kobo: number | null; created_at: string; phone_number: string | null; plan: string | null }[];
  plansHere: { id: string; name: string; price_kobo: number }[];
  running: number;
  revenue: number | null;
  paidPurchases: number | null;
};

const PAY: Record<string, { label: string; tone: BadgeTone }> = { paid: { label: 'Paid', tone: 'ok' }, pending: { label: 'Not completed', tone: 'warn' }, failed: { label: 'Failed', tone: 'bad' } };
const uptime = (s: number | null) => {
  if (!s) return null;
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  return d ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`;
};

export default function LocationView() {
  const id = useSearchParams().get('id');
  const { loaded, reload } = useAdminView<Data>(id ? viewUrl('location', { id }) : null);
  if (!id) return <NotFoundNotice what="Location" />;
  return <ViewState loaded={loaded} reload={reload} what="Location">{(d) => <LocationDetail {...d} />}</ViewState>;
}

function LocationDetail({ location, infoLink, routers, purchases, plansHere, running, revenue, paidPurchases }: Data) {
  const [now] = useState(() => Date.now()); // when the page opened, for router health
  const active = routers.filter((r) => r.lifecycle_status === 'active');

  return (
    <div className="space-y-6">
      <PageHeader
        back={<Link prefetch={false} href="/admin/locations" className="font-semibold text-muted hover:text-brand">Locations</Link>}
        title={location.name}
        description={location.description || 'No address recorded'}
        actions={
          <>
            {location.is_active === false ? <Badge>Not selling</Badge> : <Badge tone="ok">Selling</Badge>}
            <ButtonLink href={`/admin/location/edit?id=${location.id}`} variant="secondary">Edit</ButtonLink>
          </>
        }
      />

      <StatGrid cols={4}>
        <Stat label="Plans running now" value={running} how="Paid codes on this location's routers whose end time is still ahead and that were not revoked." />
        <Stat label="Routers online" value={active.length ? `${active.filter((r) => routerHealth(r.status, r.last_seen_at, now).label === 'Online').length} of ${active.length}` : 'None active'} how="Active routers the controller found online in the last 5 minutes." />
        <Stat label="Paid revenue, all time" value={revenue === null ? '—' : `₦${revenue.toLocaleString('en-NG')}`} note={revenue === null ? 'Could not be loaded' : undefined} />
        <Stat label="Paid purchases" value={paidPurchases ?? '—'} />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Routers" description="Health and load come from the router itself, read by the controller every minute." flush
          action={<Link prefetch={false} href="/admin/network/routers/new" className="text-sm font-semibold text-brand hover:underline">Register a router</Link>}>
          <ul className="divide-y divide-line">
            {routers.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <Link prefetch={false} href={`/admin/network/router?id=${r.id}`} className="font-semibold text-ink hover:text-brand">{r.name ?? r.identifier}</Link>
                  <span className="block text-[12.5px] text-muted">
                    {[r.identifier, r.board_name, r.routeros_version && `RouterOS ${r.routeros_version}`].filter(Boolean).join(', ')}
                  </span>
                  {r.lifecycle_status === 'active' && (
                    <span className="tnum block text-[12.5px] text-subtle">
                      {[r.cpu_usage_pct !== null && `CPU ${r.cpu_usage_pct}%`, r.memory_usage_pct !== null && `memory ${r.memory_usage_pct}%`, uptime(r.uptime_seconds) && `up ${uptime(r.uptime_seconds)}`, `seen ${lagos(r.last_seen_at)}`].filter(Boolean).join(', ')}
                    </span>
                  )}
                </span>
                {r.lifecycle_status === 'active' ? <Badge tone={routerHealth(r.status, r.last_seen_at, now).tone}>{routerHealth(r.status, r.last_seen_at, now).label}</Badge> : <Badge>Not active yet</Badge>}
              </li>
            ))}
            {routers.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No router here yet.</li>}
          </ul>
        </Panel>

        <Panel title="Plans on sale here" flush action={<Link prefetch={false} href="/admin/plans" className="text-sm font-semibold text-brand hover:underline">Manage plans</Link>}>
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
          <Link prefetch={false} href="/admin/transactions" className="text-sm font-semibold text-brand hover:underline">All payments</Link>
        </div>
        <TableFrame>
          <thead>
            <tr><th className={th}>Started</th><th className={th}>Customer</th><th className={th}>Plan</th><th className={th}>Status</th><th className={`${th} text-right`}>Amount</th></tr>
          </thead>
          <tbody>
            {purchases.map((p) => {
              const st = PAY[p.status] ?? { label: p.status, tone: 'neutral' as BadgeTone };
              return (
                <tr key={p.id} className={tr}>
                  <td className={`${td} tnum whitespace-nowrap text-muted`}>{lagos(p.created_at)}</td>
                  <td className={`${td} tnum`}>{p.phone_number ? `+${p.phone_number}` : '—'}</td>
                  <td className={td}>{p.plan ?? '—'}</td>
                  <td className={td}><Badge tone={st.tone}>{st.label}</Badge></td>
                  <td className={`${td} tnum text-right`}>₦{(p.amount_paid !== null ? Number(p.amount_paid) : (p.amount_kobo ?? 0) / 100).toLocaleString('en-NG')}</td>
                </tr>
              );
            })}
            {purchases.length === 0 && <EmptyRow cols={5}>No purchases here yet.</EmptyRow>}
          </tbody>
        </TableFrame>
      </section>
    </div>
  );
}
