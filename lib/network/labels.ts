// Names and statuses shown on the admin pages. No server imports, so the
// pages (drawn in the browser) and the server code share one list.

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'dead'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const JOB_KINDS = ['router.test', 'router.sync_profiles', 'router.configure_hotspot', 'access.provision', 'access.revoke', 'access.login', 'session.disconnect'] as const;

export const JOB_LABELS: Record<string, string> = {
  'router.test': 'Test connection',
  'router.sync_profiles': 'Sync speed profiles',
  'router.configure_hotspot': 'Set up hotspot',
  'access.provision': 'Provision access',
  'access.revoke': 'Revoke access',
  'access.login': 'Log device in',
  'session.disconnect': 'Disconnect session',
};

export const GRANT_STATUSES = ['pending_device', 'active', 'revoked', 'expired'] as const;

export const GRANT_LABELS: Record<string, string> = {
  pending_device: 'Waiting for router',
  active: 'On router',
  revoked: 'Revoked',
  expired: 'Expired',
};
