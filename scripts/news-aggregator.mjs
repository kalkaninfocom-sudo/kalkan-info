#!/usr/bin/env node
// RSS aggregator: Antalya Körfez + Kalkan Times + AA (filtered) → data/haberler.json
// Run: node scripts/news-aggregator.mjs

import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Trim all env vars (same pattern as api/welcome-email.js)
for (const k of Object.keys(process.env)) {
  if (typeof process.env[k] === 'string') process.env[k] = process.env[k].trim();
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'data', 'haberler.json');

const SOURCES = [
  {
    name: 'Antalya Körfez',
    url: 'https://www.antalyakorfez.com/rss',
    sourceHome: 'https://www.antalyakorfez.com',
    requireKeyword: false, // already Antalya-focused
  },
  {
    name: 'Kalkan Times',
    url: 'https://www.kalkantimes.com/rss.xml',
    sourceHome: 'https://www.kalkantimes.com',
    requireKeyword: false, // Kalkan-specific
  },
  {
    name: 'Anadolu Ajansı',
    url: 'https://www.aa.com.tr/tr/rss/default?cat=guncel',
    sourceHome: 'https://www.aa.com.tr',
    requireKeyword: true, // national feed, filter to region
  },
  {
    name: 'Antalya Haber Takip',
    url: 'https://www.antalyahabertakip.com/rss.xml',
    sourceHome: 'https://www.antalyahabertakip.com',
    requireKeyword: false, // Antalya-bölgesel
  },
  {
    name: "Antalya'dan Haberler",
    url: 'https://www.antalyadanhaberler.com/rss.xml',
    sourceHome: 'https://www.antalyadanhaberler.com',
    requireKeyword: false, // Antalya-bölgesel
  },
  {
    name: 'Antalya Haber (antalyahakkinda)',
    url: 'https://www.antalyahakkinda.com/rss',
    sourceHome: 'https://www.antalyahakkinda.com',
    requireKeyword: true, // karışık içerik, bölge filtresi gerekli
  },
  {
    name: 'AntalyaBugün',
    url: 'https://antalyabugun.com.tr/rss.xml',
    sourceHome: 'https://antalyabugun.com.tr',
    requireKeyword: true, // karışık içerik, bölge filtresi gerekli
  },
];

// Region keyword filter (case-insensitive)
const REGION_RX = /\b(kalkan|kaş|kas|patara|saklıkent|saklikent|likya|demre|fethiye|antalya|kaputaş|kaputas|kalkan times)\b/i;

// Category inference from title/description
function inferCategory(text) {
  const t = text.toLowerCase();
  if (/(plaj|deniz|mavi bayrak|kıyı)/i.test(t)) return 'Plaj';
  if (/(restoran|şef|mutfak|menü|cafe|kahve)/i.test(t)) return 'Restoran';
  if (/(belediye|başkan|altyapı|su kesintisi|elektrik|yol)/i.test(t)) return 'Belediye';
  if (/(antik|kazı|likya|patara|saklıkent|tarihi|müze|yazıt)/i.test(t)) return 'Kültür';
  if (/(yağmur|hava|fırtına|sıcaklık|kar|meteoroloji)/i.test(t)) return 'Hava';
  if (/(festival|konser|açılış|etkinlik|gala|tören|yarış)/i.test(t)) return 'Etkinlik';
  if (/(kaza|yangın|olay|asayiş|tutuklan|gözaltı)/i.test(t)) return 'Asayiş';
  if (/(tatil|turist|sezon|otel|villa|booking)/i.test(t)) return 'Turizm';
  return 'Gündem';
}

// Fallback image per category (Unsplash topical)
const FALLBACK_IMAGES = {
  Plaj: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  Restoran: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80',
  Belediye: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1200&q=80',
  Kültür: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
  Hava: 'https://images.unsplash.com/photo-1501691223387-dd0500403074?auto=format&fit=crop&w=1200&q=80',
  Etkinlik: 'https://images.unsplash.com/photo-1534531409860-9c8e2fe40b97?auto=format&fit=crop&w=1200&q=80',
  Asayiş: 'https://images.unsplash.com/photo-1453873531674-2151bcd01707?auto=format&fit=crop&w=1200&q=80',
  Turizm: 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?auto=format&fit=crop&w=1200&q=80',
  Gündem: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80',
};

// Minimal XML extraction: unwrap CDATA, decode entities, strip tags
function stripCdata(s) {
  if (!s) return '';
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}
function decode(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function stripTags(s) {
  return decode(stripCdata(s)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function pickTag(xml, tag) {
  const rx = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(rx);
  return m ? stripCdata(m[1]).trim() : '';
}
function pickAttr(xml, tag, attr) {
  const rx = new RegExp(`<${tag}[^>]*\\b${attr}\\s*=\\s*"([^"]+)"`, 'i');
  const m = xml.match(rx);
  return m ? m[1] : '';
}

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseDate(s) {
  if (!s) return new Date().toISOString().slice(0, 10);
  const d = new Date(s);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function extractImage(itemXml, contentHtml) {
  // 1) <enclosure url="..." type="image/...">
  const enc = pickAttr(itemXml, 'enclosure', 'url');
  if (enc && /\.(jpe?g|png|webp|gif)/i.test(enc)) return enc;
  // 2) <media:content url="..."> / <media:thumbnail url="...">
  const mc = pickAttr(itemXml, 'media:content', 'url') || pickAttr(itemXml, 'media:thumbnail', 'url');
  if (mc) return mc;
  // 3) <image> inside item
  const img = pickTag(itemXml, 'image');
  if (img && /^https?:/.test(img.trim())) return img.trim();
  // 4) first <img src> in content
  if (contentHtml) {
    const m = contentHtml.match(/<img[^>]+src\s*=\s*"([^"]+)"/i);
    if (m) return m[1];
  }
  return '';
}

function parseRss(xml, source) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const raw of blocks) {
    const title = stripTags(pickTag(raw, 'title'));
    if (!title) continue;
    const link = stripTags(pickTag(raw, 'link'));
    const pubDate = stripTags(pickTag(raw, 'pubDate')) || stripTags(pickTag(raw, 'dc:date'));
    const descHtml = pickTag(raw, 'description');
    const contentEncoded = pickTag(raw, 'content:encoded');
    const summary = stripTags(descHtml).slice(0, 280);
    const content = stripTags(contentEncoded || descHtml).slice(0, 800);
    const image = extractImage(raw, decode(stripCdata(contentEncoded || descHtml)));
    items.push({
      _source: source.name,
      _sourceHome: source.sourceHome,
      title,
      link,
      pubDate,
      summary,
      content,
      image,
      _matchText: `${title} ${summary}`,
    });
  }
  return items;
}

// Returns { items, failed } — never throws
async function fetchSource(src) {
  try {
    const res = await fetch(src.url, {
      headers: {
        'User-Agent': 'KalkanInfoBot/1.0 (+https://kalkaninfo.com)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      // 12s timeout via AbortController
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.error(`[${src.name}] HTTP ${res.status}`);
      return { items: [], failed: true, reason: `HTTP ${res.status}` };
    }
    const xml = await res.text();
    const items = parseRss(xml, src);
    console.log(`[${src.name}] parsed ${items.length} items`);
    return { items, failed: false };
  } catch (err) {
    console.error(`[${src.name}] fetch error:`, err.message);
    return { items: [], failed: true, reason: err.message };
  }
}

function normalize(item) {
  const category = inferCategory(item._matchText);
  const image = item.image || FALLBACK_IMAGES[category];
  const date = parseDate(item.pubDate);
  const id = `${slugify(item.title)}-${date}`.slice(0, 100);
  const tags = [];
  if (/kalkan/i.test(item._matchText)) tags.push('Kalkan');
  if (/(kaş|kas)\b/i.test(item._matchText)) tags.push('Kaş');
  if (/patara/i.test(item._matchText)) tags.push('Patara');
  if (/likya/i.test(item._matchText)) tags.push('Likya');
  if (/antalya/i.test(item._matchText) && !tags.length) tags.push('Antalya');
  return {
    id,
    title: item.title,
    category,
    date,
    image,
    summary: item.summary || item.title,
    content: item.content || item.summary || item.title,
    tags: tags.slice(0, 5),
    source: item._source,
    sourceUrl: item.link,
    featured: false,
  };
}

async function sendAlertEmail({ failedSources, successCount, latestDate, allFailed, staleData }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[alert] RESEND_API_KEY missing, skipping');
    return;
  }

  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || 'unknown';
  const failedList = failedSources.map(s => `  - ${s.name}: ${s.reason}`).join('\n');

  let alertReason = '';
  if (allFailed) {
    alertReason = 'ALL sources failed — haberler.json was NOT updated.';
  } else if (staleData) {
    alertReason = `Latest article date is ${latestDate} (older than 7 days).`;
  }

  const bodyText = [
    `[Kalkan Info] News Aggregator Alert`,
    ``,
    `Reason: ${alertReason}`,
    ``,
    `Sources succeeded: ${successCount} / ${SOURCES.length}`,
    `Failed sources:`,
    failedList || '  (none)',
    ``,
    `Latest article date: ${latestDate || 'N/A'}`,
    `Build commit: ${commitSha}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Kalkan Info <noreply@kalkaninfo.com>',
        to: ['kalkaninfo.com@gmail.com'],
        subject: '[Kalkan Info] News aggregator alert',
        text: bodyText,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[alert] Resend API error:', response.status, errBody);
    } else {
      const result = await response.json();
      console.log('[alert] Alert email sent, id:', result.id);
    }
  } catch (err) {
    console.error('[alert] Failed to send alert email:', err.message);
  }
}

async function main() {
  const results = await Promise.all(SOURCES.map(fetchSource));

  // Build summary metrics
  const failedSources = SOURCES
    .map((src, i) => results[i].failed ? { name: src.name, reason: results[i].reason } : null)
    .filter(Boolean);
  const successCount = SOURCES.length - failedSources.length;
  const allFailed = successCount === 0;

  const all = results.flatMap(r => r.items);

  const filtered = all.filter(it => {
    const src = SOURCES.find(s => s.name === it._source);
    if (!src) return false;
    if (!src.requireKeyword) return true;
    return REGION_RX.test(it._matchText);
  });

  // Dedup by normalized title
  const seen = new Set();
  const unique = [];
  for (const it of filtered) {
    const key = it.title.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 100);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(it);
  }

  // Sort by date desc, take 30
  unique.sort((a, b) => (new Date(b.pubDate || 0)) - (new Date(a.pubDate || 0)));
  const top = unique.slice(0, 30).map(normalize);

  // Mark top 4 most recent as featured
  top.slice(0, 4).forEach(it => (it.featured = true));

  // Collect categories
  const cats = Array.from(new Set(top.map(it => it.category)));

  // Determine latest article date
  const latestDate = top.length > 0 ? top[0].date : null;
  const staleData = latestDate
    ? (Date.now() - new Date(latestDate).getTime()) > 7 * 24 * 60 * 60 * 1000
    : false;

  // --- Result summary (always printed for Vercel logs) ---
  console.log('\n[news-aggregator] === BUILD SUMMARY ===');
  console.log(`  Sources OK   : ${successCount} / ${SOURCES.length}`);
  console.log(`  Sources FAIL : ${failedSources.length}${failedSources.length ? ' (' + failedSources.map(s => s.name).join(', ') + ')' : ''}`);
  console.log(`  Items written: ${top.length}`);
  console.log(`  Latest date  : ${latestDate || 'N/A'}`);
  console.log(`  Stale (>7d)  : ${staleData}`);
  if (failedSources.length) {
    for (const f of failedSources) {
      console.log(`  [FAIL] ${f.name}: ${f.reason}`);
    }
  }
  console.log('[news-aggregator] ========================\n');

  // Only write file if we got some items
  if (top.length > 0) {
    const out = {
      _meta: {
        title: 'Haberler',
        subtitle: 'Kalkan ve Antalya bölgesinden güncel haberler — canlı RSS akışı',
        updated: new Date().toISOString(),
        sources: SOURCES.map(s => ({ name: s.name, home: s.sourceHome })),
        generated_by: 'scripts/news-aggregator.mjs',
      },
      categories: cats.length ? cats : ['Gündem'],
      items: top,
    };

    await writeFile(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log(`[news-aggregator] Wrote ${top.length} items to ${OUT}`);
  } else {
    console.error('[news-aggregator] No items aggregated — keeping previous haberler.json.');
  }

  // Send alert if all sources failed OR data is stale
  if (allFailed || staleData) {
    await sendAlertEmail({ failedSources, successCount, latestDate, allFailed, staleData });
  }

  // Always exit 0 — build must not be blocked
  process.exit(0);
}

main().catch(err => {
  console.error('[news-aggregator] Fatal:', err);
  // Still exit 0 to avoid breaking the build
  process.exit(0);
});
