import { db } from '@/lib/db/client';
import { requireAdminApi } from '@/lib/auth/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { parseRouterInput, routerRow } from '@/lib/network/routers';
import { issueRouterCredential, CredentialKeyError } from '@/lib/network/credentials';

// Register a router. The API password is generated and encrypted here and
// only its ciphertext is stored; neither is ever returned or logged.
export async function POST(req: Request) {
  const { user, denied } = await requireAdminApi(req);
  if (denied) return denied;

  const parsed = parseRouterInput(await req.json().catch(() => null));
  if (!parsed.ok) return Response.json({ message: parsed.error }, { status: 400 });

  const { data: location } = await db.from('locations').select('id').eq('id', parsed.value.locationId).maybeSingle();
  if (!location) return Response.json({ message: 'That location does not exist.' }, { status: 400 });

  let credential;
  try {
    credential = await issueRouterCredential();
  } catch (err) {
    console.error('[ROUTER_CREDENTIAL_ERROR]', err instanceof CredentialKeyError ? err.message : 'unexpected');
    return Response.json({ message: 'The controller key is invalid, so no credential could be generated.' }, { status: 500 });
  }

  const { data, error } = await db
    .from('routers')
    .insert({
      ...routerRow(parsed.value),
      lifecycle_status: 'registered',
      ...(credential ? { api_user: credential.apiUser, credential_ciphertext: credential.ciphertext, credential_key_id: credential.keyId } : {}),
    })
    .select('id, tunnel_ip')
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      const what = /wg_public_key/.test(error.message) ? 'WireGuard key' : 'identifier';
      return Response.json({ message: `Another router already uses that ${what}.` }, { status: 409 });
    }
    console.error('[ROUTER_CREATE_ERROR]', error?.code, error?.message);
    return Response.json({ message: 'Could not register the router.' }, { status: 500 });
  }

  await logAdminAction(user, 'router.registered', `Router "${parsed.value.name}" registered`, data.id, {
    locationId: parsed.value.locationId,
    metadata: { identifier: parsed.value.identifier, connection_method: parsed.value.connectionMethod, credential: credential ? 'stored' : 'waiting_for_controller_key' },
  });
  return Response.json({ id: data.id, credential: credential ? 'stored' : 'waiting_for_controller_key' }, { status: 201 });
}
