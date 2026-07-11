#!/usr/bin/env node
/**
 * scripts/agency/build-venue-site.mjs — TEKRARLANABİLİR grounded işletme sitesi + ADMİN PANEL üreticisi
 *
 * Bir işletmeyi (slug/isim veya sıcak-lead sırası) alır → GERÇEK verisi + GERÇEK fotoğraflarıyla
 * premium immersive tek-sayfa site + kendi mini-CMS admin paneli üretir.
 *   demo/<slug>/index.html   → satış sitesi (menü + hakkında + saat + galeri + iletişim)
 *   demo/<slug>/admin.html   → sahip/admin girişi → içeriği düzenle → Supabase venue_sites'e kaydet
 *
 * Site açılışta venue_sites tablosundan içerik çeker (yayınlanmışsa canlı düzenlemeleri gösterir),
 * satır yoksa baked GERÇEK veriye düşer. Uydurma yok — sadece gerçek veri.
 *
 * Kullanım:
 *   node scripts/agency/build-venue-site.mjs the-view-terrace      # slug ile
 *   node scripts/agency/build-venue-site.mjs --lead 2              # 2. sıcak lead
 *   node scripts/agency/build-venue-site.mjs "Olala"              # isim ile
 *   node scripts/agency/build-venue-site.mjs --all-examples        # örnek batch üret
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

// ---------------------------------------------------------------------------
// GERÇEK veriyi düzenlenebilir `content` şemasına çevir (venue_sites.content ikizi)
// content = { tagline, about:[p], menu:[{cat,items:[{name,price,desc}]}], hours:[{d,h}]|str, phone, whatsapp, instagram }
// ---------------------------------------------------------------------------
function toContent(v) {
  const tr = (o) => (o && (o.tr || o.TR)) || '';
  const about = [tr(v.aboutP1I18n), tr(v.aboutP2I18n)].filter(Boolean);
  if (!about.length && v.summary) about.push(v.summary);

  const menu = Object.entries(v.menu || {}).map(([cat, items]) => ({
    cat,
    items: (Array.isArray(items) ? items : []).map((s) => {
      const str = String(s);
      const dash = str.indexOf(' — ');
      const name = dash === -1 ? str : str.slice(0, dash).trim();
      const rest = dash === -1 ? '' : str.slice(dash + 3).trim();
      let price = '', desc = '';
      if (rest) {
        const dot = rest.indexOf(' · ');
        if (dot === -1) { price = rest.trim(); }
        else { price = rest.slice(0, dot).trim(); desc = rest.slice(dot + 3).trim(); }
      }
      return { name, price, desc };
    }),
  }));

  return {
    tagline: tr(v.taglineI18n) || '',
    about,
    menu,
    hours: v.hours || '',
    phone: v.phone || '',
    whatsapp: (v.phone || '').replace(/[^\d]/g, ''),
    instagram: v.instagram || '',
  };
}

function siteHtml(v, photos, content) {
  const name = v.name.replace(/\s*[·|].*$/, '').trim();
  const words = name.split(' ');
  const nameA = words.slice(0, Math.ceil(words.length / 2)).join(' ');
  const nameB = words.slice(Math.ceil(words.length / 2)).join(' ');
  const cat = [v.category, v.cuisine].filter(Boolean).join(' · ') || 'Kalkan';
  const loc = v.location || 'Kalkan, Kaş/Antalya';
  const mapsQ = encodeURIComponent(`${name} ${loc}`);
  const hero = photos[0];
  const gallery = photos.slice(0, 8);
  const reviews = v.reviewCount ? `${v.reviewCount} Google reviews` : 'Loved by guests';
  const ratingLine = v.rating ? `${v.rating}★ average${v.reviewCount ? ` · ${v.reviewCount} reviews` : ''}` : '';
  const slug = v.slug || v.id;

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(name)} — Kalkan${v.rating ? ` · ${v.rating}★` : ''}</title>
<meta name="description" content="${esc(name)}, Kalkan${v.rating ? ` — ${v.rating}★ (${v.reviewCount || ''} yorum)` : ''}. ${esc((content.about[0] || v.summary || '').slice(0, 120))}"/>
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
.hero{position:relative;height:100vh;min-height:600px;overflow:hidden;display:flex;align-items:center;justify-content:center;}
.hero .bg{position:absolute;inset:-8% 0;background-size:cover;background-position:center;will-change:transform;}
.hero .ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,19,30,.5) 0%,rgba(7,19,30,.22) 42%,rgba(7,19,30,.78) 100%),radial-gradient(ellipse at center,transparent 34%,rgba(7,19,30,.55) 100%);}
.hero .grain{position:absolute;inset:0;opacity:.04;background-image:radial-gradient(#fff 1px,transparent 1px);background-size:3px 3px;}
.hero .in{position:relative;z-index:2;padding:0 clamp(1.4rem,6vw,4rem);max-width:760px;margin:0 auto;text-align:center;}
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
/* menü */
.menu-cat{margin-bottom:2.6rem;}
.menu-cat h3{font-family:'Cormorant Garamond',serif;font-size:clamp(1.4rem,3vw,1.9rem);color:var(--gold-l);margin-bottom:1rem;letter-spacing:.01em;}
.menu-item{display:flex;justify-content:space-between;gap:1rem;padding:.75rem 0;border-bottom:1px dashed rgba(200,150,42,.14);}
.menu-item .mi-l{max-width:78%;}
.menu-item .mi-n{font-weight:600;color:var(--cream);}
.menu-item .mi-d{font-size:.85rem;color:rgba(245,237,216,.55);margin-top:.15rem;line-height:1.5;}
.menu-item .mi-p{white-space:nowrap;color:var(--gold-l);font-weight:600;}
.hours-line{display:flex;justify-content:space-between;gap:1rem;padding:.6rem 0;border-bottom:1px dashed rgba(200,150,42,.14);max-width:520px;}
.about-p{max-width:680px;margin-top:1.2rem;color:rgba(245,237,216,.72);font-size:1.05rem;line-height:1.8;}
</style></head>
<body>
<nav id="nav"><a class="wm" href="#">${esc(name)}</a>
  <div class="links"><a href="#about">Hakkında</a><a href="#menu">Menü</a><a href="#gallery">Galeri</a><a href="#location">Konum</a><a class="btn btn-gold" href="#reserve">Rezervasyon</a></div>
</nav>

<header class="hero">
  <div class="bg" id="heroBg" style="background-image:url('${hero}')"></div>
  <div class="ov"></div><div class="grain"></div>
  <div class="in">
    <div class="eyebrow reveal">${esc(loc.split(',')[0])} · Kaş, Antalya</div>
    <h1 class="title reveal" style="font-size:clamp(2.6rem,7vw,5rem);margin-top:.5rem;">${esc(nameA)}<br><em style="color:var(--gold-l);">${esc(nameB || '')}</em></h1>
    <p class="reveal" id="heroTagline" style="margin:1rem auto 0;color:rgba(245,237,216,.85);font-size:1.1rem;max-width:520px;">${esc(content.tagline)}</p>
    ${v.rating ? `<div class="badge reveal"><span class="st">★★★★★</span> <b>${v.rating}</b> <span style="opacity:.7">· ${esc(reviews)}</span></div>` : ''}
    <div class="reveal" style="margin-top:2rem;display:flex;gap:.8rem;flex-wrap:wrap;justify-content:center;" id="heroCta"></div>
  </div>
</header>

<section class="sec" id="about">
  <div class="eyebrow reveal">Hakkında</div><div class="gline reveal"></div>
  <h2 class="title reveal" style="max-width:800px;">Kalkan'ın kalbinde bir ${esc(cat.toLowerCase())}.</h2>
  <div id="aboutBody" class="reveal"></div>
</section>

<section class="sec" id="menu" style="padding-top:0;">
  <div class="eyebrow reveal">Menü</div><div class="gline reveal"></div>
  <h2 class="title reveal" style="margin-bottom:2rem;">Sofradakiler.</h2>
  <div id="menuBody" class="reveal"></div>
</section>

<section class="sec" id="gallery" style="padding-top:0;">
  <div class="eyebrow reveal">Galeri</div><div class="gline reveal"></div>
  <div class="gal reveal">
    ${gallery.map((p) => `<img src="${p}" alt="${esc(name)}" loading="lazy" onclick="lb('${p}')"/>`).join('\n    ')}
  </div>
</section>

${v.rating ? `<section class="sec" style="padding-top:0;"><div class="rev reveal">
  <p class="serif" style="font-size:clamp(1.4rem,2.4vw,1.9rem);font-style:italic;">Kalkan'ın en sevilen adreslerinden.</p>
  <p style="margin:.6rem 0 1.9rem;color:rgba(245,237,216,.6);letter-spacing:.06em;">${esc(ratingLine)}</p>
  <a class="btn btn-ghost" href="https://www.google.com/maps/search/?api=1&query=${mapsQ}" target="_blank" rel="noopener">Google yorumlarını oku →</a>
</div></section>` : ''}

<section class="sec" id="hours" style="padding-top:0;">
  <div class="eyebrow reveal">Çalışma Saatleri</div><div class="gline reveal"></div>
  <div id="hoursBody" class="reveal"></div>
</section>

<section class="sec" id="location">
  <div class="eyebrow reveal">Bizi bulun</div><div class="gline reveal"></div>
  <p class="reveal" style="color:rgba(245,237,216,.7);margin-bottom:1.5rem;">${esc(loc)}</p>
  <iframe class="map reveal" loading="lazy" src="https://maps.google.com/maps?q=${mapsQ}&output=embed"></iframe>
</section>

<section class="reserve" id="reserve">
  <div class="eyebrow reveal" style="color:var(--gold-l);">İletişim & Rezervasyon</div>
  <h2 class="title reveal" style="margin:.6rem 0 1.5rem;">Yerinizi ayırtın.</h2>
  <div class="reveal" id="reserveCta" style="display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap;"></div>
</section>

<footer>
  <div><div class="serif" style="letter-spacing:.14em;text-transform:uppercase;">${esc(name)}</div>
    <div style="font-size:.8rem;color:rgba(245,237,216,.5);margin-top:.2rem;">${esc(loc)}</div></div>
  <div style="font-size:.78rem;color:rgba(245,237,216,.45);">
    <a href="admin.html">Yönetici Girişi</a> · Site by <a href="https://kalkaninfo.com" target="_blank" rel="noopener">Kalkan Info</a>
  </div>
</footer>

<a class="wa-float" id="waFloat" href="#" target="_blank" rel="noopener" aria-label="WhatsApp" style="display:none;"><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.92c0 1.92.55 3.78 1.6 5.39L2 22l4.86-1.7a9.93 9.93 0 004.65 1.16h.01c5.46 0 9.9-4.45 9.9-9.92 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0012.04 2z"/></svg></a>
<div class="lb" id="lb" onclick="this.classList.remove('on')"><img id="lbi" src=""/></div>

<script>
window.__VENUE_SLUG__ = ${JSON.stringify(slug)};
window.__VENUE_NAME__ = ${JSON.stringify(name)};
window.__VENUE_BAKED__ = ${JSON.stringify(content)};
window.__VENUE_PHONE_DISPLAY__ = ${JSON.stringify(v.phone || '')};
</script>
<script type="module">
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/js/supabase-config.js';
import { createClient } from '/vendor/supabase.mjs';

const E = (s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = (id)=>document.getElementById(id);

function render(c){
  const phone = window.__VENUE_PHONE_DISPLAY__ || c.phone || '';
  const waDigits = (c.whatsapp || (phone||'').replace(/[^\\d]/g,'')) || '';
  const wa = waDigits ? 'https://wa.me/'+waDigits : '';
  const tel = (phone||'').replace(/[^\\d]/g,'') ? 'tel:+'+(phone||'').replace(/[^\\d]/g,'') : '';
  if (c.tagline) $('heroTagline').textContent = c.tagline;

  // Hakkında
  $('aboutBody').innerHTML = (c.about||[]).map(p=>'<p class="about-p">'+E(p)+'</p>').join('') ||
    '<p class="about-p">Kalkan\\'ın sevilen adreslerinden.</p>';

  // Menü
  const menu = (c.menu||[]).filter(m=>m && (m.cat || (m.items&&m.items.length)));
  $('menu').style.display = menu.length ? '' : 'none';
  $('menuBody').innerHTML = menu.map(m=>
    '<div class="menu-cat"><h3>'+E(m.cat)+'</h3>'+
    (m.items||[]).map(it=>
      '<div class="menu-item"><div class="mi-l"><div class="mi-n">'+E(it.name)+'</div>'+
      (it.desc?'<div class="mi-d">'+E(it.desc)+'</div>':'')+'</div>'+
      (it.price?'<div class="mi-p">'+E(it.price)+'</div>':'')+'</div>'
    ).join('')+'</div>'
  ).join('');

  // Saatler
  const h = c.hours;
  let hoursHtml = '';
  if (Array.isArray(h) && h.length) hoursHtml = h.map(x=>'<div class="hours-line"><span>'+E(x.d||x.day||'')+'</span><span style="color:var(--gold-l)">'+E(x.h||x.hours||'')+'</span></div>').join('');
  else if (typeof h === 'string' && h.trim()) hoursHtml = '<p class="about-p" style="margin-top:0">'+E(h)+'</p>';
  $('hours').style.display = hoursHtml ? '' : 'none';
  $('hoursBody').innerHTML = hoursHtml;

  // CTA'lar
  const heroCta = (wa?'<a class="btn btn-gold" href="'+wa+'" target="_blank" rel="noopener">WhatsApp ile Rezervasyon</a>':'')+
                  (tel?'<a class="btn btn-ghost" href="'+tel+'">Ara</a>':'');
  $('heroCta').innerHTML = heroCta;
  $('reserveCta').innerHTML = (wa?'<a class="btn btn-gold" href="'+wa+'" target="_blank" rel="noopener">WhatsApp: '+E(phone)+'</a>':'')+
                              (tel?'<a class="btn btn-ghost" href="'+tel+'">Hemen ara</a>':'');
  const waf = $('waFloat');
  if (wa){ waf.href = wa; waf.style.display='grid'; } else { waf.style.display='none'; }
}

// 1) Baked GERÇEK veriyle hemen render (SEO/hızlı ilk boya)
render(window.__VENUE_BAKED__);

// 2) venue_sites'ten canlı içerik varsa üzerine yaz (admin düzenlemeleri)
(async()=>{
  try{
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{ persistSession:false } });
    const { data } = await sb.from('venue_sites').select('content,published').eq('slug', window.__VENUE_SLUG__).eq('published', true).maybeSingle();
    if (data && data.content && Object.keys(data.content).length){
      render({ ...window.__VENUE_BAKED__, ...data.content });
    }
  }catch(e){ /* venue_sites yoksa baked içerik kalır */ }
})();

// UI: nav solid + parallax + reveal + lightbox
const nav=$('nav');
addEventListener('scroll',function(){nav.classList.toggle('solid',scrollY>60);
  const bg=$('heroBg'); if(bg) bg.style.transform='translateY('+(scrollY*0.28)+'px)';});
const io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});
window.lb=function(src){var l=$('lb');$('lbi').src=src;l.classList.add('on');};
</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// ADMİN PANELİ — sahip/admin girişi → içeriği düzenle → venue_sites upsert
// ---------------------------------------------------------------------------
function adminHtml(v, content) {
  const name = v.name.replace(/\s*[·|].*$/, '').trim();
  const slug = v.slug || v.id;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Yönetici · ${esc(name)}</title>
<style>
:root{--sea:#0E2233;--sea-d:#07131E;--gold:#C8962A;--gold-l:#E0B450;--cream:#F5EDD8;--line:rgba(200,150,42,.2);}
*{box-sizing:border-box;margin:0;}
body{background:var(--sea);color:var(--cream);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.5;}
.wrap{max-width:820px;margin:0 auto;padding:2rem 1.2rem 5rem;}
h1{font-size:1.4rem;letter-spacing:.02em;}
.muted{color:rgba(245,237,216,.6);font-size:.9rem;}
.card{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:10px;padding:1.4rem;margin-top:1.2rem;}
label{display:block;font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;color:var(--gold-l);margin:.9rem 0 .35rem;}
input,textarea{width:100%;background:rgba(7,19,30,.6);border:1px solid var(--line);border-radius:7px;color:var(--cream);padding:.7rem .85rem;font:inherit;}
input:focus,textarea:focus{outline:none;border-color:var(--gold);}
textarea{resize:vertical;min-height:70px;}
.btn{display:inline-flex;align-items:center;gap:.5rem;border:0;border-radius:7px;padding:.75rem 1.4rem;font:inherit;font-weight:600;cursor:pointer;letter-spacing:.03em;transition:transform .12s,filter .12s;}
.btn:hover{transform:translateY(-1px);}
.btn-gold{background:linear-gradient(135deg,var(--gold),#B4653A);color:var(--sea);}
.btn-ghost{background:transparent;border:1px solid var(--line);color:var(--cream);}
.btn-sm{padding:.45rem .8rem;font-size:.82rem;}
.row{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;}
.mi{display:grid;grid-template-columns:1.4fr .7fr 2fr auto;gap:.5rem;margin-bottom:.5rem;}
.cat-block{border:1px dashed var(--line);border-radius:8px;padding:.9rem;margin-bottom:1rem;}
.cat-head{display:flex;gap:.6rem;align-items:center;margin-bottom:.7rem;}
.cat-head input{font-weight:700;}
.hidden{display:none;}
#toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--gold);color:var(--sea);padding:.7rem 1.3rem;border-radius:8px;font-weight:600;opacity:0;transition:opacity .3s;pointer-events:none;}
#toast.on{opacity:1;}
a{color:var(--gold-l);}
@media(max-width:640px){.mi{grid-template-columns:1fr 1fr;}}
</style></head>
<body>
<div class="wrap">
  <div class="row" style="justify-content:space-between;">
    <div><h1>${esc(name)} — Yönetim</h1><div class="muted">Kalkan Info · mini-CMS</div></div>
    <a class="btn btn-ghost btn-sm" href="index.html" target="_blank">Siteyi gör ↗</a>
  </div>

  <!-- GİRİŞ -->
  <div class="card" id="loginCard">
    <label>E-posta</label><input id="email" type="email" autocomplete="username" placeholder="ornek@mail.com"/>
    <label>Şifre</label><input id="pwd" type="password" autocomplete="current-password"/>
    <div class="row" style="margin-top:1rem;"><button class="btn btn-gold" id="loginBtn">Giriş</button><span class="muted" id="loginMsg"></span></div>
    <p class="muted" style="margin-top:.8rem;">Giriş bilgileriniz Kalkan Info tarafından verilir.</p>
  </div>

  <!-- EDİTÖR -->
  <div id="editor" class="hidden">
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <span class="muted">Giriş: <b id="who"></b></span>
        <button class="btn btn-ghost btn-sm" id="logoutBtn">Çıkış</button>
      </div>
    </div>

    <div class="card">
      <label>Slogan (hero altı)</label>
      <input id="f_tagline" placeholder="Kısa çarpıcı bir cümle"/>
      <label>Hakkında (her paragraf ayrı satır)</label>
      <textarea id="f_about" style="min-height:120px" placeholder="İşletmenizi anlatın..."></textarea>
      <label>Çalışma Saatleri</label>
      <input id="f_hours" placeholder="Her gün 09:00–23:00"/>
      <div class="row">
        <div style="flex:1;min-width:180px"><label>Telefon</label><input id="f_phone" placeholder="+90 5xx xxx xx xx"/></div>
        <div style="flex:1;min-width:180px"><label>WhatsApp (sadece rakam)</label><input id="f_whatsapp" placeholder="905xxxxxxxxx"/></div>
      </div>
      <label>Instagram</label><input id="f_instagram" placeholder="https://instagram.com/..."/>
    </div>

    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <label style="margin:0">Menü</label>
        <button class="btn btn-ghost btn-sm" id="addCat">+ Kategori</button>
      </div>
      <div id="menuEditor" style="margin-top:1rem;"></div>
    </div>

    <div class="row" style="margin-top:1.4rem;">
      <button class="btn btn-gold" id="saveBtn">Kaydet ve Yayınla</button>
      <span class="muted" id="saveMsg"></span>
    </div>
  </div>
</div>
<div id="toast"></div>

<script type="module">
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/js/supabase-config.js';
import { createClient } from '/vendor/supabase.mjs';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{ persistSession:true, autoRefreshToken:true } });

const SLUG = ${JSON.stringify(slug)};
const NAME = ${JSON.stringify(name)};
const BAKED = ${JSON.stringify(content)};
const $ = (id)=>document.getElementById(id);
const toast = (m)=>{ const t=$('toast'); t.textContent=m; t.classList.add('on'); setTimeout(()=>t.classList.remove('on'),2200); };

// ---- Menü editörü ----
function catBlock(cat){
  const el = document.createElement('div'); el.className='cat-block';
  el.innerHTML =
    '<div class="cat-head"><input class="c-name" placeholder="Kategori adı" value="'+(cat.cat||'').replace(/"/g,'&quot;')+'"/>'+
    '<button class="btn btn-ghost btn-sm c-add">+ Ürün</button>'+
    '<button class="btn btn-ghost btn-sm c-del">Sil</button></div>'+
    '<div class="items"></div>';
  const items = el.querySelector('.items');
  (cat.items||[]).forEach(it=>items.appendChild(itemRow(it)));
  el.querySelector('.c-add').onclick=()=>items.appendChild(itemRow({}));
  el.querySelector('.c-del').onclick=()=>el.remove();
  return el;
}
function itemRow(it){
  const r = document.createElement('div'); r.className='mi';
  r.innerHTML =
    '<input class="i-name" placeholder="Ürün" value="'+(it.name||'').replace(/"/g,'&quot;')+'"/>'+
    '<input class="i-price" placeholder="Fiyat" value="'+(it.price||'').replace(/"/g,'&quot;')+'"/>'+
    '<input class="i-desc" placeholder="Açıklama" value="'+(it.desc||'').replace(/"/g,'&quot;')+'"/>'+
    '<button class="btn btn-ghost btn-sm i-del">×</button>';
  r.querySelector('.i-del').onclick=()=>r.remove();
  return r;
}
function readMenu(){
  return [...$('menuEditor').querySelectorAll('.cat-block')].map(b=>({
    cat: b.querySelector('.c-name').value.trim(),
    items: [...b.querySelectorAll('.mi')].map(r=>({
      name: r.querySelector('.i-name').value.trim(),
      price: r.querySelector('.i-price').value.trim(),
      desc: r.querySelector('.i-desc').value.trim(),
    })).filter(i=>i.name)
  })).filter(c=>c.cat || c.items.length);
}

function fill(c){
  $('f_tagline').value = c.tagline||'';
  $('f_about').value = (c.about||[]).join('\\n');
  $('f_hours').value = typeof c.hours==='string' ? c.hours : (Array.isArray(c.hours)? c.hours.map(x=>(x.d||'')+' '+(x.h||'')).join('; '):'');
  $('f_phone').value = c.phone||'';
  $('f_whatsapp').value = c.whatsapp||'';
  $('f_instagram').value = c.instagram||'';
  const me = $('menuEditor'); me.innerHTML='';
  (c.menu||[]).forEach(cat=>me.appendChild(catBlock(cat)));
}
function collect(){
  return {
    tagline: $('f_tagline').value.trim(),
    about: $('f_about').value.split('\\n').map(s=>s.trim()).filter(Boolean),
    hours: $('f_hours').value.trim(),
    phone: $('f_phone').value.trim(),
    whatsapp: $('f_whatsapp').value.replace(/[^\\d]/g,''),
    instagram: $('f_instagram').value.trim(),
    menu: readMenu(),
  };
}

$('addCat').onclick=()=>$('menuEditor').appendChild(catBlock({cat:'',items:[{}]}));

// ---- Auth akışı ----
async function showEditor(user){
  $('loginCard').classList.add('hidden');
  $('editor').classList.remove('hidden');
  $('who').textContent = user.email;
  // Mevcut kaydı çek; yoksa baked ile başlat
  const { data } = await sb.from('venue_sites').select('content').eq('slug', SLUG).maybeSingle();
  fill(data && data.content && Object.keys(data.content).length ? { ...BAKED, ...data.content } : BAKED);
}
function showLogin(){
  $('editor').classList.add('hidden');
  $('loginCard').classList.remove('hidden');
}

$('loginBtn').onclick=async()=>{
  const email=$('email').value.trim(), password=$('pwd').value;
  $('loginMsg').textContent='...';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error){ $('loginMsg').textContent = 'Giriş başarısız: '+error.message; return; }
  $('loginMsg').textContent='';
  showEditor(data.user);
};
$('logoutBtn').onclick=async()=>{ await sb.auth.signOut(); showLogin(); };

$('saveBtn').onclick=async()=>{
  const { data:{ user } } = await sb.auth.getUser();
  if (!user){ toast('Oturum yok, tekrar giriş yapın'); showLogin(); return; }
  $('saveMsg').textContent='Kaydediliyor...';
  const content = collect();
  const { error } = await sb.from('venue_sites').upsert({
    slug: SLUG, name: NAME, owner_id: user.id, content, published: true, updated_at: new Date().toISOString(),
  }, { onConflict: 'slug' });
  if (error){ $('saveMsg').textContent='Hata: '+error.message; toast('Kaydedilemedi'); return; }
  $('saveMsg').textContent='✓ Yayınlandı';
  toast('Kaydedildi ve yayınlandı');
};

// Açılışta oturum var mı?
(async()=>{
  const { data:{ session } } = await sb.auth.getSession();
  if (session && session.user) showEditor(session.user); else showLogin();
})();
</script>
</body></html>`;
}

function build(v) {
  const photos = realPhotos(v);
  if (!photos.length) { console.error('✗ gerçek fotoğraf yok:', v.name); return false; }
  const content = toContent(v);
  const slug = v.slug || v.id;
  const dir = join(ROOT, 'demo', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), siteHtml(v, photos, content), 'utf8');
  writeFileSync(join(dir, 'admin.html'), adminHtml(v, content), 'utf8');
  const mc = content.menu.reduce((n, c) => n + c.items.length, 0);
  console.log(`✓ ${v.name}`);
  console.log(`  demo/${slug}/index.html  +  admin.html`);
  console.log(`  ${v.rating || '?'}★ · ${photos.length} foto · ${content.menu.length} menü kat / ${mc} ürün · saat:${content.hours ? 'var' : 'yok'} · tel:${v.phone || 'yok'}`);
  console.log(`  → /demo/${slug}/  ·  yönetim: /demo/${slug}/admin.html`);
  return true;
}

// Örnek batch (kaldığımız yerden test için)
const EXAMPLES = [
  'omar-s-kokobus-kokorec-kofte-tavuk-ekmek',
  'the-view-terrace-restaurant',
  'olala',
  'luna',
];

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--all-examples')) {
    let ok = 0;
    for (const q of EXAMPLES) { const v = findVenue(q); if (v && build(v)) ok++; else console.error('✗ atlandı:', q); }
    console.log(`\n${ok}/${EXAMPLES.length} örnek üretildi.`);
    return;
  }
  const leadIdx = args.includes('--lead') ? parseInt(args[args.indexOf('--lead') + 1], 10) : null;
  const arg = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
  const v = findVenue(arg, leadIdx);
  if (!v) { console.error('✗ işletme bulunamadı:', arg || `lead ${leadIdx}`); process.exit(1); }
  if (!build(v)) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
