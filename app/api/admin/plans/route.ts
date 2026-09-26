import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseRoleKey) {
      throw new Error('Missing Supabase Admin Keys in environment.');
    }

    // Initialize admin client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseRoleKey);

    const { error } = await supabaseAdmin.from('plans').insert({
      name: body.name,
      price_kobo: body.price_kobo,
      duration_seconds: body.duration_seconds,
      download_speed: body.download_speed,
      upload_speed: body.upload_speed
    });

    if (error) {
      console.error('[SUPABASE_INSERT_ERROR]', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PLAN_CREATE_ERROR]', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}