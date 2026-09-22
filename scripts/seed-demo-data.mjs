import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function log(label, result) {
  console.log(
    label,
    JSON.stringify({
      err: result.error && {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
      },
      data: result.data,
    })
  );
  return result;
}

const org = log(
  'org',
  await db
    .from('organizations')
    .upsert({ name: 'Connectly', slug: 'connectly' }, { onConflict: 'slug' })
    .select('*')
    .single()
);
if (!org.data) process.exit(1);

const uni = log(
  'uni',
  await db
    .from('universities')
    .insert({
      organization_id: org.data.id,
      name: 'Demo University',
      short_name: 'DEMO',
    })
    .select('*')
    .single()
);

// if slug unique conflict, fetch existing
let university = uni.data;
if (!university) {
  const existing = await db
    .from('universities')
    .select('*')
    .eq('organization_id', org.data.id)
    .limit(1)
    .single();
  university = existing.data;
  log('uni_existing', existing);
}
if (!university) process.exit(1);

const campus = log(
  'campus',
  await db
    .from('campuses')
    .insert({ university_id: university.id, name: 'Main Campus' })
    .select('*')
    .single()
);
let campusRow = campus.data;
if (!campusRow) {
  const existing = await db
    .from('campuses')
    .select('*')
    .eq('university_id', university.id)
    .limit(1)
    .single();
  campusRow = existing.data;
  log('campus_existing', existing);
}
if (!campusRow) process.exit(1);

const loc = log(
  'loc',
  await db
    .from('locations')
    .upsert(
      {
        campus_id: campusRow.id,
        name: 'Library',
        slug: 'library',
        is_active: true,
      },
      { onConflict: 'slug' }
    )
    .select('*')
    .single()
);

const plans = log(
  'plans',
  await db
    .from('plans')
    .insert([
      {
        organization_id: org.data.id,
        name: '1 Hour',
        price_kobo: 10000,
        duration_seconds: 3600,
        is_active: true,
      },
      {
        organization_id: org.data.id,
        name: '1 Day',
        price_kobo: 50000,
        duration_seconds: 86400,
        is_active: true,
      },
    ])
    .select('*')
);

console.log('SEED_DONE', {
  locationSlug: loc.data?.slug,
  planIds: plans.data?.map((p) => p.id),
});
