/**
 * build-reels-landing.mjs
 *
 * Generates one static landing page per IG Reels under /p/{slug}.html.
 * Each page is mobile-first, fast-loading, UTM-aware (utm-tracker.js),
 * fires a `reels_landing_view` Plausible event with { slug, campaign }
 * and shows 3 primary CTAs:
 *   1) "Tam Antik Kent Sayfası" — deep link to /antik-kentler/{antik_slug}.html
 *   2) "Concierge'le Planla"   — WhatsApp share intent
 *   3) "Tatil Planlayıcı"      — /tatil-asistani.html?via=reels&slug={slug}
 *
 * Data source: content/reels.json
 *
 * Run: node scripts/build-reels-landing.mjs
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA = resolve(ROOT, 'content/reels.json');
const OUT_DIR = resolve(ROOT, 'p');

const WHATSAPP_NUMBER = "905306650794"; // placeholder; replace with real Kalkan Info concierge number
const SITE = 'https://kalkaninfo.com';

function escapeHtml(s = '') {
  return String(s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
}
function escapeAttr(s = '') {
  return String(s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
}

function buildJsonLd(reel) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: reel.title,
    description: reel.summary,
    image: `${SITE}${reel.hero_image}`,
    url: `${SITE}/p/${reel.slug}.html`,
    isPartOf: { '@type': 'WebSite', name: 'Kalkan Info', url: SITE },
    inLanguage: 'tr-TR',
    datePublished: reel.published
  };
}

function buildBreadcrumb(reel) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Anasayfa', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Reels', item: `${SITE}/p/` },
      { '@type': 'ListItem', position: 3, name: reel.title, item: `${SITE}/p/${reel.slug}.html` }
    ]
  };
}

function buildWhatsAppHref(reel) {
  const message = encodeURIComponent(
    `Selam Kalkan Info! Instagram'da "${reel.title}" reels'inden geldim. ${reel.antik_slug ? reel.antik_slug.toUpperCase() + ' antik kentini ziyaret etmek' : 'Kalkan tatilimi planlamak'} istiyorum. Bana bir günlük plan önerebilir misiniz?`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
}

function buildTatilHref(reel) {
  const params = new URLSearchParams({
    via: 'reels',
    slug: reel.slug,
    utm_source: 'ig',
    utm_medium: 'reel',
    utm_campaign: reel.slug
  });
  return `/tatil-asistani.html?${params.toString()}`;
}

function pageHtml(reel) {
  const title = `${reel.title} | Kalkan Info`;
  const metaDesc = reel.summary.slice(0, 158);
  const canonical = `${SITE}/p/${reel.slug}.html`;
  // Prefer per-reel OG image (generate-og-reels.mjs output) if present, else fall back to reel.hero_image.
  const ogImage = `${SITE}/assets/og/reels-${reel.slug}.png`;
  const heroBg = reel.hero_image_local || reel.hero_image;
  const jsonLd = JSON.stringify(buildJsonLd(reel));
  const breadcrumb = JSON.stringify(buildBreadcrumb(reel));
  const ctaWA = buildWhatsAppHref(reel);
  const ctaTatil = buildTatilHref(reel);
  const hasAntik = !!reel.antik_slug;
  const primaryHref = reel.cta_primary.href;

  return `<!doctype html>
<html lang="tr" style="scroll-behavior:smooth;">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttr(metaDesc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index,follow">
<meta name="keywords" content="${escapeAttr(reel.title)}, kalkan, reels, instagram, antik kent, tatil, ${escapeAttr(reel.antik_slug || '')}">

<link rel="manifest" href="../manifest.json">
<meta name="theme-color" content="#0a2e4c">
<link rel="icon" type="image/svg+xml" href="../icons/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="../icons/favicon-32.png">
<link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">

<!-- OG / Twitter -->
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeAttr(title)}">
<meta property="og:description" content="${escapeAttr(metaDesc)}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Kalkan Info">
<meta property="og:locale" content="tr_TR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(title)}">
<meta name="twitter:description" content="${escapeAttr(metaDesc)}">
<meta name="twitter:image" content="${ogImage}">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

<!-- Plausible analytics (event-aware) -->
<script defer data-domain="kalkaninfo.com" src="https://plausible.io/js/script.tagged-events.js"></script>

<!-- UTM tracker (captures ig/reel/{slug} params) -->
<script src="../js/utm-tracker.js" defer></script>

<style>
  *,*::before,*::after{box-sizing:border-box;}
  html,body{margin:0;padding:0;background:#072136;color:#0a2e4c;font-family:'Inter',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;}
  body{min-height:100vh;min-height:100dvh;}
  h1,h2,h3,.font-display{font-family:'Montserrat',system-ui,sans-serif;letter-spacing:-0.025em;font-weight:800;}
  a{color:inherit;}
  .container{max-width:560px;margin:0 auto;padding:0 18px;}

  /* Top nav minimal */
  .top-nav{position:sticky;top:0;z-index:30;background:rgba(7,33,54,0.92);backdrop-filter:blur(10px);border-bottom:1px solid rgba(255,255,255,0.06);}
  .top-nav-inner{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;color:#fff;}
  .top-nav a.brand{font-family:'Montserrat',sans-serif;font-weight:800;font-size:14px;display:flex;align-items:center;gap:6px;text-decoration:none;color:#fff;letter-spacing:-0.01em;}
  .top-nav a.brand .dot{color:#f4b53d;}
  .top-nav a.menu{font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.7);text-decoration:none;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.06);}
  .top-nav a.menu:hover{background:rgba(255,255,255,0.12);color:#f4b53d;}

  /* Hero */
  .hero{position:relative;min-height:64vh;display:flex;align-items:flex-end;overflow:hidden;}
  .hero-img{position:absolute;inset:0;background-size:cover;background-position:center;filter:saturate(1.15) contrast(1.04);}
  .hero-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,33,54,0.20) 0%,rgba(7,33,54,0.30) 35%,rgba(7,33,54,0.85) 80%,#072136 100%);}
  .hero-inner{position:relative;z-index:2;width:100%;padding:32px 18px 28px;color:#fff;}
  .reel-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(244,181,61,0.18);color:#f4b53d;border:1px solid rgba(244,181,61,0.4);padding:5px 11px;border-radius:999px;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;font-weight:700;}
  .reel-badge .pulse{width:6px;height:6px;border-radius:50%;background:#f4b53d;animation:pulse 1.6s infinite;}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(1.4);}}
  .hero h1{font-size:30px;line-height:1.08;margin:14px 0 8px;text-shadow:0 4px 24px rgba(0,0,0,0.45);}
  @media(min-width:480px){.hero h1{font-size:36px;}}
  .hero p.sub{color:rgba(255,255,255,0.82);font-size:14px;line-height:1.55;margin:0;}

  /* Content card */
  .content{background:#fff;border-radius:24px 24px 0 0;margin-top:-22px;position:relative;z-index:3;padding:26px 18px 32px;}
  .content h2{color:#072136;font-size:20px;margin:0 0 12px;letter-spacing:-0.02em;}
  .content p.long{color:#33526b;font-size:15px;line-height:1.65;margin:0 0 22px;}
  .summary-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;}
  .chip{background:rgba(244,181,61,0.12);color:#a86600;border:1px solid rgba(244,181,61,0.3);padding:5px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;}

  /* CTAs */
  .cta-stack{display:flex;flex-direction:column;gap:10px;margin-top:8px;}
  .cta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-radius:14px;font-family:'Montserrat',sans-serif;font-weight:800;font-size:14px;text-decoration:none;letter-spacing:-0.005em;transition:transform .15s ease,box-shadow .15s ease;}
  .cta:active{transform:scale(0.985);}
  .cta-primary{background:#e89812;color:#072136;box-shadow:0 6px 16px -6px rgba(232,152,18,0.55);}
  .cta-primary:hover{background:#f4b53d;}
  .cta-wa{background:#25D366;color:#fff;box-shadow:0 6px 16px -6px rgba(37,211,102,0.5);}
  .cta-wa:hover{background:#1eb455;}
  .cta-tatil{background:#0a2e4c;color:#fff;box-shadow:0 6px 16px -6px rgba(10,46,76,0.5);}
  .cta-tatil:hover{background:#0c3858;}
  .cta .arrow{font-size:18px;opacity:0.85;}

  /* Secondary section */
  .secondary{padding:24px 18px 32px;background:#f6fafd;border-top:1px solid #e3edf6;}
  .secondary h3{color:#072136;font-size:14px;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 14px;}
  .more-list{display:grid;gap:10px;}
  .more-link{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff;border:1px solid #e3edf6;border-radius:12px;text-decoration:none;color:#0a2e4c;font-weight:600;font-size:13px;}
  .more-link:hover{border-color:#f4b53d;color:#a86600;}
  .more-link .emoji{font-size:18px;width:32px;height:32px;display:grid;place-items:center;background:rgba(244,181,61,0.12);border-radius:8px;}

  /* Footer */
  footer.mini{background:#072136;color:rgba(255,255,255,0.55);text-align:center;padding:20px 18px 90px;font-size:11px;line-height:1.6;}
  footer.mini a{color:#f4b53d;text-decoration:none;}

  /* IG mini thumb (bottom-right, fixed) */
  .reel-mini{position:fixed;bottom:14px;right:14px;z-index:50;width:54px;height:54px;border-radius:14px;overflow:hidden;border:2px solid #f4b53d;box-shadow:0 8px 24px rgba(0,0,0,0.35),0 0 0 4px rgba(244,181,61,0.18);background:#072136;display:grid;place-items:center;text-decoration:none;transition:transform .2s ease;}
  .reel-mini:hover{transform:scale(1.06);}
  .reel-mini img{width:100%;height:100%;object-fit:cover;display:block;}
  .reel-mini .play{position:absolute;width:18px;height:18px;background:rgba(7,33,54,0.65);border-radius:50%;display:grid;place-items:center;}
  .reel-mini .play::before{content:'';border-left:6px solid #f4b53d;border-top:4px solid transparent;border-bottom:4px solid transparent;margin-left:2px;}
</style>

<script type="application/ld+json">${breadcrumb}</script>
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>

<nav class="top-nav" aria-label="Top">
  <div class="top-nav-inner">
    <a href="../index.html" class="brand"><span class="dot">◆</span> KALKAN INFO</a>
    <a href="../index.html" class="menu">Anasayfa</a>
  </div>
</nav>

<header class="hero">
  <div class="hero-img" style="background-image:url('..${heroBg}');" role="img" aria-label="${escapeAttr(reel.title)}"></div>
  <div class="hero-overlay"></div>
  <div class="hero-inner">
    <span class="reel-badge"><span class="pulse"></span> Instagram Reels</span>
    <h1>${escapeHtml(reel.title)}</h1>
    <p class="sub">${escapeHtml(reel.subtitle)}</p>
  </div>
</header>

<main class="content">
  <div class="summary-row">
    <span class="chip">Yerel Rehber</span>
    <span class="chip">5 Dilde</span>
    ${hasAntik ? '<span class="chip">UNESCO Bilgi</span>' : '<span class="chip">AI Concierge</span>'}
  </div>

  <h2>${escapeHtml(reel.summary)}</h2>
  <p class="long">${escapeHtml(reel.long)}</p>

  <div class="cta-stack">
    <a class="cta cta-primary plausible-event-name=reels_cta_primary" data-reels-cta="primary" href="${escapeAttr(primaryHref)}">
      <span>${escapeHtml(reel.cta_primary.label)}</span>
      <span class="arrow">→</span>
    </a>
    <a class="cta cta-wa plausible-event-name=reels_cta_whatsapp" data-reels-cta="whatsapp" href="${escapeAttr(ctaWA)}" target="_blank" rel="noopener">
      <span>Concierge'le Planla (WhatsApp)</span>
      <span class="arrow">→</span>
    </a>
    <a class="cta cta-tatil plausible-event-name=reels_cta_tatil" data-reels-cta="tatil" href="${escapeAttr(ctaTatil)}">
      <span>Tatil Planlayıcıyı Aç</span>
      <span class="arrow">→</span>
    </a>
  </div>
</main>

<section class="secondary">
  <h3>Devam Et</h3>
  <div class="more-list">
    ${hasAntik ? `<a class="more-link" href="${escapeAttr(primaryHref)}"><span class="emoji">🏛️</span> Tam ${escapeHtml(reel.antik_slug)} antik kent rehberi</a>` : ''}
    <a class="more-link" href="../antik-kentler.html"><span class="emoji">🗺️</span> Tüm antik kentler haritası</a>
    <a class="more-link" href="../plajlar.html"><span class="emoji">🏖️</span> Kalkan plajları</a>
    <a class="more-link" href="../restoranlar.html"><span class="emoji">🍽️</span> Restoran &amp; bar rehberi</a>
    <a class="more-link" href="../tatil-asistani.html?via=reels&amp;slug=${escapeAttr(reel.slug)}"><span class="emoji">🤖</span> AI Tatil Planlayıcı</a>
  </div>
</section>

<footer class="mini">
  Kalkan Info — ${escapeHtml(reel.title)}<br>
  <a href="../index.html">kalkaninfo.com</a> &nbsp;·&nbsp;
  <a href="https://www.instagram.com/kalkan.info/" target="_blank" rel="noopener">@kalkan.info</a>
</footer>

<a class="reel-mini" href="${escapeAttr(reel.ig_url)}" target="_blank" rel="noopener" aria-label="Reels'i Instagram'da izle">
  <img src="..${escapeAttr(reel.reel_thumb)}" alt="">
  <span class="play"></span>
</a>

<script>
(function(){
  // Reels-specific Plausible event with { slug, campaign }
  function fire(){
    try{
      var params = new URLSearchParams(window.location.search);
      var campaign = params.get('utm_campaign') || ${JSON.stringify(reel.slug)};
      if (window.plausible) {
        window.plausible('reels_landing_view', { props: { slug: ${JSON.stringify(reel.slug)}, campaign: campaign } });
      } else {
        // Plausible may load async; retry once.
        setTimeout(function(){
          if (window.plausible) {
            window.plausible('reels_landing_view', { props: { slug: ${JSON.stringify(reel.slug)}, campaign: campaign } });
          }
        }, 1200);
      }
    }catch(e){}
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') fire();
  else document.addEventListener('DOMContentLoaded', fire);
})();
</script>

</body>
</html>
`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const raw = await readFile(DATA, 'utf8');
  const data = JSON.parse(raw);
  const built = [];
  for (const reel of data.reels) {
    const html = pageHtml(reel);
    const out = join(OUT_DIR, `${reel.slug}.html`);
    await writeFile(out, html, 'utf8');
    built.push(out);
    console.log(`OK: ${out}`);
  }
  console.log(`\nDone — ${built.length} landing pages written to ${OUT_DIR}`);
}

main().catch(err => { console.error(err); process.exit(1); });
