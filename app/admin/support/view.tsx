'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import TicketStatus from './ticket-status';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, lagos, TableFrame, td, th, tr } from '@/components/admin/table';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type Ticket = { id: string; ticket_number: number; subject: string; description: string; status: string; assigned_to: string | null; created_at: string; phone: string | null; location: string | null };
type Data = { filter: string; tickets: Ticket[]; notes: Record<string, string>; failed: boolean };

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

export default function SupportView() {
  const show = useSearchParams().get('show');
  const filter = FILTERS.some((f) => f.id === show) ? show! : 'active';
  const { loaded, reload } = useAdminView<Data>(viewUrl('support', { show: filter }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Customer problems and enquiries from the website. Site enquiries arrive with their subject starting [WiFi for your site]."
      />
      <nav aria-label="Ticket status" className="inline-flex flex-wrap rounded-[var(--radius-control)] border border-line bg-surface p-0.5">
        {FILTERS.map((f) => (
          <Link key={f.id} prefetch={false} href={f.id === 'active' ? '/admin/support' : `/admin/support?show=${f.id}`} aria-current={f.id === filter ? 'true' : undefined}
            className={cn('rounded-md px-3 py-1.5 text-[13px] font-semibold', f.id === filter ? 'bg-brand text-white' : 'text-muted hover:bg-canvas hover:text-ink')}>
            {f.label}
          </Link>
        ))}
      </nav>
      <ViewState loaded={loaded} reload={reload}>
        {({ tickets, notes, failed }) => (
          <>
            {failed && <Notice tone="bad" title="Tickets could not be loaded">Refresh to try again.</Notice>}
            <TableFrame>
              <thead>
                <tr>
                  <th className={th}>Ticket</th><th className={th}>From</th><th className={th}>Subject and message</th>
                  <th className={th}>Received</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const st = STATUS[t.status] ?? STATUS.open;
                  return (
                    <tr key={t.id} className={tr}>
                      <td className={`${td} tnum font-semibold`}>#{t.ticket_number}</td>
                      <td className={`${td} text-[13px]`}>{t.phone ? `+${t.phone}` : 'Website'}{t.location && <span className="block text-muted">{t.location}</span>}</td>
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
                        {notes[t.id] && <span className="mt-1 block max-w-[220px] text-[12px] text-muted">Note: {notes[t.id]}</span>}
                      </td>
                      <td className={`${td} text-right`}><TicketStatus id={t.id} status={t.status} number={t.ticket_number} /></td>
                    </tr>
                  );
                })}
                {tickets.length === 0 && <EmptyRow cols={6}>{filter === 'active' ? 'Nothing needs attention.' : 'No tickets.'}</EmptyRow>}
              </tbody>
            </TableFrame>
          </>
        )}
      </ViewState>
    </div>
  );
}
