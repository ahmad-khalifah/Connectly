import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/admin';
import { isUuid } from '@/lib/admin/inputs';
import { logAdminAction } from '@/lib/admin/audit';
import { requestRevoke } from '@/lib/network/access';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, denied } = await requireAdminApi();
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ message: 'Access grant not found.' }, { status: 404 });

  const result = await requestRevoke(id, user.email ?? 'admin');
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });

  await logAdminAction(user, 'access.revoke_requested', 'Early revoke requested for an access grant', id, { metadata: { job_id: result.jobId, created: result.created } });
  return NextResponse.json({ jobId: result.jobId, created: result.created }, { status: result.created ? 201 : 200 });
}
