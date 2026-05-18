import { readFileSync } from 'node:fs';
const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const url = pick('SUPABASE_URL');
const key = pick('SUPABASE_SERVICE_ROLE_KEY');

const r = await fetch(`${url}/rest/v1/social_posts?id=eq.35f7674f-2ce6-4c0d-84de-61d19aa22ce0&select=*`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` }
});
const [post] = await r.json();
console.log('Post status:', post?.status);
console.log('Scheduled at:', post?.scheduled_at);
console.log('Published at:', post?.published_at);
console.log('IG Media ID:', post?.ig_media_id || '(none)');
console.log('Engagement:', JSON.stringify(post?.engagement_metrics));
console.log('Local assets count:', post?.local_assets?.length);
console.log('Updated at:', post?.updated_at);
