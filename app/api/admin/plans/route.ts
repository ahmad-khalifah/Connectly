import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { error } = await db.from('plans').insert({
        name: body.name,
        price_kobo: body.price_kobo,
        duration_seconds: body.duration_seconds,
        download_speed: body.download_speed,
        upload_speed: body.upload_speed
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PLAN_CREATE_ERROR]', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}