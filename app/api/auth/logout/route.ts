import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  // FIX: Next.js 15+ requires awaiting cookies()
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  return NextResponse.json({ success: true });
}