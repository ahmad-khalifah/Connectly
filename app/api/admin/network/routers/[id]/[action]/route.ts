import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireAdminApi } from '@/lib/auth/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { isUuid } from '@/lib/admin/inputs';
import { activationBlockers, canRetire, canSuspend, canTest, type RouterForLifecycle } from '@/lib/network/routers';
import { issueRouterCredential, CredentialKeyError } from '@/lib/network/credentials';

type Ctx = { params: Promise<{ id: string; action: string }> };
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

// Lifecycle columns only. credential_key_id stands in for "a credential is
// stored" (the database requires the ciphertext for an Active router), so
// the ciphertext itself is never even read here.
const COLUMNS =
  'id, name, location_id, lifecycle_status, connection_method, credential_key_id, wg_public_key, tunnel_ip, management_ip, last_test_at, last_test_result';

export async function POST(_req: Request, { params }: Ctx) {
  const { user, denied } = await requireAdminApi();
  if (denied) return denied;

  const { id, action } = await params;
  if (!isUuid(id)) return json(404, { message: 'Router not found.' });

  const { data: router } = await db.from('routers').select(COLUMNS).eq('id', id).maybeSingle();
  if (!router) return json(404, { message: 'Router not found.' });
  const who = user.email ?? 'admin';
  const audit = (event: string, message: string, metadata: Record<string, unknown> = {}) =>
    logAdminAction(user, event, message, id, { locationId: router.location_id, metadata });

  switch (action) {
    // ---------------------------------------------------------------- test
    // Queues a real check for the controller: it connects through the
    // tunnel and records the outcome on the router. Nothing is simulated;
    // until the controller runs, the job simply waits in the queue.
    case 'test': {
      if (!canTest(router.lifecycle_status)) return json(409, { message: 'A retired router cannot be tested.' });
      const { data: pending } = await db
        .from('controller_jobs')
        .select('id, status')
        .eq('router_id', id)
        .eq('kind', 'router.test')
        .in('status', ['queued', 'running'])
        .limit(1)
        .maybeSingle();
      if (pending) return json(200, { jobId: pending.id, status: pending.status, created: false });

      const { data, error } = await db.rpc('enqueue_job', {
        p_kind: 'router.test',
        p_router_id: id,
        p_authorization_id: null,
        p_payload: {},
        p_idempotency_key: `test:${id}:${Date.now()}`,
        p_requested_by: who,
      });
      if (error) {
        console.error('[ROUTER_TEST_ENQUEUE_ERROR]', error.code, error.message);
        return json(500, { message: 'Could not queue the test.' });
      }
      await audit('router.test_requested', `Test Connection requested for "${router.name}"`);
      const r = data as { job_id: string; status: string; created: boolean };
      return json(201, { jobId: r.job_id, status: r.status, created: r.created });
    }

    // ------------------------------------------------------------ activate
    case 'activate': {
      const lifecycleView: RouterForLifecycle = { ...router, has_credential: Boolean(router.credential_key_id) };
      const blockers = activationBlockers(lifecycleView);
      if (blockers.length) return json(409, { message: 'This router cannot be activated yet.', reasons: blockers });

      // Conditional on the exact test that was checked, so a newer failed
      // test written by the controller in between stops the activation.
      let q = db
        .from('routers')
        .update({ lifecycle_status: 'active', activated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .in('lifecycle_status', ['registered', 'suspended']);
      q = router.last_test_at ? q.eq('last_test_at', router.last_test_at) : q;
      const { data, error } = await q.select('id');
      if (error) {
        console.error('[ROUTER_ACTIVATE_ERROR]', error.code, error.message);
        return json(500, { message: 'Could not activate the router.' });
      }
      if (!data?.length) return json(409, { message: 'The router changed meanwhile; refresh and try again.' });
      await audit('router.activated', `Router "${router.name}" activated`);
      return json(200, { success: true });
    }

    // ------------------------------------------------------------- suspend
    // Stops new sales and new provisioning. Customers already online keep
    // access until expiry: revoke jobs still run for suspended routers.
    case 'suspend': {
      if (!canSuspend(router.lifecycle_status)) return json(409, { message: 'Only an Active router can be suspended.' });
      const { data } = await db
        .from('routers')
        .update({ lifecycle_status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('lifecycle_status', 'active')
        .select('id');
      if (!data?.length) return json(409, { message: 'The router changed meanwhile; refresh and try again.' });
      await audit('router.suspended', `Router "${router.name}" suspended`);
      return json(200, { success: true });
    }

    // -------------------------------------------------------------- retire
    // Permanent. Refused while any customer still has access through the
    // router, because the controller no longer acts on a retired router and
    // could not remove that access when it expires.
    case 'retire': {
      if (!canRetire(router.lifecycle_status)) return json(409, { message: 'Suspend the router before retiring it.' });
      const { count } = await db
        .from('network_authorizations')
        .select('id', { count: 'exact', head: true })
        .eq('router_id', id)
        .in('status', ['pending_device', 'active'])
        .gt('expires_at', new Date().toISOString());
      if (count) return json(409, { message: `${count} customer${count === 1 ? ' still has' : 's still have'} access through this router. Retire it after their time runs out.` });
      const { data } = await db
        .from('routers')
        .update({ lifecycle_status: 'retired', retired_at: new Date().toISOString(), tunnel_ip: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .in('lifecycle_status', ['registered', 'suspended'])
        .select('id');
      if (!data?.length) return json(409, { message: 'The router changed meanwhile; refresh and try again.' });
      await audit('router.retired', `Router "${router.name}" retired`);
      return json(200, { success: true });
    }

    // ---------------------------------------------------------- credential
    // For a router registered before the controller published its key.
    case 'credential': {
      if (router.credential_key_id) return json(409, { message: 'A credential is already stored for this router.' });
      if (router.lifecycle_status !== 'registered') return json(409, { message: 'Credentials are issued to Registered routers only.' });
      let credential;
      try {
        credential = await issueRouterCredential();
      } catch (err) {
        console.error('[ROUTER_CREDENTIAL_ERROR]', err instanceof CredentialKeyError ? err.message : 'unexpected');
        return json(500, { message: 'The controller key is invalid, so no credential could be generated.' });
      }
      if (!credential) return json(409, { message: 'The controller has not published its key yet.' });
      const { data } = await db
        .from('routers')
        .update({ api_user: credential.apiUser, credential_ciphertext: credential.ciphertext, credential_key_id: credential.keyId, updated_at: new Date().toISOString() })
        .eq('id', id)
        .is('credential_key_id', null)
        .select('id');
      if (!data?.length) return json(409, { message: 'A credential was stored meanwhile.' });
      await audit('router.credential_issued', `API credential generated for "${router.name}"`, { key_id: credential.keyId });
      return json(200, { success: true });
    }

    default:
      return json(404, { message: 'Unknown action.' });
  }
}
