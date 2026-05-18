import { readFileSync } from 'node:fs';
const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  let v = l.slice(k.length + 1).replace(/^"|"$/g, '');
  // Strip literal \n at end (env var encoded escape)
  v = v.replace(/\\n$/, '').replace(/\s+$/, '').trim();
  return v;
}
const url = pick('SUPABASE_URL');
const key = pick('SUPABASE_SERVICE_ROLE_KEY');
console.log('URL:', JSON.stringify(url));
console.log('Key:', key.slice(0, 25) + '...');
const r = await fetch(url + '/rest/v1/social_posts?select=id,content_pack_id,status&limit=3', {
  headers: { apikey: key, Authorization: 'Bearer ' + key }
});
console.log('status:', r.status);
console.log('body:', (await r.text()).slice(0, 400));
