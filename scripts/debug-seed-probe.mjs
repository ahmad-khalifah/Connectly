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

const uni = await db.from('universities').insert({}).select().single();
console.log(
  'universities_insert',
  JSON.stringify({
    message: uni.error?.message,
    details: uni.error?.details,
    hint: uni.error?.hint,
  })
);

const org = await db
  .from('organizations')
  .insert({ name: 'Debug Org' })
  .select('*')
  .single();
console.log('org', JSON.stringify({ err: org.error, data: org.data }));

if (org.data) {
  const plan = await db
    .from('plans')
    .insert({
      organization_id: org.data.id,
      name: 'Hourly',
      price_kobo: 20000,
      duration_seconds: 3600,
    })
    .select('*')
    .single();
  console.log('plan', JSON.stringify({ err: plan.error, data: plan.data }));
}

const uni2 = await db
  .from('universities')
  .insert({ name: 'Debug University' })
  .select('*')
  .single();
console.log('uni2', JSON.stringify({ err: uni2.error, data: uni2.data }));
