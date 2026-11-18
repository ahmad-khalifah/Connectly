import { redirect } from 'next/navigation';

// This page used to list integration health with made-up figures. Real
// problems (controller, routers, payments, SMS) are on the Alerts page.
export default function APIsPage() {
  redirect('/admin/alerts');
}
