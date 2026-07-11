#!/usr/bin/env node
/**
 * scripts/agency/build-venue-site.mjs — TEKRARLANABİLİR grounded işletme sitesi üreticisi
 *
 * Bir işletmeyi (slug/isim veya sıcak-lead sırası) alır → GERÇEK verisi + GERÇEK fotoğraflarıyla
 * premium immersive tek-sayfa site üretir → demo/<slug>/index.html. "Kalkan Info altında site sat"
 * yapısının ölçeklenen hali (1 demo değil, 52 lead). Uydurma yok — sadece gerçek veri.
 *
 * Kullanım:
 *   node scripts/agency/build-venue-site.mjs the-view-terrace      # slug ile
 *   node scripts/agency/build-venue-site.mjs --lead 2              # 2. sıcak lead
 *   node scripts/agency/build-venue-site.mjs "Olala"              # isim ile
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (p) => { try { const d = JSON.parse(readFileSync(join(ROOT, p), 'utf8')); return d.items || d; } catch { return []; } };
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const realPhotos = (b) => (b.gallery || []).filter((p) => p && existsSync(join(ROOT, p.replace(/^\//, ''))));

function findVenue(arg, leadIndex) {
  const rest = load('data/restoranlar.json'), otel = load('data/oteller.json');
  const all = [...rest, ...otel];
  if (leadIndex != null) {
    const leads = load('data/agency/website-leads.json').leads || load('data/agency/website-leads.json');
    const lead = (Array.isArray(leads) ? leads : []).filter((l) => l.photoCount >= 1)[leadIndex - 1];
    if (lead) return all.find((b) => (b.slug || b.id) === lead.slug) || all.find((b) => b.name === lead.name);
    return null;
  }
  return all.find((b) => (b.slug || b.id) === arg) || all.find((b) => new RegExp(arg, 'i').test(b.name)) || null;
}

function siteHtml(v, photos) {
  const name = v.name.replace(/\s*[·|].*$/, '').trim();
  const words = name.split(' ');
  const nameA = words.slice(0, Math.ceil(words.length / 2)).join(' ');
  const nameB = words.slice(Math.ceil(words.length / 2)).join(' ');
  const phoneDigits = (v.phone || '').replace(/[^\d]/g, '');
  const wa = phoneDigits ? `https://wa.me/${phoneDigits}` : '';
  const tel = phoneDigits ? `tel:+${phoneDigits}` : '';
  const cat = [v.category, v.cuisine].filter(Boolean).join(' · ') || 'Kalkan';
  const loc = v.location || 'Kalkan, Kaş/Antalya';
  const mapsQ = encodeURIComponent(`${name} ${loc}`);
  const hero = photos[0];
  const gallery = photos.slice(0, 8);
  const reviews = v.reviewCount ? `${v.reviewCount} Google reviews` : 'Loved by guests';
  const ratingLine = v.rating ? `${v.rating}★ average${v.reviewCount ? ` · ${v.reviewCount} reviews` : ''}` : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(name)} — Kalkan${v.rating ? ` · ${v.rating}★` : ''}</title>
<meta name="description" content="${esc(name)} in Kalkan${v.rating ? ` — ${v.rating}★ (${v.reviewCount || ''} reviews)` : ''}. ${esc((v.summary || '').slice(0, 120))}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--sea:#0E2233;--sea-d:#07131E;--gold:#C8962A;--gold-l:#E0B450;--terra:#B4653A;--cream:#F5EDD8;}
*{margin:0;box-sizing:border-box;}html{scroll-behavior:smooth;}
body{background:var(--sea);color:var(--cream);font-family:'DM Sans',system-ui,sans-serif;overflow-x:hidden;}
.serif{font-family:'Cormorant Garamond',serif;}
.eyebrow{font-size:.72rem;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);}
.gline{width:44px;height:1px;background:var(--gold);margin:14px 0 20px;opacity:.6;}
.title{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:clamp(2rem,5vw,3.4rem);line-height:1.06;letter-spacing:-.01em;}
.reveal{opacity:0;transform:translateY(26px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1);}
.reveal.in{opacity:1;transform:none;}
nav{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:18px clamp(1.2rem,4vw,3rem);transition:background .3s,backdrop-filter .3s;}
nav.solid{background:rgba(7,19,30,.85);backdrop-filter:blur(10px);}
nav .wm{font-family:'Cormorant Garamond',serif;font-size:1.15rem;letter-spacing:.18em;color:var(--cream);text-transform:uppercase;text-decoration:none;}
nav .links{display:flex;gap:26px;align-items:center;}
nav a{color:rgba(245,237,216,.75);text-decoration:none;font-size:.82rem;letter-spacing:.06em;transition:color .2s;}
nav a:hover{color:var(--gold-l);}
.btn{display:inline-flex;align-items:center;gap:.55rem;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;border-radius:2px;padding:.85rem 1.6rem;transition:transform .15s,filter .15s,background .2s;cursor:pointer;}
.btn:hover{transform:translateY(-1px);}
.btn-gold{background:linear-gradient(135deg,var(--gold),var(--terra));color:var(--sea);font-weight:600;}
.btn-ghost{border:1px solid rgba(245,237,216,.4);color:var(--cream);}
.btn-ghost:hover{background:rgba(245,237,216,.08);}
.hero{position:relative;height:100vh;min-height:600px;overflow:hidden;display:flex;align-items:center;}
.hero .bg{position:absolute;inset:-8% 0;background-size:cover;background-position:center;will-change:transform;}
.hero .ov{position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,19,30,.82) 0%,rgba(7,19,30,.4) 55%,transparent 100%),linear-gradient(0deg,rgba(7,19,30,.9),transparent 55%);}
.hero .grain{position:absolute;inset:0;opacity:.04;background-image:radial-gradient(#fff 1px,transparent 1px);background-size:3px 3px;}
.hero .in{position:relative;z-index:2;padding:0 clamp(1.4rem,6vw,6rem);max-width:840px;}
.badge{display:inline-flex;align-items:center;gap:.6rem;margin-top:1.3rem;background:rgba(200,150,42,.12);border:1px solid rgba(224,180,80,.4);border-radius:999px;padding:.5rem 1rem;font-size:.8rem;}
.badge .st{color:var(--gold-l);letter-spacing:1px;}
.sec{padding:clamp(4rem,10vh,8rem) clamp(1.4rem,5vw,5rem);max-width:1280px;margin:0 auto;}
.gal{columns:2;column-gap:14px;}
@media(min-width:800px){.gal{columns:3;}}
.gal img{width:100%;margin-bottom:14px;border-radius:3px;display:block;transition:transform .4s,filter .4s;cursor:pointer;filter:saturate(.95);}
.gal img:hover{transform:scale(1.02);filter:saturate(1.1);}
.rev{text-align:center;background:rgba(200,150,42,.05);border:1px solid rgba(200,150,42,.15);border-radius:4px;padding:clamp(2rem,5vw,3.5rem);}
.reserve{background:linear-gradient(135deg,var(--sea-d),var(--sea));text-align:center;padding:clamp(3.5rem,8vh,6rem) 1.4rem;}
.map{width:100%;height:380px;border:0;border-radius:4px;filter:grayscale(.3) contrast(1.05);}
footer{background:var(--sea-d);padding:2.5rem clamp(1.4rem,5vw,5rem);display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;align-items:center;border-top:1px solid rgba(200,150,42,.12);}
footer a{color:var(--gold-l);text-decoration:none;}
.wa-float{position:fixed;bottom:22px;right:22px;z-index:60;width:56px;height:56px;border-radius:50%;background:#25D366;display:grid;place-items:center;box-shadow:0 8px 24px rgba(0,0,0,.4);}
.big{font-family:'Cormorant Garamond',serif;font-size:clamp(3.5rem,8vw,5.5rem);color:var(--gold-l);line-height:1;}
.lb{position:fixed;inset:0;z-index:80;background:rgba(4,10,16,.94);display:none;align-items:center;justify-content:center;padding:2rem;cursor:zoom-out;}
.lb.on{display:flex;}.lb img{max-width:94vw;max-height:90vh;border-radius:4px;}
</style></head>
<body>
<nav id="nav"><a class="wm" href="#">${esc(name)}</a>
  <div class="links"><a href="#gallery">Gallery</a><a href="#location">Location</a>${wa ? `<a class="btn btn-gold" href="${wa}" target="_blank" rel="noopener">Reserve</a>` : ''}</div>
</nav>

<header class="hero">
  <div class="bg" id="heroBg" style="background-image:url('${hero}')"></div>
  <div class="ov"></div><div class="grain"></div>
  <div class="in">
    <div class="eyebrow reveal">${esc(loc.split(',')[0])} · Kaş, Antalya</div>
    <h1 class="title reveal" style="font-size:clamp(2.6rem,7vw,5rem);margin-top:.5rem;">${esc(nameA)}<br><em style="color:var(--gold-l);">${esc(nameB || '')}</em></h1>
    ${v.rating ? `<div class="badge reveal"><span class="st">★★★★★</span> <b>${v.rating}</b> <span style="opacity:.7">· ${esc(reviews)}</span></div>` : ''}
    <div class="reveal" style="margin-top:2rem;display:flex;gap:.8rem;flex-wrap:wrap;">
      ${wa ? `<a class="btn btn-gold" href="${wa}" target="_blank" rel="noopener">Reserve via WhatsApp</a>` : ''}
      ${tel ? `<a class="btn btn-ghost" href="${tel}">Call</a>` : ''}
    </div>
  </div>
</header>

<section class="sec">
  <div class="eyebrow reveal">The place</div><div class="gline reveal"></div>
  <h2 class="title reveal" style="max-width:800px;">A ${esc(cat.toLowerCase())} in the heart of Kalkan.</h2>
  <p class="reveal" style="max-width:640px;margin-top:1.2rem;color:rgba(245,237,216,.7);font-size:1.05rem;line-height:1.75;">
    ${esc(v.summary || `${name}, Kalkan'ın sevilen adreslerinden. Sıcak atmosfer, yerel lezzet ve ${loc.split(',')[0]}'nun eşsiz havası bir arada.`)}
  </p>
</section>

<section class="sec" id="gallery" style="padding-top:0;">
  <div class="eyebrow reveal">Gallery</div><div class="gline reveal"></div>
  <div class="gal reveal">
    ${gallery.map((p) => `<img src="${p}" alt="${esc(name)}" loading="lazy" onclick="lb('${p}')"/>`).join('\n    ')}
  </div>
</section>

${v.rating ? `<section class="sec" style="padding-top:0;"><div class="rev reveal">
  <p class="serif" style="font-size:clamp(1.4rem,2.4vw,1.9rem);font-style:italic;">One of Kalkan's best-loved spots.</p>
  <p style="margin:.6rem 0 1.9rem;color:rgba(245,237,216,.6);letter-spacing:.06em;">${esc(ratingLine)}</p>
  <a class="btn btn-ghost" href="https://www.google.com/maps/search/?api=1&query=${mapsQ}" target="_blank" rel="noopener">Read reviews on Google →</a>
</div></section>` : ''}

<section class="sec" id="location">
  <div class="eyebrow reveal">Find us</div><div class="gline reveal"></div>
  <p class="reveal" style="color:rgba(245,237,216,.7);margin-bottom:1.5rem;">${esc(loc)}</p>
  <iframe class="map reveal" loading="lazy" src="https://maps.google.com/maps?q=${mapsQ}&output=embed"></iframe>
</section>

<section class="reserve" id="reserve">
  <div class="eyebrow reveal" style="color:var(--gold-l);">Reservations</div>
  <h2 class="title reveal" style="margin:.6rem 0 1.5rem;">Book your table.</h2>
  <div class="reveal" style="display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap;">
    ${wa ? `<a class="btn btn-gold" href="${wa}" target="_blank" rel="noopener">WhatsApp: ${esc(v.phone)}</a>` : ''}
    ${tel ? `<a class="btn btn-ghost" href="${tel}">Call now</a>` : ''}
  </div>
</section>

<footer>
  <div><div class="serif" style="letter-spacing:.14em;text-transform:uppercase;">${esc(name)}</div>
    <div style="font-size:.8rem;color:rgba(245,237,216,.5);margin-top:.2rem;">${esc(loc)}</div></div>
  <div style="font-size:.78rem;color:rgba(245,237,216,.45);">Site by <a href="https://kalkaninfo.com" target="_blank" rel="noopener">Kalkan Info</a> · kalkaninfo.com</div>
</footer>

${wa ? `<a class="wa-float" href="${wa}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.92c0 1.92.55 3.78 1.6 5.39L2 22l4.86-1.7a9.93 9.93 0 004.65 1.16h.01c5.46 0 9.9-4.45 9.9-9.92 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0012.04 2z"/></svg></a>` : ''}
<div class="lb" id="lb" onclick="this.classList.remove('on')"><img id="lbi" src=""/></div>

<script>
(function(){
  var nav=document.getElementById('nav');
  addEventListener('scroll',function(){nav.classList.toggle('solid',scrollY>60);
    var bg=document.getElementById('heroBg'); if(bg) bg.style.transform='translateY('+(scrollY*0.28)+'px)';});
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
  document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});
  window.lb=function(src){var l=document.getElementById('lb');document.getElementById('lbi').src=src;l.classList.add('on');};
})();
</script>
</body></html>`;
}

function main() {
  const args = process.argv.slice(2);
  const leadIdx = args.includes('--lead') ? parseInt(args[args.indexOf('--lead') + 1], 10) : null;
  const arg = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
  const v = findVenue(arg, leadIdx);
  if (!v) { console.error('✗ işletme bulunamadı:', arg || `lead ${leadIdx}`); process.exit(1); }
  const photos = realPhotos(v);
  if (!photos.length) { console.error('✗ gerçek fotoğraf yok:', v.name); process.exit(1); }
  const slug = v.slug || v.id;
  const dir = join(ROOT, 'demo', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), siteHtml(v, photos), 'utf8');
  console.log(`✓ site: demo/${slug}/index.html`);
  console.log(`  ${v.name} · ${v.rating || '?'}★ · ${photos.length} GERÇEK foto · tel:${v.phone || 'yok'}`);
  console.log(`  → http://localhost:3055/demo/${slug}/  (deploy: kalkaninfo.com/demo/${slug})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
