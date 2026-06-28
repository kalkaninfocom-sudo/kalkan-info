#!/usr/bin/env node
/**
 * scripts/ig-news-post.mjs
 * Kalkan Info kendi IG sayfası için HABER AJANSI otomatik paylaşım üreticisi.
 *
 * Akış:
 *   1. data/haberler.json → en yeni İŞLENMEMİŞ haberi seç (data/ig-posted-news.json'a göre)
 *   2. ig-news-card.mjs ile 1080×1080 haber kartı üret (assets/ig-news/<id>.png)
 *   3. Claude (haiku) ile haber-ajansı tonunda IG caption yaz (kaynak atfı + hashtag)
 *   4. Supabase social_posts'a status='pending_approval' satır ekle (local_assets=[kart])
 *   5. Telegram'a kartı + caption'ı ONAYLA/REDDET butonlarıyla gönder
 *      → onay callback'i (pub:<id>:now) MEVCUT api/telegram-webhook.js tarafından işlenir
 *      → onaylanınca api/social-publish-queue / publishNow IG'ye yayınlar
 *   6. İşleneni data/ig-posted-news.json'a yaz (tekrar paylaşma)
 *
 * Kullanım:
 *   node scripts/ig-news-post.mjs              # en yeni işlenmemiş haber
 *   node scripts/ig-news-post.mjs <haber-id>   # belirli haber
 *   node scripts/ig-news-post.mjs --dry-run    # kart + caption üret, DB/Telegram'a dokunma
 *   node scripts/ig-news-post.mjs --force      # işlenmiş olsa bile tekrar üret
 *
 * Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID
 * Hepsi opsiyonel — eksik olan adım graceful atlanır (prod'da env mevcut).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateNewsCard } from './ig-news-card.mjs';
import { cheapLLM } from '../lib/cheap-llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── .env.local fallback (lokal çalıştırma için) ──────────────────────────────
try {
  const envPath = join(ROOT, '.env.local');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
} catch {}

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SITE_BASE = 'https://www.kalkaninfo.com';

const ARG = process.argv.find((a) => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]);
const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const POSTED_PATH = join(ROOT, 'data', 'ig-posted-news.json');

// ── Helpers ──────────────────────────────────────────────────────────────────
const supa = (path, opts = {}) => fetch(`${SUPA_URL}/rest/v1${path}`, {
  ...opts,
  headers: {
    apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json', ...(opts.headers || {}),
  },
});

const mdEscape = (s) => String(s ?? '').replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');

function approvalKeyboard(postId) {
  return { inline_keyboard: [
    [{ text: '✅ Yayınla Şimdi', callback_data: `pub:${postId}:now` },
     { text: '⏰ Önerilen Saatte', callback_data: `pub:${postId}:scheduled` }],
    [{ text: '✏️ Değiştir', callback_data: `pub:${postId}:edit` },
     { text: '❌ Reddet', callback_data: `pub:${postId}:reject` }],
  ]};
}

async function loadPosted() {
  if (!existsSync(POSTED_PATH)) return { posted: [] };
  try { return JSON.parse(await readFile(POSTED_PATH, 'utf8')); } catch { return { posted: [] }; }
}

async function savePosted(state) {
  await writeFile(POSTED_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

// Haberi tarihe göre sırala (en yeni önce). items zaten yeni→eski sıralı ama garanti edelim.
function sortNewest(items) {
  return [...items].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

// ── Hashtag üretimi ──────────────────────────────────────────────────────────
const CATEGORY_TAGS = {
  'Asayiş':   ['#asayiş', '#haber'],
  'Belediye': ['#belediye', '#yerelhaber'],
  'Gündem':   ['#gündem', '#haber'],
  'Plaj':     ['#plaj', '#tatil'],
  'Hava':     ['#hava', '#havadurumu'],
  'Kültür':   ['#kültür', '#etkinlik'],
  'Etkinlik': ['#etkinlik', '#kalkanetkinlik'],
  'Turizm':   ['#turizm', '#kalkanturizm'],
};

function buildHashtags(item) {
  const base = ['#kalkan', '#kaş', '#sondakika', '#kalkaninfo', '#antalya'];
  const extra = CATEGORY_TAGS[item.category] || ['#haber'];
  // Tekilleştir, sırayı koru
  return [...new Set([...base, ...extra])];
}

// ── Claude caption ───────────────────────────────────────────────────────────
async function generateCaption(item) {
  const fallback = () => {
    const summary = (item.summary || item.title || '').trim();
    const clipped = summary.length > 280 ? summary.slice(0, 277) + '...' : summary;
    return `📍 ${item.title}\n\n${clipped}\n\nKaynak: ${item.source || 'Kalkan Info'}`;
  };

  const prompt = `Sen bir HABER AJANSI sosyal medya editörüsün. Kalkan Info adlı yerel haber/turizm markasının Instagram hesabı için bu haberden kısa, ciddi ve güvenilir tonda bir caption yaz.

Kurallar:
- Türkçe, haber-ajansı tonu (abartısız, net, olgusal). Tıklama tuzağı YOK.
- En fazla 4 kısa paragraf / 600 karakter.
- İlk satır dikkat çekici ama dürüst bir özet (gerekirse 1 emoji 📍 veya ⚠️).
- Son satırda kaynağı belirt: "Kaynak: ${item.source || 'Kalkan Info'}".
- Hashtag EKLEME (onları ben ekliyorum).
- Sadece caption metnini döndür, açıklama veya tırnak ekleme.

HABER:
Başlık: ${item.title}
Kategori: ${item.category || 'Gündem'}
Özet: ${item.summary || item.content?.slice(0, 500) || ''}`;

  try {
    const { text, provider } = await cheapLLM(prompt, { maxTokens: 700 });
    console.log(`  [cheap-llm] caption ✓ ${provider}`);
    return text.trim() || fallback();
  } catch (e) {
    console.warn('  ⚠️  Caption üretim hatası, şablona düşülüyor:', e.message);
    return fallback();
  }
}

// ── Telegram: yerel kart PNG'sini multipart upload ile gönder ───────────────
async function sendTelegramCard(cardPath, captionPreview, postId) {
  if (!TG_TOKEN || !TG_CHAT) {
    console.log('  ℹ️  Telegram env yok — onay mesajı atlanıyor (taslak yine üretildi)');
    return null;
  }
  try {
    const buf = await readFile(cardPath);
    const form = new FormData();
    form.append('chat_id', String(TG_CHAT));
    form.append('photo', new Blob([buf], { type: 'image/png' }), 'haber-karti.png');
    form.append('caption', captionPreview.slice(0, 1024));
    form.append('parse_mode', 'MarkdownV2');
    form.append('reply_markup', JSON.stringify(approvalKeyboard(postId)));

    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
      method: 'POST', body: form,
    });
    const json = await res.json();
    if (!json.ok) { console.error('  ❌ Telegram sendPhoto fail:', json.description); return null; }
    return json.result?.message_id || null;
  } catch (e) {
    console.error('  ❌ Telegram gönderim hatası:', e.message);
    return null;
  }
}

// ── Supabase: social_posts satırı ekle ──────────────────────────────────────
async function insertSocialPost({ item, caption, hashtags, publicPath }) {
  if (!SUPA_URL || !SUPA_KEY) {
    console.log('  ℹ️  Supabase env yok — DB kaydı atlanıyor (yayın kuyruğu prod\'da çalışır)');
    return null;
  }
  const row = {
    content_pack_id: `news-${item.id}`.slice(0, 120),
    content_type: 'image',
    language: 'tr',
    caption,
    hashtags,
    local_assets: [publicPath],
    status: 'pending_approval',
    scheduled_at: new Date().toISOString(),
    telegram_chat_id: TG_CHAT ? Number(TG_CHAT) : null,
  };
  const ins = await supa('/social_posts?select=id', {
    method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row),
  });
  if (!ins.ok) {
    console.error('  ❌ social_posts insert fail:', ins.status, await ins.text());
    return null;
  }
  const [created] = await ins.json();
  return created?.id || null;
}

// ── Ana akış ─────────────────────────────────────────────────────────────────
async function main() {
  const data = JSON.parse(await readFile(join(ROOT, 'data', 'haberler.json'), 'utf8'));
  const items = sortNewest(data.items || []);
  if (!items.length) { console.error('haberler.json boş'); process.exit(1); }

  const posted = await loadPosted();
  const postedIds = new Set((posted.posted || []).map((p) => p.id));

  // Hedef haberi seç
  let item;
  if (ARG) {
    item = items.find((x) => x.id === ARG);
    if (!item) { console.error(`Haber bulunamadı: ${ARG}`); process.exit(1); }
  } else {
    item = items.find((x) => FORCE || !postedIds.has(x.id));
    if (!item) { console.log('✅ Yeni (işlenmemiş) haber yok — hepsi paylaşılmış.'); return; }
  }

  if (!FORCE && !ARG && postedIds.has(item.id)) {
    console.log(`ℹ️  ${item.id} zaten işlenmiş. --force ile tekrar üret.`);
    return;
  }

  console.log(`📰 Haber: ${item.title}`);
  console.log(`   Kategori: ${item.category} | Kaynak: ${item.source} | Tarih: ${item.date}\n`);

  // 1) Kart üret
  console.log('🎨 Kart üretiliyor...');
  const card = await generateNewsCard({ item });
  console.log(`   ✅ ${card.publicPath} (${card.kb} KB, görsel ${card.hadImage ? 'gömüldü' : 'fallback'})`);

  // 2) Caption üret
  console.log('✍️  Caption üretiliyor...');
  const captionBody = await generateCaption(item);
  const hashtags = buildHashtags(item);
  const fullCaption = `${captionBody}\n\n${hashtags.join(' ')}`;
  console.log(`   ✅ Caption (${fullCaption.length} karakter), ${hashtags.length} hashtag`);
  console.log('   ──────\n   ' + fullCaption.split('\n').join('\n   ') + '\n   ──────');

  if (DRY) {
    console.log('\n🧪 --dry-run: DB/Telegram atlandı. Kart ve caption hazır.');
    return;
  }

  // 3) Supabase social_posts ekle
  console.log('\n🗄️  social_posts kaydı...');
  const postId = await insertSocialPost({ item, caption: fullCaption, hashtags, publicPath: card.publicPath });
  if (postId) console.log(`   ✅ social_posts id: ${postId}`);

  // Telegram callback'i gerçek bir postId ister (webhook DB'yi günceller).
  // DB yoksa test- önekiyle gönder (webhook test modunda yutar, gerçek yayın olmaz).
  const callbackId = postId || `test-news-${Date.now()}`;

  // 4) Telegram onay mesajı (kart görseli + caption preview + butonlar)
  console.log('📨 Telegram onay mesajı...');
  const preview = mdEscape(
    `📰 YENİ HABER PAYLAŞIMI\n\n${item.title}\n\nKaynak: ${item.source || 'Kalkan Info'}\n\n` +
    `Onaylarsan IG'de yayınlanır. Caption ve kart hazır.`
  );
  const msgId = await sendTelegramCard(card.outPath, preview, callbackId);
  if (msgId) {
    console.log(`   ✅ Telegram message_id: ${msgId}`);
    // message_id'yi DB'ye yaz (webhook edit için)
    if (postId && SUPA_URL) {
      await supa(`/social_posts?id=eq.${postId}`, {
        method: 'PATCH', body: JSON.stringify({ telegram_message_id: msgId }),
      }).catch(() => {});
    }
  }

  // 5) İşlendi olarak işaretle
  posted.posted = posted.posted || [];
  posted.posted.unshift({
    id: item.id,
    title: item.title,
    socialPostId: postId,
    cardPath: card.publicPath,
    postedAt: new Date().toISOString(),
  });
  // Son 200 kaydı tut
  posted.posted = posted.posted.slice(0, 200);
  await savePosted(posted);
  console.log(`\n✅ Tamam. ${item.id} işlendi olarak kaydedildi.`);
  if (!postId) {
    console.log('⚠️  Supabase yoktu — gerçek IG yayını için prod env\'de çalıştır (DB + cron gerekli).');
  } else {
    console.log(`ℹ️  Onayla → api/telegram-webhook → publishNow IG'ye gönderir.`);
    console.log(`   Not: Kart ${SITE_BASE}${card.publicPath} olarak deploy edilmiş olmalı (IG public URL ister).`);
  }
}

main().catch((e) => { console.error('fatal:', e); process.exit(1); });
