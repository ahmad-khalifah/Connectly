import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth/admin';
import AdminShell from './admin-shell';
import { appEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Server-side admin check for every /admin page, in addition to proxy.ts.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect('/login');

  return <AdminShell operatorEmail={user.email ?? ''} environment={appEnv()}>{children}</AdminShell>;
}
