#!/usr/bin/env node
// scripts/ig-reply-poll.mjs
// Kalkan Info — Instagram oto-cevap POLLING motoru.
//
// NEDEN POLLING: api/*.js Vercel Hobby limitinde (12/12) DOLU; yeni webhook
// fonksiyonu eklenemez. Bu script PC'de (cron / runner) periyodik çalışır:
//   1) Kendi IG hesabımızın son medyalarındaki YENİ yorumları çeker
//   2) (best-effort) gelen DM'leri çeker
//   3) Daha önce yanıtlanmamışları bulur (data/ig-replied.json takibi)
//   4) lib/ig-reply.mjs ile Claude (Haiku) cevabı üretir
//   5) MOD'a göre cevaplar:
//        IG_AUTOREPLY_MODE=auto    → Graph API ile DOĞRUDAN cevaplar
//        IG_AUTOREPLY_MODE=approve → Telegram'a onaya gönderir (varsayılan)
//
// GRACEFUL: token yok/invalid ise gerçek API çağrısı yapılmaz; yerleşik
// örnek yorumlarla cevap üretimi gösterilir (mock).
//
// ONAY AKIŞI (approve):
//   - Telegram'a "✅ Onayla / ❌ Reddet" butonlu mesaj gider.
//   - Etkileşimli onay için AYRI bir bot gerekir (TELEGRAM_IG_BOT_TOKEN):
//     mevcut social-manager botu WEBHOOK kullanıyor; aynı token'da getUpdates
//     409 Conflict verir (webhook vs polling çakışır). Ayrı bot yoksa mesaj
//     yine de bilgilendirme olarak gider ve CLI ile onaylanabilir:
//       node scripts/ig-reply-poll.mjs --apply-all     (bekleyen onayları gönder)
//       node scripts/ig-reply-poll.mjs --list-pending
//
// ENV: IG_BUSINESS_ID, IG_LONG_LIVED_TOKEN, ANTHROPIC_API_KEY,
//      IG_AUTOREPLY_MODE (auto|approve), TELEGRAM_IG_BOT_TOKEN (ops.),
//      TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID (bildirim için).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateReply, loadKnowledgeBase } from '../lib/ig-reply.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STATE_PATH = join(ROOT, 'data', 'ig-replied.json');

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const MODE = (process.env.IG_AUTOREPLY_MODE || 'approve').toLowerCase();
const MEDIA_LIMIT = 8;        // kaç son medyanın yorumlarına bakılsın
const COMMENT_LIMIT = 25;     // medya başına en fazla yorum
const MAX_REPLIES_PER_RUN = 10; // güvenlik: tek koşuda en fazla cevap/öneri

// ── CLI flags
const args = process.argv.slice(2);
const FLAG = (name) => args.includes(name);
const FORCE_MOCK = FLAG('--mock');
const APPLY_ALL = FLAG('--apply-all');
const LIST_PENDING = FLAG('--list-pending');

// ── State (data/ig-replied.json)
function loadState() {
  try {
    const s = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
    s.comments ||= {};
    s.messages ||= {};
    s.pending ||= {};
    return s;
  } catch {
    return { _meta: {}, comments: {}, messages: {}, pending: {} };
  }
}
function saveState(state) {
  state.updated = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

// ── Graph API helpers
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

// ── Telegram (bildirim + opsiyonel etkileşimli onay)
function tgToken() {
  // Etkileşimli onay için ayrı bot tercih edilir (webhook çakışmasını önler).
  return process.env.TELEGRAM_IG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || null;
}
const TG_INTERACTIVE = !!process.env.TELEGRAM_IG_BOT_TOKEN;
async function tgCall(method, body) {
  const t = tgToken();
  if (!t) return null;
  const res = await fetch(`https://api.telegram.org/bot${t}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) console.warn(`[tg] ${method} fail: ${json.description || res.status}`);
  return json.result;
}
function tgEscape(s) {
  return String(s ?? '').replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}
async function tgNotifyProposal({ token, kind, username, text, reply, lang }) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) return false;
  const head = kind === 'dm' ? '💬 *Yeni DM*' : '💬 *Yeni Yorum*';
  const body = [
    head + ` \\(${lang.toUpperCase()}\\)`,
    `*@${tgEscape(username || 'kullanıcı')}:*`,
    `_${tgEscape(text.slice(0, 300))}_`,
    '',
    '*Önerilen cevap:*',
    tgEscape(reply),
  ].join('\n');
  const reply_markup = TG_INTERACTIVE
    ? { inline_keyboard: [[
        { text: '✅ Onayla & Cevapla', callback_data: `igr:${token}:ok` },
        { text: '❌ Reddet', callback_data: `igr:${token}:no` },
      ]] }
    : undefined;
  await tgCall('sendMessage', {
    chat_id: chatId, text: body, parse_mode: 'MarkdownV2',
    disable_web_page_preview: true, reply_markup,
  });
  return true;
}

// Etkileşimli onayları işle (yalnızca ayrı IG bot varsa — getUpdates).
async function consumeApprovals(state, token) {
  if (!TG_INTERACTIVE) return 0;
  const updates = await tgCall('getUpdates', {
    offset: (state.tgOffset || 0) + 1,
    timeout: 0,
    allowed_updates: ['callback_query'],
  });
  if (!Array.isArray(updates) || !updates.length) return 0;

  let applied = 0;
  for (const u of updates) {
    state.tgOffset = u.update_id;
    const cb = u.callback_query;
    if (!cb) continue;
    const [verb, tok, action] = (cb.data || '').split(':');
    if (verb !== 'igr') continue;
    const p = state.pending[tok];
    let toast;
    if (!p) {
      toast = 'Bu öneri artık geçerli değil';
    } else if (action === 'ok') {
      try {
        await applyReply(p, token, state);
        toast = '✅ Cevap gönderildi';
      } catch (e) {
        toast = `❌ Gönderim hatası: ${String(e.message).slice(0, 80)}`;
      }
      delete state.pending[tok];
      applied++;
    } else {
      delete state.pending[tok];
      toast = '❌ Reddedildi';
    }
    await tgCall('answerCallbackQuery', { callback_query_id: cb.id, text: toast });
    if (cb.message) {
      await tgCall('editMessageText', {
        chat_id: cb.message.chat.id, message_id: cb.message.message_id,
        text: `${cb.message.text}\n\n— ${toast}`, reply_markup: { inline_keyboard: [] },
      }).catch(() => {});
    }
  }
  return applied;
}

// Bir öneriyi gerçekten IG'ye gönderir + state'i işaretler.
async function applyReply(p, token, state) {
  if (p.kind === 'comment') {
    const r = await graphPost(`${p.targetId}/replies`, { message: p.reply }, token);
    state.comments[p.targetId] = { repliedAt: new Date().toISOString(), mode: MODE, replyId: r.id, lang: p.lang };
    return r;
  }
  if (p.kind === 'dm') {
    // IG Messaging Send API — instagram_manage_messages + Advanced Access gerekir.
    const r = await graphPost(`${process.env.IG_BUSINESS_ID}/messages`, {
      recipient: { id: p.senderId },
      message: { text: p.reply },
    }, token);
    state.messages[p.targetId] = { repliedAt: new Date().toISOString(), mode: MODE, lang: p.lang };
    return r;
  }
}

let _tok = 0;
function newToken() { return `t${Date.now().toString(36)}${(_tok++).toString(36)}`; }

// ── Yeni bir item (yorum/DM) için cevap üretip mod'a göre işle.
async function handleItem({ kind, targetId, senderId, username, text }, state, token, kb, counters) {
  const done = kind === 'comment' ? state.comments : state.messages;
  if (done[targetId]) return;                 // zaten işlendi
  // pending'de mi?
  if (Object.values(state.pending).some(p => p.targetId === targetId)) return;
  if (counters.replies >= MAX_REPLIES_PER_RUN) return;

  const { reply, skip, reason, lang, cost } = await generateReply({ text, username, kb });
  counters.cost += cost;

  if (skip) {
    // Tekrar değerlendirmemek için "skipped" olarak işaretle
    done[targetId] = { skipped: true, reason, at: new Date().toISOString() };
    console.log(`  ⏭️  skip @${username}: ${reason}`);
    return;
  }

  counters.replies++;
  console.log(`  💬 @${username} (${lang}): "${text.slice(0, 60)}"`);
  console.log(`     → ${reply}`);

  if (MODE === 'auto') {
    try {
      const item = { kind, targetId, senderId, username, reply, lang };
      await applyReply(item, token, state);
      console.log('     ✅ gönderildi (auto)');
    } catch (e) {
      console.warn(`     ❌ gönderim hatası: ${e.message}`);
    }
  } else {
    const tok = newToken();
    state.pending[tok] = { kind, targetId, senderId, username, text: text.slice(0, 500), reply, lang, createdAt: new Date().toISOString() };
    const sent = await tgNotifyProposal({ token: tok, kind, username, text, reply, lang });
    console.log(sent
      ? `     📨 onaya gönderildi (Telegram${TG_INTERACTIVE ? ', butonlu' : ', bildirim'})`
      : '     📝 pending kaydedildi (Telegram yapılandırılmadı)');
  }
}

// ── IG'den yeni yorumları çek
async function fetchComments(token, kb, state, counters) {
  const businessId = process.env.IG_BUSINESS_ID;
  const media = await graphGet(`${businessId}/media`, { fields: 'id,caption,timestamp', limit: MEDIA_LIMIT }, token);
  const myUsername = (await getMyUsername(token)) || '';

  for (const m of media.data || []) {
    let comments;
    try {
      comments = await graphGet(`${m.id}/comments`, { fields: 'id,text,username,timestamp', limit: COMMENT_LIMIT }, token);
    } catch (e) {
      console.warn(`  [comments] media ${m.id} atlandı: ${e.message}`);
      continue;
    }
    for (const c of comments.data || []) {
      if (myUsername && c.username === myUsername) continue;  // kendi yorumumuz
      if (!c.text) continue;
      await handleItem({ kind: 'comment', targetId: c.id, username: c.username, text: c.text }, state, token, kb, counters);
    }
  }
}

let _myUsername;
async function getMyUsername(token) {
  if (_myUsername !== undefined) return _myUsername;
  try {
    const me = await graphGet(`${process.env.IG_BUSINESS_ID}`, { fields: 'username' }, token);
    _myUsername = me.username || null;
  } catch { _myUsername = null; }
  return _myUsername;
}

// ── IG'den gelen DM'leri çek (best-effort; izin yoksa sessizce atla)
async function fetchDMs(token, kb, state, counters) {
  const businessId = process.env.IG_BUSINESS_ID;
  let convs;
  try {
    convs = await graphGet(`${businessId}/conversations`, {
      platform: 'instagram',
      fields: 'participants,messages.limit(5){id,from,message,created_time}',
      limit: 15,
    }, token);
  } catch (e) {
    console.log(`  [dm] atlandı (izin/permission gerekebilir): ${e.message.slice(0, 120)}`);
    return;
  }
  const myUsername = await getMyUsername(token);
  for (const conv of convs.data || []) {
    const msgs = conv.messages?.data || [];
    if (!msgs.length) continue;
    const last = msgs[0]; // en yeni
    // Bizden gelen son mesajsa veya boşsa atla
    const fromName = last.from?.username || '';
    if (!last.message) continue;
    if (myUsername && fromName === myUsername) continue;
    await handleItem({
      kind: 'dm', targetId: last.id, senderId: last.from?.id, username: fromName,
      text: last.message,
    }, state, token, kb, counters);
  }
}

// ── Mock: token yokken cevap üretimini göster
async function runMock(kb) {
  console.log('🧪 MOCK MODU — gerçek IG/Telegram çağrısı yapılmaz\n');
  const samples = [
    { username: 'gezgin_ayse', text: 'Kalkan\'da iyi bir balık restoranı var mı? Akşam yemeği için.' },
    { username: 'random_promo', text: 'Take 10k followers cheap!! click link in bio 🔥🔥' },
    { username: 'john_travels', text: 'Is Kaputas beach worth visiting in September?' },
    { username: 'fan_kalkan', text: 'merhaba güzel sayfa 👍' },
  ];
  for (const s of samples) {
    const r = await generateReply({ text: s.text, username: s.username, kb });
    console.log(`@${s.username} (${r.lang}): "${s.text}"`);
    console.log(r.skip ? `  ⏭️  SKIP — ${r.reason}` : `  💬 ${r.reply}`);
    console.log('');
  }
}

async function main() {
  const token = process.env.IG_LONG_LIVED_TOKEN;
  const businessId = process.env.IG_BUSINESS_ID;
  const kb = loadKnowledgeBase();
  const state = loadState();

  // CLI: bekleyen önerileri listele / hepsini gönder
  if (LIST_PENDING) {
    const entries = Object.entries(state.pending);
    if (!entries.length) { console.log('Bekleyen öneri yok.'); return; }
    for (const [tok, p] of entries) {
      console.log(`[${tok}] ${p.kind} @${p.username} (${p.lang})\n  soru: ${p.text}\n  cevap: ${p.reply}\n`);
    }
    return;
  }
  if (APPLY_ALL) {
    if (!token || !businessId) { console.error('IG token/business id yok — gönderilemez.'); process.exit(1); }
    let n = 0;
    for (const [tok, p] of Object.entries(state.pending)) {
      try { await applyReply(p, token, state); delete state.pending[tok]; n++; console.log(`✅ gönderildi: @${p.username}`); }
      catch (e) { console.warn(`❌ @${p.username}: ${e.message}`); }
    }
    saveState(state);
    console.log(`\nToplam ${n} cevap gönderildi.`);
    return;
  }

  // Mock?
  if (FORCE_MOCK || !token || !businessId) {
    if (!FORCE_MOCK) console.log('⚠️  IG_LONG_LIVED_TOKEN / IG_BUSINESS_ID yok — mock moduna düşülüyor.\n');
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY de yok — cevap üretilemez. .env yükleyin.');
      process.exit(1);
    }
    await runMock(kb);
    return;
  }

  console.log(`🤖 IG oto-cevap — mod: ${MODE}${TG_INTERACTIVE ? ' (Telegram butonlu onay)' : ''}\n`);
  const counters = { replies: 0, cost: 0 };

  // 1) Önce bekleyen onayları işle (etkileşimli)
  const applied = await consumeApprovals(state, token).catch(e => { console.warn('[approvals]', e.message); return 0; });
  if (applied) console.log(`✅ ${applied} onaylanmış cevap gönderildi.\n`);

  // 2) Yeni yorum + DM tara
  console.log('📥 Yorumlar taranıyor...');
  await fetchComments(token, kb, state, counters).catch(e => console.warn('[comments]', e.message));
  console.log('📥 DM\'ler taranıyor...');
  await fetchDMs(token, kb, state, counters).catch(e => console.warn('[dm]', e.message));

  saveState(state);
  console.log(`\n✔️  Bitti — ${counters.replies} cevap/öneri · ~$${counters.cost.toFixed(4)} · ${Object.keys(state.pending).length} bekleyen onay`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
