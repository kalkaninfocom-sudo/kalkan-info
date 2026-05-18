import { readFileSync } from 'node:fs';
const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const url = pick('SUPABASE_URL');
const key = pick('SUPABASE_SERVICE_ROLE_KEY');
const r = await fetch(`${url}/rest/v1/social_posts?id=eq.a69f3cab-4905-4d52-af91-b8f8010b7276&select=status,scheduled_at,published_at,ig_media_id,engagement_metrics,updated_at`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` }
});
const [p] = await r.json();
console.log('Status:', p?.status);
console.log('Scheduled:', p?.scheduled_at);
console.log('Published:', p?.published_at);
console.log('IG Media ID:', p?.ig_media_id || '(none)');
console.log('Engagement:', JSON.stringify(p?.engagement_metrics));
console.log('Updated:', p?.updated_at);
