import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { passcode } = await request.json();
    
    const validPasscode = (process.env.ADMIN_PASSCODE || '0000').trim();
    const enteredPasscode = String(passcode).trim();

    if (enteredPasscode === validPasscode) {
      // FIX: Next.js 15+ requires awaiting cookies()
      const cookieStore = await cookies(); 
      cookieStore.set('admin_session', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/',
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Invalid passcode' }, { status: 401 });
  } catch (error) {
    console.error('[AUTH ERROR]', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}