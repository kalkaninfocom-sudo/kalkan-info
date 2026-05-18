// scripts/_setup-permanent-page-token.mjs
// 3-step token upgrade:
//   1. Short-lived USER → Long-lived USER (60 days, fb_exchange_token)
//   2. Long-lived USER → /me/accounts → Long-lived PAGE token (NEVER EXPIRES)
//   3. Vercel env IG_LONG_LIVED_TOKEN update + redeploy

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const USER_TOKEN = process.argv[2];
const APP_ID = '4407667539517517';
const APP_SECRET = 'VtAcdA5ntIzfPaQT-fGE20QXqdw';
if (!USER_TOKEN) { console.error('Usage: ... <short_lived_user_token>'); process.exit(1); }

// Step 1: short-lived → long-lived user
console.log('1/3 fb_exchange_token (short → long-lived user, 60 days)');
const ex = await fetch(
  `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${encodeURIComponent(APP_SECRET)}&fb_exchange_token=${USER_TOKEN}`
).then(r => r.json());
if (!ex.access_token) { console.error('exchange fail:', ex); process.exit(1); }
const LONG_USER = ex.access_token;
const days = Math.round(ex.expires_in / 86400);
console.log(`  ✅ ${days}-day user token: ${LONG_USER.slice(0, 30)}...`);

// Step 2: long-lived user → /me/accounts → long-lived page token
console.log('2/3 /me/accounts → long-lived PAGE token (never expires)');
const acc = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${LONG_USER}`).then(r => r.json());
const page = (acc.data || []).find(p => p.instagram_business_account?.id === '17841464755523227') || acc.data?.[0];
if (!page) { console.error('no page:', acc); process.exit(1); }
const PAGE_TOKEN = page.access_token;
console.log(`  ✅ ${page.name} (Page ID ${page.id})`);
console.log(`     IG: ${page.instagram_business_account?.id}`);
console.log(`     Page Token: ${PAGE_TOKEN.slice(0, 30)}...`);

// Verify page token never-expires by debug_token
const dbg = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${PAGE_TOKEN}&access_token=${APP_ID}|${APP_SECRET}`).then(r => r.json());
const expiresAt = dbg.data?.expires_at;
console.log(`     debug_token expires_at: ${expiresAt === 0 ? 'NEVER ✓' : new Date(expiresAt * 1000).toISOString()}`);

// Step 3: Vercel env update
console.log('3/3 Vercel env IG_LONG_LIVED_TOKEN + META_APP_SECRET update');
const vToken = JSON.parse(readFileSync(homedir() + '/AppData/Roaming/com.vercel.cli/Data/auth.json', 'utf8')).token;
const PROJ = 'prj_BH2LwGySrcm0VTNmOqam14bGLdGN';
const TEAM = 'team_KQRZpbniYV5I2ZFb1BwcMdxJ';

async function upsertEnv(key, value) {
  // Delete existing
  const list = await fetch(`https://api.vercel.com/v9/projects/${PROJ}/env?teamId=${TEAM}`, {
    headers: { Authorization: `Bearer ${vToken}` }
  }).then(r => r.json());
  for (const e of (list.envs || []).filter(e => e.key === key)) {
    await fetch(`https://api.vercel.com/v9/projects/${PROJ}/env/${e.id}?teamId=${TEAM}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${vToken}` }
    });
  }
  // Create new
  const r = await fetch(`https://api.vercel.com/v10/projects/${PROJ}/env?teamId=${TEAM}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${vToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, type: 'encrypted', target: ['production', 'preview', 'development'] }),
  });
  return r.ok;
}

const ok1 = await upsertEnv('IG_LONG_LIVED_TOKEN', PAGE_TOKEN);
const ok2 = await upsertEnv('META_APP_SECRET', APP_SECRET);  // re-set just in case
console.log(`  Vercel IG_LONG_LIVED_TOKEN: ${ok1 ? '✓' : '✗'}`);
console.log(`  Vercel META_APP_SECRET: ${ok2 ? '✓' : '✗'}`);

// Trigger redeploy
const hook = 'https://api.vercel.com/v1/integrations/deploy/prj_BH2LwGySrcm0VTNmOqam14bGLdGN/H6qrfGFrBr';
const dep = await fetch(hook, { method: 'POST' }).then(r => r.json());
console.log(`  Deploy: ${dep.job?.id}`);

console.log('\n🎉 SONSUZA DEK GEÇERLİ PAGE TOKEN KURULDU!');
console.log('   Telegram approval flow + cron publish queue artık expire problemi olmadan çalışır.');
console.log('   cron-refresh-ig-token aylık güvenlik refresh yapacak.\n');
console.log('   PAGE_TOKEN (kaydet, sonraki manuel testler için):');
console.log('   ' + PAGE_TOKEN);
