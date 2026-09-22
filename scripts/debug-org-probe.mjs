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

for (const table of ['campuses', 'organizations', 'orgs']) {
  const r = await db.from(table).select('*').limit(1);
  console.log(
    table,
    JSON.stringify({
      ok: !r.error,
      err: r.error?.message,
      keys: r.data?.[0] ? Object.keys(r.data[0]) : [],
    })
  );
  if (!r.error) {
    const ins = await db.from(table).insert({}).select().single();
    console.log(
      table + '_insert',
      JSON.stringify({
        message: ins.error?.message,
        details: ins.error?.details,
        hint: ins.error?.hint,
      })
    );
  }
}
