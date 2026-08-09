/**
 * supabase/functions/lyra-live/index.ts
 * KalkanInfo AI — Lyra CANLI-VERİ araçları (Deno Edge Function)
 *
 * ElevenLabs sesli konsiyerj (Lyra) webhook araçları buraya GET atar:
 *   nobetci_eczane    → ?topic=eczane    (bugünün Kaş/Kalkan nöbetçi eczanesi)
 *   bugun_etkinlikler → ?topic=etkinlik  (bugünün etkinlikleri)
 * Araç tanımları: ai/scripts/setup-voice-tools.mjs (Authorization: Bearer <anon> + apikey).
 * Model yanıttaki `eczane.summary` / `etkinlik.summary` alanını doğal cümleye çevirip söyler.
 *
 * Veri kaynağı (service_role GEREKMEZ — hepsi public):
 *   - eczane: önce https://kalkaninfo.com/data/eczane.json (fetch-eczane.mjs günlük 06:00 üretir);
 *             bayatsa (today.date != bugün) → antalyaeo.org.tr canlı scrape (fetch-eczane.mjs deseni).
 *   - etkinlik: https://kalkaninfo.com/data/etkinlik-takvimi.json → bugünün oneoff (tarih) + recurring (gün).
 *
 * İstek : GET ?topic=eczane|etkinlik
 * Yanıt : { ok, topic, eczane?: {...}, etkinlik?: {...} }  (hata: { ok:false, error })
 */

const SITE = 'https://kalkaninfo.com';
const EO_URL = 'https://www.antalyaeo.org.tr/tr/nobetci-eczaneler';

const ALLOWED_ORIGINS = [
  'https://kalkaninfo.com',
  'https://www.kalkaninfo.com',
  'http://localhost:3000',
  'http://localhost:3010',
];
function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Max-Age': '86400',
  };
}

// Europe/Istanbul YYYY-MM-DD
function todayIstanbul(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
}
// Europe/Istanbul Türkçe uzun gün adı (recurring.day ile eşleşir: "Salı","Pazar"…)
function weekdayIstanbulTr(): string {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long' }).format(new Date());
}

// ---------------------------------------------------------------------------
// ECZANE — publish edilmiş JSON önce; bayatsa canlı scrape (fetch-eczane.mjs portu)
// ---------------------------------------------------------------------------
function titleCaseTr(s: string): string {
  return s.toLocaleLowerCase('tr-TR').split(/\s+/)
    .map((w) => (w ? w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1) : w)).join(' ');
}
function formatPhone(raw: string): string {
  if (!raw || raw.length < 10) return '';
  const r = raw.replace(/^0/, '');
  return r.length === 10 ? `+90 ${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6, 8)} ${r.slice(8, 10)}` : raw;
}
type Pharmacy = { name: string; address: string; phone: string; mapUrl: string; isKalkan: boolean };

async function fetchEoHtml(): Promise<string> {
  const res = await fetch(EO_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KalkanInfoBot/1.0)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`EO HTTP ${res.status}`);
  // Sayfa windows-1254 olabilir → content-type charset'e göre decode et.
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const buf = new Uint8Array(await res.arrayBuffer());
  const enc = /1254|iso-8859-9/.test(ct) ? 'windows-1254' : 'utf-8';
  try { return new TextDecoder(enc).decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
}
function extractKasBlock(html: string): string {
  const kasIdx = html.search(/<span>\s*Kaş\s*<\/span>/i);
  if (kasIdx === -1) throw new Error('Kaş bloğu yok');
  const after = html.slice(kasIdx);
  const nextIlce = after.search(/<div class="ilce">/i);
  return nextIlce === -1 ? after : after.slice(0, nextIlce);
}
function parseEczaneList(block: string): Pharmacy[] {
  const items: Pharmacy[] = [];
  const re = /<div class="nesne row nobetciDiv[^>]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const chunk = m[1];
    const nameMatch = chunk.match(/<a[^>]*href="tel:[^"]*"[^>]*>([^<]+)<\/a>/i);
    if (!nameMatch) continue;
    const phoneMatch = chunk.match(/<a[^>]*href="tel:([^"]+)"[^>]*>\s*0\([^)]*\)[^<]*<\/a>/i);
    const addrMatch = chunk.match(/<a[^>]*class="nadres"[^>]*>[\s\S]*?>\s*([^<]+?)\s*<\/a>/i);
    const geoMatch = chunk.match(/maps\.google\.com\/maps\?q=([\d.]+),([\d.]+)/i);
    const phoneRaw = (phoneMatch?.[1] || '').replace(/[^\d]/g, '');
    const address = (addrMatch?.[1] || '').replace(/\s+/g, ' ').trim();
    items.push({
      name: titleCaseTr(nameMatch[1].trim()),
      address,
      phone: formatPhone(phoneRaw),
      mapUrl: geoMatch ? `https://maps.google.com/maps?q=${geoMatch[1]},${geoMatch[2]}` : '',
      isKalkan: /kalkan/i.test(address),
    });
  }
  return items;
}

function eczaneSummary(p: { name: string; address: string; phone: string; isKalkan?: boolean }): string {
  const where = p.isKalkan ? "Kalkan'da" : "Kaş bölgesinde (Kalkan'a en yakın)";
  const tel = p.phone ? `, telefon ${p.phone}` : '';
  const adr = p.address ? `, ${p.address}` : '';
  return `Bugün ${where} nöbetçi eczane: ${p.name}${adr}${tel}.`;
}

async function getEczane() {
  const today = todayIstanbul();
  // 1) Publish edilmiş günlük JSON
  try {
    const res = await fetch(`${SITE}/data/eczane.json`, { headers: { 'cache-control': 'no-cache' } });
    if (res.ok) {
      const d = await res.json();
      if (d?.today?.name && d.today.date === today) {
        const t = d.today;
        return {
          summary: eczaneSummary(t), name: t.name, address: t.address,
          phone: t.phone, mapUrl: t.mapUrl, isKalkan: !!t.isKalkan, date: t.date, source: 'kalkaninfo.com/data/eczane.json',
        };
      }
    }
  } catch (_) { /* aşağıda canlı scrape'e düş */ }

  // 2) Bayat/eksik → antalyaeo.org.tr canlı scrape
  const html = await fetchEoHtml();
  const items = parseEczaneList(extractKasBlock(html));
  if (!items.length) throw new Error('Kaş nöbetçi eczane bulunamadı');
  const pick = items.find((i) => i.isKalkan) || items[0];
  return {
    summary: eczaneSummary(pick), name: pick.name, address: pick.address,
    phone: pick.phone, mapUrl: pick.mapUrl, isKalkan: pick.isKalkan, date: today, source: 'antalyaeo.org.tr (canlı)',
  };
}

// ---------------------------------------------------------------------------
// ETKİNLİK — bugünün oneoff (tarih) + recurring (Türkçe gün adı) etkinlikleri
// ---------------------------------------------------------------------------
type Ev = { time?: string; venueName?: string; title?: string; type?: string; area?: string };

async function getEtkinlik() {
  const today = todayIstanbul();
  const wday = weekdayIstanbulTr().toLocaleLowerCase('tr-TR');
  let cal: { oneoff?: Ev[] & { date?: string }[]; recurring?: (Ev & { day?: string })[] } = {};
  try {
    const res = await fetch(`${SITE}/data/etkinlik-takvimi.json`, { headers: { 'cache-control': 'no-cache' } });
    if (res.ok) cal = await res.json();
  } catch (_) { /* boş takvim gibi davran */ }

  const oneoff = (cal.oneoff || []).filter((e: any) => e.date === today);
  const recurring = (cal.recurring || []).filter((e: any) => (e.day || '').toLocaleLowerCase('tr-TR') === wday);
  const all: Ev[] = [...oneoff, ...recurring]
    .map((e: any) => ({ time: e.time, venueName: e.venueName, title: e.title, type: e.type, area: e.area }))
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  let summary: string;
  if (!all.length) {
    summary = 'Bugün için takvimde planlı özel bir etkinlik görünmüyor. İstersen sana güzel bir restoran ya da plaj önerebilirim.';
  } else {
    const parts = all.map((e) => {
      const t = e.time ? `${e.time} ` : '';
      const v = e.venueName ? ` — ${e.venueName}` : '';
      return `${t}${e.title || e.type || 'etkinlik'}${v}`;
    });
    summary = `Bugün Kalkan'da: ${parts.join('; ')}.`;
  }
  return { summary, count: all.length, events: all };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'GET')
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405, headers });

  const topic = new URL(req.url).searchParams.get('topic') || '';
  try {
    if (topic === 'eczane') {
      const eczane = await getEczane();
      return new Response(JSON.stringify({ ok: true, topic, eczane }), { status: 200, headers });
    }
    if (topic === 'etkinlik') {
      const etkinlik = await getEtkinlik();
      return new Response(JSON.stringify({ ok: true, topic, etkinlik }), { status: 200, headers });
    }
    return new Response(JSON.stringify({ ok: false, error: "topic 'eczane' veya 'etkinlik' olmalı" }), { status: 400, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[lyra-live] error:', topic, msg);
    return new Response(JSON.stringify({ ok: false, topic, error: msg }), { status: 500, headers });
  }
});
