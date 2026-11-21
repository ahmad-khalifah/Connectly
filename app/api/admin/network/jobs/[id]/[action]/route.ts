import { requireAdminApi } from '@/lib/auth/admin';
import { isUuid } from '@/lib/admin/inputs';
import { cancelJob, retryJob } from '@/lib/network/jobs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { user, denied } = await requireAdminApi(req);
  if (denied) return denied;

  const { id, action } = await params;
  if (!isUuid(id)) return Response.json({ message: 'Job not found.' }, { status: 404 });
  const admin = user.email ?? 'admin';

  const result = action === 'retry' ? await retryJob(id, admin) : action === 'cancel' ? await cancelJob(id, admin) : null;
  if (!result) return Response.json({ message: 'Unknown action.' }, { status: 404 });
  if (!result.ok) return Response.json({ message: result.message }, { status: result.status });
  return Response.json({ success: true });
}
