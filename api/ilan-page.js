/**
 * api/ilan-page.js — Server-side rendered job detail
 *
 * URL: GET /ilan/[slug]  (Vercel rewrite → /api/ilan-page?slug=...)
 *
 * Çıktı: tam HTML + JobPosting JSON-LD (Google Jobs için zorunlu)
 * Yan etki: view_count + 1 (per 6h per visitor)
 *
 * 10 yıl operasyonel için tasarım:
 * - Vendor-agnostic: sadece Supabase + standard schema.org
 * - Cache headers: 60s edge + 5min stale-while-revalidate
 * - Graceful 404 ve 410 (süresi dolmuş)
 * - Hreflang ve canonical proper
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

for (const k of Object.keys(process.env)) {
  if (typeof process.env[k] === 'string') process.env[k] = process.env[k].trim();
}

const BASE_URL = 'https://kalkaninfo.com';

const CATEGORIES = {
  restoran: 'Restoran & Cafe', villa: 'Villa & Konaklama', otel: 'Otel & Pansiyon',
  tur: 'Tekne & Tur', hizmet: 'Hizmet & Bakım', ofis: 'Ofis & Yönetim', diger: 'Diğer',
};
const TYPES = {
  full: 'Tam zamanlı', part: 'Yarı zamanlı', seasonal: 'Sezonluk', freelance: 'Serbest',
};
const LANG_LABELS = { tr: 'TR', en: 'EN', de: 'DE', ru: 'RU', ar: 'AR', fr: 'FR' };

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatSalary(min, max, cur) {
  if (!min && !max) return null;
  const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '₺';
  const fmt = n => n.toLocaleString('tr-TR');
  if (min && max && min !== max) return `${sym}${fmt(min)} – ${sym}${fmt(max)}`;
  return `${sym}${fmt(min || max)}`;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

function visitorHash(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || '';
  const salt = process.env.META_APP_SECRET || 'kalkan-info-salt';
  return crypto.createHash('sha256').update(ip + ua + salt).digest('hex').slice(0, 32);
}

function uaHash(req) {
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(ua).digest('hex').slice(0, 16);
}

function buildJobPostingLD(job, fullUrl) {
  const description = job.description?.trim() || stripHtml(job.description_html) || job.title;
  const validThrough = job.expires_at
    ? new Date(job.expires_at).toISOString()
    : new Date(new Date(job.published_at || job.created_at).getTime() + 60 * 86400000).toISOString();

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description,
    datePosted: new Date(job.published_at || job.created_at).toISOString(),
    validThrough,
    employmentType: job.employment_type_iso || 'OTHER',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.employer_name,
      sameAs: 'https://kalkaninfo.com',
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location,
        addressRegion: 'Antalya',
        addressCountry: 'TR',
      },
    },
    url: fullUrl,
    identifier: {
      '@type': 'PropertyValue',
      name: 'Kalkan Info',
      value: job.slug,
    },
    inLanguage: job.content_lang || 'tr',
    directApply: false,
  };

  if (job.salary_min || job.salary_max) {
    ld.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: job.currency || 'TRY',
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.salary_min || job.salary_max,
        maxValue: job.salary_max || job.salary_min,
        unitText: 'MONTH',
      },
    };
  }

  if (job.workplace_type === 'remote') {
    ld.jobLocationType = 'TELECOMMUTE';
    ld.applicantLocationRequirements = {
      '@type': 'Country',
      name: 'Turkey',
    };
  }

  return ld;
}

function renderNotFound(slug, status) {
  const isGone = status === 410;
  const title = isGone ? 'İlanın süresi dolmuş' : 'İlan bulunamadı';
  const msg = isGone
    ? 'Bu ilan kapatıldı veya süresi doldu. Aktif ilanlara göz at.'
    : 'Aradığınız iş ilanı bulunamadı. Aktif tüm ilanları görüntüleyebilirsin.';
  return `<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,follow"/>
<title>${esc(title)} — Kalkan Info</title>
<link rel="canonical" href="${BASE_URL}/ilanlar"/>
<link rel="stylesheet" href="/dist/tw.css"/>
<style>body{font-family:Inter,system-ui,sans-serif;background:#dce6ef;color:#0a2e4c;margin:0;}</style>
</head><body>
<main style="max-width:600px;margin:80px auto;padding:32px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(7,33,54,.08);text-align:center;">
  <div style="font-size:48px;line-height:1;margin-bottom:12px;">${isGone ? '⏳' : '🔍'}</div>
  <h1 style="font-family:Montserrat,sans-serif;font-weight:800;font-size:24px;margin:0 0 12px;">${esc(title)}</h1>
  <p style="color:#5d97c4;margin:0 0 24px;">${esc(msg)}</p>
  <a href="/ilanlar" style="display:inline-block;background:linear-gradient(135deg,#f4b53d,#e89812);color:#072136;font-weight:800;padding:12px 28px;border-radius:10px;text-decoration:none;">Tüm İlanlar</a>
</main>
</body></html>`;
}

function renderJobPage(job) {
  const fullUrl = `${BASE_URL}/ilan/${job.slug}`;
  const cat = CATEGORIES[job.category] || job.category;
  const type = TYPES[job.type] || job.type;
  const salary = formatSalary(job.salary_min, job.salary_max, job.currency);
  const langs = (job.languages || []).map(l => esc(LANG_LABELS[l] || l.toUpperCase())).join(' · ');
  const description = job.description?.trim() || stripHtml(job.description_html);
  const ldJson = JSON.stringify(buildJobPostingLD(job, fullUrl));
  const breadcrumb = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Anasayfa', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'İş İlanları', item: `${BASE_URL}/ilanlar` },
      { '@type': 'ListItem', position: 3, name: job.title, item: fullUrl },
    ],
  });

  const reqsHtml = (job.requirements || []).map(r =>
    `<li class="flex gap-2 items-start"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e89812" stroke-width="3" style="flex-shrink:0;margin-top:4px;"><polyline points="20 6 9 17 4 12"/></svg><span>${esc(r)}</span></li>`
  ).join('');

  return `<!doctype html>
<html lang="${esc(job.content_lang || 'tr')}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(job.title)} — ${esc(job.employer_name)} — Kalkan Info</title>
<meta name="description" content="${esc((description || job.title).slice(0, 160))}"/>
<meta name="robots" content="index, follow, max-image-preview:large"/>
<link rel="canonical" href="${fullUrl}"/>

<meta property="og:type" content="article"/>
<meta property="og:site_name" content="Kalkan Info"/>
<meta property="og:title" content="${esc(job.title)} — ${esc(job.employer_name)}"/>
<meta property="og:description" content="${esc((description || job.title).slice(0, 200))}"/>
<meta property="og:url" content="${fullUrl}"/>
<meta property="og:image" content="${BASE_URL}/assets/og-default.png"/>
<meta name="twitter:card" content="summary_large_image"/>

<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/dist/tw.css"/>
<link rel="icon" type="image/svg+xml" href="/icons/favicon.svg"/>
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png"/>

<script type="application/ld+json">${ldJson}</script>
<script type="application/ld+json">${breadcrumb}</script>

<style>
  html,body{font-family:'Inter',system-ui,sans-serif;color:#0a2e4c;background:#dce6ef;margin:0;}
  h1,h2,h3,.font-display{font-family:'Montserrat',system-ui,sans-serif;letter-spacing:-.02em;}
  .chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;}
  .chip-cat{background:#fff;border:1px solid #cfdfee;color:#134c79;}
  .chip-type{background:rgba(232,152,18,.1);border:1px solid rgba(232,152,18,.3);color:#a06908;}
  .info-card{background:#eef4fa;border-radius:10px;padding:14px 16px;}
  .info-label{font-size:10px;text-transform:uppercase;letter-spacing:.04em;font-weight:700;color:#5d97c4;margin-bottom:4px;}
  .info-value{font-size:15px;font-weight:700;color:#0a2e4c;}
  .apply-btn{display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;font-weight:800;padding:14px 28px;border-radius:12px;text-decoration:none;transition:background .18s;}
  .apply-btn:hover{background:#1da851;}
  .back-link{color:#1a5e93;font-weight:600;text-decoration:none;}
  .back-link:hover{text-decoration:underline;}
</style>
</head>
<body>

<header style="background:#072136;padding:14px 16px;">
  <div style="max-width:880px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;">
    <a href="/" style="color:#fff;font-weight:800;text-decoration:none;font-family:Montserrat,sans-serif;"><span style="color:#e89812;">◆</span> KALKAN INFO</a>
    <a href="/ilanlar" class="back-link" style="color:#9cc0dd;font-size:13px;">← Tüm İlanlar</a>
  </div>
</header>

<main style="max-width:880px;margin:32px auto;padding:0 16px;">
  <article style="background:#fff;border-radius:18px;box-shadow:0 4px 24px rgba(7,33,54,.08);overflow:hidden;">
    <div style="padding:32px 36px 24px;background:linear-gradient(180deg,#eef4fa 0%,#fff 100%);border-bottom:1px solid #e5edf5;">
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
        <span class="chip chip-cat">${esc(cat)}</span>
        <span class="chip chip-type">${esc(type)}</span>
        ${job.workplace_type === 'remote' ? '<span class="chip" style="background:#dcfce7;color:#15803d;border:1px solid #86efac;">Uzaktan</span>' : ''}
      </div>
      <h1 style="font-size:30px;font-weight:800;line-height:1.15;margin:0 0 8px;color:#0a2e4c;">${esc(job.title)}</h1>
      <div style="display:flex;align-items:center;gap:8px;color:#1a5e93;font-weight:600;font-size:15px;">
        <span>${esc(job.employer_name)}</span>
        <span style="color:#9cc0dd;">·</span>
        <span>📍 ${esc(job.location)}</span>
      </div>
    </div>

    <div style="padding:24px 36px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
      ${salary ? `<div class="info-card"><div class="info-label">Maaş Aralığı</div><div class="info-value" style="color:#e89812;">${esc(salary)}</div></div>` : ''}
      ${job.experience ? `<div class="info-card"><div class="info-label">Deneyim</div><div class="info-value">${esc(job.experience)}</div></div>` : ''}
      ${langs ? `<div class="info-card"><div class="info-label">Diller</div><div class="info-value">${langs}</div></div>` : ''}
      <div class="info-card"><div class="info-label">Yayın Tarihi</div><div class="info-value">${esc(formatDate(job.published_at || job.created_at))}</div></div>
      ${job.expires_at ? `<div class="info-card"><div class="info-label">Son Başvuru</div><div class="info-value">${esc(formatDate(job.expires_at))}</div></div>` : ''}
    </div>

    ${description ? `<section style="padding:8px 36px 4px;">
      <h2 style="font-size:18px;font-weight:700;margin:16px 0 12px;">İş Tanımı</h2>
      <div style="white-space:pre-wrap;line-height:1.7;color:#2f547a;font-size:15px;">${esc(description)}</div>
    </section>` : ''}

    ${reqsHtml ? `<section style="padding:8px 36px 24px;">
      <h2 style="font-size:18px;font-weight:700;margin:24px 0 12px;">Aranan Nitelikler</h2>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;color:#2f547a;font-size:15px;">${reqsHtml}</ul>
    </section>` : ''}

    <footer style="padding:24px 36px;background:#eef4fa;border-top:1px solid #cfdfee;text-align:center;">
      <a href="/ilanlar?ilan=${esc(job.slug)}" class="apply-btn" id="apply-cta">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
        <span>Başvur</span>
      </a>
      <p style="font-size:12px;color:#5d97c4;margin:14px 0 0;">Başvurun işverene direkt iletilir. Kalkan Info aracı olmaz.</p>
    </footer>
  </article>

  <div style="margin-top:24px;display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
    <a href="/ilanlar" class="back-link">← Tüm İlanlar</a>
    <span style="color:#9cc0dd;">·</span>
    <a href="/ilan-ver" class="back-link">İlan Ver</a>
    <span style="color:#9cc0dd;">·</span>
    <a href="/kvkk" class="back-link">KVKK</a>
  </div>
</main>

<footer style="background:#072136;color:rgba(255,255,255,.6);padding:24px 16px;text-align:center;font-size:12px;margin-top:48px;">
  © 2026 Kalkan Info · Kalkan · Kaş · Patara
</footer>

</body>
</html>`;
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || '').trim().toLowerCase().slice(0, 100);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.status(404).send(renderNotFound(slug, 404));
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.status(503).send(renderNotFound(slug, 404));
    return;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;

    if (!job) {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.status(404).send(renderNotFound(slug, 404));
      return;
    }

    if (job.status !== 'active' || (job.expires_at && new Date(job.expires_at) < new Date())) {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.status(410).send(renderNotFound(slug, 410));
      return;
    }

    // View tracking — fire and forget
    try {
      const vh = visitorHash(req);
      const uh = uaHash(req);
      const referer = (req.headers.referer || '').slice(0, 200) || null;
      await supabase.rpc('bump_job_view', {
        p_job_id: job.id,
        p_visitor_hash: vh,
        p_referer: referer,
        p_ua_hash: uh,
      });
    } catch (e) {
      console.warn('[ilan-page] view bump failed:', e.message);
    }

    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.status(200).send(renderJobPage(job));
  } catch (err) {
    console.error('[ilan-page] error:', err.message);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.status(500).send(renderNotFound(slug, 500));
  }
}
