import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('Usage: node ... <token>'); process.exit(1); }

console.log('🔍 Token doğrulanıyor...');
const me = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${TOKEN}`).then(r => r.json());
if (me.error) { console.error('❌ Token invalid:', me.error); process.exit(1); }
console.log(`✅ User: ${me.name} (id ${me.id})`);

console.log('\n📋 Page access tokens listesi...');
const acc = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${TOKEN}`).then(r => r.json());
if (acc.error) { console.error('❌', acc.error); process.exit(1); }

const pages = acc.data || [];
console.log(`${pages.length} page bulundu:`);
let target = null;
for (const p of pages) {
  const igInfo = p.instagram_business_account
    ? ` · IG: @${p.instagram_business_account.username} (${p.instagram_business_account.id})`
    : ' · IG: yok';
  console.log(` - ${p.name} (${p.id})${igInfo}`);
  if (p.instagram_business_account?.id === '17841464755523227' || /kalkan/i.test(p.name)) target = p;
}

if (!target) { console.error('❌ Kalkan info page bulunamadı'); process.exit(1); }
console.log(`\n🎯 Target: ${target.name} (Page ID ${target.id})`);
console.log(`   IG Business ID: ${target.instagram_business_account?.id}`);
console.log(`   Page Access Token (uzun-ömürlü): ${target.access_token.slice(0, 30)}...`);

// Verify the page token works with IG Business
const pageToken = target.access_token;
const igId = target.instagram_business_account?.id;
const igTest = await fetch(`https://graph.facebook.com/v21.0/${igId}?fields=name,username,profile_picture_url&access_token=${pageToken}`).then(r => r.json());
if (igTest.error) { console.error('❌ Page token IG test fail:', igTest.error); process.exit(1); }
console.log(`✅ Page token IG erişim OK: @${igTest.username} (${igTest.name})`);

// Update Vercel env
const vToken = JSON.parse(readFileSync(homedir() + '/AppData/Roaming/com.vercel.cli/Data/auth.json', 'utf8')).token;
const PROJ = 'prj_BH2LwGySrcm0VTNmOqam14bGLdGN';
const TEAM = 'team_KQRZpbniYV5I2ZFb1BwcMdxJ';

// Find existing IG_LONG_LIVED_TOKEN env
const envList = await fetch(`https://api.vercel.com/v9/projects/${PROJ}/env?teamId=${TEAM}`, {
  headers: { Authorization: `Bearer ${vToken}` }
}).then(r => r.json());

const existing = (envList.envs || []).find(e => e.key === 'IG_LONG_LIVED_TOKEN' && e.target.includes('production'));
let updRes;
if (existing) {
  updRes = await fetch(`https://api.vercel.com/v9/projects/${PROJ}/env/${existing.id}?teamId=${TEAM}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${vToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: pageToken })
  });
} else {
  updRes = await fetch(`https://api.vercel.com/v10/projects/${PROJ}/env?teamId=${TEAM}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${vToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'IG_LONG_LIVED_TOKEN', value: pageToken, type: 'encrypted', target: ['production'] })
  });
}
console.log(`\n${updRes.ok ? '✅' : '❌'} Vercel env update: ${updRes.status}`);

// Trigger redeploy
const hook = 'https://api.vercel.com/v1/integrations/deploy/prj_BH2LwGySrcm0VTNmOqam14bGLdGN/H6qrfGFrBr';
const dep = await fetch(hook, { method: 'POST' }).then(r => r.json());
console.log(`✅ Deploy tetiklendi: ${dep.job?.id}`);
console.log(`\n🎉 Page token kuruldu. Deploy READY olunca Telegram'da test post aç + Yayınla Şimdi.`);
