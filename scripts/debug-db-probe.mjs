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

const loc = await db.from('locations').select('id,slug,name,is_active').limit(5);
console.log('LOC', JSON.stringify({ err: loc.error, data: loc.data }));

const plans = await db.from('plans').select('id,name,is_active,price_kobo').limit(5);
console.log('PLANS', JSON.stringify({ err: plans.error, data: plans.data }));

const cols = await db.from('purchases').select('paystack_reference').limit(1);
console.log(
  'PAYSTACK_REF_COL',
  JSON.stringify({
    err: cols.error && {
      message: cols.error.message,
      code: cols.error.code,
      details: cols.error.details,
    },
    data: cols.data,
  })
);

const purch = await db.from('purchases').select('id,status').limit(1);
console.log(
  'PURCHASES',
  JSON.stringify({ err: purch.error && purch.error.message, data: purch.data })
);
