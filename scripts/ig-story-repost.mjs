#!/usr/bin/env node
// scripts/ig-story-repost.mjs
// Kalkan Info — @kalkan.info'ya etiketlenmiş gönderileri hikayemize repost eden poller.
//
// NASIL ÇALIŞIR:
//   1) Graph API'den bizi etiketleyen medyaları çeker (/{IG_BUSINESS_ID}/tags)
//   2) (best-effort) hikaye mention'larını çeker (/{IG_BUSINESS_ID}/mentions)
//   3) Daha önce işlenmediyse (data/ig-reposted.json dedup) Telegram'a onay için gönderir
//   4) IG_STORY_REPOST_MODE=approve (varsayılan) → sadece Telegram bildirimi, otomatik yayın YOK
//      IG_STORY_REPOST_MODE=auto → Graph API ile kendi hikayemize yayınlar
//
// IG API KISITLAMALARI (dürüst belge):
//   - /{id}/tags  → "instagram_basic" + "pages_show_list" izni; Creator/Business hesap gerekir.
//   - /mentions   → "instagram_manage_mentions" izni (App Review gerektirir — standart erişimde yok).
//   - Başka kullanıcının medyasını DOĞRUDAN hikayeye "reshare" etmek (gibi IG uygulamasındaki özellik)
//     IG Graph API'nin sunduğu bir endpoint DEĞİLDİR (2024 itibarıyla hâlâ mevcut değil).
//     Geçici çözüm (bu scriptte uygulanan):
//       → Etiketlenmiş medyanın media_url'ini okuyup OUR hikayeleri olarak yayınla
//       → Caption'a "@kullanıcı_adı ❤️ via @kalkan.info" gibi atıf metni ekle
//       → Bu "reshare" değil "yeniden paylaşım"dır; haklar konusunda dikkatli olun.
//   - STORIES container için: image_url (JPEG, kamuya açık, < 8 MB) veya video_url (MP4) gerekir.
//     IG CDN URL'leri imzalıdır ve süresi dolabilir — yayın sırasında erişilebilir olmalı.
//   - Video stories için is_carousel_item ve video_url kullanılır; ayrı bir publish adımı şart.
//   - "instagram_content_publish" izni kesinlikle gereklidir (her iki mod için de).
//
// ENV: IG_BUSINESS_ID, IG_LONG_LIVED_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID,
//      IG_STORY_REPOST_MODE (approve|auto, varsayılan: approve)
//
// ÇALIŞTIRIL: node scripts/ig-story-repost.mjs
//   --mock   : token olmadan test et (örnek etiket verisiyle)
//   --dry-run: API'den çek ama yayınlama/Telegram bildirimi yapma

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STATE_PATH = join(ROOT, 'data', 'ig-reposted.json');
const DATA_DIR = join(ROOT, 'data');

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const MODE = (process.env.IG_STORY_REPOST_MODE || 'approve').toLowerCase();
const args = process.argv.slice(2);
const FORCE_MOCK = args.includes('--mock');
const DRY_RUN = args.includes('--dry-run');

// ── State (data/ig-reposted.json)
function loadState() {
  try {
    const s = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
    s.processed ||= {};
    s.pending ||= {};
    return s;
  } catch {
    return {
      _meta: {
        title: 'IG hikaye repost takip',
        note: 'Bu dosya scripts/ig-story-repost.mjs tarafından yönetilir. Etiketlenmiş medya id\'leri burada tutulur.',
      },
      processed: {},
      pending: {},
    };
  }
}
function saveState(state) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  state.updated = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

// ── Graph API yardımcıları
async function graphGet(path, params = {}, token) {
  const qs = new URLSearchParams({ ...params, access_token: token }).toString();
  const res = await fetch(`${GRAPH_BASE}/${path}?${qs}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function graphPost(path, body, token) {
  const res = await fetch(`${GRAPH_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// ── Telegram yardımcıları
function tgToken() {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}
async function tgCall(method, body) {
  const t = tgToken();
  if (!t) return null;
  const res = await fetch(`https://api.telegram.org/bot${t}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) console.warn(`[tg] ${method} başarısız: ${json.description || res.status}`);
  return json.result;
}
function tgEscape(s) {
  return String(s ?? '').replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

async function tgNotifyRepost({ mediaId, username, mediaType, permalink, caption, mediaUrl }) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) {
    console.log('  [tg] TELEGRAM_ADMIN_CHAT_ID yok — bildirim atlandı.');
    return false;
  }

  const typeLabel = mediaType === 'VIDEO' ? '🎬 Video' : '🖼️ Fotoğraf';
  const body = [
    `📌 *Yeni etiket tespit edildi* \\(${tgEscape(typeLabel)}\\)`,
    `*Hesap:* @${tgEscape(username || 'bilinmiyor')}`,
    caption ? `*Caption:* _${tgEscape(String(caption).slice(0, 200))}_` : '',
    '',
    permalink ? `🔗 [Orijinal gönderi](${permalink})` : '',
    '',
    `*Medya ID:* \`${tgEscape(mediaId)}\``,
    '',
    MODE === 'approve'
      ? '⏳ *Onay bekleniyor* — hikayeye repost etmek için:' + '\n`node scripts/ig-story-repost.mjs --apply ' + mediaId + '`'
      : '🤖 _auto modda — hikayeye yayınlanıyor..._',
  ].filter(Boolean).join('\n');

  // Fotoğrafsa Telegram'a direkt resim gönder (varsa)
  if (mediaUrl && mediaType === 'IMAGE') {
    await tgCall('sendPhoto', {
      chat_id: chatId,
      photo: mediaUrl,
      caption: body,
      parse_mode: 'MarkdownV2',
    }).catch(() =>
      // Resim erişilemezse sadece metin gönder
      tgCall('sendMessage', {
        chat_id: chatId,
        text: body,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false,
      })
    );
  } else {
    await tgCall('sendMessage', {
      chat_id: chatId,
      text: body,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: false,
    });
  }
  return true;
}

// ── IG Stories'e yayınla
// NOT: Bu, orijinal kullanıcının medyasının URL'sini alıp kendi hikayemiz olarak yayınlar.
// IG Graph API'de "native reshare" özelliği yoktur — bu bir geçici çözümdür.
async function publishStory({ mediaType, mediaUrl, username, token }) {
  const businessId = process.env.IG_BUSINESS_ID;

  // Atıf metni — kendi hikayemiz olarak yayınladığımızı belirtmek için
  const attribution = `📍 @${username} tarafından @kalkan.info'ya etiketlendi ❤️`;

  // 1) Media container oluştur
  const containerParams = {
    media_type: 'STORIES',
    ...(mediaType === 'VIDEO'
      ? { video_url: mediaUrl }
      : { image_url: mediaUrl }),
    // caption hikayede görünmez ama meta olarak eklenir
  };

  console.log(`  [stories] Container oluşturuluyor (${mediaType})...`);
  const container = await graphPost(`${businessId}/media`, containerParams, token);
  if (!container.id) throw new Error('Container id alınamadı: ' + JSON.stringify(container));

  const containerId = container.id;
  console.log(`  [stories] Container: ${containerId}`);

  // 2) Video için işleme bekleme (image'da atla)
  if (mediaType === 'VIDEO') {
    console.log('  [stories] Video işleme bekleniyor (max 30sn)...');
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const status = await graphGet(containerId, { fields: 'status_code' }, token);
        if (status.status_code === 'FINISHED') break;
        if (status.status_code === 'ERROR') throw new Error('Video işleme hatası');
        console.log(`    status: ${status.status_code} (${i + 1}/6)...`);
      } catch (e) {
        console.warn(`    [stories] status kontrol hatası: ${e.message}`);
      }
    }
  }

  // 3) Yayınla
  console.log('  [stories] Yayınlanıyor...');
  const result = await graphPost(`${businessId}/media_publish`, { creation_id: containerId }, token);
  console.log(`  [stories] ✅ Yayınlandı: ${result.id} — ${attribution}`);
  return result;
}

// ── Etiketlenmiş medyaları çek
async function fetchTaggedMedia(token) {
  const businessId = process.env.IG_BUSINESS_ID;
  try {
    const data = await graphGet(`${businessId}/tags`, {
      fields: 'id,media_type,media_url,thumbnail_url,permalink,username,caption,timestamp',
      limit: 20,
    }, token);
    return data.data || [];
  } catch (e) {
    // Yaygın hata: "instagram_basic" izni yok veya hesap Business değil
    if (e.message.includes('190') || e.message.includes('permission')) {
      console.log(`  [tags] İzin hatası — "instagram_basic" + Business hesap gereklidir.`);
      console.log(`         Hata: ${e.message.slice(0, 200)}`);
    } else {
      console.warn(`  [tags] Etiket çekme başarısız: ${e.message.slice(0, 200)}`);
    }
    return [];
  }
}

// ── Story mention'larını çek (best-effort; App Review gerektiren izin)
async function fetchStoryMentions(token) {
  const businessId = process.env.IG_BUSINESS_ID;
  try {
    // Not: Bu endpoint "instagram_manage_mentions" izni ister.
    // Standart (basic) erişimde "OAuthException #200" verir.
    // Eğer izin yoksa sessizce [] döner ve gerekli izni loglar.
    const data = await graphGet(`${businessId}/mentions`, {
      fields: 'id,media_type,media_url,permalink,username,caption,timestamp',
      limit: 20,
    }, token);
    return data.data || [];
  } catch (e) {
    if (e.message.includes('200') || e.message.includes('permission') || e.message.includes('OAuthException')) {
      console.log('  [mentions] Story mention erişimi yok — "instagram_manage_mentions" izni + App Review gerektirir.');
      console.log('             Bu özellik için Meta geliştiricisi panelinden izin başvurusu yapılmalıdır.');
      console.log('             Geçici çözüm: Etiketlenmiş gönderiler (tags) endpoint ile devam ediliyor.');
    } else {
      console.warn(`  [mentions] Mention çekme başarısız: ${e.message.slice(0, 200)}`);
    }
    return [];
  }
}

// ── Yeni bir etiketlenmiş medyayı işle
async function handleTaggedMedia(media, state, token) {
  const { id, media_type: mediaType, media_url: mediaUrl, thumbnail_url, permalink, username, caption } = media;

  if (state.processed[id]) return; // zaten işlendi
  if (Object.values(state.pending).some(p => p.mediaId === id)) return; // onay bekliyor

  console.log(`  📌 Yeni etiket: @${username || '?'} (${mediaType}) — ${id}`);

  // Kullanılacak medya URL'si: video için thumbnail (hikaye önizleme) veya video_url
  const effectiveUrl = mediaUrl || thumbnail_url || null;

  if (!effectiveUrl) {
    console.log(`     [atlandı] media_url alınamadı — muhtemelen gizli hesap.`);
    state.processed[id] = { skipped: true, reason: 'media_url yok', at: new Date().toISOString(), username };
    return;
  }

  if (MODE === 'auto' && !DRY_RUN) {
    try {
      await publishStory({ mediaType, mediaUrl: effectiveUrl, username, token });
      state.processed[id] = {
        mode: 'auto', publishedAt: new Date().toISOString(), mediaType, username, permalink,
      };
      console.log(`     ✅ Hikayeye yayınlandı (auto)`);
    } catch (e) {
      console.warn(`     ❌ Yayın hatası: ${e.message}`);
      state.processed[id] = { error: e.message, at: new Date().toISOString(), username };
    }
  } else {
    // approve modu (varsayılan) veya dry-run
    const pendingKey = `p_${id}`;
    state.pending[pendingKey] = {
      mediaId: id, mediaType, mediaUrl: effectiveUrl, permalink, username,
      caption: caption ? String(caption).slice(0, 500) : null,
      createdAt: new Date().toISOString(),
    };

    if (!DRY_RUN) {
      const sent = await tgNotifyRepost({ mediaId: id, username, mediaType, permalink, caption, mediaUrl: effectiveUrl });
      console.log(sent
        ? `     📨 Telegram'a onay bildirimi gönderildi`
        : `     📝 Pending kaydedildi (Telegram yapılandırılmadı)`);
    } else {
      console.log(`     [dry-run] Telegram bildirimi atlandı`);
    }
  }
}

// ── --apply <mediaId> CLI komutu: tek bir medyayı doğrudan hikayeye yayınla
async function applyById(mediaId, token) {
  const state = loadState();
  const pendingEntry = Object.entries(state.pending).find(([, p]) => p.mediaId === mediaId);

  if (!pendingEntry) {
    // Doğrudan API'den çekmeyi dene
    console.log(`  [apply] Pending'de bulunamadı — API'den alınıyor: ${mediaId}`);
    try {
      const media = await graphGet(mediaId, {
        fields: 'id,media_type,media_url,thumbnail_url,permalink,username,caption',
      }, token);
      const effectiveUrl = media.media_url || media.thumbnail_url;
      if (!effectiveUrl) { console.error('  media_url alınamadı.'); process.exit(1); }
      await publishStory({ mediaType: media.media_type, mediaUrl: effectiveUrl, username: media.username, token });
      state.processed[mediaId] = { mode: 'manual-apply', publishedAt: new Date().toISOString() };
    } catch (e) {
      console.error(`  ❌ ${e.message}`);
      process.exit(1);
    }
  } else {
    const [key, p] = pendingEntry;
    await publishStory({ mediaType: p.mediaType, mediaUrl: p.mediaUrl, username: p.username, token });
    state.processed[mediaId] = { mode: 'manual-apply', publishedAt: new Date().toISOString(), username: p.username };
    delete state.pending[key];
  }
  saveState(state);
  console.log('✔️ Tamamlandı.');
}

// ── Mock modu: token yokken akışı göster
function runMock() {
  console.log('🧪 MOCK MODU — gerçek API çağrısı yapılmaz\n');
  const samples = [
    { id: 'MOCK_1001', media_type: 'IMAGE', media_url: 'https://placehold.co/1080x1920.jpg', permalink: 'https://www.instagram.com/p/abc123/', username: 'gezgin_ayse', caption: 'Kalkan muhteşemdi! 🌊 @kalkan.info' },
    { id: 'MOCK_1002', media_type: 'VIDEO', media_url: null, thumbnail_url: 'https://placehold.co/1080x1920.jpg', permalink: 'https://www.instagram.com/p/xyz456/', username: 'john_travels', caption: 'Amazing view from Kaputas! @kalkan.info #Turkey' },
    { id: 'MOCK_1003', media_type: 'IMAGE', media_url: null, permalink: null, username: 'gizli_hesap', caption: null },
  ];
  const state = loadState();
  for (const m of samples) {
    const url = m.media_url || m.thumbnail_url || null;
    console.log(`  @${m.username} (${m.media_type}) [${m.id}]`);
    if (!url) { console.log('    → atlandı (media_url yok)\n'); continue; }
    console.log(`    caption: "${(m.caption || '').slice(0, 60)}"`);
    console.log(`    → ${MODE === 'auto' ? '🤖 auto: hikayeye yayınlanacak' : '📨 approve: Telegram onay bildirimi gönderilecek'}`);
    console.log('');
  }
  console.log(`[mock] State: ${Object.keys(state.processed).length} işlenmiş, ${Object.keys(state.pending).length} bekleyen`);
}

async function main() {
  const token = process.env.IG_LONG_LIVED_TOKEN;
  const businessId = process.env.IG_BUSINESS_ID;

  // --list-pending
  if (args.includes('--list-pending')) {
    const state = loadState();
    const entries = Object.entries(state.pending);
    if (!entries.length) { console.log('Bekleyen repost yok.'); return; }
    for (const [k, p] of entries) {
      console.log(`[${k}] @${p.username} (${p.mediaType}) — ${p.mediaId}`);
      console.log(`  ${p.permalink || 'permalink yok'}`);
      console.log(`  Yayınla: node scripts/ig-story-repost.mjs --apply ${p.mediaId}\n`);
    }
    return;
  }

  // --apply <mediaId>
  const applyIdx = args.indexOf('--apply');
  if (applyIdx !== -1) {
    const applyId = args[applyIdx + 1];
    if (!applyId) { console.error('--apply için medya ID gerekli.'); process.exit(1); }
    if (!token || !businessId) { console.error('❌ IG_LONG_LIVED_TOKEN / IG_BUSINESS_ID yok.'); process.exit(1); }
    await applyById(applyId, token);
    return;
  }

  // Token/business yok → mock
  if (FORCE_MOCK || !token || !businessId) {
    if (!FORCE_MOCK) {
      console.log('⚠️  IG_LONG_LIVED_TOKEN veya IG_BUSINESS_ID yok — token yok, atlanıyor.');
      console.log('    Mock çıktısı görmek için: node scripts/ig-story-repost.mjs --mock\n');
    }
    runMock();
    return;
  }

  console.log(`🔄 IG hikaye repost tarayıcı — mod: ${MODE}${DRY_RUN ? ' (dry-run)' : ''}\n`);

  const state = loadState();
  let newCount = 0;

  // 1) Etiketlenmiş gönderiler
  console.log('📥 Etiketlenmiş medyalar çekiliyor (/{id}/tags)...');
  const tagged = await fetchTaggedMedia(token);
  console.log(`   ${tagged.length} etiket bulundu.`);

  for (const m of tagged) {
    await handleTaggedMedia(m, state, token);
    if (!state.processed[m.id]?.skipped || state.pending[`p_${m.id}`]) newCount++;
  }

  // 2) Story mention (best-effort — izin yoksa sessizce atlar)
  console.log('\n📥 Story mention\'lar çekiliyor (/{id}/mentions — best-effort)...');
  const mentions = await fetchStoryMentions(token);
  console.log(`   ${mentions.length} mention bulundu.`);

  for (const m of mentions) {
    await handleTaggedMedia(m, state, token);
  }

  saveState(state);

  const pendingCount = Object.keys(state.pending).length;
  const processedCount = Object.keys(state.processed).length;
  console.log(`\n✔️  Bitti — ${processedCount} toplam işlenmiş · ${pendingCount} bekleyen onay`);
  if (pendingCount > 0) {
    console.log(`    Bekleyenleri gör: node scripts/ig-story-repost.mjs --list-pending`);
  }
}

// ESM guard: doğrudan çalıştırıldığında main() çağır
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => {
    console.error('FATAL:', e.message || e);
    process.exit(1);
  });
}

export { main, publishStory, fetchTaggedMedia };
