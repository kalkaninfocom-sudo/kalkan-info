#!/usr/bin/env node
/**
 * scripts/agency/build-venue-site.mjs — TEKRARLANABİLİR grounded işletme sitesi + ADMİN PANEL üreticisi
 *
 * Bir işletmeyi (slug/isim veya sıcak-lead sırası) alır → GERÇEK verisi + GERÇEK fotoğraflarıyla
 * PREMIUM · AÇIK golden-hour tema · MOBİL-ÖNCELİKLİ · 5 DİLLİ tek-sayfa site + mini-CMS admin üretir.
 *   demo/<slug>/index.html   → satış sitesi (5 dil: TR/EN/DE/RU/FR, yapışkan aksiyon barı)
 *   demo/<slug>/admin.html   → sahip girişi → içerik düzenle → Supabase venue_sites'e kaydet
 *
 * Marka (docs/MARKA_STRATEJISI): açık #FAF6EF zemin · #0E1A24 metin · #E8A020 altın · teal vurgu.
 * Koyu tema YASAK. Gerçek foto zorunlu (stok yok). Uydurma yok — sadece gerçek veri.
 *
 * Çeviri: arayüz + bölüm başlıkları statik 5 dil (aşağıdaki I18N). Mekan içeriği (tagline/hakkında)
 * mevcut *I18n verisinden; yoksa --translate ile cheap-llm; o da yoksa TR fallback.
 *
 * Kullanım:
 *   node scripts/agency/build-venue-site.mjs zeugma-restorant [--translate]
 *   node scripts/agency/build-venue-site.mjs --lead 2 [--translate]
 *   node scripts/agency/build-venue-site.mjs --all-examples
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (p) => { try { const d = JSON.parse(readFileSync(join(ROOT, p), 'utf8')); return d.items || d; } catch { return []; } };
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const realPhotos = (b) => (b.gallery || []).filter((p) => p && existsSync(join(ROOT, p.replace(/^\//, ''))));

const LANGS = ['tr', 'en', 'de', 'ru', 'fr'];

// Per-venue hero config (opsiyonel). data/venue-hero.json:
//   { "<slug>": { "mode":"text"|"photo", "accent":"#hex", "accent2":"#hex", "image":"/assets/..." } }
// Yoksa VARSAYILAN = text hero (marka renginde temiz yazı — kötü foto riski yok).
const HEROCFG = (() => { try { return JSON.parse(readFileSync(join(ROOT, 'data', 'venue-hero.json'), 'utf8')); } catch { return {}; } })();

// Statik arayüz sözlüğü (5 dil). {cat} = kategori adı yer tutucu.
const I18N = {
  tr: { about:'Hakkında', menu:'Menü', gallery:'Galeri', location:'Konum', hours:'Çalışma Saatleri', reserve:'Rezervasyon',
        aboutTitle:'Kalkan’ın kalbinde bir {cat}.', menuTitle:'Sofradakiler.', reserveTitle:'Yerinizi ayırtın.',
        reserveEye:'İletişim & Rezervasyon', reviewsQuote:'Kalkan’ın en sevilen adreslerinden.', readReviews:'Google yorumlarını oku',
        call:'Ara', directions:'Yol tarifi', wa:'WhatsApp', waReserve:'WhatsApp ile Rezervasyon', findUs:'Bizi bulun',
        admin:'Yönetici Girişi', by:'Site:' },
  en: { about:'About', menu:'Menu', gallery:'Gallery', location:'Location', hours:'Opening Hours', reserve:'Reserve',
        aboutTitle:'A {cat} in the heart of Kalkan.', menuTitle:'On the table.', reserveTitle:'Reserve your table.',
        reserveEye:'Contact & Reservations', reviewsQuote:'One of Kalkan’s most-loved addresses.', readReviews:'Read Google reviews',
        call:'Call', directions:'Directions', wa:'WhatsApp', waReserve:'Reserve on WhatsApp', findUs:'Find us',
        admin:'Admin Login', by:'Site by' },
  de: { about:'Über uns', menu:'Speisekarte', gallery:'Galerie', location:'Lage', hours:'Öffnungszeiten', reserve:'Reservieren',
        aboutTitle:'Ein {cat} im Herzen von Kalkan.', menuTitle:'Auf dem Tisch.', reserveTitle:'Reservieren Sie Ihren Tisch.',
        reserveEye:'Kontakt & Reservierung', reviewsQuote:'Eine der beliebtesten Adressen Kalkans.', readReviews:'Google-Bewertungen lesen',
        call:'Anrufen', directions:'Route', wa:'WhatsApp', waReserve:'Per WhatsApp reservieren', findUs:'Finden Sie uns',
        admin:'Admin-Login', by:'Website:' },
  ru: { about:'О нас', menu:'Меню', gallery:'Галерея', location:'Расположение', hours:'Часы работы', reserve:'Бронировать',
        aboutTitle:'{cat} в сердце Калкана.', menuTitle:'На столе.', reserveTitle:'Забронируйте столик.',
        reserveEye:'Контакты и бронирование', reviewsQuote:'Одно из самых любимых мест Калкана.', readReviews:'Читать отзывы Google',
        call:'Позвонить', directions:'Маршрут', wa:'WhatsApp', waReserve:'Бронь в WhatsApp', findUs:'Найти нас',
        admin:'Вход для админа', by:'Сайт:' },
  fr: { about:'À propos', menu:'Menu', gallery:'Galerie', location:'Emplacement', hours:'Horaires', reserve:'Réserver',
        aboutTitle:'Un {cat} au cœur de Kalkan.', menuTitle:'À table.', reserveTitle:'Réservez votre table.',
        reserveEye:'Contact & Réservations', reviewsQuote:'L’une des adresses les plus appréciées de Kalkan.', readReviews:'Lire les avis Google',
        call:'Appeler', directions:'Itinéraire', wa:'WhatsApp', waReserve:'Réserver sur WhatsApp', findUs:'Nous trouver',
        admin:'Connexion admin', by:'Site :' },
};
const LANG_LABEL = { tr:'TR', en:'EN', de:'DE', ru:'RU', fr:'FR' };
const MENU_HINT = {
  tr:'Güncel menümüz için bize bir mesaj atın — hemen iletelim.',
  en:'Message us for our current menu — we’ll send it right over.',
  de:'Schreiben Sie uns für unsere aktuelle Speisekarte — wir senden sie sofort.',
  ru:'Напишите нам — пришлём актуальное меню сразу.',
  fr:'Écrivez-nous pour notre menu actuel — nous vous l’envoyons aussitôt.',
};

// GERÇEK veriyi düzenlenebilir `content` şemasına çevir (venue_sites.content ikizi)
function toContent(v) {
  const tr = (o) => (o && (o.tr || o.TR)) || '';
  const about = [tr(v.aboutP1I18n), tr(v.aboutP2I18n)].filter(Boolean);
  if (!about.length && v.summary) about.push(v.summary);
  const menu = Object.entries(v.menu || {}).map(([cat, items]) => ({
    cat,
    items: (Array.isArray(items) ? items : []).map((s) => {
      const str = String(s), dash = str.indexOf(' — ');
      const name = dash === -1 ? str : str.slice(0, dash).trim();
      const rest = dash === -1 ? '' : str.slice(dash + 3).trim();
      let price = '', desc = '';
      if (rest) { const dot = rest.indexOf(' · '); if (dot === -1) price = rest.trim(); else { price = rest.slice(0, dot).trim(); desc = rest.slice(dot + 3).trim(); } }
      return { name, price, desc };
    }),
  }));
  return { tagline: tr(v.taglineI18n) || '', about, menu, hours: v.hours || '', phone: v.phone || '', whatsapp: (v.phone || '').replace(/[^\d]/g, ''), instagram: v.instagram || '' };
}

// Mekan içeriğini 5 dile çevir: mevcut *I18n → yoksa cheap-llm → yoksa TR fallback
async function buildContentI18n(v, content, useLLM) {
  const pick = (o) => o && LANGS.every((l) => o[l]) ? { tr:o.tr, en:o.en, de:o.de, ru:o.ru, fr:o.fr } : null;
  const out = {};
  for (const l of LANGS) out[l] = { tagline: content.tagline, about: [...content.about] };

  // 1) mevcut i18n alanları
  const tagI = pick(v.taglineI18n); if (tagI) for (const l of LANGS) out[l].tagline = tagI[l];
  const a1 = pick(v.aboutP1I18n), a2 = pick(v.aboutP2I18n);
  if (a1) for (const l of LANGS) out[l].about = [a1[l], a2 ? a2[l] : ''].filter(Boolean);

  // 2) eksikse cheap-llm (best-effort)
  const needs = !tagI || !a1;
  if (needs && useLLM) {
    try {
      const { cheapJSON } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href);
      const src = JSON.stringify({ tagline: content.tagline || '', about: content.about || [] });
      const { data } = await cheapJSON(
        `Bir Kalkan restoranının site metnini çevir. Kaynak (Türkçe) JSON: ${src}\n` +
        `Çıktı: {"en":{"tagline":"","about":[]},"de":{...},"ru":{...},"fr":{...}} — SADECE JSON, doğal turizm dili, kısa.`,
        { system: 'Profesyonel turizm çevirmeni. Yalnız geçerli JSON döndür.' }
      );
      for (const l of ['en', 'de', 'ru', 'fr']) if (data && data[l]) {
        if (data[l].tagline) out[l].tagline = data[l].tagline;
        if (Array.isArray(data[l].about) && data[l].about.length) out[l].about = data[l].about;
      }
      console.log('  ✓ içerik çevirisi: cheap-llm');
    } catch (e) { console.log('  ℹ çeviri atlandı (TR fallback):', e.message.slice(0, 60)); }
  }
  return out;
}

function siteHtml(v, photos, content, ci18n) {
  const name = v.name.replace(/\s*[·|].*$/, '').trim();
  const cat = ([v.category, v.cuisine].filter(Boolean).join(' · ') || 'Kalkan');
  const catWord = (v.category || 'mekan').toLowerCase();
  const loc = v.location || 'Kalkan, Kaş/Antalya';
  const mapsQ = encodeURIComponent(`${name} ${loc}`);
  const hero = photos[0];
  const gallery = photos.slice(0, 8);
  const slug = v.slug || v.id;
  const ratingLine = v.rating ? `${v.rating}★${v.reviewCount ? ` · ${v.reviewCount}` : ''}` : '';

  const langPills = LANGS.map((l) => `<button class="lp" data-lang="${l}"${l === 'tr' ? ' aria-current="true"' : ''}>${LANG_LABEL[l]}</button>`).join('');

  // HERO modu: config → yoksa varsayılan text (marka renginde temiz kart)
  const cfg = HEROCFG[slug] || {};
  const heroMode = cfg.mode || (cfg.image ? 'photo' : 'text');
  const heroImg = cfg.image || hero;
  const acc = cfg.accent || '#14212C', acc2 = cfg.accent2 || '#0A1219';
  const heroInner = `
    <div class="eyebrow reveal">${esc(loc.split(',')[0])} · Kaş, Antalya</div>
    <h1 class="reveal">${esc(name)}</h1>
    <p class="tag reveal" id="heroTagline"></p>
    ${v.rating ? `<div class="badge reveal">★ <b>${v.rating}</b>${v.reviewCount ? ` · ${v.reviewCount} Google` : ''}</div>` : ''}
    <div class="reveal" style="margin-top:1.6rem;display:flex;gap:.7rem;flex-wrap:wrap;" id="heroCta"></div>`;
  const heroBlock = heroMode === 'photo'
    ? `<header class="hero"><div class="bg" id="heroBg" style="background-image:url('${heroImg}')"></div><div class="ov"></div><div class="in">${heroInner}</div></header>`
    : heroMode === 'banner'
    ? `<header class="hero banner" style="--acc:${acc};--acc2:${acc2}"><div class="bg" id="heroBg" style="background-image:url('${heroImg}')"></div><div class="duo"></div><div class="ov"></div><div class="hero-tex"></div><div class="hero-frame"></div><div class="in">${heroInner}</div></header>`
    : `<header class="hero text" style="--acc:${acc};--acc2:${acc2}"><div class="hero-tex"></div><div class="hero-frame"></div><div class="in">${heroInner}</div></header>`;

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${esc(name)} — Kalkan${v.rating ? ` · ${v.rating}★` : ''}</title>
<meta name="description" content="${esc(name)}, Kalkan${v.rating ? ` — ${v.rating}★ (${v.reviewCount || ''} yorum)` : ''}. ${esc((content.about[0] || v.summary || '').slice(0, 120))}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#FAF6EF;--ink:#0E1A24;--muted:#5a6570;--gold:#E8A020;--gold-d:#C8801A;--teal:#1E7878;--card:#fff;--line:rgba(14,26,36,.10);}
*{margin:0;box-sizing:border-box;}html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--ink);font-family:'Inter',system-ui,sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased;padding-bottom:64px;}
.serif{font-family:'Fraunces',Georgia,serif;}
.eyebrow{font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-d);font-weight:600;}
.gline{width:42px;height:2px;background:var(--gold);margin:12px 0 18px;border-radius:2px;}
.title{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(1.9rem,5vw,3.2rem);line-height:1.05;letter-spacing:-.02em;}
.reveal{opacity:0;transform:translateY(22px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1);}
.reveal.vis{opacity:1;transform:none;}
/* NAV */
nav{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:14px clamp(1rem,4vw,3rem);transition:background .3s,box-shadow .3s;}
nav.solid{background:rgba(250,246,239,.92);backdrop-filter:blur(12px);box-shadow:0 1px 0 var(--line);}
nav .wm{font-family:'Fraunces',serif;font-weight:700;font-size:1.1rem;letter-spacing:.02em;color:var(--ink);text-decoration:none;opacity:0;transition:opacity .3s;}
nav.solid .wm{opacity:1;}
.langs{display:flex;gap:2px;background:rgba(14,26,36,.06);border-radius:999px;padding:3px;margin-left:auto;}
.lp{border:0;background:transparent;color:var(--muted);font:inherit;font-size:.72rem;font-weight:600;letter-spacing:.04em;padding:.32rem .55rem;border-radius:999px;cursor:pointer;transition:background .2s,color .2s;}
.lp[aria-current="true"]{background:var(--card);color:var(--ink);box-shadow:0 1px 4px rgba(14,26,36,.12);}
nav .nav-res{display:none;}
@media(min-width:860px){nav .nav-res{display:inline-flex;}}
/* HERO */
.hero{position:relative;height:100svh;min-height:560px;overflow:hidden;display:flex;align-items:flex-end;}
.hero .bg{position:absolute;inset:-6% 0;background-size:cover;background-position:center;will-change:transform;}
.hero .ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,26,36,.34) 0%,rgba(14,26,36,.06) 26%,rgba(14,26,36,.44) 56%,rgba(14,26,36,.86) 100%);}
.hero .in{position:relative;z-index:2;padding:0 clamp(1.4rem,6vw,4.5rem) clamp(2.4rem,7vh,4rem);max-width:900px;color:#FBF7EF;}
.hero h1{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(2.6rem,8vw,5.4rem);line-height:.98;letter-spacing:-.03em;text-shadow:0 2px 30px rgba(0,0,0,.35);}
.hero .tag{margin-top:.9rem;font-size:clamp(1rem,2vw,1.2rem);max-width:520px;color:rgba(251,247,239,.9);}
.hero .badge{display:inline-flex;align-items:center;gap:.5rem;margin-top:1.2rem;background:rgba(232,160,32,.2);border:1px solid rgba(232,160,32,.55);border-radius:999px;padding:.4rem .9rem;font-size:.82rem;font-weight:600;color:#FBF7EF;backdrop-filter:blur(4px);}
.hero .eyebrow{color:var(--gold);text-shadow:0 1px 14px rgba(0,0,0,.6);}
.hero .tag{text-shadow:0 1px 16px rgba(0,0,0,.5);}
/* metin hero (marka renginde temiz kart — foto yoksa/iyi değilse) */
.hero.text{align-items:center;background:linear-gradient(152deg,var(--acc,#14212C) 0%,var(--acc2,#0A1219) 82%);}
.hero.text .in{text-align:center;max-width:860px;margin:0 auto;padding:0 clamp(1.4rem,6vw,4rem) clamp(2rem,7vh,4rem);}
.hero.text .hero-tex{position:absolute;inset:0;opacity:.05;background-image:radial-gradient(#fff 1px,transparent 1px);background-size:4px 4px;pointer-events:none;}
.hero.text .hero-frame{position:absolute;inset:clamp(14px,2.4vw,26px);border:1px solid rgba(232,160,32,.32);border-radius:12px;pointer-events:none;}
.hero.text h1{text-shadow:none;}
.hero.text .tag{text-shadow:none;margin-left:auto;margin-right:auto;}
.hero.text #heroCta{justify-content:center;}
.hero.text .badge{background:rgba(9,11,15,.34);border-color:rgba(232,160,32,.55);}
/* banner hero (yemek fotosu + marka rengi duotone — zengin) */
.hero.banner{align-items:center;}
.hero.banner .duo{position:absolute;inset:0;background:linear-gradient(155deg,var(--acc,#8E2420) 0%,var(--acc2,#3A0E0C) 92%);opacity:.8;mix-blend-mode:multiply;}
.hero.banner .ov{background:linear-gradient(180deg,rgba(6,10,14,.42),rgba(6,10,14,.12) 42%,rgba(6,10,14,.66));}
.hero.banner .in{text-align:center;max-width:860px;margin:0 auto;padding:0 clamp(1.4rem,6vw,4rem) clamp(2rem,7vh,4rem);}
.hero.banner .hero-tex{position:absolute;inset:0;opacity:.05;background-image:radial-gradient(#fff 1px,transparent 1px);background-size:4px 4px;pointer-events:none;}
.hero.banner .hero-frame{position:absolute;inset:clamp(14px,2.4vw,26px);border:1px solid rgba(232,160,32,.42);border-radius:12px;pointer-events:none;}
.hero.banner .eyebrow{color:var(--gold);}
.hero.banner #heroCta{justify-content:center;}
.hero.banner .badge{background:rgba(9,11,15,.4);border-color:rgba(232,160,32,.6);}
/* SECTIONS */
.sec{padding:clamp(3rem,8vh,6.5rem) clamp(1.4rem,5vw,5rem);max-width:1180px;margin:0 auto;}
.about-p{max-width:660px;margin-top:1.1rem;color:var(--muted);font-size:1.06rem;line-height:1.75;}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:0 14px 40px -26px rgba(14,26,36,.4);}
/* MENU */
.menu-cat{margin-bottom:2.4rem;}
.menu-cat h3{font-family:'Fraunces',serif;font-size:clamp(1.3rem,3vw,1.7rem);color:var(--gold-d);margin-bottom:.8rem;}
.menu-item{display:flex;justify-content:space-between;gap:1rem;padding:.8rem 0;border-bottom:1px solid var(--line);}
.menu-item .mi-n{font-weight:600;}
.menu-item .mi-d{font-size:.86rem;color:var(--muted);margin-top:.15rem;line-height:1.5;max-width:80%;}
.menu-item .mi-p{white-space:nowrap;color:var(--gold-d);font-weight:600;}
.menu-grid{display:grid;grid-template-columns:1fr;gap:18px;}
@media(min-width:760px){.menu-grid{grid-template-columns:1fr 1fr;}}
.mcard{background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 14px 40px -28px rgba(14,26,36,.42);}
.mcard .ph{height:150px;background-size:cover;background-position:center;}
.mcard .bd{padding:1.1rem 1.3rem 1.4rem;}
.mcard h3{font-family:'Fraunces',serif;font-size:1.3rem;color:var(--gold-d);margin-bottom:.15rem;}
.mcard .cnt{font-size:.74rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:.8rem;}
.menu-cta{background:linear-gradient(135deg,#fff,#FBF3E4);border:1px solid var(--line);border-radius:20px;padding:clamp(2rem,5vw,3.2rem);text-align:center;box-shadow:0 14px 40px -28px rgba(14,26,36,.4);}
.menu-cta .mh{font-family:'Fraunces',serif;font-size:clamp(1.3rem,2.6vw,1.8rem);}
.menu-cta p{color:var(--muted);margin:.6rem auto 1.4rem;max-width:440px;}
.hours-wrap{display:grid;grid-template-columns:1fr;gap:20px;align-items:stretch;}
@media(min-width:760px){.hours-wrap{grid-template-columns:1.05fr .95fr;}}
.hours-photo{min-height:220px;border-radius:16px;background-size:cover;background-position:center;box-shadow:0 14px 38px -24px rgba(14,26,36,.5);}
/* GALLERY */
.gal{columns:2;column-gap:12px;}@media(min-width:800px){.gal{columns:3;}}
.gal img{width:100%;margin-bottom:12px;border-radius:12px;display:block;cursor:pointer;transition:transform .4s;box-shadow:0 8px 24px -18px rgba(14,26,36,.5);}
.gal img:hover{transform:scale(1.02);}
/* REVIEWS */
.rev{text-align:center;background:linear-gradient(180deg,#fff,#FBF3E4);border:1px solid var(--line);border-radius:20px;padding:clamp(2rem,5vw,3.2rem);}
.rev .q{font-family:'Fraunces',serif;font-style:italic;font-size:clamp(1.3rem,2.4vw,1.8rem);}
.hours-line{display:flex;justify-content:space-between;gap:1rem;padding:.6rem 0;border-bottom:1px solid var(--line);max-width:520px;}
.map{width:100%;height:360px;border:0;border-radius:16px;filter:saturate(1.05);}
/* RESERVE */
.reserve{background:linear-gradient(135deg,#0E1A24,#14212c);color:#FBF7EF;text-align:center;padding:clamp(3rem,8vh,5.5rem) 1.4rem;border-radius:0;}
.reserve .eyebrow{color:var(--gold);}
/* BUTTONS */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;font-size:.82rem;font-weight:600;letter-spacing:.02em;text-decoration:none;border-radius:999px;padding:.85rem 1.5rem;transition:transform .15s,filter .15s;cursor:pointer;border:0;}
.btn:hover{transform:translateY(-1px);}
.btn:active{transform:translateY(0);}
.btn-gold{background:linear-gradient(135deg,var(--gold),var(--gold-d));color:#22160a;box-shadow:0 10px 24px -12px rgba(232,160,32,.7);}
.btn-ink{background:var(--ink);color:#FBF7EF;}
.btn-ghost{border:1px solid rgba(251,247,239,.4);color:#FBF7EF;background:transparent;}
.btn-outline{border:1px solid var(--line);color:var(--ink);background:#fff;}
/* STICKY MOBILE ACTION BAR (phone-first) */
.dock{position:fixed;left:0;right:0;bottom:0;z-index:70;display:flex;gap:8px;padding:10px clamp(.7rem,3vw,1.2rem) calc(10px + env(safe-area-inset-bottom));background:rgba(250,246,239,.95);backdrop-filter:blur(12px);border-top:1px solid var(--line);}
.dock a{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-decoration:none;font-size:.66rem;font-weight:600;letter-spacing:.02em;padding:.5rem .3rem;border-radius:12px;color:var(--ink);}
.dock a svg{width:20px;height:20px;}
.dock a.d-wa{background:#25D366;color:#fff;}
.dock a.d-call{background:var(--ink);color:#FBF7EF;}
.dock a.d-dir{background:#fff;border:1px solid var(--line);}
@media(min-width:860px){.dock{display:none;}body{padding-bottom:0;}}
footer{background:#F1E9DA;padding:2.4rem clamp(1.4rem,5vw,5rem);display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;align-items:center;border-top:1px solid var(--line);}
footer a{color:var(--gold-d);text-decoration:none;}
.lb{position:fixed;inset:0;z-index:90;background:rgba(14,26,36,.92);display:none;align-items:center;justify-content:center;padding:2rem;cursor:zoom-out;}
.lb.on{display:flex;}.lb img{max-width:94vw;max-height:90vh;border-radius:10px;}
[data-hide]{display:none;}
</style></head>
<body>
<nav id="nav">
  <a class="wm" href="#">${esc(name)}</a>
  <div class="langs" id="langs">${langPills}</div>
  <a class="btn btn-gold nav-res" href="#reserve" data-i="reserve" style="padding:.6rem 1.2rem;font-size:.76rem;">${I18N.tr.reserve}</a>
</nav>

${heroBlock}

<section class="sec" id="about">
  <div class="eyebrow reveal" data-i="about">${I18N.tr.about}</div><div class="gline reveal"></div>
  <h2 class="title reveal" id="aboutTitle"></h2>
  <div id="aboutBody" class="reveal"></div>
</section>

<section class="sec" id="menu" style="padding-top:0;">
  <div class="eyebrow reveal" data-i="menu">${I18N.tr.menu}</div><div class="gline reveal"></div>
  <h2 class="title reveal" id="menuTitle" style="margin-bottom:1.8rem;"></h2>
  <div id="menuBody" class="reveal"></div>
</section>

<section class="sec" id="gallery" style="padding-top:0;">
  <div class="eyebrow reveal" data-i="gallery">${I18N.tr.gallery}</div><div class="gline reveal"></div>
  <div class="gal reveal">
    ${gallery.map((p) => `<img src="${p}" alt="${esc(name)}" loading="lazy" onclick="lb('${p}')"/>`).join('\n    ')}
  </div>
</section>

${v.rating ? `<section class="sec" style="padding-top:0;"><div class="rev reveal">
  <p class="q" id="revQuote"></p>
  <p style="margin:.6rem 0 1.6rem;color:var(--muted);letter-spacing:.04em;">${esc(ratingLine)} · Google</p>
  <a class="btn btn-outline" id="revLink" href="https://www.google.com/maps/search/?api=1&query=${mapsQ}" target="_blank" rel="noopener"></a>
</div></section>` : ''}

<section class="sec" id="hours" style="padding-top:0;">
  <div class="eyebrow reveal" data-i="hours">${I18N.tr.hours}</div><div class="gline reveal"></div>
  <div class="hours-wrap reveal"><div id="hoursBody"></div><div class="hours-photo" id="hoursPhoto"></div></div>
</section>

<section class="sec" id="location">
  <div class="eyebrow reveal" data-i="findUs">${I18N.tr.findUs}</div><div class="gline reveal"></div>
  <p class="reveal" style="color:var(--muted);margin-bottom:1.3rem;">${esc(loc)}</p>
  <iframe class="map reveal" loading="lazy" src="https://maps.google.com/maps?q=${mapsQ}&output=embed"></iframe>
</section>

<section class="reserve" id="reserve">
  <div class="eyebrow reveal" data-i="reserveEye">${I18N.tr.reserveEye}</div>
  <h2 class="title reveal" id="reserveTitle" style="margin:.6rem 0 1.5rem;"></h2>
  <div class="reveal" id="reserveCta" style="display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap;"></div>
</section>

<footer>
  <div><div class="serif" style="font-weight:700;">${esc(name)}</div>
    <div style="font-size:.82rem;color:var(--muted);margin-top:.2rem;">${esc(loc)}</div></div>
  <div style="font-size:.8rem;color:var(--muted);">
    <a href="admin.html" data-i="admin">${I18N.tr.admin}</a> · <span data-i="by">${I18N.tr.by}</span> <a href="https://kalkaninfo.com" target="_blank" rel="noopener">Kalkan Info</a>
  </div>
</footer>

<div class="dock" id="dock"></div>
<div class="lb" id="lb" onclick="this.classList.remove('on')"><img id="lbi" src=""/></div>

<script>
window.__I18N__ = ${JSON.stringify(I18N)};
window.__CI18N__ = ${JSON.stringify(ci18n)};
window.__MENUHINT__ = ${JSON.stringify(MENU_HINT)};
window.__GALLERY__ = ${JSON.stringify(gallery)};
window.__CAT__ = ${JSON.stringify(catWord)};
window.__MAPSQ__ = ${JSON.stringify(mapsQ)};
window.__VENUE_SLUG__ = ${JSON.stringify(slug)};
window.__VENUE_NAME__ = ${JSON.stringify(name)};
window.__VENUE_BAKED__ = ${JSON.stringify(content)};
window.__VENUE_PHONE_DISPLAY__ = ${JSON.stringify(v.phone || '')};
</script>
<script type="module">
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/js/supabase-config.js';
import { createClient } from '/vendor/supabase.mjs';
const E=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=(id)=>document.getElementById(id);
let LANG='tr', BAKED=window.__VENUE_BAKED__, CI=window.__CI18N__;

function labels(){return window.__I18N__[LANG]||window.__I18N__.tr;}
function applyLabels(){
  const t=labels();
  document.querySelectorAll('[data-i]').forEach(el=>{const k=el.getAttribute('data-i'); if(t[k]!=null) el.textContent=t[k];});
  const aT=$('aboutTitle'); if(aT) aT.textContent=t.aboutTitle.replace('{cat}',window.__CAT__);
  const mT=$('menuTitle'); if(mT) mT.textContent=t.menuTitle;
  const rQ=$('revQuote'); if(rQ) rQ.textContent=t.reviewsQuote;
  const rL=$('revLink'); if(rL) rL.textContent=t.readReviews+' →';
  const rT=$('reserveTitle'); if(rT) rT.textContent=t.reserveTitle;
  document.documentElement.lang=LANG;
}
function content(){ // aktif dildeki mekan içeriği + admin (baked) verisi
  const c=(CI&&CI[LANG])||{}; return { ...BAKED, tagline:c.tagline!=null?c.tagline:BAKED.tagline, about:(c.about&&c.about.length)?c.about:BAKED.about };
}
function render(){
  const t=labels(), c=content();
  const phone=window.__VENUE_PHONE_DISPLAY__||c.phone||'';
  const waDigits=(c.whatsapp||(phone||'').replace(/[^\\d]/g,''))||'';
  const wa=waDigits?'https://wa.me/'+waDigits:'';
  const tel=(phone||'').replace(/[^\\d]/g,'')?'tel:+'+(phone||'').replace(/[^\\d]/g,''):'';
  const dir='https://www.google.com/maps/search/?api=1&query='+window.__MAPSQ__;
  $('heroTagline').textContent=c.tagline||'';
  $('aboutBody').innerHTML=(c.about||[]).map(p=>'<p class="about-p">'+E(p)+'</p>').join('');
  const G=window.__GALLERY__||[];
  const menu=(BAKED.menu||[]).filter(m=>m&&(m.cat||(m.items&&m.items.length)));
  $('menu').style.display='';
  if(menu.length){
    $('menuBody').innerHTML='<div class="menu-grid">'+menu.map((m,i)=>
      '<div class="mcard">'+(G.length?'<div class="ph" style="background-image:url('+G[i%G.length]+')"></div>':'')+
      '<div class="bd"><h3>'+E(m.cat)+'</h3><div class="cnt">'+(((m.items&&m.items.length)||0))+' '+E(t.menu)+'</div>'+
      (m.items||[]).map(it=>'<div class="menu-item"><div><div class="mi-n">'+E(it.name)+'</div>'+(it.desc?'<div class="mi-d">'+E(it.desc)+'</div>':'')+'</div>'+(it.price?'<div class="mi-p">'+E(it.price)+'</div>':'')+'</div>').join('')+
      '</div></div>').join('')+'</div>';
  } else {
    const mh=(window.__MENUHINT__&&window.__MENUHINT__[LANG])||'';
    $('menuBody').innerHTML='<div class="menu-cta"><div class="mh">'+E(window.__VENUE_NAME__)+'</div><p>'+E(mh)+'</p>'+(wa?'<a class="btn btn-gold" href="'+wa+'" target="_blank" rel="noopener">'+E(t.wa)+'</a>':(tel?'<a class="btn btn-outline" href="'+tel+'">'+E(t.call)+'</a>':''))+'</div>';
  }
  const h=BAKED.hours; let hh='';
  if(Array.isArray(h)&&h.length) hh=h.map(x=>'<div class="hours-line"><span>'+E(x.d||x.day||'')+'</span><span style="color:var(--gold-d)">'+E(x.h||x.hours||'')+'</span></div>').join('');
  else if(typeof h==='string'&&h.trim()) hh='<p class="about-p" style="margin-top:0">'+E(h)+'</p>';
  $('hours').style.display=hh?'':'none'; $('hoursBody').innerHTML=hh;
  const hp=$('hoursPhoto'); if(hp){ if(hh&&G.length){ hp.style.backgroundImage="url('"+(G[1]||G[0])+"')"; hp.style.display=''; } else hp.style.display='none'; }
  // CTA'lar
  $('heroCta').innerHTML=(wa?'<a class="btn btn-gold" href="'+wa+'" target="_blank" rel="noopener">'+E(t.waReserve)+'</a>':'')+(tel?'<a class="btn btn-ghost" href="'+tel+'">'+E(t.call)+'</a>':'');
  $('reserveCta').innerHTML=(wa?'<a class="btn btn-gold" href="'+wa+'" target="_blank" rel="noopener">WhatsApp · '+E(phone)+'</a>':'')+(tel?'<a class="btn btn-ghost" href="'+tel+'">'+E(t.call)+'</a>':'');
  // yapışkan mobil bar
  $('dock').innerHTML=(tel?'<a class="d-call" href="'+tel+'"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11 11 0 003.5.56 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11 11 0 00.56 3.5 1 1 0 01-.24 1z"/></svg>'+E(t.call)+'</a>':'')+
    (wa?'<a class="d-wa" href="'+wa+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.5 15.3L2 22l4.9-1.4A10 10 0 1012 2z"/></svg>'+E(t.wa)+'</a>':'')+
    '<a class="d-dir" href="'+dir+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"/></svg>'+E(t.directions)+'</a>';
}
function setLang(l){ LANG=l; document.querySelectorAll('.lp').forEach(b=>b.setAttribute('aria-current', b.dataset.lang===l?'true':'false')); applyLabels(); render(); }

document.getElementById('langs').addEventListener('click',e=>{const b=e.target.closest('.lp'); if(b) setLang(b.dataset.lang);});
applyLabels(); render();

// venue_sites canlı içerik (admin düzenlemeleri) — baked'in üzerine
(async()=>{ try{
  const sb=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false}});
  const {data}=await sb.from('venue_sites').select('content,published').eq('slug',window.__VENUE_SLUG__).eq('published',true).maybeSingle();
  if(data&&data.content&&Object.keys(data.content).length){ BAKED={...BAKED,...data.content}; render(); }
}catch(e){} })();

// nav solid + parallax + reveal + lightbox
const nav=$('nav');
addEventListener('scroll',()=>{nav.classList.toggle('solid',scrollY>60);const bg=$('heroBg');if(bg)bg.style.transform='translateY('+(scrollY*0.22)+'px)';});
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('vis');io.unobserve(e.target);}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
window.lb=(src)=>{$('lbi').src=src;$('lb').classList.add('on');};
</script>
</body></html>`;
}

// ADMİN PANELİ (açık tema) — sahip girişi → içerik düzenle → venue_sites upsert
function adminHtml(v, content) {
  const name = v.name.replace(/\s*[·|].*$/, '').trim();
  const slug = v.slug || v.id;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Yönetici · ${esc(name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#FAF6EF;--ink:#0E1A24;--muted:#5a6570;--gold:#E8A020;--gold-d:#C8801A;--card:#fff;--line:rgba(14,26,36,.12);}
*{box-sizing:border-box;margin:0;}
body{background:var(--bg);color:var(--ink);font-family:'Inter',system-ui,sans-serif;line-height:1.5;}
.wrap{max-width:820px;margin:0 auto;padding:2rem 1.2rem 5rem;}
h1{font-size:1.4rem;letter-spacing:-.01em;}
.muted{color:var(--muted);font-size:.9rem;}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.4rem;margin-top:1.2rem;box-shadow:0 12px 34px -24px rgba(14,26,36,.4);}
label{display:block;font-size:.78rem;letter-spacing:.05em;text-transform:uppercase;color:var(--gold-d);font-weight:600;margin:.9rem 0 .35rem;}
input,textarea{width:100%;background:#fff;border:1px solid var(--line);border-radius:9px;color:var(--ink);padding:.7rem .85rem;font:inherit;}
input:focus,textarea:focus{outline:none;border-color:var(--gold);}
textarea{resize:vertical;min-height:70px;}
.btn{display:inline-flex;align-items:center;gap:.5rem;border:0;border-radius:999px;padding:.75rem 1.4rem;font:inherit;font-weight:600;cursor:pointer;transition:transform .12s;}
.btn:hover{transform:translateY(-1px);}
.btn-gold{background:linear-gradient(135deg,var(--gold),var(--gold-d));color:#22160a;}
.btn-ghost{background:#fff;border:1px solid var(--line);color:var(--ink);}
.btn-sm{padding:.45rem .9rem;font-size:.82rem;}
.row{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;}
.mi{display:grid;grid-template-columns:1.4fr .7fr 2fr auto;gap:.5rem;margin-bottom:.5rem;}
.cat-block{border:1px dashed var(--line);border-radius:10px;padding:.9rem;margin-bottom:1rem;}
.cat-head{display:flex;gap:.6rem;align-items:center;margin-bottom:.7rem;}
.cat-head input{font-weight:700;}
.hidden{display:none;}
#toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--gold);color:#22160a;padding:.7rem 1.3rem;border-radius:10px;font-weight:600;opacity:0;transition:opacity .3s;pointer-events:none;}
#toast.on{opacity:1;}
a{color:var(--gold-d);}
@media(max-width:640px){.mi{grid-template-columns:1fr 1fr;}}
</style></head>
<body>
<div class="wrap">
  <div class="row" style="justify-content:space-between;">
    <div><h1>${esc(name)} — Yönetim</h1><div class="muted">Kalkan Info · mini-CMS</div></div>
    <a class="btn btn-ghost btn-sm" href="index.html" target="_blank">Siteyi gör ↗</a>
  </div>
  <div class="card" id="loginCard">
    <label>E-posta</label><input id="email" type="email" autocomplete="username" placeholder="ornek@mail.com"/>
    <label>Şifre</label><input id="pwd" type="password" autocomplete="current-password"/>
    <div class="row" style="margin-top:1rem;"><button class="btn btn-gold" id="loginBtn">Giriş</button><span class="muted" id="loginMsg"></span></div>
    <p class="muted" style="margin-top:.8rem;">Giriş bilgileriniz Kalkan Info tarafından verilir.</p>
  </div>
  <div id="editor" class="hidden">
    <div class="card"><div class="row" style="justify-content:space-between;"><span class="muted">Giriş: <b id="who"></b></span><button class="btn btn-ghost btn-sm" id="logoutBtn">Çıkış</button></div></div>
    <div class="card">
      <label>Slogan (hero altı)</label><input id="f_tagline" placeholder="Kısa çarpıcı bir cümle"/>
      <label>Hakkında (her paragraf ayrı satır)</label><textarea id="f_about" style="min-height:120px" placeholder="İşletmenizi anlatın..."></textarea>
      <label>Çalışma Saatleri</label><input id="f_hours" placeholder="Her gün 09:00–23:00"/>
      <div class="row"><div style="flex:1;min-width:180px"><label>Telefon</label><input id="f_phone" placeholder="+90 5xx xxx xx xx"/></div><div style="flex:1;min-width:180px"><label>WhatsApp (sadece rakam)</label><input id="f_whatsapp" placeholder="905xxxxxxxxx"/></div></div>
      <label>Instagram</label><input id="f_instagram" placeholder="https://instagram.com/..."/>
    </div>
    <div class="card"><div class="row" style="justify-content:space-between;"><label style="margin:0">Menü</label><button class="btn btn-ghost btn-sm" id="addCat">+ Kategori</button></div><div id="menuEditor" style="margin-top:1rem;"></div></div>
    <div class="row" style="margin-top:1.4rem;"><button class="btn btn-gold" id="saveBtn">Kaydet ve Yayınla</button><span class="muted" id="saveMsg"></span></div>
  </div>
</div>
<div id="toast"></div>
<script type="module">
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/js/supabase-config.js';
import { createClient } from '/vendor/supabase.mjs';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{ persistSession:true, autoRefreshToken:true } });
const SLUG=${JSON.stringify(slug)}, NAME=${JSON.stringify(name)}, BAKED=${JSON.stringify(content)};
const $=(id)=>document.getElementById(id);
const toast=(m)=>{const t=$('toast');t.textContent=m;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),2200);};
function catBlock(cat){const el=document.createElement('div');el.className='cat-block';
  el.innerHTML='<div class="cat-head"><input class="c-name" placeholder="Kategori adı" value="'+(cat.cat||'').replace(/"/g,'&quot;')+'"/><button class="btn btn-ghost btn-sm c-add">+ Ürün</button><button class="btn btn-ghost btn-sm c-del">Sil</button></div><div class="items"></div>';
  const items=el.querySelector('.items');(cat.items||[]).forEach(it=>items.appendChild(itemRow(it)));
  el.querySelector('.c-add').onclick=()=>items.appendChild(itemRow({}));el.querySelector('.c-del').onclick=()=>el.remove();return el;}
function itemRow(it){const r=document.createElement('div');r.className='mi';
  r.innerHTML='<input class="i-name" placeholder="Ürün" value="'+(it.name||'').replace(/"/g,'&quot;')+'"/><input class="i-price" placeholder="Fiyat" value="'+(it.price||'').replace(/"/g,'&quot;')+'"/><input class="i-desc" placeholder="Açıklama" value="'+(it.desc||'').replace(/"/g,'&quot;')+'"/><button class="btn btn-ghost btn-sm i-del">×</button>';
  r.querySelector('.i-del').onclick=()=>r.remove();return r;}
function readMenu(){return [...$('menuEditor').querySelectorAll('.cat-block')].map(b=>({cat:b.querySelector('.c-name').value.trim(),items:[...b.querySelectorAll('.mi')].map(r=>({name:r.querySelector('.i-name').value.trim(),price:r.querySelector('.i-price').value.trim(),desc:r.querySelector('.i-desc').value.trim()})).filter(i=>i.name)})).filter(c=>c.cat||c.items.length);}
function fill(c){$('f_tagline').value=c.tagline||'';$('f_about').value=(c.about||[]).join('\\n');$('f_hours').value=typeof c.hours==='string'?c.hours:(Array.isArray(c.hours)?c.hours.map(x=>(x.d||'')+' '+(x.h||'')).join('; '):'');$('f_phone').value=c.phone||'';$('f_whatsapp').value=c.whatsapp||'';$('f_instagram').value=c.instagram||'';const me=$('menuEditor');me.innerHTML='';(c.menu||[]).forEach(cat=>me.appendChild(catBlock(cat)));}
function collect(){return {tagline:$('f_tagline').value.trim(),about:$('f_about').value.split('\\n').map(s=>s.trim()).filter(Boolean),hours:$('f_hours').value.trim(),phone:$('f_phone').value.trim(),whatsapp:$('f_whatsapp').value.replace(/[^\\d]/g,''),instagram:$('f_instagram').value.trim(),menu:readMenu()};}
$('addCat').onclick=()=>$('menuEditor').appendChild(catBlock({cat:'',items:[{}]}));
async function showEditor(user){$('loginCard').classList.add('hidden');$('editor').classList.remove('hidden');$('who').textContent=user.email;const {data}=await sb.from('venue_sites').select('content').eq('slug',SLUG).maybeSingle();fill(data&&data.content&&Object.keys(data.content).length?{...BAKED,...data.content}:BAKED);}
function showLogin(){$('editor').classList.add('hidden');$('loginCard').classList.remove('hidden');}
$('loginBtn').onclick=async()=>{const email=$('email').value.trim(),password=$('pwd').value;$('loginMsg').textContent='...';const {data,error}=await sb.auth.signInWithPassword({email,password});if(error){$('loginMsg').textContent='Giriş başarısız: '+error.message;return;}$('loginMsg').textContent='';showEditor(data.user);};
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();showLogin();};
$('saveBtn').onclick=async()=>{const {data:{user}}=await sb.auth.getUser();if(!user){toast('Oturum yok, tekrar giriş yapın');showLogin();return;}$('saveMsg').textContent='Kaydediliyor...';const content=collect();const {error}=await sb.from('venue_sites').upsert({slug:SLUG,name:NAME,owner_id:user.id,content,published:true,updated_at:new Date().toISOString()},{onConflict:'slug'});if(error){$('saveMsg').textContent='Hata: '+error.message;toast('Kaydedilemedi');return;}$('saveMsg').textContent='✓ Yayınlandı';toast('Kaydedildi ve yayınlandı');};
(async()=>{const {data:{session}}=await sb.auth.getSession();if(session&&session.user)showEditor(session.user);else showLogin();})();
</script>
</body></html>`;
}

async function build(v, useLLM) {
  const photos = realPhotos(v);
  if (!photos.length) { console.error('✗ gerçek fotoğraf yok:', v.name); return false; }
  const content = toContent(v);
  const ci18n = await buildContentI18n(v, content, useLLM);
  const slug = v.slug || v.id;
  const dir = join(ROOT, 'demo', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), siteHtml(v, photos, content, ci18n), 'utf8');
  writeFileSync(join(dir, 'admin.html'), adminHtml(v, content), 'utf8');
  const mc = content.menu.reduce((n, c) => n + c.items.length, 0);
  console.log(`✓ ${v.name}`);
  console.log(`  demo/${slug}/index.html + admin.html  ·  5 dil · açık tema · mobil dock`);
  console.log(`  ${v.rating || '?'}★ · ${photos.length} foto · ${content.menu.length} menü kat / ${mc} ürün · tel:${v.phone || 'yok'}`);
  return true;
}

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

const EXAMPLES = ['zeugma-restorant', 'the-view-terrace-restaurant', 'olala', 'luna'];

async function main() {
  const args = process.argv.slice(2);
  const useLLM = args.includes('--translate');
  if (args.includes('--all-examples')) {
    let ok = 0;
    for (const q of EXAMPLES) { const v = findVenue(q); if (v && await build(v, useLLM)) ok++; else console.error('✗ atlandı:', q); }
    console.log(`\n${ok}/${EXAMPLES.length} örnek üretildi.`);
    return;
  }
  if (args.includes('--all-demos')) {
    const { readdirSync } = await import('node:fs');
    const slugs = readdirSync(join(ROOT, 'demo'), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(ROOT, 'demo', d.name, 'index.html'))).map((d) => d.name).filter((s) => !['ciku', 'assets'].includes(s) && !s.startsWith('_'));
    let ok = 0;
    for (const s of slugs) { const v = findVenue(s); if (v && await build(v, useLLM)) ok++; else console.error('✗ atlandı (veri yok):', s); }
    console.log(`\n${ok}/${slugs.length} demo yenilendi.`);
    return;
  }
  const leadIdx = args.includes('--lead') ? parseInt(args[args.indexOf('--lead') + 1], 10) : null;
  const arg = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
  const v = findVenue(arg, leadIdx);
  if (!v) { console.error('✗ işletme bulunamadı:', arg || `lead ${leadIdx}`); process.exit(1); }
  if (!(await build(v, useLLM))) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
