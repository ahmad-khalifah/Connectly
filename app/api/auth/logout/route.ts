import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSessionClient } from '@/lib/auth/admin';

// Ends the Supabase Auth session (the real admin login). Previously this only
// deleted an unused `admin_session` cookie, so admins stayed signed in.
export async function POST() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete('admin_session'); // legacy cookie from the retired passcode login

  return NextResponse.json({ success: true });
}
