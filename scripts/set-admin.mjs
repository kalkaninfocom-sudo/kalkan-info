import fs from 'fs';

const raw = fs.readFileSync('.env.local', 'utf8');
function pick(key) {
  const m = raw.match(new RegExp('^' + key + '=\"?([^\"\\r\\n]+)\"?', 'm'));
  if (!m) return '';
  // Literal backslash-n veya gerçek newline temizliği
  return m[1].replace(/\\n$/g, '').replace(/\\n/g, '').replace(/\s+$/, '').trim();
}

const URL = pick('SUPABASE_URL');
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const TARGET_ID = process.argv[2] || '318ec6d0-851e-4ea9-afd2-501094cf2d6d';
const NEW_ROLE = process.argv[3] || 'admin';

console.log('URL:', JSON.stringify(URL));
console.log('KEY length:', KEY.length, '(starts:', KEY.slice(0, 12) + '...)');
console.log('Target user ID:', TARGET_ID);

const get = await fetch(URL + '/auth/v1/admin/users/' + TARGET_ID, {
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
});
if (!get.ok) {
  console.error('GET fail:', get.status, await get.text());
  process.exit(1);
}
const user = await get.json();
console.log('Found:', user.email, '· current role:', user.app_metadata?.role || 'none');

const patch = await fetch(URL + '/auth/v1/admin/users/' + TARGET_ID, {
  method: 'PUT',
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ app_metadata: { ...(user.app_metadata || {}), role: NEW_ROLE } })
});
const r = await patch.json();
console.log('PATCH:', patch.status, '· new role:', r.app_metadata?.role);
