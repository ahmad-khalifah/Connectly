import { requireAdminPage } from '@/lib/auth/admin';
import Link from 'next/link';
import { db } from '@/lib/db/client';
import RouterForm from '../../router-form';
import { PageHeader } from '@/components/admin/page-header';
import { Notice } from '@/components/ui/notice';

export const dynamic = 'force-dynamic';

export default async function NewRouterPage() {
  await requireAdminPage();
  const { data: locations } = await db.from('locations').select('id, name').eq('is_active', true).order('name');
  return (
    <div className="space-y-6">
      <PageHeader back={<Link href="/admin/network" className="font-semibold text-muted hover:text-brand">Routers</Link>} title="Register a router"
        description="Register it here first; the router page then shows the engineer exactly what to type." />
      {locations?.length ? (
        <RouterForm mode="create" locations={locations} />
      ) : (
        <Notice tone="warn" title="Create a location first">Every router belongs to a location that is selling plans.</Notice>
      )}
    </div>
  );
}
