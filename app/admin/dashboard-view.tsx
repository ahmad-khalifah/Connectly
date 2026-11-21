'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Alert } from '@/lib/admin/alerts';
import { computeMetrics, DEFINITIONS, isPeriod, PERIODS, type Period } from '@/lib/admin/metrics';
import type { NetworkPart, PaidPart, PeoplePart } from '@/lib/admin/metrics-loader';
import { isUuid } from '@/lib/admin/inputs';
import AlertsPanel from './components/alerts-panel';
import { PageHeader } from '@/components/admin/page-header';
import { Stat, StatGrid } from '@/components/admin/stat-grid';
import { DashboardFilters } from '@/components/admin/dashboard-filters';
import { RevenueChart } from '@/components/admin/revenue-chart';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { routerHealth } from '@/lib/admin/router-health';
import { adminFetch, LoadError, Loading, useAdminView, viewUrl } from '@/components/admin/admin-data';

// The dashboard, drawn in the browser from five small data requests made at
// once (lib/http/admin-api.ts), so each stays within Cloudflare's free CPU
// limit. The figures are worked out here with the same computeMetrics.

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const how = (name: string) => DEFINITIONS.find((d) => d.name === name)?.how;
const lagosTime = (iso: string) => new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

type Side = {
  locations: { id: string; name: string }[];
  routers: { id: string; name: string | null; identifier: string; status: string | null; lifecycle_status: string; last_seen_at: string | null; location_id: string | null }[];
  activity: { id: string; event_type: string; severity: string; message: string; created_at: string }[];
};

export default function DashboardView() {
  const sp = useSearchParams();
  const period: Period = isPeriod(sp.get('period')) ? (sp.get('period') as Period) : '30d';
  const locationId = isUuid(sp.get('location')) ? sp.get('location') : null;
  const periodLabel = PERIODS.find((p) => p.id === period)!.label.toLowerCase();
  const [swept, setSwept] = useState(0);

  const paid = useAdminView<PaidPart>(viewUrl('dashboard-paid', { period, location: locationId, swept: swept ? String(swept) : null }));
  const people = useAdminView<PeoplePart>(viewUrl('dashboard-people', { period, location: locationId }));
  const network = useAdminView<NetworkPart>(viewUrl('dashboard-network'));
  const alerts = useAdminView<Alert[]>(viewUrl('dashboard-alerts'));
  const side = useAdminView<Side>(viewUrl('dashboard-side'));

  // Settle recent payments whose Korapay notification never arrived, in the
  // background; if any changed, the money figures load again.
  useEffect(() => {
    adminFetch('/api/admin/sweep', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { confirmed?: number; failed?: number } | null) => {
        if (s && (s.confirmed || s.failed)) setSwept((n) => n + 1);
      })
      .catch(() => {});
  }, []);

  const locations = side.loaded.state === 'ready' ? side.loaded.data.locations : [];
  const locationName = locationId ? locations.find((l) => l.id === locationId)?.name : null;
  const now = new Date();

  const parts = [paid, people, network] as const;
  const failed = parts.find((p) => p.loaded.state === 'error' || p.loaded.state === 'not_found');
  const ready = paid.loaded.state === 'ready' && people.loaded.state === 'ready' && network.loaded.state === 'ready';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Figures come straight from the database, in Lagos time${locationName ? `, for ${locationName}` : ', for all locations'}. Hover a figure to see how it is worked out.`}
      />
      <DashboardFilters period={period} locationId={locationId} locations={locations} />

      {alerts.loaded.state === 'ready' && alerts.loaded.data.length > 0 && <AlertsPanel alerts={alerts.loaded.data} />}

      {failed ? (
        <LoadError message={failed.loaded.state === 'error' ? failed.loaded.message : 'Not found'} onRetry={() => parts.forEach((p) => p.reload())} />
      ) : ready && paid.loaded.state === 'ready' && people.loaded.state === 'ready' && network.loaded.state === 'ready' ? (
        <Figures
          m={computeMetrics({ ...paid.loaded.data, ...people.loaded.data, ...network.loaded.data }, { period, locationId, now })}
          periodLabel={periodLabel}
          filtered={Boolean(locationId)}
        />
      ) : (
        <Loading label="Loading the figures" />
      )}

      <SidePanels side={side.loaded.state === 'ready' ? side.loaded.data : null} locationId={locationId} locationName={locationName ?? null} now={now} />

      <Panel title="How these figures are calculated">
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {DEFINITIONS.map((d) => (
            <div key={d.name}>
              <dt className="font-semibold text-ink">{d.name}</dt>
              <dd className="mt-0.5 leading-relaxed text-muted">{d.how}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}

function SidePanels({ side, locationId, locationName, now }: { side: Side | null; locationId: string | null; locationName: string | null; now: Date }) {
  const activity = side?.activity ?? [];
  const routers = (side?.routers ?? []).filter((r) => !locationId || r.location_id === locationId);
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Panel title="Recent activity" description="Latest admin actions, payments and network events. Refreshes when you reload the page." flush className="lg:col-span-3">
        <ul className="divide-y divide-line">
          {activity.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
              <span className="min-w-0">
                <span className="block text-ink">{e.message}</span>
                <span className="text-[12.5px] text-subtle">{e.event_type}</span>
              </span>
              <span className="tnum shrink-0 text-[12.5px] text-muted">{lagosTime(e.created_at)}</span>
            </li>
          ))}
          {side && activity.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">Nothing recorded yet.</li>}
          {!side && <li className="px-5 py-8"><Loading /></li>}
        </ul>
      </Panel>
      <Panel title="Routers" description="Health from the controller's check every minute. A router not checked for 5 minutes shows No recent check." flush className="lg:col-span-2"
        action={<Link href="/admin/network" className="text-sm font-semibold text-brand hover:underline">Manage</Link>}>
        <ul className="divide-y divide-line">
          {routers.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span className="min-w-0">
                <Link href={`/admin/network/routers/${r.id}`} className="block truncate font-semibold text-ink hover:text-brand">{r.name ?? r.identifier}</Link>
                <span className="text-[12.5px] text-subtle">
                  {r.lifecycle_status === 'active' ? `Last seen ${r.last_seen_at ? lagosTime(r.last_seen_at) : 'never'}` : `Not active yet (${r.lifecycle_status})`}
                </span>
              </span>
              {r.lifecycle_status === 'active' ? (
                <Badge tone={routerHealth(r.status, r.last_seen_at, now.getTime()).tone}>{routerHealth(r.status, r.last_seen_at, now.getTime()).label}</Badge>
              ) : (
                <Badge>Not checked</Badge>
              )}
            </li>
          ))}
          {side && routers.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No routers{locationName ? ' at this location' : ''} yet.</li>}
          {!side && <li className="px-5 py-8"><Loading /></li>}
        </ul>
      </Panel>
    </div>
  );
}

function Figures({ m, periodLabel, filtered }: { m: ReturnType<typeof computeMetrics>; periodLabel: string; filtered: boolean }) {
  const { money, customers, network } = m;
  return (
    <>
      <section aria-labelledby="money" className="space-y-3">
        <h2 id="money" className="text-lg font-bold text-ink">Money <span className="font-normal text-muted">({periodLabel})</span></h2>
        <StatGrid cols={5}>
          <Stat label="Revenue" value={naira(money.revenue)} how={how('Revenue')} />
          <Stat label="Korapay fees" value={naira(money.fees)} how={how('Korapay fees')} />
          <Stat label="Revenue after fees" value={naira(money.afterFees)} how={how('Revenue after fees')} />
          <Stat label="Expenses" value={naira(money.expenses)} how={how('Expenses')} note={money.expenses === 0 ? 'None recorded' : undefined} />
          <Stat label="Net profit" value={naira(money.netProfit)} tone={money.netProfit < 0 ? 'bad' : undefined} how={how('Net profit')} />
        </StatGrid>
        <StatGrid cols={2}>
          <Stat label="Successful payments" value={money.successfulPayments} how={how('Successful payments')} />
          <Stat label="Failed payments" value={money.failedPayments} tone={money.failedPayments > 0 ? 'warn' : undefined} how={how('Failed payments')} />
        </StatGrid>
      </section>

      <Panel title="Revenue" description={m.seriesUnit === 'day' ? `Per day, ${periodLabel}.` : 'Per month, all time.'}>
        <dl className="mb-5 grid grid-cols-2 gap-4 border-b border-line pb-5 sm:grid-cols-4">
          {([['Today', money.windows.today], ['Last 7 days', money.windows.last7], ['This month', money.windows.month], ['All time', money.windows.all]] as const).map(([l, v]) => (
            <div key={l}>
              <dt className="text-[13px] text-muted">{l}</dt>
              <dd className="tnum text-lg font-bold text-ink">{naira(v)}</dd>
            </div>
          ))}
        </dl>
        <RevenueChart data={m.series} unit={m.seriesUnit} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="customers" className="space-y-3">
          <h2 id="customers" className="text-lg font-bold text-ink">Customers</h2>
          <StatGrid cols={2}>
            <Stat label="Plans running now" value={customers.plansRunning} how={how('Plans running now')} />
            <Stat label="Customers on a plan" value={customers.customersOnPlans} how={how('Customers on a plan')} />
            <Stat label={`Plans ended, ${periodLabel}`} value={customers.plansEnded} how={how('Plans ended')} />
            <Stat label={`Ended early, ${periodLabel}`} value={customers.endedEarly} how={how('Ended early')} />
            <Stat label="Registered customers" value={customers.registered} note={filtered ? 'All locations' : 'All time'} how={how('Registered customers')} />
            <Stat label={`New customers, ${periodLabel}`} value={customers.newCustomers} note={filtered ? 'All locations' : undefined} how={how('New customers')} />
          </StatGrid>
        </section>
        <section aria-labelledby="network" className="space-y-3">
          <h2 id="network" className="text-lg font-bold text-ink">Network</h2>
          <StatGrid cols={2}>
            <Stat label="Routers online" value={network.routersOnline} tone={network.routersOnline > 0 ? 'ok' : undefined} how={how('Routers online and offline')}
              note={[network.routersUnchecked && `${network.routersUnchecked} not checked in the last 5 minutes`, network.routersNotActive && `${network.routersNotActive} registered, not active yet`].filter(Boolean).join('. ') || undefined} />
            <Stat label="Routers offline" value={network.routersOffline} tone={network.routersOffline > 0 ? 'bad' : undefined} how={how('Routers online and offline')} />
            <Stat label="Controller" value={network.controllerLive ? 'Running' : 'Stopped'} tone={network.controllerLive ? 'ok' : 'bad'} how={how('Controller')} />
            <Stat label="Locations open" value={`${network.locationsOpen} of ${network.locationsTotal}`} note="Set by an admin" how={how('Locations open')} />
            <Stat label="Jobs waiting" value={network.jobsWaiting} how={how('Jobs waiting')} />
            <Stat label={`Jobs that gave up, ${periodLabel}`} value={network.jobsGaveUp} tone={network.jobsGaveUp > 0 ? 'bad' : undefined} how={how('Jobs that gave up')} />
            <Stat label="Devices online now" value={network.devicesOnline} how={how('Devices online now')}
              note={network.controllerLive ? undefined : 'Controller stopped: not current'} />
            <Stat label="Data use" unmeasured how={how('Data use')} />
          </StatGrid>
        </section>
      </div>
    </>
  );
}
