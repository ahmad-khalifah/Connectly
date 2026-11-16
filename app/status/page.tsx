import { redirect } from 'next/navigation';

// Old status URL (/status?ref=...). The payment status page now lives at
// /success?reference=...; keep old links working.
export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; reference?: string }>;
}) {
  const { ref, reference } = await searchParams;
  const value = reference ?? ref;
  redirect(value ? `/success?reference=${encodeURIComponent(value)}` : '/success');
}
