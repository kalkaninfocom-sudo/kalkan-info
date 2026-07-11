// ─── Background-image placeholder gizleme ────────────────────────────────────
document.querySelectorAll('[style*="background-image:url(\'assets"]').forEach(el => {
  const m = (el.getAttribute('style') || '').match(/url\('([^']+)'\)/);
  if (!m) return;
  const img = new Image();
  img.onload = () => el.classList.add('img-loaded');
  img.src = m[1];
});

// ─── Mobil menü aç/kapat ─────────────────────────────────────────────────────
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  navLinks.querySelectorAll('a').forEach(link =>
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    })
  );
}

// ─── Header scroll gölgesi ───────────────────────────────────────────────────
const siteHeader = document.getElementById('siteHeader');
if (siteHeader) {
  window.addEventListener('scroll', () =>
    siteHeader.classList.toggle('scrolled', window.scrollY > 40), { passive: true });
}

// ─── Scroll-reveal ───────────────────────────────────────────────────────────
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  revealEls.forEach(el => io.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('in-view'));
}

// ─── QR kod ──────────────────────────────────────────────────────────────────
const qrContainer = document.getElementById('qrcode');
if (qrContainer && window.QRCode) {
  new QRCode(qrContainer, {
    text: new URL('menu.html', window.location.href).href,
    width: 128, height: 128,
    colorDark: '#111111', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

// ─── Ayarlar: sunucudan çek, sayfayı dinamik doldur ──────────────────────────
let _settings = {};
async function fetchSettings() {
  try { _settings = await fetch('/api/settings').then(r => r.json()); }
  catch (e) { _settings = (typeof SETTINGS !== 'undefined') ? SETTINGS : {}; }
}
function renderSettings() {
  const s = _settings;
  // Hero tagline
  const tagEl = document.querySelector('.hero-tagline');
  if (tagEl && s.hero_tagline) tagEl.textContent = TC(s.hero_tagline);
  // Alıntı (blockquote)
  const quoteEl = document.querySelector('.about-quote');
  if (quoteEl && s.about_quote) quoteEl.textContent = `"${TC(s.about_quote)}"`;
  // About text
  const aboutPs = document.querySelectorAll('.about-text p:not(.eyebrow):not(.signature)');
  if (aboutPs[0] && s.about_text)  aboutPs[0].textContent = TC(s.about_text);
  if (aboutPs[1] && s.about_text2) aboutPs[1].textContent = TC(s.about_text2);
  // Çalışma saatleri — hero badge + iletişim kartı + footer
  if (s.hours_open && s.hours_close) {
    document.querySelectorAll('.js-hours').forEach(el => {
      el.textContent = `${s.hours_open}–${s.hours_close}`;
    });
  }
  // Phone links — href ve görünen metin
  if (s.phone) {
    const phoneClean = s.phone.replace(/\s/g, '');
    const phoneDisplay = s.phone.startsWith('+90') ? '0' + s.phone.slice(3).trim() : s.phone;
    document.querySelectorAll('a[href^="tel:"]').forEach(a => {
      a.href = 'tel:' + phoneClean;
      if (/^[\d\s\+\-\(\)]+$/.test(a.textContent.trim())) a.textContent = phoneDisplay;
    });
    const fab = document.getElementById('fabCall');
    if (fab) fab.setAttribute('aria-label', T('call_now') + ': ' + phoneDisplay);
  }
  // Instagram links
  if (s.instagram) {
    document.querySelectorAll('a[href*="instagram.com/"]').forEach(a => {
      a.href = `https://instagram.com/${s.instagram}`;
      if (a.textContent.startsWith('@')) a.textContent = '@' + s.instagram;
    });
  }
  // Maps
  if (s.maps_dir_url) {
    document.querySelectorAll('a[href*="google.com/maps/dir"]').forEach(a => a.href = s.maps_dir_url);
  }
  if (s.maps_embed) {
    const iframe = document.querySelector('.map-frame iframe');
    if (iframe) iframe.src = s.maps_embed;
  }
  // Rating — hero rozeti ve yorum özeti
  if (s.google_rating && s.google_review_count) {
    const val = `${s.google_rating}/5 · ${s.google_review_count}`;
    const heroRating = document.getElementById('heroRatingValue');
    if (heroRating) heroRating.textContent = val;
    const summaryRating = document.getElementById('ratingSummaryValue');
    if (summaryRating) summaryRating.textContent = val;
  }
  // Adres
  const addrText = TC(s.address || 'Kalkan, Kaş / Antalya');
  const contactAddress = document.getElementById('contactAddress');
  if (contactAddress) contactAddress.textContent = addrText;
}
async function applySettings() {
  await fetchSettings();
  renderSettings();
}

// ─── Menü kategorileri: sunucudan çek, dinamik kartlar oluştur ──────────────
let _categories = [];
let _openCat = null;
async function fetchMenu() {
  try {
    const data = await fetch('/api/menu').then(r => r.json());
    _categories = data.categories || [];
  } catch (e) {
    if (typeof MENU_DATA !== 'undefined') _categories = MENU_DATA.categories || [];
  }
}
function renderAccordionFor(catId) {
  const accordion = document.getElementById('priceAccordion');
  if (!accordion) return;
  const cat = _categories.find(c => c.id === catId);
  if (!cat) { accordion.innerHTML = ''; return; }
  const rows = (cat.items || []).map(item => `
    <div class="p-row">
      <div class="p-name">${TC(item.name)}${item.desc ? `<small>${TC(item.desc)}</small>` : ''}</div>
      <div class="p-price">${item.price ? '₺' + item.price : '—'}</div>
    </div>
  `).join('');
  accordion.innerHTML = `<h4>${TC(cat.name)}</h4>${rows}`;
}
function renderMenuTiles() {
  const grid = document.getElementById('menuTiles');
  const accordion = document.getElementById('priceAccordion');
  if (!grid || !accordion || !_categories.length) return;

  grid.innerHTML = '';
  _categories.forEach(cat => {
    const imgSrc = `assets/images/kategoriler/${cat.id}.jpg`;
    const card = document.createElement('div');
    card.className = 'cat-card' + (cat.id === _openCat ? ' active' : '');
    card.dataset.cat = cat.id;
    card.innerHTML = `
      <div class="cat-img" style="background-image:url('${imgSrc}')" role="img" aria-label="${TC(cat.name)}">
        <div class="img-ph-label">${cat.id}.jpg</div>
      </div>
      <div class="cat-label">
        <h3></h3>
        <span class="cat-hint"></span>
      </div>`;
    card.querySelector('h3').textContent = TC(cat.name);
    card.querySelector('.cat-hint').textContent = T('price_list_arrow');
    // Görsel yüklenince placeholder gizle
    const img = new Image(); img.onload = () => card.classList.add('img-loaded'); img.src = imgSrc;
    grid.appendChild(card);
  });

  renderAccordionFor(_openCat);
  accordion.classList.toggle('open', !!_openCat);
}
function bindMenuTileEvents() {
  const grid = document.getElementById('menuTiles');
  const accordion = document.getElementById('priceAccordion');
  if (!grid || !accordion) return;
  grid.addEventListener('click', e => {
    const tile = e.target.closest('.cat-card');
    if (!tile) return;
    const catId = tile.dataset.cat;
    const allTiles = grid.querySelectorAll('.cat-card');
    if (_openCat === catId) {
      accordion.classList.remove('open');
      allTiles.forEach(t => t.classList.remove('active'));
      _openCat = null;
      return;
    }
    allTiles.forEach(t => t.classList.remove('active'));
    tile.classList.add('active');
    renderAccordionFor(catId);
    accordion.classList.add('open');
    _openCat = catId;
  });
}
async function initMenuTiles() {
  await fetchMenu();
  if (!_categories.length) return;
  _openCat = _categories[0].id;
  bindMenuTileEvents();
  renderMenuTiles();
}

// ─── Yorumlar: sunucudan çek, carousel oluştur ──────────────────────────────
let _reviews = [];
let _revCurrent = 0;
let _revTimer = null;
async function fetchReviews() {
  try {
    const data = await fetch('/api/reviews').then(r => r.json());
    _reviews = data.reviews || [];
  } catch (e) {
    if (typeof REVIEWS_DATA !== 'undefined') _reviews = REVIEWS_DATA.reviews || [];
  }
}
const SOURCE_COLORS = { google: '#4285F4', tripadvisor: '#34E0A1', diger: '#D4952A' };
function updateReviewTrack() {
  const track = document.getElementById('carouselTrack');
  const dotsWrap = document.getElementById('carouselDots');
  if (!track) return;
  track.style.transform = `translateX(-${_revCurrent * 100}%)`;
  if (dotsWrap) dotsWrap.querySelectorAll('button').forEach((d, i) => d.classList.toggle('active', i === _revCurrent));
}
function goToReview(idx, user) {
  _revCurrent = (idx + _reviews.length) % _reviews.length;
  updateReviewTrack();
  if (user) restartReviewTimer();
}
function startReviewTimer() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced && _reviews.length > 1) _revTimer = setInterval(() => goToReview(_revCurrent + 1), 5500);
}
function stopReviewTimer() { clearInterval(_revTimer); }
function restartReviewTimer() { stopReviewTimer(); startReviewTimer(); }

function renderReviews() {
  const track = document.getElementById('carouselTrack');
  const dotsWrap = document.getElementById('carouselDots');
  if (!track || !dotsWrap || !_reviews.length) return;
  track.innerHTML = '';
  dotsWrap.innerHTML = '';

  _reviews.forEach(rev => {
    const slide = document.createElement('article');
    slide.className = 'testimonial';
    const stars = '★★★★★'.slice(0, Math.max(0, Math.min(5, rev.rating || 5)));
    const label = sourceLabel(rev.source);
    const color = SOURCE_COLORS[rev.source] || '#D4952A';
    const who = rev.author ? `${rev.author} · ${label}` : anonReviewLabel(rev.source);
    slide.innerHTML = `<div class="stars">${stars}</div><p></p><div class="who"><span class="src-dot" style="background:${color}"></span><span></span></div>`;
    slide.querySelector('p').textContent = TC(rev.text || '');
    slide.querySelector('.who span:last-child').textContent = who;
    track.appendChild(slide);
  });

  _reviews.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.setAttribute('aria-label', T('review_dot') + ' ' + (i + 1));
    if (i === _revCurrent) dot.classList.add('active');
    dot.addEventListener('click', () => goToReview(i, true));
    dotsWrap.appendChild(dot);
  });

  if (_revCurrent >= _reviews.length) _revCurrent = 0;
  updateReviewTrack();
}
function bindReviewEvents() {
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const carEl = document.getElementById('reviewCarousel');
  if (nextBtn) nextBtn.addEventListener('click', () => goToReview(_revCurrent + 1, true));
  if (prevBtn) prevBtn.addEventListener('click', () => goToReview(_revCurrent - 1, true));
  if (carEl) {
    carEl.addEventListener('mouseenter', stopReviewTimer);
    carEl.addEventListener('mouseleave', startReviewTimer);
    carEl.addEventListener('focusin', stopReviewTimer);
    carEl.addEventListener('focusout', startReviewTimer);
  }
}
async function initReviewCarousel() {
  const track = document.getElementById('carouselTrack');
  if (!track) return;
  await fetchReviews();
  if (!_reviews.length) return;
  bindReviewEvents();
  renderReviews();
  startReviewTimer();
}

// ─── Dil değişince tüm dinamik içerik yeniden çizilir ───────────────────────
window.addEventListener('langchange', () => {
  renderSettings();
  renderMenuTiles();
  renderReviews();
});

// ─── Başlat ───────────────────────────────────────────────────────────────────
applySettings();
initMenuTiles();
initReviewCarousel();
