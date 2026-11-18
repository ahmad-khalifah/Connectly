import Link from 'next/link';
import { appUrl } from '@/lib/env';
import { db } from '@/lib/db/client';
import { requestTime } from '@/lib/time';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, TableFrame, td, th, tr } from '@/components/admin/table';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';

export const dynamic = 'force-dynamic';

type Loc = {
  id: string; name: string; slug: string; status: string | null; is_active: boolean | null;
  institutions: { name: string } | { name: string }[] | null;
  routers: { id: string; status: string | null; lifecycle_status: string }[] | null;
  purchases: { status: string; amount_paid: number | null; amount_kobo: number | null; network_authorizations: { status: string; revoked_at: string | null; expires_at: string }[] | null }[] | null;
};

export default async function LocationsPage() {
  const { data, error } = await db
    .from('locations')
    .select('id, name, slug, status, is_active, institutions(name), routers(id, status, lifecycle_status), purchases(status, amount_paid, amount_kobo, network_authorizations(status, revoked_at, expires_at))')
    .order('name', { ascending: true });

  const now = requestTime();
  const rows = ((data ?? []) as unknown as Loc[]).map((l) => {
    const purchases = l.purchases ?? [];
    const running = purchases.flatMap((p) => p.network_authorizations ?? []).filter((g) => (g.status === 'active' || g.status === 'pending_device') && !g.revoked_at && Date.parse(g.expires_at) > now).length;
    const revenue = purchases.filter((p) => p.status === 'paid').reduce((s, p) => s + (p.amount_paid !== null ? Number(p.amount_paid) : (p.amount_kobo ?? 0) / 100), 0);
    const active = (l.routers ?? []).filter((r) => r.lifecycle_status === 'active');
    const inst = Array.isArray(l.institutions) ? l.institutions[0] : l.institutions;
    return { ...l, running, revenue, routersOnline: active.filter((r) => r.status === 'online').length, routersActive: active.length, routersTotal: (l.routers ?? []).filter((r) => r.lifecycle_status !== 'retired').length, institution: inst?.name ?? null };
  });
  const base = appUrl();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations"
        description="Each site Connectly serves: its routers, the plans running there and what it has taken."
        actions={<ButtonLink href="/admin/locations/new">New location</ButtonLink>}
      />
      {error && <Notice tone="bad" title="Locations could not be loaded">The database did not answer. Refresh to try again.</Notice>}
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
          {rows.map((l) => (
            <tr key={l.id} className={tr}>
              <td className={td}>
                <Link href={`/admin/locations/${l.id}`} className="font-semibold text-ink hover:text-brand">{l.name}</Link>
                {l.institution && <span className="block text-[12.5px] text-muted">{l.institution}</span>}
              </td>
              <td className={td}>{l.is_active === false ? <Badge>Not selling</Badge> : <Badge tone="ok">Selling</Badge>}</td>
              <td className={`${td} tnum`}>
                {l.routersActive ? (
                  <span className={l.routersOnline < l.routersActive ? 'font-semibold text-bad' : ''}>{l.routersOnline} of {l.routersActive}</span>
                ) : <span className="text-muted">{l.routersTotal ? `${l.routersTotal} not active yet` : 'None'}</span>}
              </td>
              <td className={`${td} tnum text-right`}>{l.running}</td>
              <td className={`${td} tnum text-right`}>₦{l.revenue.toLocaleString('en-NG')}</td>
              <td className={`${td} text-[13px]`}>
                <a href={`${base}/connect?loc=${l.slug}`} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">/connect?loc={l.slug}</a>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={6}>No locations yet. Create one, then register its router.</EmptyRow>}
        </tbody>
      </TableFrame>
      <p className="text-[13px] text-muted">The information link is for posters and QR codes: it tells people to join the WiFi. Plans are bought on the WiFi sign-in page, which knows the router.</p>
    </div>
  );
}
