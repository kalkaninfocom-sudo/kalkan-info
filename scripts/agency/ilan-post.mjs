#!/usr/bin/env node
/**
 * scripts/agency/ilan-post.mjs
 * Kalkan Info — İŞ İLANLARI sosyal medya üreticisi (ÇİFT MOD).
 *
 * ig-news-post.mjs ikizi. Akış:
 *   1. Supabase `jobs` (status='active') → aktif ilanları çek
 *   2. ÇİFT MOD:
 *        - ilan VARSA  → haftalık "KALKAN'DA İŞ VAR" DİJEST kartı (en yeni ≤6 ilan)
 *        - ilan YOKSA → "İŞ VAR MI? İLAN VER!" TANITIM kartı (işveren + iş arayan çağrısı)
 *      → board boşken bile içerik üretir (flywheel), ilan girilince otomatik dijeste döner.
 *   3. cheap-llm ile IG caption (kartsız/ücretsiz router)
 *   4. Supabase social_posts → status='pending_approval' (local_assets=[kart])
 *   5. Telegram'a kart + caption + ONAYLA/REDDET butonları (callback pub:<id>:now
 *      → MEVCUT api/telegram-webhook.js işler → onaylanınca IG'ye yayınlar)
 *
 * Kullanım:
 *   node scripts/agency/ilan-post.mjs            # otomatik mod seçimi
 *   node scripts/agency/ilan-post.mjs --dry-run  # kart + caption üret, DB/Telegram atla
 *   node scripts/agency/ilan-post.mjs --promo    # ilan olsa bile tanıtım kartını zorla
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN,
 *      TELEGRAM_ADMIN_CHAT_ID, (+ cheap-llm: GROQ/CEREBRAS/NVIDIA...). Eksik olan adım graceful atlanır.
 */
import puppeteer from 'puppeteer';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cheapLLM } from '../../lib/cheap-llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(ROOT, 'assets', 'ig-ilan');

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

const DRY = process.argv.includes('--dry-run');
const FORCE_PROMO = process.argv.includes('--promo');
const MOCK = process.argv.includes('--mock'); // sadece --dry-run ile dijest layout QA (sahte ilan)

const MOCK_JOBS = [
  { title: 'Deneyimli Garson', employer_name: 'Marina Restaurant', location: 'Kalkan', category: 'restoran', type: 'seasonal' },
  { title: 'Villa Kat Görevlisi', employer_name: 'Patara Prime Villas', location: 'Kalkan', category: 'villa', type: 'full' },
  { title: 'Tekne Kaptanı', employer_name: 'Blue Cruise Kaş', location: 'Kaş', category: 'tur', type: 'seasonal' },
  { title: 'Resepsiyon Görevlisi (EN)', employer_name: 'Patara Beach Hotel', location: 'Patara', category: 'otel', type: 'full' },
  { title: 'Barista', employer_name: 'Owlsan Cafe', location: 'Kalkan', category: 'restoran', type: 'part' },
  { title: 'Havuz & Bahçe Bakımı', employer_name: 'Kalkan Estate', location: 'Kalkan', category: 'hizmet', type: 'full' },
];

const CATEGORIES = {
  restoran: 'Restoran & Cafe', villa: 'Villa & Konaklama', otel: 'Otel & Pansiyon',
  tur: 'Tekne & Tur', hizmet: 'Hizmet & Bakım', ofis: 'Ofis & Yönetim', diger: 'Diğer',
};
const TYPES = { full: 'Tam zamanlı', part: 'Yarı zamanlı', seasonal: 'Sezonluk', freelance: 'Serbest' };

// ── Helpers ──────────────────────────────────────────────────────────────────
const supa = (path, opts = {}) => fetch(`${SUPA_URL}/rest/v1${path}`, {
  ...opts,
  headers: {
    apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json', ...(opts.headers || {}),
  },
});

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const mdEscape = (s) => String(s ?? '').replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');

function todayISO() { return new Date().toISOString().slice(0, 10); }

function approvalKeyboard(postId) {
  return { inline_keyboard: [
    [{ text: '✅ Yayınla Şimdi', callback_data: `pub:${postId}:now` },
     { text: '⏰ Önerilen Saatte', callback_data: `pub:${postId}:scheduled` }],
    [{ text: '✏️ Değiştir', callback_data: `pub:${postId}:edit` },
     { text: '❌ Reddet', callback_data: `pub:${postId}:reject` }],
  ]};
}

// ── Supabase: aktif ilanları çek ─────────────────────────────────────────────
async function fetchActiveJobs() {
  if (!SUPA_URL || !SUPA_KEY) {
    console.log('  ℹ️  Supabase env yok — ilan çekilemedi, TANITIM moduna düşülüyor.');
    return [];
  }
  try {
    const res = await supa('/jobs?status=eq.active&select=title,employer_name,location,category,type,slug,published_at,created_at&order=published_at.desc&limit=6');
    if (!res.ok) { console.warn('  ⚠️  jobs fetch fail:', res.status); return []; }
    return await res.json();
  } catch (e) {
    console.warn('  ⚠️  jobs fetch hatası:', e.message);
    return [];
  }
}

// ── Kart HTML (1080×1350, 4:5) — navy #072136 + gold #e89812 iş panosu estetiği ─
function digestCardHtml(jobs) {
  const rows = jobs.slice(0, 5).map((j) => {
    const cat = CATEGORIES[j.category] || j.category || '';
    const type = TYPES[j.type] || j.type || '';
    const meta = [j.employer_name, j.location].filter(Boolean).join(' · ');
    return `
      <div class="job">
        <div class="job-main">
          <div class="job-cat">${escHtml(cat)}</div>
          <div class="job-title">${escHtml(j.title)}</div>
          <div class="job-meta">📍 ${escHtml(meta)}</div>
        </div>
        <div class="job-type">${escHtml(type)}</div>
      </div>`;
  }).join('');

  const count = jobs.length;
  return baseCard(`
    <div class="hero">
      <div class="kicker">İŞ FIRSATLARI · KALKAN · KAŞ · PATARA</div>
      <div class="title">KALKAN'DA<br>İŞ VAR</div>
      <div class="sub">${count} aktif ilan · bu hafta</div>
    </div>
    <div class="list">${rows}</div>
    <div class="foot">
      <span class="foot-cta">Tümü ve başvuru →</span>
      <span class="foot-url">kalkaninfo.com/ilanlar</span>
    </div>
  `);
}

function promoCardHtml() {
  return baseCard(`
    <div class="hero hero-promo">
      <div class="kicker">KALKAN · KAŞ · PATARA İŞ PANOSU</div>
      <div class="title">İŞ VAR MI?</div>
      <div class="sub">Bölgenin ücretsiz iş ilanı panosu — kalkaninfo.com/ilanlar</div>
    </div>
    <div class="promo-grid">
      <div class="promo-box">
        <div class="promo-ico">🧑‍🍳</div>
        <div class="promo-h">İŞ ARIYORSAN</div>
        <div class="promo-p">Restoran, villa, otel, tekne, ofis — bölgedeki fırsatları takip et, WhatsApp ile tek tıkla başvur.</div>
      </div>
      <div class="promo-box promo-box-gold">
        <div class="promo-ico">🏪</div>
        <div class="promo-h">ELEMAN ARIYORSAN</div>
        <div class="promo-p">İşletmen için <b>ücretsiz</b> ilan ver. Bölge halkı ve mevsimlik çalışanlar görsün.</div>
      </div>
    </div>
    <div class="foot">
      <span class="foot-cta">Ücretsiz ilan ver →</span>
      <span class="foot-url">kalkaninfo.com/ilan-ver</span>
    </div>
  `);
}

function baseCard(inner) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Inter:wght@400;500;600;700&display=swap');
  body { width:1080px; height:1350px; overflow:hidden; font-family:'Inter',sans-serif;
    background:#072136; color:#eaf2fa; }
  .card { position:relative; width:1080px; height:1350px; padding:64px 60px 52px;
    display:flex; flex-direction:column;
    background:
      radial-gradient(1200px 500px at 80% -10%, rgba(232,152,18,0.18), transparent 60%),
      radial-gradient(900px 600px at -10% 110%, rgba(26,94,147,0.35), transparent 60%),
      #072136; }
  .brand { position:absolute; top:34px; left:60px; display:flex; align-items:center; gap:12px;
    font-family:'Montserrat',sans-serif; font-weight:800; font-size:22px; letter-spacing:.06em; color:#fff; }
  .brand .d { color:#e89812; font-size:24px; }
  .hero { margin-top:26px; }
  .kicker { font-family:'Inter',sans-serif; font-weight:700; font-size:20px; letter-spacing:.18em;
    color:#e89812; text-transform:uppercase; }
  .title { font-family:'Montserrat',sans-serif; font-weight:900; font-size:100px; line-height:.98;
    letter-spacing:-.02em; color:#fff; margin-top:14px; }
  .hero-promo .title { font-size:120px; }
  .sub { font-size:26px; color:rgba(234,242,250,.72); margin-top:16px; font-weight:500; }
  /* Dijest liste */
  .list { margin-top:34px; display:flex; flex-direction:column; gap:15px; flex:1; }
  .job { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10);
    border-radius:18px; padding:22px 26px; display:flex; align-items:center; gap:18px; }
  .job-main { min-width:0; flex:1; }
  .job-cat { font-size:15px; font-weight:700; letter-spacing:.10em; text-transform:uppercase; color:#e89812; }
  .job-title { font-family:'Montserrat',sans-serif; font-weight:800; font-size:34px; line-height:1.12;
    color:#fff; margin-top:4px;
    display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; }
  .job-meta { font-size:21px; color:rgba(234,242,250,.66); margin-top:6px; }
  .job-type { flex-shrink:0; font-size:19px; font-weight:700; color:#0a2e4c; background:#e89812;
    padding:9px 16px; border-radius:999px; white-space:nowrap; }
  /* Tanıtım */
  .promo-grid { margin-top:48px; display:flex; gap:24px; flex:1; align-items:stretch; }
  .promo-box { flex:1; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12);
    border-radius:24px; padding:52px 34px; display:flex; flex-direction:column; justify-content:flex-start; }
  .promo-box-gold { background:rgba(232,152,18,.22); border-color:rgba(232,152,18,.55); }
  .promo-ico { font-size:76px; line-height:1; }
  .promo-h { font-family:'Montserrat',sans-serif; font-weight:900; font-size:40px; color:#fff; margin-top:26px;
    letter-spacing:-.01em; min-height:1.9em; display:flex; align-items:flex-end; }
  .promo-p { font-size:25px; line-height:1.5; color:rgba(234,242,250,.82); margin-top:16px; }
  .promo-p b { color:#e89812; }
  /* Alt */
  .foot { margin-top:40px; padding-top:26px; border-top:1px solid rgba(255,255,255,.14);
    display:flex; align-items:center; justify-content:space-between; }
  .foot-cta { font-family:'Montserrat',sans-serif; font-weight:800; font-size:30px; color:#fff; }
  .foot-url { font-size:26px; font-weight:700; color:#e89812; letter-spacing:.01em; }
</style></head><body>
  <div class="card">
    <div class="brand"><span class="d">◆</span>KALKAN INFO</div>
    ${inner}
  </div>
</body></html>`;
}

// ── Kart PNG üret ────────────────────────────────────────────────────────────
async function renderCard(html, id) {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-web-security'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const outPath = join(OUT_DIR, `${id}.png`);
    await page.screenshot({ path: outPath, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1350 } });
    await page.close();
    const st = await stat(outPath);
    return { outPath, publicPath: `/assets/ig-ilan/${id}.png`, kb: Math.round(st.size / 1024) };
  } finally {
    await browser.close();
  }
}

// ── Caption (cheap-llm) ──────────────────────────────────────────────────────
async function generateCaption(mode, jobs) {
  const fallbackDigest = () => {
    const lines = jobs.slice(0, 6).map((j) =>
      `• ${j.title}${j.location ? ' — ' + j.location : ''}`).join('\n');
    return `📢 Kalkan, Kaş ve Patara'da bu haftanın iş ilanları:\n\n${lines}\n\n` +
      `Tüm ilanlar ve WhatsApp ile başvuru: kalkaninfo.com/ilanlar`;
  };
  const fallbackPromo = () =>
    `📢 Kalkan · Kaş · Patara'nın ücretsiz iş panosu yayında!\n\n` +
    `🧑‍🍳 İş arıyorsan: bölgedeki fırsatları takip et, tek tıkla başvur.\n` +
    `🏪 Eleman arıyorsan: işletmen için ücretsiz ilan ver.\n\n` +
    `kalkaninfo.com/ilanlar`;

  const prompt = mode === 'digest'
    ? `Sen Kalkan Info yerel turizm/haber markasının Instagram editörüsün. Aşağıdaki aktif iş ilanlarından bölge halkına hitap eden kısa, samimi ama profesyonel bir Türkçe caption yaz.
Kurallar: en fazla 4 kısa paragraf/600 karakter; ilk satır dikkat çekici (1 emoji olabilir 📢); ilanları tek tek uzun uzun yazma, "bu hafta X aktif ilan var" tonu; son satırda net CTA "kalkaninfo.com/ilanlar"; hashtag EKLEME; sadece caption metnini döndür.
AKTİF İLANLAR:
${jobs.slice(0, 6).map((j) => `- ${j.title} | ${j.employer_name || ''} | ${j.location || ''} | ${TYPES[j.type] || ''}`).join('\n')}`
    : `Sen Kalkan Info yerel turizm/haber markasının Instagram editörüsün. Bölgenin ÜCRETSİZ iş ilanı panosunu tanıtan kısa Türkçe caption yaz. İki kitleye hitap et: (1) iş arayanlar (fırsatları takip et, kolay başvur), (2) işletmeler (ücretsiz ilan ver, bölge halkı görsün).
Kurallar: en fazla 4 kısa paragraf/600 karakter; ilk satır dikkat çekici (1 emoji 📢); net CTA "kalkaninfo.com/ilanlar"; hashtag EKLEME; sadece caption metnini döndür.`;

  try {
    const { text, provider } = await cheapLLM(prompt, { maxTokens: 700 });
    console.log(`  [cheap-llm] caption ✓ ${provider}`);
    // Küçük modeller talimata rağmen hashtag ekleyebiliyor → temizle (hashtag'ları biz ekliyoruz).
    const cleaned = (text || '')
      .replace(/#[\p{L}\p{N}_]+/gu, '')       // inline hashtag token'larını sil
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cleaned || (mode === 'digest' ? fallbackDigest() : fallbackPromo());
  } catch (e) {
    console.warn('  ⚠️  Caption üretim hatası, şablona düşülüyor:', e.message);
    return mode === 'digest' ? fallbackDigest() : fallbackPromo();
  }
}

function buildHashtags(mode) {
  const base = ['#kalkan', '#kaş', '#patara', '#kalkaninfo', '#işilanı'];
  const extra = mode === 'digest' ? ['#işvar', '#kariyer'] : ['#ilanver', '#işarayanlar'];
  return [...new Set([...base, ...extra])].slice(0, 8);
}

// ── Telegram: kart PNG multipart gönder ──────────────────────────────────────
async function sendTelegramCard(cardPath, preview, postId) {
  if (!TG_TOKEN || !TG_CHAT) {
    console.log('  ℹ️  Telegram env yok — onay mesajı atlandı (taslak üretildi).');
    return null;
  }
  try {
    const buf = await readFile(cardPath);
    const form = new FormData();
    form.append('chat_id', String(TG_CHAT));
    form.append('photo', new Blob([buf], { type: 'image/png' }), 'ilan-karti.png');
    form.append('caption', preview.slice(0, 1024));
    form.append('parse_mode', 'MarkdownV2');
    form.append('reply_markup', JSON.stringify(approvalKeyboard(postId)));
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, { method: 'POST', body: form });
    const json = await res.json();
    if (!json.ok) { console.error('  ❌ Telegram sendPhoto fail:', json.description); return null; }
    return json.result?.message_id || null;
  } catch (e) {
    console.error('  ❌ Telegram gönderim hatası:', e.message);
    return null;
  }
}

// ── Supabase storage: kartı yükle → public URL (IG publish local_assets[0]'ı okur) ─
async function uploadCard(cardPath, id) {
  if (!SUPA_URL || !SUPA_KEY) return null;
  try {
    const objectPath = `ilan-card/${id}.png`;
    const buf = await readFile(cardPath);
    const up = await fetch(`${SUPA_URL}/storage/v1/object/social-media/${objectPath}`, {
      method: 'POST',
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'image/png', 'x-upsert': 'true' },
      body: buf,
    });
    if (!up.ok) { console.warn('  ⚠️  storage upload fail:', up.status, (await up.text()).slice(0, 140)); return null; }
    return `${SUPA_URL}/storage/v1/object/public/social-media/${objectPath}`;
  } catch (e) {
    console.warn('  ⚠️  storage upload hatası:', e.message);
    return null;
  }
}

// ── Supabase: social_posts satırı ───────────────────────────────────────────
async function insertSocialPost({ mode, caption, hashtags, publicPath }) {
  if (!SUPA_URL || !SUPA_KEY) {
    console.log('  ℹ️  Supabase env yok — DB kaydı atlandı (yayın kuyruğu prod\'da çalışır).');
    return null;
  }
  // Haftalık dedup: content_pack_id mode + tarih. Aynı gün ikinci çalıştırma guard.
  const packId = `ilan-${mode}-${todayISO()}`;
  const existing = await supa(`/social_posts?content_pack_id=eq.${packId}&select=id&limit=1`);
  if (existing.ok && (await existing.json()).length > 0) {
    console.log(`  ℹ️  social_posts zaten var (${packId}) — atlandı.`);
    return 'EXISTS';
  }
  const row = {
    content_pack_id: packId,
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
  if (!ins.ok) { console.error('  ❌ social_posts insert fail:', ins.status, await ins.text()); return null; }
  const [created] = await ins.json();
  return created?.id || null;
}

// ── Ana akış ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('💼 İş İlanları sosyal üreticisi\n');
  if (MOCK && !DRY) { console.error('❌ --mock sadece --dry-run ile kullanılır (sahte ilan paylaşılamaz).'); process.exit(1); }
  const jobs = MOCK ? MOCK_JOBS : (FORCE_PROMO ? [] : await fetchActiveJobs());
  const mode = jobs.length > 0 ? 'digest' : 'promo';
  console.log(`   Aktif ilan: ${jobs.length} → mod: ${mode.toUpperCase()}${FORCE_PROMO ? ' (--promo zorlandı)' : ''}\n`);

  const id = `ilan-${mode}-${todayISO()}`;
  const html = mode === 'digest' ? digestCardHtml(jobs) : promoCardHtml();

  console.log('🎨 Kart üretiliyor...');
  const card = await renderCard(html, id);
  console.log(`   ✅ ${card.publicPath} (${card.kb} KB)`);

  console.log('✍️  Caption üretiliyor...');
  const body = await generateCaption(mode, jobs);
  const hashtags = buildHashtags(mode);
  const fullCaption = `${body}\n\n${hashtags.join(' ')}`;
  console.log('   ──────\n   ' + fullCaption.split('\n').join('\n   ') + '\n   ──────');

  if (DRY) { console.log('\n🧪 --dry-run: DB/Telegram atlandı. Kart + caption hazır.'); return; }

  console.log('\n☁️  Kart Supabase storage\'a yükleniyor...');
  const storageUrl = await uploadCard(card.outPath, id);
  console.log(storageUrl ? `   ✅ ${storageUrl}` : '   ℹ️  storage atlandı — yerel path kullanılacak');

  console.log('\n🗄️  social_posts kaydı...');
  const postId = await insertSocialPost({ mode, caption: fullCaption, hashtags, publicPath: storageUrl || card.publicPath });
  if (postId === 'EXISTS') { console.log('   Bugün zaten üretilmiş — çıkılıyor.'); return; }
  if (postId) console.log(`   ✅ social_posts id: ${postId}`);

  const callbackId = postId || `test-ilan-${Date.now()}`;
  console.log('📨 Telegram onay mesajı...');
  const preview = mdEscape(
    mode === 'digest'
      ? `💼 İŞ İLANLARI PAYLAŞIMI\n\n${jobs.length} aktif ilan · haftalık dijest\n\nOnaylarsan IG'de yayınlanır.`
      : `💼 İŞ PANOSU TANITIMI\n\nAktif ilan yok → işveren+iş arayan çağrısı kartı.\n\nOnaylarsan IG'de yayınlanır.`
  );
  const msgId = await sendTelegramCard(card.outPath, preview, callbackId);
  if (msgId) console.log(`   ✅ Telegram onay mesajı gönderildi (message_id ${msgId})`);
  console.log('\n✅ Tamam. Telegram\'dan onayla → IG yayın.');
}

main().catch((e) => { console.error('[ilan-post] fatal:', e); process.exit(1); });
