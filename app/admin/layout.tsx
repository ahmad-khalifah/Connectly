import { AdminFrame } from '@/components/admin/admin-frame';

// Static: the sign-in check runs in the browser (AdminFrame) and on the
// server for every data request (lib/http/admin-api.ts, lib/auth/request-admin.ts).
// Pages still rendered on the server also check (requireAdminPage).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminFrame>{children}</AdminFrame>;
}
