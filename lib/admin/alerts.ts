// Things that need someone's attention, worked out from data the platform
// already records. Shown on the dashboard and the Network page, so a problem
// is visible without searching for it.

import { db } from '@/lib/db/client';
import { isControllerLive } from '@/lib/network/jobs';
import { smsConfigured } from '@/lib/sms';

export type Alert = { severity: 'error' | 'warn' | 'info'; title: string; detail: string; href: string };

const DAY_MS = 24 * 3_600_000;
export const STUCK_GRANT_MS = 10 * 60_000;
/** A router running the on-router agent checks in every 15 s; silence for this long is a problem. */
export const AGENT_STALE_MS = 3 * 60_000;

type AlertRouter = { id: string; name: string | null; identifier: string; status: string | null; agent_enabled?: boolean | null; agent_last_seen_at?: string | null };
/** True when the router's own agent is doing the controller's work and is checking in. */
export const agentLive = (r: Pick<AlertRouter, 'agent_enabled' | 'agent_last_seen_at'>, now: number) =>
  Boolean(r.agent_enabled && r.agent_last_seen_at && now - Date.parse(r.agent_last_seen_at) <= AGENT_STALE_MS);

export async function loadAlerts(now = Date.now()): Promise<Alert[]> {
  const since = new Date(now - DAY_MS).toISOString();
  const stuckBefore = new Date(now - STUCK_GRANT_MS).toISOString();
  const [routers, controllers, deadJobs, stuck, grantFailed, mismatches, smsFailed] = await Promise.all([
    db.from('routers').select('id, name, identifier, status, last_seen_at, agent_enabled, agent_last_seen_at').eq('lifecycle_status', 'active'),
    db.from('controller_instances').select('last_heartbeat_at').order('last_heartbeat_at', { ascending: false }).limit(1),
    db.from('controller_jobs').select('id', { count: 'exact', head: true }).eq('status', 'dead').gte('updated_at', since),
    db.from('network_authorizations').select('id', { count: 'exact', head: true }).eq('status', 'pending_device').lte('created_at', stuckBefore).gt('expires_at', new Date(now).toISOString()),
    db.from('activity_logs').select('id', { count: 'exact', head: true }).eq('event_type', 'access.grant_failed').gte('created_at', since),
    db.from('activity_logs').select('id', { count: 'exact', head: true }).eq('event_type', 'payment_mismatch').gte('created_at', since),
    db.from('notifications').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since),
  ]);

  const alerts: Alert[] = [];
  const active = (routers.data ?? []) as AlertRouter[];
  const last = controllers.data?.[0]?.last_heartbeat_at as string | undefined;
  // Routers with their own agent do not need the old controller; only the rest do.
  const needController = active.filter((r) => !r.agent_enabled);
  if (needController.length > 0 && !(last && isControllerLive(last, now))) {
    alerts.push({ severity: 'error', title: 'Network Controller is not running', detail: 'New customers are not being let onto the WiFi, and expired customers are not being removed.', href: '/admin/network' });
  }
  for (const r of active.filter((x) => x.agent_enabled && !agentLive(x, now))) {
    alerts.push({ severity: 'error', title: `${r.name ?? r.identifier} has stopped checking in`, detail: 'Check that the router is on and has internet. New customers cannot get online until it is back.', href: `/admin/network/router?id=${r.id}` });
  }
  for (const r of active.filter((x) => x.status === 'offline' && !(x.agent_enabled && !agentLive(x, now)))) {
    alerts.push({ severity: 'error', title: `Router ${r.name ?? r.identifier} is offline`, detail: 'We cannot reach it. Customers at this location may be unable to pay or connect.', href: `/admin/network/router?id=${r.id}` });
  }
  const n = (r: { count: number | null }) => r.count ?? 0;
  if (n(stuck)) alerts.push({ severity: 'error', title: `${n(stuck)} paid customer${n(stuck) === 1 ? ' is' : 's are'} waiting for access`, detail: 'They paid more than 10 minutes ago but are not online yet.', href: '/admin/network/access?status=pending_device' });
  if (n(grantFailed)) alerts.push({ severity: 'error', title: `${n(grantFailed)} payment${n(grantFailed) === 1 ? '' : 's'} could not create access`, detail: 'Payment confirmed but no access grant was made (last 24 hours). See the activity log.', href: '/admin' });
  if (n(deadJobs)) alerts.push({ severity: 'warn', title: `${n(deadJobs)} router task${n(deadJobs) === 1 ? '' : 's'} failed`, detail: 'It was tried several times and gave up (last 24 hours).', href: '/admin/network/jobs?status=dead' });
  if (n(mismatches)) alerts.push({ severity: 'warn', title: `${n(mismatches)} payment${n(mismatches) === 1 ? '' : 's'} did not match the price`, detail: 'Korapay reported a different amount or currency (last 24 hours).', href: '/admin/transactions' });
  if (!smsConfigured()) {
    alerts.push({ severity: 'info', title: 'SMS pending provider approval', detail: `Waiting for Termii to approve the sender ID. Payments and WiFi work as normal; customers see their code on the payment page.${n(smsFailed) ? ` ${n(smsFailed)} message${n(smsFailed) === 1 ? ' was' : 's were'} not sent in the last 24 hours.` : ''}`, href: '/admin/settings' });
  } else if (n(smsFailed)) {
    alerts.push({ severity: 'warn', title: `${n(smsFailed)} SMS failed`, detail: 'Customers may not have received their code or reminder (last 24 hours). Check Settings → SMS test.', href: '/admin/settings' });
  }
  return alerts;
}
