#!/usr/bin/env node
/**
 * site-edit-worker.mjs — Telegram'dan gelen site-düzenleme kuyruğunu işler.
 * Supabase site_edit_queue (status=pending) → JSON düzenle → git commit + push → Vercel deploy.
 * Sonucu kuyruğa yazar + Telegram'a bildirir. always-on daemon'dan çağrılır (veya cron/tek sefer).
 *
 * REPO MAKİNESİNDE çalışır (git erişimi şart). Branch: EDIT_PUSH_BRANCH (varsayılan mevcut branch).
 * node scripts/agency/site-edit-worker.mjs [--once]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
if (existsSync(join(ROOT, '.env.local'))) for (const l of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const SUPA_URL = process.env.SUPABASE_URL, SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const slug = (s) => String(s || '').toLowerCase().replace(/[çğıöşü]/g, (c) => ({ç:'c',ğ:'g',ı:'i',ö:'o',ş:'s',ü:'u'}[c])).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1${path}`, { ...opts, headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return r;
}
async function tg(chatId, text) {
  if (!TG_TOKEN || !chatId) return;
  try { await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }) }); } catch {}
}
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const writeJson = (rel, d) => writeFileSync(join(ROOT, rel), JSON.stringify(d, null, 2) + '\n', 'utf8');

// ── AKSİYONLAR ── her biri {ok, summary, files[]} döner (uydurma yok — verilen alanlar)
const ACTIONS = {
  addEvent(a) {
    const d = readJson('data/etkinlik-takvimi.json');
    if (!a.title || !a.date) return { ok: false, summary: 'Etkinlik için en az başlık + tarih gerekli.' };
    const ev = {
      id: `oneoff-${slug(a.title).slice(0, 24)}-${a.date.replace(/-/g, '')}`,
      venueName: a.venueName || a.venue || '', area: a.area || 'Kalkan',
      type: a.type || 'Etkinlik', date: a.date, time: a.time || '', title: a.title,
      source: 'telegram', verified: true,
    };
    if ((d.oneoff || []).some((x) => x.id === ev.id)) return { ok: false, summary: 'Bu etkinlik zaten var.' };
    d.oneoff = [...(d.oneoff || []), ev];
    writeJson('data/etkinlik-takvimi.json', d);
    return { ok: true, summary: `Etkinlik eklendi: ${ev.date} · ${ev.title}`, files: ['data/etkinlik-takvimi.json'] };
  },
  addProvider(a) {
    const d = readJson('data/hizmet-saglayicilari.json');
    const cat = a.category || a.kategori;
    if (!cat || !a.name || !a.phone) return { ok: false, summary: 'Sağlayıcı için kategori + ad + telefon gerekli.' };
    const svc = d.services?.[cat];
    if (!svc) return { ok: false, summary: `Kategori bulunamadı: ${cat}. Mevcut: ${Object.keys(d.services || {}).join(', ')}` };
    const raw = String(a.phone).replace(/\D/g, '');
    const id = `${cat}-${slug(a.name)}`;
    if ((svc.providers || []).some((p) => p.id === id || (p.phoneRaw === raw))) return { ok: false, summary: 'Bu sağlayıcı zaten var.' };
    svc.providers.push({ id, name: a.name, type: a.type || 'Yerel Usta', rating: 5, reviewCount: 0,
      summary: a.summary || `Kalkan'da ${svc.title.toLowerCase()} hizmeti.`, specialties: a.specialties || [svc.title],
      phone: a.phone, phoneRaw: raw, whatsapp: a.phone, whatsappRaw: raw, location: a.location || 'Kalkan',
      verified: true, featured: false, addedAt: new Date().toISOString().slice(0, 10) });
    writeJson('data/hizmet-saglayicilari.json', d);
    return { ok: true, summary: `Sağlayıcı eklendi: ${a.name} (${cat}) ${a.phone}`, files: ['data/hizmet-saglayicilari.json'] };
  },
};

function gitPush(files, msg) {
  const opts = { cwd: ROOT, stdio: 'pipe' };
  execSync(`git add ${files.map((f) => `"${f}"`).join(' ')}`, opts);
  execSync(`git -c user.name="Kalkan Bot" -c user.email="bot@kalkaninfo.com" commit -m "${msg.replace(/"/g, "'")}"`, opts);
  const branch = process.env.EDIT_PUSH_BRANCH || execSync('git rev-parse --abbrev-ref HEAD', opts).toString().trim();
  execSync(`git push origin HEAD:${branch}`, opts);
  return execSync('git rev-parse --short HEAD', opts).toString().trim();
}

async function processOne(row) {
  const a = row.action || {};
  const handler = ACTIONS[a.type];
  let result, status, sha = null;
  if (!handler) { result = `Bilinmeyen aksiyon: ${a.type}`; status = 'error'; }
  else {
    try {
      const r = handler(a);
      if (!r.ok) { result = r.summary; status = 'error'; }
      else {
        sha = gitPush(r.files, `bot(telegram): ${r.summary}`);
        result = `${r.summary} · commit ${sha} · ~1 dk içinde canlı.`;
        status = 'done';
      }
    } catch (e) { result = `Hata: ${String(e.message || e).slice(0, 200)}`; status = 'error'; }
  }
  await supa(`/site_edit_queue?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify({ status, result, commit_sha: sha, processed_at: new Date().toISOString() }) });
  await tg(row.chat_id, status === 'done' ? `✅ ${result}` : `⚠️ ${result}`);
  console.log(`[site-edit] #${row.id} ${a.type} → ${status}: ${result}`);
}

export async function runSiteEditQueue() {
  if (!SUPA_URL || !SUPA_KEY) { console.warn('[site-edit] SUPABASE env yok'); return 0; }
  const r = await supa(`/site_edit_queue?status=eq.pending&order=created_at.asc&limit=10`);
  if (!r.ok) { console.warn('[site-edit] kuyruk okunamadı', r.status); return 0; }
  const rows = await r.json();
  for (const row of rows) await processOne(row);
  return rows.length;
}

if (process.argv[1] && process.argv[1].endsWith('site-edit-worker.mjs')) {
  runSiteEditQueue().then((n) => console.log(`site-edit: ${n} istek işlendi.`)).catch((e) => { console.error(e); process.exit(1); });
}
