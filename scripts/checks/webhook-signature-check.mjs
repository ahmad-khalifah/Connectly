// Sends forged and unsigned Korapay-style notifications to the preview
// through Vercel's bypass, and shows each is refused by the app itself.
const base = process.env.TARGET; // https://<preview>/api/webhooks/kora
const bypass = process.env.BYPASS;
const ref = 'CONN_e8ac76e9-86ae-45f0-911f-4ac2d1af1475'; // a staging purchase that is 'failed'
const body = JSON.stringify({ event: 'charge.success', data: { reference: ref, payment_reference: ref, amount: 300, status: 'success', currency: 'NGN' } });
const cases = [
  ['through bypass, forged signature', `${base}?x-vercel-protection-bypass=${bypass}`, { 'x-korapay-signature': 'f'.repeat(64) }],
  ['through bypass, no signature', `${base}?x-vercel-protection-bypass=${bypass}`, {}],
  ['through bypass, signature over a different body', `${base}?x-vercel-protection-bypass=${bypass}`, { 'x-korapay-signature': '0'.repeat(64) }],
  ['without bypass, no signature', base, {}],
];
for (const [name, url, headers] of cases) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body, redirect: 'manual' });
  const text = (await r.text()).slice(0, 120).replace(/\s+/g, ' ');
  console.log(JSON.stringify({ case: name, status: r.status, served_by_app: (r.headers.get('content-type') || '').includes('application/json'), body: text }));
}
const ok = await fetch(`${base.replace('/api/webhooks/kora', '/api/purchase/status')}?reference=CONN_00000000-0000-4000-8000-000000000000&x-vercel-protection-bypass=${bypass}`);
console.log(JSON.stringify({ case: 'bypass reaches the app (status lookup)', status: ok.status, body: (await ok.text()).slice(0, 80) }));
