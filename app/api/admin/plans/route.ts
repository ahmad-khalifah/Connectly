import { db } from '@/lib/db/client';
import { requireAdminApi } from '@/lib/auth/admin';
import { parsePlanInput, planRow } from '@/lib/admin/inputs';
import { logAdminAction } from '@/lib/admin/audit';

export async function POST(request: Request) {
  const { user, denied } = await requireAdminApi(request);
  if (denied) return denied;

  const parsed = parsePlanInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.error }, { status: 400 });

  // Single-organisation deployment: plans belong to the first organisation.
  const { data: org } = await db.from('organizations').select('id').order('created_at').limit(1).maybeSingle();

  const { data, error } = await db
    .from('plans')
    .insert({ ...planRow(parsed.value), organization_id: org?.id ?? null })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[PLAN_CREATE_ERROR]', error);
    return Response.json({ message: 'Could not create the plan.' }, { status: 500 });
  }

  await logAdminAction(user, 'plan.created', `Plan "${parsed.value.name}" created`, data.id, { metadata: planRow(parsed.value) });
  return Response.json({ success: true, id: data.id }, { status: 201 });
}
