import { requireAdminApi } from '@/lib/auth/admin';
import { isUuid } from '@/lib/admin/inputs';
import { logAdminAction } from '@/lib/admin/audit';
import { requestRevoke } from '@/lib/network/access';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, denied } = await requireAdminApi(req);
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return Response.json({ message: 'Access grant not found.' }, { status: 404 });

  const result = await requestRevoke(id, user.email ?? 'admin');
  if (!result.ok) return Response.json({ message: result.message }, { status: result.status });

  await logAdminAction(user, 'access.revoke_requested', 'Early revoke requested for an access grant', id, { metadata: { job_id: result.jobId, created: result.created } });
  return Response.json({ jobId: result.jobId, created: result.created }, { status: result.created ? 201 : 200 });
}
