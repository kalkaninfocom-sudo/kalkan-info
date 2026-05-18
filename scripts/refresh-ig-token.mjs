// scripts/refresh-ig-token.mjs
// Mevcut IG_LONG_LIVED_TOKEN'i fb_exchange_token ile YENİLER (60 yeni gün)
// + Vercel env'i otomatik günceller.
//
// Token henüz expire OLMADIYSA çalışır. Bir kez expire olunca manuel
// Graph API Explorer'dan yeni short-lived token alınmalı.
//
// Kullanım:
//   node scripts/refresh-ig-token.mjs                # mevcut long-lived'i refresh et
//   node scripts/refresh-ig-token.mjs --short=...    # short-lived → long-lived exchange
//
// Env: META_APP_ID, META_APP_SECRET, IG_LONG_LIVED_TOKEN (.env.local veya argv)

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

function env(k) {
  try {
    const raw = readFileSync('.env.local', 'utf8');
    const l = raw.split(/\r?\n/).find(l => l.startsWith(k + '='));
    if (!l) return process.env[k] || '';
    return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
  } catch { return process.env[k] || ''; }
}

const APP_ID = env('META_APP_ID');
const APP_SECRET = env('META_APP_SECRET');
const SHORT_ARG = process.argv.find(a => a.startsWith('--short='))?.slice(8);
const CURRENT = SHORT_ARG || env('IG_LONG_LIVED_TOKEN');

if (!APP_ID || !APP_SECRET) {
  console.error('❌ META_APP_ID ve META_APP_SECRET .env.local\'da gerekli');
  process.exit(1);
}
if (!CURRENT) {
  console.error('❌ Token yok. --short=... ile geç veya .env.local IG_LONG_LIVED_TOKEN ekle');
  process.exit(1);
}

console.log('🔄 Token exchange başlıyor...');
const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${encodeURIComponent(APP_SECRET)}&fb_exchange_token=${CURRENT}`;
const res = await fetch(exchangeUrl);
const data = await res.json();

if (!res.ok || !data.access_token) {
  console.error('❌ Exchange fail:', JSON.stringify(data));
  console.error('   Token expire olduysa Graph API Explorer\'dan yeni short-lived token al:');
  console.error('   https://developers.facebook.com/tools/explorer/');
  process.exit(1);
}

const newToken = data.access_token;
const expiresIn = data.expires_in;
const days = Math.round(expiresIn / 86400);
console.log(`✅ Yeni token alındı (${days} gün geçerli)`);
console.log(`   Token: ${newToken.slice(0, 30)}...`);

// Vercel env update
const vToken = (() => {
  try {
    return JSON.parse(readFileSync(homedir() + '/AppData/Roaming/com.vercel.cli/Data/auth.json', 'utf8')).token;
  } catch { return null; }
})();

if (!vToken) {
  console.log('\n⚠️  Vercel CLI auth bulunamadı. Token\'i manuel olarak Vercel env\'e ekle:');
  console.log(`   IG_LONG_LIVED_TOKEN = ${newToken}`);
  process.exit(0);
}

const PROJ = 'prj_BH2LwGySrcm0VTNmOqam14bGLdGN';
const TEAM = 'team_KQRZpbniYV5I2ZFb1BwcMdxJ';

const upd = await fetch(`https://api.vercel.com/v10/projects/${PROJ}/env?teamId=${TEAM}&upsert=true`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${vToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    key: 'IG_LONG_LIVED_TOKEN', value: newToken, type: 'encrypted', target: ['production']
  })
});

if (upd.ok) {
  console.log('✅ Vercel env güncellendi');
  console.log('   Yeni deploy tetiklenmeli — değişiklik için rebuild lazım');
} else {
  console.error('❌ Vercel env update fail:', upd.status, await upd.text());
  console.log('   Manuel ekle: IG_LONG_LIVED_TOKEN =', newToken);
}
