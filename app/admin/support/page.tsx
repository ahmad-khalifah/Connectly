import Link from 'next/link';
import { db } from '@/lib/db/client';
import TicketStatus from './ticket-status';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, lagos, TableFrame, td, th, tr } from '@/components/admin/table';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  open: { label: 'Open', tone: 'bad' },
  in_progress: { label: 'In progress', tone: 'warn' },
  resolved: { label: 'Resolved', tone: 'ok' },
};
const FILTERS = [
  { id: 'active', label: 'Needs attention' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'all', label: 'All' },
];
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const filter = FILTERS.some((f) => f.id === show) ? show! : 'active';

  let q = db.from('support_tickets').select('id, ticket_number, category, subject, description, status, assigned_to, created_at, resolved_at, customers(phone_number), locations(name)').order('created_at', { ascending: false }).limit(200);
  if (filter === 'active') q = q.in('status', ['open', 'in_progress']);
  if (filter === 'resolved') q = q.eq('status', 'resolved');
  const { data: tickets, error } = await q;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Customer problems and enquiries from the website. Site enquiries arrive with their subject starting [WiFi for your site]."
      />
      <nav aria-label="Ticket status" className="inline-flex flex-wrap rounded-[var(--radius-control)] border border-line bg-surface p-0.5">
        {FILTERS.map((f) => (
          <Link key={f.id} href={f.id === 'active' ? '/admin/support' : `/admin/support?show=${f.id}`} aria-current={f.id === filter ? 'true' : undefined}
            className={cn('rounded-md px-3 py-1.5 text-[13px] font-semibold', f.id === filter ? 'bg-brand text-white' : 'text-muted hover:bg-canvas hover:text-ink')}>
            {f.label}
          </Link>
        ))}
      </nav>
      {error && <Notice tone="bad" title="Tickets could not be loaded">Refresh to try again.</Notice>}

      <TableFrame>
        <thead>
          <tr>
            <th className={th}>Ticket</th><th className={th}>From</th><th className={th}>Subject and message</th>
            <th className={th}>Received</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {(tickets ?? []).map((t) => {
            const st = STATUS[t.status ?? 'open'] ?? STATUS.open;
            const phone = one(t.customers as { phone_number: string } | { phone_number: string }[] | null)?.phone_number;
            const loc = one(t.locations as { name: string } | { name: string }[] | null)?.name;
            return (
              <tr key={t.id} className={tr}>
                <td className={`${td} tnum font-semibold`}>#{t.ticket_number}</td>
                <td className={`${td} text-[13px]`}>{phone ? `+${phone}` : 'Website'}{loc && <span className="block text-muted">{loc}</span>}</td>
                <td className={`${td} max-w-[460px]`}>
                  <span className="font-semibold text-ink">{t.subject}</span>
                  <details className="mt-1 text-[13px] text-muted">
                    <summary className="cursor-pointer select-none font-semibold text-brand">Show message</summary>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">{t.description}</p>
                  </details>
                </td>
                <td className={`${td} tnum whitespace-nowrap text-muted`}>{lagos(t.created_at)}</td>
                <td className={td}>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {t.assigned_to && <span className="mt-1 block text-[12px] text-subtle">{t.assigned_to}</span>}
                </td>
                <td className={`${td} text-right`}><TicketStatus id={t.id} status={t.status ?? 'open'} /></td>
              </tr>
            );
          })}
          {(tickets ?? []).length === 0 && <EmptyRow cols={6}>{filter === 'active' ? 'Nothing needs attention.' : 'No tickets.'}</EmptyRow>}
        </tbody>
      </TableFrame>
    </div>
  );
}
