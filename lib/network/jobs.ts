// Admin actions on controller jobs. Each is one conditional UPDATE, so it is
// safe against the controller and other admins acting at the same moment:
// a job that is running, or already finished, is never touched.

import { db } from '@/lib/db/client';

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'dead'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const JOB_KINDS = ['router.test', 'router.sync_profiles', 'access.provision', 'access.revoke', 'access.login', 'session.disconnect'] as const;

/** Extra attempts an admin retry grants, bounded by the table's limit of 50. */
export const RETRY_EXTRA_ATTEMPTS = 3;

export const JOB_LABELS: Record<string, string> = {
  'router.test': 'Test connection',
  'router.sync_profiles': 'Sync speed profiles',
  'access.provision': 'Provision access',
  'access.revoke': 'Revoke access',
  'access.login': 'Log device in',
  'session.disconnect': 'Disconnect session',
};

export type AdminJobResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * Puts a failed or dead job back in the queue to run now, with a few more
 * attempts. Router actions are written to be safe to repeat, so a retry
 * cannot create duplicate access.
 */
export async function retryJob(jobId: string, admin: string): Promise<AdminJobResult> {
  const { data: job } = await db.from('controller_jobs').select('id, status, attempts, max_attempts').eq('id', jobId).maybeSingle();
  if (!job) return { ok: false, status: 404, message: 'Job not found.' };
  if (job.status !== 'failed' && job.status !== 'dead')
    return { ok: false, status: 409, message: `A ${job.status} job cannot be retried.` };

  const { data, error } = await db
    .from('controller_jobs')
    .update({
      status: 'queued',
      run_after: new Date().toISOString(),
      max_attempts: Math.min(50, Math.max(job.max_attempts, job.attempts + RETRY_EXTRA_ATTEMPTS)),
      finished_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .in('status', ['failed', 'dead'])
    .select('id');
  if (error) return { ok: false, status: 500, message: 'Could not retry the job.' };
  if (!data?.length) return { ok: false, status: 409, message: 'The job changed meanwhile; refresh and try again.' };

  await logJobAction('job.retried', `Job retried by ${admin}`, jobId, admin);
  return { ok: true };
}

/** Stops a job that has not started (or is waiting to retry). Never a running one. */
export async function cancelJob(jobId: string, admin: string): Promise<AdminJobResult> {
  const { data, error } = await db
    .from('controller_jobs')
    .update({ status: 'dead', last_error: `Cancelled by ${admin}`, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .in('status', ['queued', 'failed'])
    .select('id');
  if (error) return { ok: false, status: 500, message: 'Could not cancel the job.' };
  if (!data?.length) return { ok: false, status: 409, message: 'Only a queued or failed job can be cancelled.' };

  await logJobAction('job.cancelled', `Job cancelled by ${admin}`, jobId, admin);
  return { ok: true };
}

async function logJobAction(event: string, message: string, jobId: string, admin: string) {
  try {
    await db.from('activity_logs').insert({ event_type: event, severity: 'info', entity_id: jobId, message, metadata: { operator: admin } });
  } catch (err) {
    console.error('[JOB_AUDIT_ERROR]', err);
  }
}

/** Controller heartbeat older than this means it is not running. */
export const CONTROLLER_STALE_MS = 2 * 60 * 1000;

export function isControllerLive(lastHeartbeatIso: string, now = Date.now()): boolean {
  return now - Date.parse(lastHeartbeatIso) < CONTROLLER_STALE_MS;
}
