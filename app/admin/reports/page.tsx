import { redirect } from 'next/navigation';

// This page offered export buttons that did nothing. Revenue by location
// and plan, from the database, is on the Revenue page.
export default function ReportsPage() {
  redirect('/admin/revenue');
}
