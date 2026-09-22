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

const pay = await db.from('payments').insert({}).select().single();
console.log(
  'PAYMENTS_INSERT',
  JSON.stringify({
    message: pay.error?.message,
    details: pay.error?.details,
    hint: pay.error?.hint,
    code: pay.error?.code,
  })
);

const loc = await db.from('locations').insert({}).select().single();
console.log(
  'LOCATIONS_INSERT',
  JSON.stringify({
    message: loc.error?.message,
    details: loc.error?.details,
    hint: loc.error?.hint,
  })
);

const plan = await db.from('plans').insert({}).select().single();
console.log(
  'PLANS_INSERT',
  JSON.stringify({
    message: plan.error?.message,
    details: plan.error?.details,
    hint: plan.error?.hint,
  })
);
