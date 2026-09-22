import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, slug, building } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { message: 'Name and slug are required fields.' },
        { status: 400 }
      );
    }

    // Insert the new location into Supabase
    const { data, error } = await db
      .from('locations')
      .insert([
        { 
          name, 
          slug, 
          building,
          status: 'active' // Sets a default status for new facilities
        }
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}