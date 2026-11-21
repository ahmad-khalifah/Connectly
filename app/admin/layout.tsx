import { AdminFrame } from '@/components/admin/admin-frame';

// Static: every admin page is a file with no data in it. The browser checks
// the sign-in first (AdminFrame); the server checks it again on every data
// request and every change (lib/http/admin-api.ts, lib/auth/admin.ts).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminFrame>{children}</AdminFrame>;
}
