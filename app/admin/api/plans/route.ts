import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, priceNaira, durationValue, durationUnit, downloadMbps, uploadMbps } = body;

    // Convert UI values to database units
    const price_kobo = Number(priceNaira) * 100;
    const duration_seconds = durationUnit === 'hours' 
      ? Number(durationValue) * 3600 
      : Number(durationValue) * 86400;
    const download_limit_kbps = Number(downloadMbps) * 1024;
    const upload_limit_kbps = Number(uploadMbps) * 1024;

    // Fetch the default organization ID (assuming single-tenant deployment for now)
    const { data: org } = await db.from('organizations').select('id').limit(1).single();
    
    if (!org) {
      return NextResponse.json({ message: 'Organization not found' }, { status: 400 });
    }

    const { error } = await db.from('plans').insert({
      organization_id: org.id,
      name,
      price_kobo,
      duration_seconds,
      download_limit_kbps,
      upload_limit_kbps,
      is_active: true
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Server Error' }, { status: 500 });
  }
}