#!/usr/bin/env node
/**
 * comment-dm-funnel.mjs — "Yorum kelimesi → DM" hunisi (AI-affiliate playbook).
 *
 * MANTIK: Videonun sonunda "REHBER yaz" dersin. Yorum yazan kişiye otomatik
 * DM gider (değer + link). Bu (1) videoyu algoritmada yukarı iter, (2) gerçekten
 * ilgilenen kişiyi işaretler, (3) özel konuşma + satış kanalı açar.
 *
 * Mekanizma: IG Graph  POST /{comment-id}/private_replies  → yorumcuya DM.
 * (İzin: instagram_manage_messages. Yorum başına 1 private reply, ~7 gün pencere.)
 *
 * Kampanyalar: data/dm-funnel.json  (yoksa yerleşik örnek kullanılır)
 *   [{ "keyword":"REHBER", "dm":"...link...", "publicReply":"DM'ine baktım 📩", "active":true }]
 * Dedup    : data/state/dm-funnel-state.json  (comment id bazında)
 *
 * Kullanım:
 *   node scripts/agency/comment-dm-funnel.mjs             # DRY-RUN (gönderMEZ, eşleşmeleri gösterir)
 *   node scripts/agency/comment-dm-funnel.mjs --live      # gerçekten DM gönder
 *   node scripts/agency/comment-dm-funnel.mjs --mock      # token yokken örnek yorumlarla dene
 *
 * ENV: IG_BUSINESS_ID, IG_LONG_LIVED_TOKEN
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CFG_PATH = join(ROOT, 'data', 'dm-funnel.json');
const STATE_PATH = join(ROOT, 'data', 'state', 'dm-funnel-state.json');

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const BUSINESS_ID = process.env.IG_BUSINESS_ID || '';
const TOKEN = process.env.IG_LONG_LIVED_TOKEN || process.env.FB_PAGE_TOKEN || '';
const MEDIA_LIMIT = 12;
const COMMENT_LIMIT = 50;
const MAX_DM_PER_RUN = 40;

const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const MOCK = args.includes('--mock') || !TOKEN || !BUSINESS_ID;

// ── Yerleşik örnek kampanya (data/dm-funnel.json yoksa) ──
const DEFAULT_CAMPAIGNS = [{
  keyword: 'REHBER',
  active: true,
  dm: 'Selam! 🌊 İşte sana söz verdiğimiz Kalkan mini rehberi: en iyi plajlar, restoranlar ve gizli koylar → https://kalkaninfo.com\n' +
      'Villa veya rezervasyon için buradan yazabilirsin: https://wa.me/905306650794',
  publicReply: 'DM kutunu kontrol et 📩',
}];

function loadCampaigns() {
  if (existsSync(CFG_PATH)) {
    try { const c = JSON.parse(readFileSync(CFG_PATH, 'utf8')); if (Array.isArray(c) && c.length) return c; } catch { /* ör. bozuk → default */ }
  }
  return DEFAULT_CAMPAIGNS;
}
function loadState() {
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { return { done: {} }; }
}
function saveState(s) {
  s.updated = new Date().toISOString();
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2) + '\n');
}

async function graphGet(path, params = {}) {
  const qs = new URLSearchParams({ ...params, access_token: TOKEN }).toString();
  const res = await fetch(`${GRAPH_BASE}/${path}?${qs}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}
async function graphPost(path, body) {
  const res = await fetch(`${GRAPH_BASE}/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: TOKEN }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// yorum, kampanya kelimesini içeriyor mu (kelime sınırı, büyük/küçük fark etmez)
function matchCampaign(text, campaigns) {
  const t = (text || '').toLowerCase();
  return campaigns.find((c) => {
    if (c.active === false) return false;
    const kw = String(c.keyword || '').toLowerCase().trim();
    return kw && new RegExp(`(^|[^a-z0-9ğüşıöç])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9ğüşıöç]|$)`, 'i').test(t);
  });
}

async function collectComments() {
  if (MOCK) {
    return [
      { id: 'mock_1', text: 'Bu plajlar harika, REHBER', username: 'gezgin_ayse', mediaId: 'm1' },
      { id: 'mock_2', text: 'çok güzel 😍', username: 'mehmet', mediaId: 'm1' },
      { id: 'mock_3', text: 'rehber alabilir miyim?', username: 'tourist_jane', mediaId: 'm2' },
    ];
  }
  const out = [];
  const media = await graphGet(`${BUSINESS_ID}/media`, { fields: 'id,caption,timestamp', limit: MEDIA_LIMIT });
  for (const m of media.data || []) {
    let c;
    try { c = await graphGet(`${m.id}/comments`, { fields: 'id,text,username,timestamp', limit: COMMENT_LIMIT }); }
    catch { continue; }
    for (const cm of c.data || []) out.push({ ...cm, mediaId: m.id });
  }
  return out;
}

(async () => {
  const campaigns = loadCampaigns();
  const state = loadState();
  console.log(`💬 Comment→DM hunisi — ${campaigns.length} kampanya · ${MOCK ? 'MOCK' : LIVE ? 'CANLI' : 'DRY-RUN'}\n`);
  console.log('Kampanya kelimeleri:', campaigns.filter(c => c.active !== false).map(c => c.keyword).join(', ') || '(yok)', '\n');

  const comments = await collectComments();
  let matched = 0, sent = 0, skipped = 0;

  for (const cm of comments) {
    const camp = matchCampaign(cm.text, campaigns);
    if (!camp) continue;
    matched++;
    if (state.done[cm.id]) { skipped++; continue; }
    console.log(`→ @${cm.username}: "${(cm.text || '').slice(0, 60)}"  [${camp.keyword}]`);

    if (!LIVE || MOCK) { console.log(`   (dry-run) DM gönderilecekti: "${camp.dm.slice(0, 70)}…"`); continue; }
    if (sent >= MAX_DM_PER_RUN) { console.log('   ⚠ tur limiti doldu'); break; }
    try {
      await graphPost(`${cm.id}/private_replies`, { message: camp.dm });
      if (camp.publicReply) { try { await graphPost(`${cm.id}/replies`, { message: camp.publicReply }); } catch { /* public reply best-effort */ } }
      state.done[cm.id] = { keyword: camp.keyword, username: cm.username, at: new Date().toISOString() };
      sent++;
      console.log('   ✓ DM gönderildi');
    } catch (e) {
      console.log(`   ✗ hata: ${e.message.slice(0, 120)}`);
    }
  }

  if (LIVE && !MOCK) saveState(state);
  console.log(`\nÖzet: ${matched} eşleşme · ${sent} DM gönderildi · ${skipped} zaten yapılmış${LIVE ? '' : ' · (DRY-RUN: --live ile gerçek gönderilir)'}`);
})();
