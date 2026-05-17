import fs from 'fs';

const raw = fs.readFileSync('.env.local', 'utf8');
function pick(key) {
  const m = raw.match(new RegExp('^' + key + '=\"?([^\"\\r\\n]+)\"?', 'm'));
  if (!m) return '';
  return m[1].replace(/\\n$/g, '').replace(/\\n/g, '').replace(/\s+$/, '').trim();
}
const URL = pick('SUPABASE_URL');
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const TARGET = process.argv[2] || '318ec6d0-851e-4ea9-afd2-501094cf2d6d';

const r = await fetch(URL + '/auth/v1/admin/users/' + TARGET, {
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
});
const u = await r.json();
console.log('email:', u.email);
console.log('user_metadata:', JSON.stringify(u.user_metadata || {}, null, 2));
console.log('app_metadata:', JSON.stringify(u.app_metadata || {}, null, 2));
