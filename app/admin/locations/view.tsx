'use client';

import { useState } from 'react';
import Link from 'next/link';
import { routerHealth } from '@/lib/admin/router-health';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, TableFrame, td, th, tr } from '@/components/admin/table';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type Loc = {
  id: string; name: string; slug: string; is_active: boolean | null; institution: string | null;
  routers: { status: string | null; lifecycle_status: string; last_seen_at: string | null }[];
  running: number; revenue: number;
};
type Data = { base: string; failed: boolean; revenueFailed: boolean; locations: Loc[] };

export default function LocationsView() {
  const { loaded, reload } = useAdminView<Data>(viewUrl('locations'));
  const [now] = useState(() => Date.now()); // when the page opened, for router health
  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations"
        description="Each site Connectly serves: its routers, the plans running there and what it has taken."
        actions={<ButtonLink href="/admin/locations/new">New location</ButtonLink>}
      />
      <ViewState loaded={loaded} reload={reload}>
        {({ base, failed, revenueFailed, locations }) => (
          <>
            {failed && <Notice tone="bad" title="Locations could not be loaded">The database did not answer. Refresh to try again.</Notice>}
            {revenueFailed && <Notice tone="warn">Revenue could not be loaded; it shows as ₦0.</Notice>}
            <TableFrame>
              <thead>
                <tr>
                  <th className={th}>Location</th>
                  <th className={th}>Selling</th>
                  <th className={th}>Routers online</th>
                  <th className={`${th} text-right`}>Plans running now</th>
                  <th className={`${th} text-right`}>Paid revenue, all time</th>
                  <th className={th}>Information link</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => {
                  const active = l.routers.filter((r) => r.lifecycle_status === 'active');
                  const online = active.filter((r) => routerHealth(r.status, r.last_seen_at, now).label === 'Online').length;
                  const total = l.routers.filter((r) => r.lifecycle_status !== 'retired').length;
                  return (
                    <tr key={l.id} className={tr}>
                      <td className={td}>
                        <Link prefetch={false} href={`/admin/location?id=${l.id}`} className="font-semibold text-ink hover:text-brand">{l.name}</Link>
                        {l.institution && <span className="block text-[12.5px] text-muted">{l.institution}</span>}
                      </td>
                      <td className={td}>{l.is_active === false ? <Badge>Not selling</Badge> : <Badge tone="ok">Selling</Badge>}</td>
                      <td className={`${td} tnum`}>
                        {active.length ? (
                          <span className={online < active.length ? 'font-semibold text-bad' : ''}>{online} of {active.length}</span>
                        ) : <span className="text-muted">{total ? `${total} not active yet` : 'None'}</span>}
                      </td>
                      <td className={`${td} tnum text-right`}>{l.running}</td>
                      <td className={`${td} tnum text-right`}>₦{l.revenue.toLocaleString('en-NG')}</td>
                      <td className={`${td} text-[13px]`}>
                        <a href={`${base}/connect?loc=${l.slug}`} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">/connect?loc={l.slug}</a>
                      </td>
                    </tr>
                  );
                })}
                {locations.length === 0 && <EmptyRow cols={6}>No locations yet. Create one, then register its router.</EmptyRow>}
              </tbody>
            </TableFrame>
            <p className="text-[13px] text-muted">The information link is for posters and QR codes: it tells people to join the WiFi. Plans are bought on the WiFi sign-in page, which knows the router.</p>
          </>
        )}
      </ViewState>
    </div>
  );
}
