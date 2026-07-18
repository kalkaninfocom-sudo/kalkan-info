// scripts/build-agent-panel.mjs
// Kalkan Info — 28 Agent Durum Panosu. agents.json + schedule.json + (varsa)
// Supabase son üretimleri toplayıp golden-hour temalı self-contained agent-panel.html üretir.
// Çalıştır: node --env-file=.env.local scripts/build-agent-panel.mjs
// Cron: cron-rebuild günlük çağırır (build-all.mjs içinden de eklenebilir).

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => JSON.parse(fs.readFileSync(resolve(ROOT, p), 'utf8'));

const agentsRaw = rd('data/agency/agents.json').agents;
const agents = Object.entries(agentsRaw).map(([id, v]) => ({ id, ...v }));
let schedule = [];
try {
  const s = rd('data/agency/schedule.json');
  schedule = Array.isArray(s) ? s : (s.slots || s.schedule || s.entries || Object.values(s).find((v) => Array.isArray(v)) || []);
} catch {}

// agent id → çalışma saatleri
const schedByAgent = {};
for (const slot of schedule) {
  if (slot.type === 'agent' && slot.agent) {
    (schedByAgent[slot.agent] ??= []).push((slot.dow ? slot.dow + ' ' : '') + (slot.time || ''));
  }
}

const DEPTS = {
  sosyal:    { label: 'Sosyal Medya', icon: '◆', color: '#E8A020' },
  gazete:    { label: 'Kalkan Today Gazete', icon: '▤', color: '#1fa8a8' },
  concierge: { label: 'Concierge & Rehber', icon: '✦', color: '#c97b09' },
  teknik:    { label: 'Teknik & Uyum', icon: '⚙', color: '#16243A' },
};

// Supabase son üretim (build-time snapshot, graceful)
let lastPosts = [];
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (U && K) {
  try {
    const r = await fetch(`${U}/rest/v1/social_posts?select=content_pack_id,status,created_at&order=created_at.desc&limit=6`, {
      headers: { apikey: K, Authorization: `Bearer ${K}` },
    });
    if (r.ok) lastPosts = await r.json();
  } catch {}
}

const modelBadge = (m) => {
  const map = { haiku: '#8da750', sonnet: '#E8A020', opus: '#c0392b' };
  const base = (m || '').split('+')[0];
  const c = map[base] || '#6A6558';
  return `<span style="background:${c}1f;color:${c};font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;white-space:nowrap">${m || '—'}</span>`;
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const charLine = (a) => {
  const sys = (a.system || '').replace(/\s+/g, ' ').trim();
  const m = sys.match(/Sen\s+[^—.]+[—-]\s*([^.]+)\./) || sys.match(/^([^.]{20,120})\./);
  return m ? m[1].trim() : (a.role || '');
};

const cardsByDept = Object.keys(DEPTS).map((dep) => {
  const list = agents.filter((a) => a.department === dep);
  if (!list.length) return '';
  const d = DEPTS[dep];
  const cards = list.map((a) => {
    const times = (schedByAgent[a.id] || []);
    const trig = a.schedule?.type === 'trigger';
    const when = trig ? (a.schedule.label || 'Tetikleyici') : (times.length ? times.join(' · ') : 'Pipeline');
    return `
      <div class="card">
        <div class="card-top">
          <h3>${esc(a.name)}</h3>
          ${modelBadge(a.model)}
        </div>
        <p class="role">${esc(a.role || '')}</p>
        <p class="char">${esc(charLine(a))}</p>
        <div class="meta">
          <span class="pill ${trig ? 'trig' : 'sched'}">${trig ? '⚡ ' : '⏱ '}${esc(when)}</span>
          ${a.pipelineRole ? `<span class="pill role-pill">${esc(a.pipelineRole)}</span>` : ''}
        </div>
      </div>`;
  }).join('');
  return `
    <section class="dept">
      <div class="dept-head" style="--dc:${d.color}">
        <span class="dept-icon">${d.icon}</span>
        <h2>${d.label}</h2>
        <span class="dept-count">${list.length} agent</span>
      </div>
      <div class="grid">${cards}</div>
    </section>`;
}).join('');

const activityRows = lastPosts.length
  ? lastPosts.map((p) => `<li><span class="dot"></span><b>${esc((p.content_pack_id || '').slice(0, 30))}</b> <em>${esc(p.status || '')}</em> <time>${esc((p.created_at || '').slice(0, 16).replace('T', ' '))}</time></li>`).join('')
  : '<li class="muted">Supabase erişimi yok (build-time) — canlı üretimler /admin\'de.</li>';

const html = `<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Agent Panosu — Kalkan Info Multiverse</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{--linen:#FAF6EF;--linen2:#EFE7D8;--ink:#16243A;--muted:#6A6558;--gold:#E8A020;--line:#e4dbca}
  body{font-family:'Manrope',sans-serif;background:var(--linen);color:var(--ink);line-height:1.6;
    background-image:radial-gradient(1100px 500px at 90% -10%,rgba(232,160,32,.10),transparent 60%),radial-gradient(900px 600px at -5% 110%,rgba(31,168,168,.08),transparent 60%)}
  h1,h2,h3{font-family:'Fraunces',Georgia,serif;letter-spacing:-.02em;line-height:1.1}
  .wrap{max-width:1180px;margin:0 auto;padding:40px 22px 60px}
  header.top{margin-bottom:8px}
  .kick{font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--gold);font-weight:800}
  h1{font-size:clamp(2rem,5vw,3.2rem);margin:6px 0}
  h1 em{font-style:italic;color:var(--gold)}
  .sub{color:var(--muted);max-width:640px}
  .stats{display:flex;gap:14px;flex-wrap:wrap;margin:22px 0 6px}
  .stat{background:#fff;border:1px solid var(--linen2);border-radius:14px;padding:12px 18px;box-shadow:0 8px 22px -16px rgba(107,68,38,.4)}
  .stat b{font-family:'Fraunces',serif;font-size:26px;display:block;color:var(--ink)}
  .stat span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
  .health{display:inline-flex;align-items:center;gap:7px;background:#8da7501f;color:#5f7a2f;font-weight:700;font-size:12px;padding:6px 13px;border-radius:99px;margin-top:14px}
  .health .live{width:8px;height:8px;border-radius:50%;background:#5f7a2f;box-shadow:0 0 0 0 rgba(95,122,47,.5);animation:p 2s infinite}
  @keyframes p{70%{box-shadow:0 0 0 8px rgba(95,122,47,0)}100%{box-shadow:0 0 0 0 rgba(95,122,47,0)}}
  .dept{margin-top:34px}
  .dept-head{display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:2px solid var(--dc);margin-bottom:16px}
  .dept-icon{width:34px;height:34px;display:grid;place-items:center;background:var(--dc);color:#fff;border-radius:9px;font-size:16px}
  .dept-head h2{font-size:22px;flex:1}
  .dept-count{font-size:12px;color:var(--muted);font-weight:700;background:#fff;border:1px solid var(--linen2);padding:4px 11px;border-radius:99px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:14px}
  .card{background:#fff;border:1px solid var(--linen2);border-radius:16px;padding:16px 17px;box-shadow:0 10px 26px -20px rgba(107,68,38,.5);transition:transform .3s cubic-bezier(.16,1,.3,1),box-shadow .3s}
  .card:hover{transform:translateY(-3px);box-shadow:0 18px 40px -20px rgba(107,68,38,.6)}
  .card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
  .card-top h3{font-size:17px}
  .role{font-size:12.5px;color:var(--ink);font-weight:600;margin-bottom:5px}
  .char{font-size:11.5px;color:var(--muted);margin-bottom:11px;min-height:32px}
  .meta{display:flex;gap:6px;flex-wrap:wrap}
  .pill{font-size:10px;font-weight:700;padding:3px 9px;border-radius:99px}
  .pill.trig{background:#E8A0201f;color:#c97b09}
  .pill.sched{background:#1fa8a81f;color:#178a8a}
  .pill.role-pill{background:#16243a12;color:#16243a}
  .activity{margin-top:36px;background:#fff;border:1px solid var(--linen2);border-radius:18px;padding:20px 22px;box-shadow:0 10px 26px -20px rgba(107,68,38,.5)}
  .activity h2{font-size:20px;margin-bottom:12px}
  .activity ul{list-style:none;display:flex;flex-direction:column;gap:9px}
  .activity li{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--ink);padding-bottom:9px;border-bottom:1px solid var(--linen2)}
  .activity li:last-child{border:0}
  .activity .dot{width:7px;height:7px;border-radius:50%;background:var(--gold);flex:none}
  .activity em{color:#c97b09;font-style:normal;font-weight:700;font-size:11px}
  .activity time{margin-left:auto;color:var(--muted);font-size:11px}
  .activity .muted{color:var(--muted)}
  footer{margin-top:40px;text-align:center;color:var(--muted);font-size:11px}
  .note{margin-top:10px;font-size:11.5px;color:var(--muted);max-width:720px}
</style></head>
<body><div class="wrap">
  <header class="top">
    <div class="kick">Kalkan Info · Multiverse</div>
    <h1>28 Agent <em>Panosu</em></h1>
    <p class="sub">Tüm departmanların yapay zekâ kadrosu — karakter, model, zamanlama ve son üretimler tek ekranda.</p>
    <div class="health"><span class="live"></span>Motor 7/24 aktif — GitHub Actions her 10 dk</div>
    <div class="stats">
      <div class="stat"><b>${agents.length}</b><span>Agent</span></div>
      <div class="stat"><b>${Object.keys(DEPTS).length}</b><span>Departman</span></div>
      <div class="stat"><b>${schedule.filter((s) => s.type === 'agent').length}</b><span>Zamanlı görev</span></div>
      <div class="stat"><b>${agents.filter((a) => a.schedule?.type === 'trigger').length}</b><span>Tetikleyici</span></div>
    </div>
  </header>
  ${cardsByDept}
  <div class="activity">
    <h2>Son üretimler (Supabase)</h2>
    <ul>${activityRows}</ul>
  </div>
  <p class="note">Not: WhatsApp / DM / Ads agent'ları Meta App Review onayından sonra tam aktif olur. Diğer tüm kadro çalışıyor.</p>
  <footer>Kalkan Info Agent Multiverse · otomatik üretildi · ${new Date().toISOString().slice(0, 10)}</footer>
</div></body></html>`;

const out = resolve(ROOT, 'agent-panel.html');
fs.writeFileSync(out, html, 'utf8');
console.log(`✓ Agent panosu → ${out} (${agents.length} agent, ${lastPosts.length} son üretim)`);
