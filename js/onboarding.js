/**
 * onboarding.js — Hizmet Ekle tek-scroll form (ES module)
 * Supabase port — Faz 2.5 / T2.10
 *
 * Default: tek scroll form (#ob-single)
 * Legacy:  ?wizard=legacy → 4-step wizard (rollback)
 *
 * Bağımlılıklar:
 *   js/auth.js             — requireAuth, isSupabaseConfigured
 *   js/supabase-client.js  — supabase client (DB + Storage)
 *   js/slug.js             — uniqueSlug
 */

import { supabase } from './supabase-client.js';
import { isSupabaseConfigured, requireAuth } from './auth.js';
import { uniqueSlug } from './slug.js';

// i18n — opsiyonel
let _t = (key) => key;
try {
  const i18nMod = await import('./i18n.js');
  _t = i18nMod.t ?? _t;
} catch { /* yok */ }

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------
const DRAFT_KEY_PREFIX = 'kalkan_onboarding_draft_';
const MAX_FILE_MB      = 5;
const MAX_GALLERY      = 8;
const STORAGE_BUCKET   = 'profiles';

const TYPE_LABELS = {
  restoran: { label: 'Restoran',         icon: '🍽️' },
  villa:    { label: 'Villa',            icon: '🏖️' },
  asci:     { label: 'Aşçı / Catering', icon: '👨‍🍳' },
  transfer: { label: 'Transfer',         icon: '🚐' },
  tur:      { label: 'Tur',             icon: '🚤' },
  hizmet:   { label: 'Diğer Hizmet',    icon: '🛠️' },
};

const CATEGORIES = {
  restoran: ['Fine Dining', 'Türk Mutfağı', 'Deniz Ürünleri', 'Dünya Mutfağı', 'Kahvaltı & Brunch', 'Kafe'],
  villa:    ['Lüks Villa', 'Standart Villa', 'Apart', 'Butik Otel'],
  asci:     ['Türk Mutfağı', 'Akdeniz', 'Dünya Mutfağı', 'Vejetaryen / Vegan', 'Özel Diyet'],
  transfer: ['Havalimanı Transfer', 'Şehir İçi', 'Günübirlik Tur', 'VIP'],
  tur:      ['Tekne Turu', 'Jeep Safari', 'Trekking', 'Dalış', 'Kültür Turu'],
  hizmet:   ['Temizlik', 'Tadilat', 'Çiçekçi', 'Çamaşırhane', 'Diğer'],
};

const DISTRICTS = ['Kalkan Merkez', 'Kaş', 'Kınık', 'Bezirgan', 'Islamlar', 'Diğer'];

const SPECIALTIES_ALL = [
  'Açık Hava', 'Deniz Manzarası', 'Çocuk Dostu', 'Evcil Hayvan Dostu',
  'Vejetaryen', 'Vegan', 'Helal', 'Canlı Müzik', 'Özel Etkinlik',
  'Havuzlu', 'Jakuzili', 'Doğa İçi', 'Tarihi', '7/24',
];

const LANGUAGES = ['TR', 'EN', 'DE', 'RU'];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  user: null,
  providerId: null,
  data: {
    type: '',
    name: '',
    logoFile: null,
    logoUrl: '',
    category: '',
    summary: '',
    description: '',
    foundedYear: '',
    phone: '',
    email: '',
    website: '',
    instagram: '',
    whatsapp: '',
    address: '',
    district: '',
    lat: null,
    lng: null,
    specialties: [],
    priceRange: '',
    hoursOpen: '',
    hoursClose: '',
    languages: [],
    coverFile: null,
    coverUrl: '',
    galleryFiles: [],
    galleryUrls: [],
    kvkk: false,
    menuItems: [],
  },
  errors: {},
  saving: false,
  // legacy wizard compat
  step: 1,
  totalSteps: 4,
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export async function init(rootSelector = '#onboarding-root') {
  const $root = document.querySelector(rootSelector);
  if (!$root) return;

  // ?wizard=legacy → eski 4-step flow
  const useLegacy = new URLSearchParams(window.location.search).get('wizard') === 'legacy';

  let user = null;
  if (!isSupabaseConfigured) {
    user = null;
  } else {
    try {
      const { data: { session } } = await Promise.race([
        supabase.auth.getSession(),
        new Promise((resolve) => setTimeout(() => resolve({ data: { session: null } }), 4000)),
      ]);
      user = session?.user || null;
    } catch {
      user = null;
    }
  }

  // Loading overlay kaldır
  const _overlay = document.getElementById('page-loading');
  if (_overlay) {
    _overlay.style.opacity = '0';
    setTimeout(() => _overlay.remove(), 300);
  }

  if (!user) {
    _renderLanding($root);
    return;
  }

  if (!user.email_confirmed_at) {
    state.user = user;
    _renderEmailVerification($root);
    return;
  }

  state.user = user;
  _loadDraft();

  if (useLegacy) {
    _renderLegacyWizard($root);
  } else {
    _renderSingleForm($root);
  }
}

// ---------------------------------------------------------------------------
// Landing ekranı
// ---------------------------------------------------------------------------
function _renderLanding($root) {
  $root.innerHTML = `
<div class="max-w-xl mx-auto">
  <div class="bg-white rounded-2xl shadow-card overflow-hidden">
    <div class="bg-gradient-to-r from-sea-800 to-sea-700 px-8 py-7 text-white">
      <div class="w-12 h-12 rounded-xl bg-sun-400/20 flex items-center justify-center mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f4b53d" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <h1 class="font-display font-bold text-xl leading-snug">
        İşletmenizi Kalkan Info'ya Eklemek<br />İçin Önce Üye Olun
      </h1>
      <p class="text-sea-200 text-sm mt-2">Kalkan'ın en kapsamlı rehberine işletmenizi ekleyin.</p>
    </div>
    <div class="px-8 py-6 space-y-3 border-b border-sea-100">
      ${[
        ['Ücretsiz kayıt', 'kredi kartı gerekmez, sözleşme yok'],
        ['24-48 saat onay', 'admin inceleme sonrası profiliniz yayına alınır'],
        ['Müşteri yorumları + WhatsApp Concierge', 'entegrasyonu ile daha fazla müşteri'],
      ].map(([b, s]) => `
      <div class="flex items-start gap-3">
        <span class="w-6 h-6 rounded-full bg-sea-100 text-sea-700 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <span class="text-sea-700 text-sm"><strong class="text-sea-800">${b}</strong> — ${s}</span>
      </div>`).join('')}
    </div>
    <div class="px-8 py-6 space-y-3">
      <a href="register.html?return=hizmet-ekle.html"
        class="flex items-center justify-center gap-2 w-full bg-sun-400 hover:bg-sun-500 text-sea-900 font-display font-bold text-sm px-6 py-3.5 rounded-xl transition shadow-deep active:scale-95">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        Ücretsiz Kayıt Ol
      </a>
      <a href="login.html?return=hizmet-ekle.html"
        class="flex items-center justify-center gap-2 w-full bg-white hover:bg-sea-50 text-sea-700 border-2 border-sea-200 hover:border-sea-400 font-display font-bold text-sm px-6 py-3.5 rounded-xl transition active:scale-95">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Zaten Üyeyim, Giriş Yap
      </a>
    </div>
    <div class="px-8 pb-6 text-center">
      <p class="text-sea-400 text-xs">Hesap oluşturmak 1 dakika sürer · KVKK uyumlu</p>
    </div>
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// E-posta doğrulama ekranı
// ---------------------------------------------------------------------------
function _renderEmailVerification($root) {
  $root.innerHTML = `
<div class="max-w-md mx-auto">
  <div class="bg-white rounded-2xl shadow-card overflow-hidden">
    <div class="bg-gradient-to-r from-sea-800 to-sea-700 px-8 py-7 text-white">
      <div class="w-12 h-12 rounded-xl bg-sun-400/20 flex items-center justify-center mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f4b53d" stroke-width="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
      </div>
      <h1 class="font-display font-bold text-xl">E-postanızı Doğrulayın</h1>
      <p class="text-sea-200 text-sm mt-2">Hizmet eklemek için e-posta adresinizi doğrulamanız gerekiyor.</p>
    </div>
    <div class="px-8 py-6 space-y-3">
      <button id="ob-resend-btn"
        class="flex items-center justify-center gap-2 w-full bg-sun-400 hover:bg-sun-500 text-sea-900 font-display font-bold text-sm px-6 py-3.5 rounded-xl transition shadow-deep active:scale-95">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Doğrulama E-postasını Yeniden Gönder
      </button>
      <a href="login.html"
        class="flex items-center justify-center w-full bg-white hover:bg-sea-50 text-sea-700 border-2 border-sea-200 hover:border-sea-400 font-display font-bold text-sm px-6 py-3.5 rounded-xl transition active:scale-95">
        Giriş Sayfasına Dön
      </a>
    </div>
    <div class="px-8 pb-6 text-center">
      <p class="text-sea-400 text-xs">E-postayı doğruladıktan sonra sayfayı yenileyin.</p>
    </div>
  </div>
</div>`;

  document.getElementById('ob-resend-btn')?.addEventListener('click', async () => {
    try {
      const email = state.user?.email;
      if (!email) throw new Error('E-posta bulunamadı');
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      alert('Doğrulama e-postası gönderildi. Lütfen gelen kutunuzu kontrol edin.');
    } catch (err) {
      console.error('[onboarding] resend hatası:', err);
      alert('E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin.');
    }
  });
}

// ===========================================================================
// TEK SCROLL FORM
// ===========================================================================

const SECTIONS = [
  { id: 'isletme',  num: 1, title: 'İşletme Bilgileri' },
  { id: 'iletisim', num: 2, title: 'İletişim' },
  { id: 'lokasyon', num: 3, title: 'Lokasyon' },
  { id: 'detaylar', num: 4, title: 'Hizmet Detayları' },
  { id: 'gorseller',num: 5, title: 'Görseller' },
  { id: 'kvkk',     num: 6, title: 'Onay' },
];

function _renderSingleForm($root) {
  // Inject styles once
  _injectSingleFormStyles();

  $root.innerHTML = `
<!-- Global error banner -->
<div id="ob-global-err" class="hidden mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
  <svg class="shrink-0 mt-0.5 text-red-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
  <p id="ob-global-err-msg" class="text-red-700 text-sm"></p>
</div>

<div class="ob-layout">
  <!-- Side nav (desktop) -->
  <nav class="ob-sidenav" id="ob-sidenav">
    <div class="ob-sidenav-inner">
      ${SECTIONS.map(s => `
      <a href="#ob-sec-${s.id}" class="ob-sidenav-item" data-sec="${s.id}" id="ob-nav-${s.id}">
        <span class="ob-sidenav-num">${s.num}</span>
        <span class="ob-sidenav-label">${s.title}</span>
      </a>`).join('')}
    </div>
  </nav>

  <!-- Main form -->
  <form id="ob-single" class="ob-form" novalidate>

    <!-- Mobile breadcrumb -->
    <div class="ob-breadcrumb" id="ob-breadcrumb">
      ${SECTIONS.map((s, i) => `<span class="ob-bc-item" data-sec="${s.id}" id="ob-bc-${s.id}">${s.num}</span>${i < SECTIONS.length - 1 ? '<span class="ob-bc-sep">›</span>' : ''}`).join('')}
    </div>

    <!-- Section 1: İşletme -->
    <section class="ob-section" id="ob-sec-isletme">
      <div class="ob-section-header">
        <span class="ob-section-num">1</span>
        <h2>İşletme Bilgileri</h2>
      </div>
      <div class="ob-section-body">

        <!-- Tip seçimi -->
        <div class="ob-field">
          <label class="ob-label">İşletme tipi <span class="ob-req">*</span></label>
          <div class="ob-type-grid" id="ob-type-grid">
            ${Object.entries(TYPE_LABELS).map(([value, {label, icon}]) => `
            <button type="button" class="ob-type-btn${state.data.type === value ? ' ob-type-btn--active' : ''}"
              data-action="select-type" data-value="${value}">
              <span class="ob-type-icon">${icon}</span>
              <span class="ob-type-label">${label}</span>
            </button>`).join('')}
          </div>
          <p class="ob-field-err hidden" id="err-type"></p>
        </div>

        <!-- Logo + İsim -->
        <div class="ob-row">
          <div class="ob-field" style="flex:0 0 80px;">
            <label class="ob-label">Logo</label>
            <div id="ob-logo-zone" class="ob-logo-zone" title="Logo yükle">
              <div id="ob-logo-preview">
                ${state.data.logoUrl
                  ? `<img src="${_esc(state.data.logoUrl)}" class="ob-logo-img" />`
                  : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9cc0dd" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.3-3.3a2 2 0 0 0-2.8 0L6 21"/></svg>`}
              </div>
            </div>
            <input type="file" id="ob-logo-input" accept="image/*" class="hidden" />
          </div>
          <div class="ob-field" style="flex:1;">
            <label class="ob-label" for="ob-name">İşletme adı <span class="ob-req">*</span></label>
            <input type="text" id="ob-name" name="name" maxlength="200" class="ob-input"
              placeholder="Örn: Aubergine Restaurant"
              value="${_esc(state.data.name)}" required />
            <p class="ob-field-err hidden" id="err-name"></p>
          </div>
        </div>

        <!-- Kategori -->
        <div class="ob-field">
          <label class="ob-label" for="ob-category">Kategori <span class="ob-req">*</span></label>
          <select id="ob-category" name="category" class="ob-input" required>
            <option value="">Seçin...</option>
            ${(CATEGORIES[state.data.type] || []).map(c =>
              `<option value="${_esc(c)}"${state.data.category === c ? ' selected' : ''}>${_esc(c)}</option>`
            ).join('')}
          </select>
          <p class="ob-field-err hidden" id="err-category"></p>
        </div>

        <!-- Açıklama -->
        <div class="ob-field">
          <label class="ob-label" for="ob-summary">Kısa özet <span class="ob-hint">(max 280 karakter)</span></label>
          <div style="position:relative;">
            <textarea id="ob-summary" name="summary" rows="2" maxlength="280" class="ob-input ob-textarea"
              placeholder="Birkaç kelimeyle tanıtın...">${_esc(state.data.summary)}</textarea>
            <span id="ob-summary-count" class="ob-char-count">${state.data.summary.length}/280</span>
          </div>
        </div>

        <div class="ob-field">
          <label class="ob-label" for="ob-description">Tam açıklama</label>
          <textarea id="ob-description" name="description" rows="4" class="ob-input ob-textarea"
            placeholder="Detaylı açıklama, özellikler, öneriler...">${_esc(state.data.description)}</textarea>
        </div>

        <!-- Kuruluş yılı -->
        <div class="ob-field ob-field--half">
          <label class="ob-label" for="ob-founded">Kuruluş yılı</label>
          <input type="number" id="ob-founded" name="foundedYear" min="1950" max="2030"
            class="ob-input" placeholder="2010"
            value="${_esc(state.data.foundedYear)}" />
        </div>

      </div>
    </section>

    <!-- Section 2: İletişim -->
    <section class="ob-section" id="ob-sec-iletisim">
      <div class="ob-section-header">
        <span class="ob-section-num">2</span>
        <h2>İletişim</h2>
      </div>
      <div class="ob-section-body">
        <div class="ob-grid-2">
          <div class="ob-field">
            <label class="ob-label" for="ob-phone">Telefon</label>
            <input type="tel" id="ob-phone" name="phone" class="ob-input"
              placeholder="+90 242 000 00 00"
              pattern="[+]?[0-9 \\-()]{7,20}"
              value="${_esc(state.data.phone)}" />
          </div>
          <div class="ob-field">
            <label class="ob-label" for="ob-whatsapp">WhatsApp</label>
            <input type="tel" id="ob-whatsapp" name="whatsapp" class="ob-input"
              placeholder="+90 5__ ___ __ __"
              value="${_esc(state.data.whatsapp)}" />
          </div>
          <div class="ob-field">
            <label class="ob-label" for="ob-email">E-posta</label>
            <input type="email" id="ob-email" name="email" class="ob-input"
              placeholder="info@isletme.com"
              value="${_esc(state.data.email)}" />
          </div>
          <div class="ob-field">
            <label class="ob-label" for="ob-website">Website</label>
            <input type="url" id="ob-website" name="website" class="ob-input"
              placeholder="https://isletme.com"
              value="${_esc(state.data.website)}" />
          </div>
          <div class="ob-field">
            <label class="ob-label" for="ob-instagram">Instagram</label>
            <div class="ob-input-icon-wrap">
              <span class="ob-input-icon">@</span>
              <input type="text" id="ob-instagram" name="instagram" class="ob-input ob-input--icon"
                placeholder="kullaniciadı"
                value="${_esc(state.data.instagram)}" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 3: Lokasyon -->
    <section class="ob-section" id="ob-sec-lokasyon">
      <div class="ob-section-header">
        <span class="ob-section-num">3</span>
        <h2>Lokasyon</h2>
      </div>
      <div class="ob-section-body">
        <div class="ob-field">
          <label class="ob-label" for="ob-address">Adres <span class="ob-req">*</span></label>
          <input type="text" id="ob-address" name="address" maxlength="300" class="ob-input"
            placeholder="Sokak, mahalle..."
            value="${_esc(state.data.address)}" required />
          <p class="ob-field-err hidden" id="err-address"></p>
        </div>

        <div class="ob-field ob-field--half">
          <label class="ob-label" for="ob-district">İlçe</label>
          <select id="ob-district" name="district" class="ob-input">
            <option value="">Seçin...</option>
            ${DISTRICTS.map(d => `<option value="${_esc(d)}"${state.data.district === d ? ' selected' : ''}>${_esc(d)}</option>`).join('')}
          </select>
        </div>

        <div class="ob-field">
          <label class="ob-label">Haritada konum işaretleyin</label>
          <p class="ob-hint-text">Kalkan merkeze varsayılan geliyor. Pinı sürükleyin veya tıklayın.</p>
          <div id="ob-map" class="ob-map"></div>
          <div class="ob-coords">
            <span>Enlem: <strong id="ob-lat-display">${state.data.lat?.toFixed(5) ?? '—'}</strong></span>
            <span>Boylam: <strong id="ob-lng-display">${state.data.lng?.toFixed(5) ?? '—'}</strong></span>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 4: Hizmet Detayları -->
    <section class="ob-section" id="ob-sec-detaylar">
      <div class="ob-section-header">
        <span class="ob-section-num">4</span>
        <h2>Hizmet Detayları</h2>
      </div>
      <div class="ob-section-body">

        <!-- Specialties chips -->
        <div class="ob-field">
          <label class="ob-label">Özellikler</label>
          <div class="ob-chips" id="ob-specialties">
            ${SPECIALTIES_ALL.map(s => `
            <button type="button" class="ob-chip${state.data.specialties.includes(s) ? ' ob-chip--active' : ''}"
              data-action="toggle-specialty" data-value="${_esc(s)}">${_esc(s)}</button>`).join('')}
          </div>
        </div>

        <!-- Fiyat aralığı -->
        <div class="ob-field">
          <label class="ob-label">Fiyat aralığı</label>
          <div class="ob-price-btns" id="ob-price-btns">
            ${['$','$$','$$$','$$$$'].map(p => `
            <button type="button" data-action="select-price" data-value="${p}"
              class="ob-price-btn${state.data.priceRange === p ? ' ob-price-btn--active' : ''}">${p}</button>`).join('')}
          </div>
        </div>

        <!-- Çalışma saatleri -->
        <div class="ob-grid-2">
          <div class="ob-field">
            <label class="ob-label" for="ob-hours-open">Açılış saati</label>
            <input type="time" id="ob-hours-open" name="hoursOpen" class="ob-input"
              value="${_esc(state.data.hoursOpen)}" />
          </div>
          <div class="ob-field">
            <label class="ob-label" for="ob-hours-close">Kapanış saati</label>
            <input type="time" id="ob-hours-close" name="hoursClose" class="ob-input"
              value="${_esc(state.data.hoursClose)}" />
          </div>
        </div>

        <!-- Dil seçimi -->
        <div class="ob-field">
          <label class="ob-label">Hizmet dilleri</label>
          <div class="ob-lang-btns" id="ob-lang-btns">
            ${LANGUAGES.map(l => `
            <button type="button" data-action="toggle-lang" data-value="${l}"
              class="ob-lang-btn${state.data.languages.includes(l) ? ' ob-lang-btn--active' : ''}">${l}</button>`).join('')}
          </div>
        </div>

      </div>
    </section>

    <!-- Section 5: Görseller -->
    <section class="ob-section" id="ob-sec-gorseller">
      <div class="ob-section-header">
        <span class="ob-section-num">5</span>
        <h2>Görseller</h2>
      </div>
      <div class="ob-section-body">

        <!-- Kapak -->
        <div class="ob-field">
          <label class="ob-label">Kapak fotosu <span class="ob-req">*</span></label>
          <p class="ob-hint-text">Max 5 MB · JPG, PNG, WebP</p>
          <div id="ob-cover-zone" class="ob-drop-zone${state.errors.cover ? ' ob-drop-zone--err' : ''}">
            <div id="ob-cover-preview">
              ${state.data.coverUrl
                ? `<img src="${_esc(state.data.coverUrl)}" class="ob-cover-preview-img" /><p class="ob-drop-hint">Değiştirmek için tıklayın</p>`
                : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9cc0dd" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                  <p class="ob-drop-label">Kapak fotosu yükle</p>
                  <p class="ob-drop-hint">veya sürükleyip bırakın</p>`}
            </div>
          </div>
          <input type="file" id="ob-cover-input" accept="image/*" class="hidden" />
          <p class="ob-field-err hidden" id="err-cover"></p>
        </div>

        <!-- Galeri -->
        <div class="ob-field">
          <label class="ob-label">Galeri <span class="ob-hint">(max ${MAX_GALLERY} fotoğraf)</span></label>
          <div id="ob-gallery-zone" class="ob-drop-zone ob-gallery-zone">
            <div id="ob-gallery-preview">
              ${_buildGalleryPreviewHTML()}
            </div>
          </div>
          <input type="file" id="ob-gallery-input" accept="image/*" multiple class="hidden" />
        </div>

      </div>
    </section>

    <!-- Section 6: KVKK -->
    <section class="ob-section" id="ob-sec-kvkk">
      <div class="ob-section-header">
        <span class="ob-section-num">6</span>
        <h2>Onay</h2>
      </div>
      <div class="ob-section-body">
        <label class="ob-kvkk-label">
          <input type="checkbox" id="ob-kvkk" name="kvkk" class="ob-checkbox"
            ${state.data.kvkk ? 'checked' : ''} required />
          <span>
            <a href="kvkk.html" target="_blank" class="ob-kvkk-link">KVKK Aydınlatma Metni</a>'ni ve
            <a href="terms.html" target="_blank" class="ob-kvkk-link">Kullanım Şartları</a>'nı okudum, kabul ediyorum.
            <span class="ob-req">*</span>
          </span>
        </label>
        <p class="ob-field-err hidden" id="err-kvkk"></p>
      </div>
    </section>

    <!-- Sticky submit bar -->
    <div class="ob-sticky-bar" id="ob-sticky-bar">
      <div class="ob-sticky-inner">
        <p class="ob-sticky-hint">Tüm zorunlu alanları doldurun, kaydedin.</p>
        <button type="submit" id="ob-submit-btn" class="ob-submit-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Başvuruyu Gönder
        </button>
      </div>
    </div>

  </form>
</div>`;

  _bindSingleFormEvents();
  _initScrollSpy();
  // Map init in background — zone is visible
  setTimeout(_initMapPicker, 200);
}

// ---------------------------------------------------------------------------
// Gallery preview HTML helper
// ---------------------------------------------------------------------------
function _buildGalleryPreviewHTML() {
  const urls = state.data.galleryUrls;
  if (urls.length === 0) {
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9cc0dd" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.3-3.3a2 2 0 0 0-2.8 0L6 21"/></svg>
      <p class="ob-drop-label">Galeri fotoğrafları ekle</p>
      <p class="ob-drop-hint">Birden fazla seçebilirsiniz</p>`;
  }
  return `<div class="ob-gallery-grid">
    ${urls.map((u, i) => `
    <div class="ob-gallery-thumb-wrap">
      <img src="${_esc(u)}" class="ob-gallery-thumb" />
      <button type="button" data-action="remove-gallery" data-index="${i}" class="ob-gallery-remove" title="Kaldır">×</button>
    </div>`).join('')}
    ${urls.length < MAX_GALLERY ? `<div class="ob-gallery-add" id="ob-gallery-add-btn">+</div>` : ''}
  </div>`;
}

// ---------------------------------------------------------------------------
// Bind events for single form
// ---------------------------------------------------------------------------
function _bindSingleFormEvents() {
  // Form submit
  const form = document.getElementById('ob-single');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    _syncSingleFormToState();
    if (_validateAll()) {
      _save();
    }
  });

  // Summary char count
  const sumEl    = document.getElementById('ob-summary');
  const sumCount = document.getElementById('ob-summary-count');
  sumEl?.addEventListener('input', () => {
    if (sumCount) sumCount.textContent = `${sumEl.value.length}/280`;
  });

  // Logo zone
  const logoZone  = document.getElementById('ob-logo-zone');
  const logoInput = document.getElementById('ob-logo-input');
  logoZone?.addEventListener('click', () => logoInput?.click());
  logoInput?.addEventListener('change', () => {
    if (logoInput.files[0]) _handleLogoFile(logoInput.files[0]);
  });

  // Cover drop zone
  _bindDropZone('ob-cover-zone', 'ob-cover-input', false, _handleCoverFile);

  // Gallery drop zone
  _bindDropZone('ob-gallery-zone', 'ob-gallery-input', true, _handleGalleryFiles);

  // Delegated clicks
  document.addEventListener('click', _handleSingleFormClick, true);

  // Autosave on input
  document.addEventListener('change', () => { _syncSingleFormToState(); _saveDraft(); });
  document.addEventListener('input',  () => { _syncSingleFormToState(); _saveDraft(); });
}

function _handleSingleFormClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'select-type') {
    state.data.type     = btn.dataset.value;
    state.data.category = '';
    // Update type buttons
    document.querySelectorAll('[data-action="select-type"]').forEach(b => {
      b.classList.toggle('ob-type-btn--active', b.dataset.value === state.data.type);
    });
    // Refresh category options
    const sel = document.getElementById('ob-category');
    if (sel) {
      sel.innerHTML = `<option value="">Seçin...</option>` +
        (CATEGORIES[state.data.type] || []).map(c =>
          `<option value="${_esc(c)}">${_esc(c)}</option>`
        ).join('');
    }
  }

  if (action === 'select-price') {
    state.data.priceRange = btn.dataset.value;
    document.querySelectorAll('[data-action="select-price"]').forEach(b => {
      b.classList.toggle('ob-price-btn--active', b.dataset.value === state.data.priceRange);
    });
  }

  if (action === 'toggle-specialty') {
    const val = btn.dataset.value;
    const idx = state.data.specialties.indexOf(val);
    if (idx === -1) state.data.specialties.push(val);
    else state.data.specialties.splice(idx, 1);
    btn.classList.toggle('ob-chip--active', state.data.specialties.includes(val));
  }

  if (action === 'toggle-lang') {
    const val = btn.dataset.value;
    const idx = state.data.languages.indexOf(val);
    if (idx === -1) state.data.languages.push(val);
    else state.data.languages.splice(idx, 1);
    btn.classList.toggle('ob-lang-btn--active', state.data.languages.includes(val));
  }

  if (action === 'remove-gallery') {
    const idx = parseInt(btn.dataset.index, 10);
    state.data.galleryUrls.splice(idx, 1);
    state.data.galleryFiles.splice(idx, 1);
    const preview = document.getElementById('ob-gallery-preview');
    if (preview) preview.innerHTML = _buildGalleryPreviewHTML();
  }

  if (btn.id === 'ob-gallery-add-btn' || e.target.closest('#ob-gallery-add-btn')) {
    document.getElementById('ob-gallery-input')?.click();
  }
}

// ---------------------------------------------------------------------------
// Drop zone helper
// ---------------------------------------------------------------------------
function _bindDropZone(zoneId, inputId, multiple, handler) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  zone.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="remove-gallery"]')) input.click();
  });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('ob-drop-zone--hover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('ob-drop-zone--hover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('ob-drop-zone--hover');
    const files = Array.from(e.dataTransfer.files);
    multiple ? handler(files) : handler(files[0]);
  });
  input.addEventListener('change', () => {
    const files = Array.from(input.files);
    multiple ? handler(files) : handler(files[0]);
  });
}

// ---------------------------------------------------------------------------
// File handlers
// ---------------------------------------------------------------------------
function _handleLogoFile(file) {
  if (!_validateFile(file)) return;
  state.data.logoFile = file;
  state.data.logoUrl  = URL.createObjectURL(file);
  const preview = document.getElementById('ob-logo-preview');
  if (preview) preview.innerHTML = `<img src="${state.data.logoUrl}" class="ob-logo-img" />`;
}

function _handleCoverFile(file) {
  if (!file || !_validateFile(file)) return;
  state.data.coverFile = file;
  state.data.coverUrl  = URL.createObjectURL(file);
  state.errors.cover   = null;
  const preview = document.getElementById('ob-cover-preview');
  if (preview) {
    preview.innerHTML = `<img src="${state.data.coverUrl}" class="ob-cover-preview-img" /><p class="ob-drop-hint">Değiştirmek için tıklayın</p>`;
  }
  _hideFieldErr('err-cover');
}

function _handleGalleryFiles(files) {
  const remaining = MAX_GALLERY - state.data.galleryUrls.length;
  const toAdd = files.filter(_validateFile).slice(0, remaining);
  toAdd.forEach((f) => {
    state.data.galleryFiles.push(f);
    state.data.galleryUrls.push(URL.createObjectURL(f));
  });
  const preview = document.getElementById('ob-gallery-preview');
  if (preview) preview.innerHTML = _buildGalleryPreviewHTML();
}

function _validateFile(file) {
  if (!file) return false;
  if (!file.type.startsWith('image/')) {
    _showGlobalError(`"${file.name}" geçerli bir görsel değil.`);
    return false;
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    _showGlobalError(`"${file.name}" çok büyük. Max ${MAX_FILE_MB} MB olmalıdır.`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Sync form → state (single form)
// ---------------------------------------------------------------------------
function _syncSingleFormToState() {
  const get = (id) => document.getElementById(id);
  state.data.name        = get('ob-name')?.value.trim() || '';
  state.data.category    = get('ob-category')?.value || '';
  state.data.summary     = get('ob-summary')?.value.trim() || '';
  state.data.description = get('ob-description')?.value.trim() || '';
  state.data.foundedYear = get('ob-founded')?.value || '';
  state.data.phone       = get('ob-phone')?.value.trim() || '';
  state.data.whatsapp    = get('ob-whatsapp')?.value.trim() || '';
  state.data.email       = get('ob-email')?.value.trim() || '';
  state.data.website     = get('ob-website')?.value.trim() || '';
  state.data.instagram   = get('ob-instagram')?.value.trim() || '';
  state.data.address     = get('ob-address')?.value.trim() || '';
  state.data.district    = get('ob-district')?.value || '';
  state.data.hoursOpen   = get('ob-hours-open')?.value || '';
  state.data.hoursClose  = get('ob-hours-close')?.value || '';
  state.data.kvkk        = get('ob-kvkk')?.checked || false;
}

// ---------------------------------------------------------------------------
// Validate all sections
// ---------------------------------------------------------------------------
function _validateAll() {
  _syncSingleFormToState();
  state.errors = {};

  if (!state.data.type)     state.errors.type     = 'Lütfen bir işletme tipi seçin.';
  if (!state.data.name)     state.errors.name     = 'İşletme adı zorunludur.';
  if (!state.data.category) state.errors.category = 'Kategori seçiniz.';
  if (!state.data.address)  state.errors.address  = 'Adres zorunludur.';
  if (!state.data.coverFile && !state.data.coverUrl) state.errors.cover = 'Kapak fotosu zorunludur.';
  if (!state.data.kvkk)     state.errors.kvkk     = 'KVKK onayı zorunludur.';

  // Show/hide field errors
  _showOrHideFieldErr('err-type',     state.errors.type);
  _showOrHideFieldErr('err-name',     state.errors.name);
  _showOrHideFieldErr('err-category', state.errors.category);
  _showOrHideFieldErr('err-address',  state.errors.address);
  _showOrHideFieldErr('err-cover',    state.errors.cover);
  _showOrHideFieldErr('err-kvkk',     state.errors.kvkk);

  const hasErrors = Object.keys(state.errors).length > 0;
  if (hasErrors) {
    // Flash error sections and scroll to first
    const firstErrKey = Object.keys(state.errors)[0];
    const sectionMap = {
      type:     'ob-sec-isletme',
      name:     'ob-sec-isletme',
      category: 'ob-sec-isletme',
      address:  'ob-sec-lokasyon',
      cover:    'ob-sec-gorseller',
      kvkk:     'ob-sec-kvkk',
    };
    const secId = sectionMap[firstErrKey];
    if (secId) {
      const sec = document.getElementById(secId);
      if (sec) {
        sec.classList.add('ob-section--flash');
        setTimeout(() => sec.classList.remove('ob-section--flash'), 1200);
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    // Focus first errored input
    const inputMap = {
      type:     'ob-type-grid',
      name:     'ob-name',
      category: 'ob-category',
      address:  'ob-address',
      cover:    'ob-cover-zone',
      kvkk:     'ob-kvkk',
    };
    const focusId = inputMap[firstErrKey];
    if (focusId) document.getElementById(focusId)?.focus();
  }

  return !hasErrors;
}

function _showOrHideFieldErr(errId, msg) {
  const el = document.getElementById(errId);
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function _hideFieldErr(errId) {
  const el = document.getElementById(errId);
  if (el) el.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// Scroll spy — highlight active section in sidenav + breadcrumb
// ---------------------------------------------------------------------------
function _initScrollSpy() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.id.replace('ob-sec-', '');
      const navEl = document.getElementById(`ob-nav-${id}`);
      const bcEl  = document.getElementById(`ob-bc-${id}`);
      if (entry.isIntersecting) {
        document.querySelectorAll('.ob-sidenav-item').forEach(el => el.classList.remove('ob-sidenav-item--active'));
        document.querySelectorAll('.ob-bc-item').forEach(el => el.classList.remove('ob-bc-item--active'));
        navEl?.classList.add('ob-sidenav-item--active');
        bcEl?.classList.add('ob-bc-item--active');
      }
    });
  }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });

  SECTIONS.forEach(s => {
    const el = document.getElementById(`ob-sec-${s.id}`);
    if (el) observer.observe(el);
  });
}

// ---------------------------------------------------------------------------
// Map picker (Leaflet)
// ---------------------------------------------------------------------------
let _mapInstance = null;

async function _initMapPicker() {
  const container = document.getElementById('ob-map');
  if (!container) return;

  const lat = state.data.lat ?? 36.2658;
  const lng = state.data.lng ?? 29.4118;

  if (!document.querySelector('link[href*="leaflet"]')) {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' });
    document.head.appendChild(link);
  }

  if (!window.L) {
    await new Promise((resolve, reject) => {
      const s = Object.assign(document.createElement('script'), { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  if (_mapInstance) { _mapInstance.remove(); _mapInstance = null; }

  _mapInstance = window.L.map(container).setView([lat, lng], 14);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
  }).addTo(_mapInstance);

  const marker = window.L.marker([lat, lng], { draggable: true }).addTo(_mapInstance);

  function _updateCoords(latlng) {
    state.data.lat = latlng.lat;
    state.data.lng = latlng.lng;
    const latEl = document.getElementById('ob-lat-display');
    const lngEl = document.getElementById('ob-lng-display');
    if (latEl) latEl.textContent = latlng.lat.toFixed(5);
    if (lngEl) lngEl.textContent = latlng.lng.toFixed(5);
  }

  marker.on('dragend', (e) => _updateCoords(e.target.getLatLng()));
  _mapInstance.on('click', (e) => { marker.setLatLng(e.latlng); _updateCoords(e.latlng); });
}

// ---------------------------------------------------------------------------
// Storage upload
// ---------------------------------------------------------------------------
async function _uploadToStorage(path, file) {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
    if (error) throw error;
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (err) {
    console.warn(`[onboarding] storage upload başarısız (${path}):`, err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------
async function _save() {
  if (state.saving) return;
  state.saving = true;

  const submitBtn = document.getElementById('ob-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Gönderiliyor...'; }
  _hideGlobalError();

  try {
    const uid = state.user?.id;
    if (!uid) throw new Error('Oturum bilgisi bulunamadı');

    let coverUrl    = state.data.coverUrl?.startsWith('blob:') ? '' : state.data.coverUrl;
    let galleryUrls = state.data.galleryUrls.filter(u => u && !u.startsWith('blob:'));

    const uploadId = state.providerId || `provider_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    state.providerId = uploadId;

    if (state.data.coverFile) {
      const url = await _uploadToStorage(`${uid}/${uploadId}/cover.jpg`, state.data.coverFile);
      if (url) coverUrl = url;
    }

    if (state.data.logoFile) {
      await _uploadToStorage(`${uid}/${uploadId}/logo.jpg`, state.data.logoFile);
    }

    for (let i = 0; i < state.data.galleryFiles.length; i++) {
      const file = state.data.galleryFiles[i];
      if (!file) continue;
      const url = await _uploadToStorage(`${uid}/${uploadId}/gallery-${i}.jpg`, file);
      if (url) galleryUrls.push(url);
    }

    const row = {
      owner_id:         uid,
      type:             state.data.type,
      status:           'pending',
      slug:             uniqueSlug(state.data.name),
      name:             state.data.name,
      category:         state.data.category || null,
      summary:          state.data.summary || null,
      description_i18n: state.data.description ? { tr: state.data.description } : {},
      price_range:      state.data.priceRange || null,
      lat:              state.data.lat,
      lng:              state.data.lng,
      address:          state.data.address || null,
      district:         state.data.district || null,
      phone:            state.data.phone || null,
      whatsapp:         state.data.whatsapp || null,
      email:            state.data.email || null,
      website:          state.data.website || null,
      cover_image:      coverUrl || null,
      gallery:          galleryUrls,
      data: {
        instagram:    state.data.instagram || null,
        founded_year: state.data.foundedYear || null,
        hours:        { open: state.data.hoursOpen, close: state.data.hoursClose },
        languages:    state.data.languages,
        specialties:  state.data.specialties,
        menu:         state.data.menuItems.filter(m => m.name),
      },
    };

    const { data: inserted, error } = await supabase
      .from('providers')
      .insert(row)
      .select('id, slug')
      .single();

    if (error) throw error;

    _clearDraft();
    _renderSuccess();

  } catch (err) {
    console.error('[onboarding] save error:', err);
    _showGlobalError(`Kayıt sırasında hata oluştu: ${err.message || 'Lütfen tekrar deneyin.'}`);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Başvuruyu Gönder'; }
  } finally {
    state.saving = false;
  }
}

// ---------------------------------------------------------------------------
// Success screen
// ---------------------------------------------------------------------------
function _renderSuccess() {
  const $root = document.querySelector('#onboarding-root');
  if (!$root) return;
  $root.innerHTML = `
<div class="bg-white rounded-xl p-8 shadow-card text-center max-w-md mx-auto">
  <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
  </div>
  <h2 class="font-display font-bold text-xl text-sea-800 mb-2">Başvurun Alındı!</h2>
  <p class="text-sea-600 text-sm leading-relaxed mb-6">
    Profilin admin onayına alındı. <strong>24-48 saat</strong> içinde incelenip yayınlanacak.
    Onay durumunu profilinden takip edebilirsin.
  </p>
  <a href="profil.html"
    class="inline-block bg-sea-600 hover:bg-sea-700 text-white font-display font-bold px-8 py-3 rounded-lg transition shadow-deep text-sm">
    Profilime Git →
  </a>
</div>`;
  setTimeout(() => { window.location.href = 'profil.html'; }, 4000);
}

// ---------------------------------------------------------------------------
// Draft autosave / restore
// ---------------------------------------------------------------------------
function _saveDraft() {
  if (!state.user) return;
  const key = `${DRAFT_KEY_PREFIX}${state.user.id}`;
  try {
    localStorage.setItem(key, JSON.stringify({
      data: {
        ...state.data,
        logoFile:     null,
        coverFile:    null,
        galleryFiles: [],
        logoUrl:      state.data.logoUrl?.startsWith('blob:')  ? '' : state.data.logoUrl,
        coverUrl:     state.data.coverUrl?.startsWith('blob:') ? '' : state.data.coverUrl,
        galleryUrls:  state.data.galleryUrls.filter(u => !u.startsWith('blob:')),
      },
    }));
  } catch { /* localStorage dolu */ }
}

function _loadDraft() {
  if (!state.user) return;
  const key = `${DRAFT_KEY_PREFIX}${state.user.id}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.assign(state.data, parsed.data || {});
    state.data.logoFile   = null;
    state.data.coverFile  = null;
    state.data.galleryFiles = [];
  } catch { /* corrupted draft */ }
}

function _clearDraft() {
  if (!state.user) return;
  localStorage.removeItem(`${DRAFT_KEY_PREFIX}${state.user.id}`);
}

// ---------------------------------------------------------------------------
// Global hata banner
// ---------------------------------------------------------------------------
function _showGlobalError(msg) {
  const el    = document.getElementById('ob-global-err');
  const msgEl = document.getElementById('ob-global-err-msg');
  if (el && msgEl) {
    msgEl.textContent = msg;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function _hideGlobalError() {
  document.getElementById('ob-global-err')?.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// HTML escape
// ---------------------------------------------------------------------------
function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ---------------------------------------------------------------------------
// Single form CSS injection
// ---------------------------------------------------------------------------
function _injectSingleFormStyles() {
  if (document.getElementById('ob-single-styles')) return;
  const style = document.createElement('style');
  style.id = 'ob-single-styles';
  style.textContent = `
/* Layout */
.ob-layout { display:flex; gap:2rem; align-items:flex-start; }

/* Side nav */
.ob-sidenav { display:none; width:200px; flex-shrink:0; position:sticky; top:80px; }
@media(min-width:1024px){ .ob-sidenav { display:block; } }
.ob-sidenav-inner { background:#fff; border-radius:0.75rem; padding:0.75rem; box-shadow:0 1px 2px rgba(13,58,95,0.06),0 8px 24px -8px rgba(13,58,95,0.18); }
.ob-sidenav-item { display:flex; align-items:center; gap:0.625rem; padding:0.5rem 0.75rem; border-radius:0.5rem; text-decoration:none; color:#4a7fa5; font-size:0.8125rem; font-weight:600; transition:background .15s,color .15s; }
.ob-sidenav-item:hover { background:#f0f6fb; color:#0a2e4c; }
.ob-sidenav-item--active { background:#e8f2fb; color:#0a2e4c; }
.ob-sidenav-num { width:22px; height:22px; border-radius:50%; background:#1a5e93; color:#fff; font-size:0.7rem; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.ob-sidenav-item--active .ob-sidenav-num { background:#e89812; }

/* Breadcrumb (mobile) */
.ob-breadcrumb { display:flex; align-items:center; gap:0.25rem; overflow-x:auto; padding:0.5rem 0 0.75rem; scrollbar-width:none; }
.ob-breadcrumb::-webkit-scrollbar { display:none; }
@media(min-width:1024px){ .ob-breadcrumb { display:none; } }
.ob-bc-item { width:28px; height:28px; border-radius:50%; background:#d4e4f0; color:#4a7fa5; font-size:0.75rem; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background .15s,color .15s; }
.ob-bc-item--active { background:#1a5e93; color:#fff; }
.ob-bc-sep { color:#9cc0dd; font-size:0.75rem; flex-shrink:0; }

/* Form */
.ob-form { flex:1; min-width:0; padding-bottom:100px; }

/* Section */
.ob-section { background:#fff; border-radius:0.875rem; margin-bottom:1.25rem; overflow:hidden; box-shadow:0 1px 2px rgba(13,58,95,0.06),0 8px 24px -8px rgba(13,58,95,0.18); }
.ob-section-header { display:flex; align-items:center; gap:0.75rem; padding:1rem 1.25rem; background:linear-gradient(90deg,#f0f6fb 0%,#fff 100%); border-bottom:1px solid #e4eef6; }
.ob-section-header h2 { font-family:'Montserrat',sans-serif; font-size:1rem; font-weight:700; color:#0a2e4c; margin:0; }
.ob-section-num { width:28px; height:28px; border-radius:50%; background:#1a5e93; color:#fff; font-size:0.8rem; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.ob-section-body { padding:1.25rem; display:flex; flex-direction:column; gap:1rem; }
@keyframes ob-flash { 0%,100%{box-shadow:0 0 0 0 rgba(26,94,147,0)} 30%{box-shadow:0 0 0 4px rgba(26,94,147,0.35)} }
.ob-section--flash { animation:ob-flash .8s ease; }

/* Fields */
.ob-field { display:flex; flex-direction:column; }
.ob-field--half { max-width:240px; }
.ob-row { display:flex; gap:0.75rem; align-items:flex-end; }
.ob-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem 1rem; }
@media(max-width:600px){ .ob-grid-2 { grid-template-columns:1fr; } }
.ob-label { display:block; font-size:0.8125rem; font-weight:600; color:#0d3a5f; margin-bottom:0.375rem; font-family:'Montserrat',sans-serif; }
.ob-req { color:#c0392b; }
.ob-hint { font-size:0.75rem; font-weight:400; color:#6899b8; margin-left:0.25rem; }
.ob-hint-text { font-size:0.75rem; color:#6899b8; margin-bottom:0.5rem; }
.ob-field-err { color:#c0392b; font-size:0.8rem; margin-top:0.25rem; }
.ob-char-count { position:absolute; bottom:0.5rem; right:0.75rem; font-size:0.6875rem; color:#9cc0dd; pointer-events:none; }

/* Input */
.ob-input { width:100%; border:1.5px solid #9cc0dd; border-radius:0.5rem; padding:0.625rem 0.875rem; font-size:0.9375rem; color:#0a2e4c; background:#fff; outline:none; transition:border-color .18s,box-shadow .18s; font-family:'Inter',sans-serif; box-sizing:border-box; }
.ob-input:focus { border-color:#1a5e93; box-shadow:0 0 0 3px rgba(26,94,147,0.12); }
.ob-textarea { resize:vertical; }
select.ob-input { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%230d3a5f' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 0.75rem center; padding-right:2.25rem; }
.ob-input-icon-wrap { position:relative; }
.ob-input-icon { position:absolute; left:0.75rem; top:50%; transform:translateY(-50%); color:#6899b8; font-weight:600; pointer-events:none; }
.ob-input--icon { padding-left:1.875rem; }

/* Type grid */
.ob-type-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.625rem; }
@media(max-width:480px){ .ob-type-grid { grid-template-columns:repeat(2,1fr); } }
.ob-type-btn { display:flex; flex-direction:column; align-items:center; gap:0.375rem; padding:0.875rem 0.5rem; border-radius:0.75rem; border:2px solid #dce8f2; background:#fff; color:#0a2e4c; cursor:pointer; transition:border-color .15s,background .15s; }
.ob-type-btn:hover { border-color:#9cc0dd; background:#f4f9fd; }
.ob-type-btn--active { border-color:#1a5e93; background:#e8f2fb; }
.ob-type-icon { font-size:1.75rem; }
.ob-type-label { font-size:0.75rem; font-weight:700; font-family:'Montserrat',sans-serif; text-align:center; }

/* Logo zone */
.ob-logo-zone { width:72px; height:72px; border-radius:0.625rem; border:2px dashed #9cc0dd; cursor:pointer; display:flex; align-items:center; justify-content:center; overflow:hidden; transition:border-color .15s; background:#f4f9fd; }
.ob-logo-zone:hover { border-color:#1a5e93; }
.ob-logo-img { width:100%; height:100%; object-fit:cover; }

/* Chips */
.ob-chips { display:flex; flex-wrap:wrap; gap:0.375rem; }
.ob-chip { padding:0.3rem 0.75rem; border-radius:999px; border:1.5px solid #d4e4f0; background:#fff; color:#4a7fa5; font-size:0.8125rem; font-weight:600; cursor:pointer; transition:all .15s; }
.ob-chip:hover { border-color:#9cc0dd; }
.ob-chip--active { border-color:#1a5e93; background:#1a5e93; color:#fff; }

/* Price buttons */
.ob-price-btns { display:flex; gap:0.5rem; }
.ob-price-btn { padding:0.4rem 1rem; border-radius:0.5rem; border:2px solid #d4e4f0; background:#fff; color:#0a2e4c; font-family:monospace; font-size:0.9375rem; font-weight:700; cursor:pointer; transition:all .15s; }
.ob-price-btn:hover { border-color:#9cc0dd; }
.ob-price-btn--active { border-color:#1a5e93; background:#1a5e93; color:#fff; }

/* Language buttons */
.ob-lang-btns { display:flex; gap:0.5rem; flex-wrap:wrap; }
.ob-lang-btn { padding:0.35rem 0.875rem; border-radius:0.5rem; border:2px solid #d4e4f0; background:#fff; color:#0a2e4c; font-size:0.8125rem; font-weight:700; cursor:pointer; transition:all .15s; }
.ob-lang-btn:hover { border-color:#9cc0dd; }
.ob-lang-btn--active { border-color:#1a5e93; background:#1a5e93; color:#fff; }

/* Map */
.ob-map { height:260px; border-radius:0.625rem; overflow:hidden; border:1.5px solid #9cc0dd; }
.ob-coords { display:flex; gap:1.5rem; margin-top:0.5rem; font-size:0.75rem; color:#6899b8; }

/* Drop zones */
.ob-drop-zone { border:2px dashed #9cc0dd; border-radius:0.875rem; padding:1.5rem; text-align:center; cursor:pointer; transition:border-color .15s,background .15s; background:#f4f9fd; }
.ob-drop-zone:hover,.ob-drop-zone--hover { border-color:#1a5e93; background:#eaf3fb; }
.ob-drop-zone--err { border-color:#e74c3c; background:#fef2f2; }
.ob-drop-label { font-size:0.9rem; font-weight:600; color:#0d3a5f; margin-top:0.375rem; }
.ob-drop-hint { font-size:0.75rem; color:#9cc0dd; margin-top:0.25rem; }
.ob-cover-preview-img { width:100%; height:140px; object-fit:cover; border-radius:0.5rem; margin-bottom:0.5rem; }
.ob-gallery-zone { padding:1rem; }
.ob-gallery-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:0.5rem; }
@media(max-width:480px){ .ob-gallery-grid { grid-template-columns:repeat(3,1fr); } }
.ob-gallery-thumb-wrap { position:relative; }
.ob-gallery-thumb { width:100%; height:72px; object-fit:cover; border-radius:0.375rem; }
.ob-gallery-remove { position:absolute; top:2px; right:2px; width:20px; height:20px; border-radius:50%; background:#e74c3c; color:#fff; font-size:0.9rem; line-height:1; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.ob-gallery-add { height:72px; border-radius:0.375rem; border:2px dashed #9cc0dd; display:flex; align-items:center; justify-content:center; color:#9cc0dd; font-size:1.5rem; cursor:pointer; transition:all .15s; }
.ob-gallery-add:hover { border-color:#1a5e93; color:#1a5e93; }

/* KVKK */
.ob-kvkk-label { display:flex; align-items:flex-start; gap:0.75rem; cursor:pointer; }
.ob-checkbox { width:18px; height:18px; border:2px solid #9cc0dd; border-radius:4px; flex-shrink:0; margin-top:2px; cursor:pointer; accent-color:#1a5e93; }
.ob-kvkk-link { color:#1a5e93; font-weight:600; text-decoration:underline; }

/* Sticky submit bar */
.ob-sticky-bar { position:fixed; bottom:0; left:0; right:0; z-index:30; background:rgba(255,255,255,0.95); backdrop-filter:blur(8px); border-top:1px solid #d4e4f0; box-shadow:0 -4px 24px -4px rgba(13,58,95,0.18); padding:0.75rem 1rem; }
.ob-sticky-inner { max-width:56rem; margin:0 auto; display:flex; align-items:center; justify-content:space-between; gap:1rem; }
.ob-sticky-hint { font-size:0.8125rem; color:#6899b8; font-weight:500; }
.ob-submit-btn { display:flex; align-items:center; gap:0.5rem; padding:0.75rem 1.75rem; border-radius:0.625rem; background:#1a5e93; color:#fff; font-family:'Montserrat',sans-serif; font-weight:700; font-size:0.9375rem; border:none; cursor:pointer; transition:background .18s,transform .1s; box-shadow:0 4px 16px -4px rgba(26,94,147,0.45); }
.ob-submit-btn:hover { background:#0d4a78; }
.ob-submit-btn:active { transform:scale(0.97); }
.ob-submit-btn:disabled { opacity:0.55; cursor:not-allowed; }
`;
  document.head.appendChild(style);
}

// ===========================================================================
// LEGACY WIZARD (4-step) — erişim: ?wizard=legacy
// Orijinal kod aynen korundu, sadece $root parametresi eklendi
// ===========================================================================

function _renderLegacyWizard($root) {
  // Inject legacy wrapper into root
  $root.innerHTML = `
<div class="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 font-semibold">
  ⚠️ Eski wizard modunda görüntülüyorsunuz.
  <a href="hizmet-ekle.html" class="underline ml-1">Yeni forma geç →</a>
</div>
<div id="ob-legacy-root"></div>`;

  // Re-bind root for legacy
  const $legacyRoot = document.getElementById('ob-legacy-root');
  _legacyRender($legacyRoot);
  document.addEventListener('change', () => _legacyAutosave());
  document.addEventListener('input',  () => _legacyAutosave());
}

// --- Legacy internals (preserved from original) ---

function _legacyRender($r) {
  $r.innerHTML = _legacyBuildShell();
  _legacyBindNav($r);
  _legacyRenderProgress($r);
  _legacyRenderStep($r);
  _legacyRenderPreview($r);
}

function _legacyBuildShell() {
  return `
<div id="ob-global-err" class="hidden mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
  <svg class="shrink-0 mt-0.5 text-red-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
  <p id="ob-global-err-msg" class="text-red-700 text-sm"></p>
</div>
<div class="mb-6">
  <div class="flex justify-between text-xs text-sea-600 font-semibold mb-2">
    ${['Tip Seçimi','Temel Bilgiler','Konum & İletişim','Görseller & Menü']
      .map((label, i) => `
      <span id="ob-step-label-${i+1}" class="${state.step === i+1 ? 'text-sea-800' : 'text-sea-400'}">
        <span class="hidden sm:inline">${label}</span>
        <span class="sm:hidden">${i+1}</span>
      </span>`).join('')}
  </div>
  <div class="h-2 bg-sea-100 rounded-full overflow-hidden">
    <div id="ob-progress-bar" class="h-full bg-sea-600 rounded-full transition-all duration-300" style="width:${(state.step/state.totalSteps)*100}%"></div>
  </div>
</div>
<div class="flex gap-6 items-start">
  <div id="ob-steps" class="flex-1 min-w-0"></div>
  <div id="ob-preview" class="hidden lg:block w-72 shrink-0 sticky top-24">
    <div class="text-xs uppercase tracking-widest text-sea-500 font-bold mb-2">Önizleme</div>
    <div id="ob-preview-card" class="rounded-xl overflow-hidden border border-sea-100 bg-white shadow-card">
      ${_legacyBuildPreviewCard()}
    </div>
  </div>
</div>`;
}

function _legacyRenderProgress($r) {
  const bar = $r?.querySelector?.('#ob-progress-bar') || document.getElementById('ob-progress-bar');
  if (bar) bar.style.width = `${(state.step / state.totalSteps) * 100}%`;
  for (let i = 1; i <= state.totalSteps; i++) {
    const el = document.getElementById(`ob-step-label-${i}`);
    if (el) el.className = state.step === i ? 'text-sea-800 font-bold' : 'text-sea-400';
  }
}

function _legacyRenderStep($r) {
  const $steps = document.getElementById('ob-steps');
  if (!$steps) return;
  const renderers = [null, _legacyStep1, _legacyStep2, _legacyStep3, _legacyStep4];
  $steps.innerHTML = renderers[state.step]?.() ?? '';
  _legacyBindStepEvents();
}

function _legacyStep1() {
  return `
<div class="bg-white rounded-xl p-6 shadow-card">
  <h2 class="font-display font-bold text-xl text-sea-800 mb-1">Hizmet tipini seçin</h2>
  <p class="text-sea-600 text-sm mb-5">İşletmenizi en iyi tanımlayan kategoriyi seçin.</p>
  <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
    ${Object.entries(TYPE_LABELS).map(([value, {label, icon}]) => `
    <button type="button" data-action="lw-select-type" data-value="${value}"
      class="ob-type-card flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition
        ${state.data.type === value ? 'border-sea-600 bg-sea-50 text-sea-800' : 'border-sea-100 bg-white text-sea-700 hover:border-sea-300 hover:bg-sea-50/40'}">
      <span class="text-3xl">${icon}</span>
      <span class="font-display font-bold text-sm text-center leading-tight">${label}</span>
    </button>`).join('')}
  </div>
  ${state.errors.type ? `<p class="text-red-600 text-sm mt-3">${state.errors.type}</p>` : ''}
</div>
${_legacyNavBtns(false, true)}`;
}

function _legacyStep2() {
  const cats = CATEGORIES[state.data.type] || [];
  return `
<div class="bg-white rounded-xl p-6 shadow-card space-y-5">
  <h2 class="font-display font-bold text-xl text-sea-800">Temel bilgiler</h2>
  <div>
    <label class="ob-label">İşletme adı <span class="text-red-500">*</span></label>
    <input type="text" id="ob-name" maxlength="200" class="ob-input ${state.errors.name ? 'border-red-400' : ''}"
      placeholder="Örn: Aubergine Restaurant" value="${_esc(state.data.name)}" />
    ${state.errors.name ? `<p class="ob-field-err">${state.errors.name}</p>` : ''}
  </div>
  <div>
    <label class="ob-label">Kategori <span class="text-red-500">*</span></label>
    <select id="ob-category" class="ob-input ${state.errors.category ? 'border-red-400' : ''}">
      <option value="">Seçin...</option>
      ${cats.map(c => `<option value="${c}" ${state.data.category === c ? 'selected' : ''}>${c}</option>`).join('')}
    </select>
    ${state.errors.category ? `<p class="ob-field-err">${state.errors.category}</p>` : ''}
  </div>
  <div>
    <label class="ob-label">Kısa özet <span class="text-sea-400 text-xs">(max 280 karakter)</span></label>
    <div class="relative">
      <textarea id="ob-summary" rows="2" maxlength="280" class="ob-input resize-none"
        placeholder="Birkaç kelimeyle tanıtın...">${_esc(state.data.summary)}</textarea>
      <span id="ob-summary-count" class="absolute bottom-2 right-3 text-[11px] text-sea-400">${state.data.summary.length}/280</span>
    </div>
  </div>
  <div>
    <label class="ob-label">Tam açıklama</label>
    <textarea id="ob-description" rows="5" class="ob-input resize-y">${_esc(state.data.description)}</textarea>
  </div>
  <div>
    <label class="ob-label">Fiyat aralığı</label>
    <div class="flex gap-2 mt-1">
      ${['$','$$','$$$','$$$$'].map(p => `
      <button type="button" data-action="lw-select-price" data-value="${p}"
        class="px-4 py-2 rounded-lg border-2 font-mono font-semibold text-sm transition
          ${state.data.priceRange === p ? 'border-sea-600 bg-sea-600 text-white' : 'border-sea-200 bg-white text-sea-700 hover:border-sea-400'}">${p}</button>`).join('')}
    </div>
  </div>
</div>
${_legacyNavBtns(true, true)}`;
}

function _legacyStep3() {
  return `
<div class="bg-white rounded-xl p-6 shadow-card space-y-5">
  <h2 class="font-display font-bold text-xl text-sea-800">Konum & İletişim</h2>
  <div>
    <label class="ob-label">Adres <span class="text-red-500">*</span></label>
    <input type="text" id="ob-address" maxlength="300" class="ob-input ${state.errors.address ? 'border-red-400' : ''}"
      placeholder="Sokak, mahalle, ilçe..." value="${_esc(state.data.address)}" />
    ${state.errors.address ? `<p class="ob-field-err">${state.errors.address}</p>` : ''}
  </div>
  <div>
    <label class="ob-label">Haritada konum işaretleyin</label>
    <div class="text-xs text-sea-500 mb-2">Kalkan merkeze varsayılan olarak geliyor. Pinı sürükleyip bırakın.</div>
    <div id="ob-map" class="rounded-lg overflow-hidden border border-sea-200" style="height:260px;"></div>
    <div class="flex gap-4 mt-2 text-xs text-sea-500">
      <span>Enlem: <span id="ob-lat-display">${state.data.lat?.toFixed(5) ?? '—'}</span></span>
      <span>Boylam: <span id="ob-lng-display">${state.data.lng?.toFixed(5) ?? '—'}</span></span>
    </div>
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div><label class="ob-label">Telefon</label><input type="tel" id="ob-phone" class="ob-input" placeholder="+90 242 000 00 00" value="${_esc(state.data.phone)}" /></div>
    <div><label class="ob-label">WhatsApp</label><input type="tel" id="ob-whatsapp" class="ob-input" placeholder="+90 5__ ___ __ __" value="${_esc(state.data.whatsapp)}" /></div>
    <div><label class="ob-label">E-posta</label><input type="email" id="ob-email" class="ob-input" placeholder="info@isletme.com" value="${_esc(state.data.email)}" /></div>
    <div><label class="ob-label">Website</label><input type="url" id="ob-website" class="ob-input" placeholder="https://isletme.com" value="${_esc(state.data.website)}" /></div>
  </div>
</div>
${_legacyNavBtns(true, true)}`;
}

function _legacyStep4() {
  const isRestoran = state.data.type === 'restoran';
  return `
<div class="bg-white rounded-xl p-6 shadow-card space-y-6">
  <h2 class="font-display font-bold text-xl text-sea-800">Görseller${isRestoran ? ' & Menü' : ''}</h2>
  <div>
    <label class="ob-label">Kapak fotosu <span class="text-red-500">*</span></label>
    <p class="text-xs text-sea-500 mb-2">Max 5 MB · JPG, PNG, WebP</p>
    <div id="ob-cover-zone"
      class="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${state.errors.cover ? 'border-red-400 bg-red-50' : 'border-sea-200 bg-sea-50/40 hover:border-sea-400 hover:bg-sea-50'}">
      ${state.data.coverUrl
        ? `<img src="${state.data.coverUrl}" class="w-full h-36 object-cover rounded-lg mb-2" /><p class="text-xs text-sea-500">Değiştirmek için tıklayın</p>`
        : `<svg class="mx-auto mb-2 text-sea-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          <p class="text-sm font-semibold text-sea-700">Kapak fotosu yükle</p><p class="text-xs text-sea-400 mt-1">veya sürükleyip bırakın</p>`}
    </div>
    <input type="file" id="ob-cover-input" accept="image/*" class="hidden" />
    ${state.errors.cover ? `<p class="ob-field-err">${state.errors.cover}</p>` : ''}
  </div>
  <div>
    <label class="ob-label">Galeri <span class="text-sea-400 text-xs">(max ${MAX_GALLERY} fotoğraf)</span></label>
    <div id="ob-gallery-zone" class="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition border-sea-200 bg-sea-50/40 hover:border-sea-400 hover:bg-sea-50">
      ${state.data.galleryUrls.length
        ? `<div class="grid grid-cols-4 gap-2 mb-2">
            ${state.data.galleryUrls.map((u, i) => `
              <div class="relative group">
                <img src="${u}" class="w-full h-16 object-cover rounded" />
                <button type="button" data-action="lw-remove-gallery" data-index="${i}"
                  class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs grid place-items-center opacity-0 group-hover:opacity-100 transition">×</button>
              </div>`).join('')}
            ${state.data.galleryUrls.length < MAX_GALLERY ? `<div class="h-16 rounded border-2 border-dashed border-sea-200 grid place-items-center text-sea-400 text-xl">+</div>` : ''}
           </div><p class="text-xs text-sea-500">Fotoğraf eklemek için tıklayın</p>`
        : `<svg class="mx-auto mb-2 text-sea-400" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.3-3.3a2 2 0 0 0-2.8 0L6 21"/></svg>
          <p class="text-sm font-semibold text-sea-700">Galeri fotoğrafları ekle</p><p class="text-xs text-sea-400 mt-1">Birden fazla seçebilirsiniz</p>`}
    </div>
    <input type="file" id="ob-gallery-input" accept="image/*" multiple class="hidden" />
  </div>
  ${isRestoran ? _legacyMenuEditor() : ''}
</div>
${_legacyNavBtns(true, false, true)}`;
}

function _legacyMenuEditor() {
  const items = state.data.menuItems;
  return `
<div>
  <label class="ob-label">Menü</label>
  <div id="ob-menu-list" class="space-y-2 mb-3">
    ${items.length === 0 ? `<p class="text-sm text-sea-400 italic">Henüz ürün eklenmedi.</p>` : items.map((item, i) => _legacyMenuItem(item, i)).join('')}
  </div>
  <button type="button" data-action="lw-add-menu-item"
    class="flex items-center gap-2 text-sea-600 hover:text-sea-800 text-sm font-semibold transition">
    <span class="w-7 h-7 rounded-full border-2 border-sea-400 grid place-items-center text-lg leading-none">+</span>Ürün Ekle
  </button>
</div>`;
}

function _legacyMenuItem(item, index) {
  return `
<div class="ob-menu-item border border-sea-100 rounded-lg p-3 bg-sea-50/40" data-menu-index="${index}">
  <div class="grid grid-cols-2 gap-2 mb-2">
    <input type="text" data-menu-field="category" data-index="${index}" value="${_esc(item.category)}" placeholder="Kategori" class="ob-input-sm col-span-2" style="width:100%;border:1.5px solid #cfdfee;border-radius:.375rem;padding:.45rem .6rem;font-size:.8125rem;color:#0a2e4c;background:#fff;outline:none;" />
    <input type="text" data-menu-field="name" data-index="${index}" value="${_esc(item.name)}" placeholder="Ürün adı *" class="ob-input-sm" style="width:100%;border:1.5px solid #cfdfee;border-radius:.375rem;padding:.45rem .6rem;font-size:.8125rem;color:#0a2e4c;background:#fff;outline:none;" />
    <input type="text" data-menu-field="price" data-index="${index}" value="${_esc(item.price)}" placeholder="Fiyat" class="ob-input-sm" style="width:100%;border:1.5px solid #cfdfee;border-radius:.375rem;padding:.45rem .6rem;font-size:.8125rem;color:#0a2e4c;background:#fff;outline:none;" />
    <input type="text" data-menu-field="description" data-index="${index}" value="${_esc(item.description)}" placeholder="Açıklama" class="ob-input-sm col-span-2" style="width:100%;border:1.5px solid #cfdfee;border-radius:.375rem;padding:.45rem .6rem;font-size:.8125rem;color:#0a2e4c;background:#fff;outline:none;" />
  </div>
  <div class="flex justify-end gap-2">
    <button type="button" data-action="lw-move-menu" data-direction="up" data-index="${index}" ${index === 0 ? 'disabled' : ''} class="w-7 h-7 rounded border border-sea-200 grid place-items-center text-sea-500 hover:bg-sea-50 disabled:opacity-30">↑</button>
    <button type="button" data-action="lw-move-menu" data-direction="down" data-index="${index}" ${index === state.data.menuItems.length - 1 ? 'disabled' : ''} class="w-7 h-7 rounded border border-sea-200 grid place-items-center text-sea-500 hover:bg-sea-50 disabled:opacity-30">↓</button>
    <button type="button" data-action="lw-remove-menu-item" data-index="${index}" class="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded transition">Sil</button>
  </div>
</div>`;
}

function _legacyNavBtns(showBack, showNext, showSave = false) {
  return `
<div class="flex justify-between mt-4">
  ${showBack ? `<button type="button" data-action="lw-prev" class="px-5 py-2.5 rounded-lg border-2 border-sea-200 text-sea-700 font-semibold text-sm hover:bg-sea-50 transition">← Geri</button>` : '<span></span>'}
  ${showSave
    ? `<button type="button" id="ob-save-btn" data-action="lw-save" class="px-6 py-2.5 rounded-lg bg-sea-600 text-white font-display font-bold text-sm hover:bg-sea-700 active:scale-95 transition shadow-deep disabled:opacity-50">Kaydet ve İncele</button>`
    : showNext ? `<button type="button" data-action="lw-next" class="px-6 py-2.5 rounded-lg bg-sea-600 text-white font-display font-bold text-sm hover:bg-sea-700 active:scale-95 transition shadow-deep">İleri →</button>` : ''}
</div>`;
}

function _legacyBuildPreviewCard() {
  const d = state.data;
  const typeInfo = TYPE_LABELS[d.type] || {};
  return `
<div class="relative">
  ${d.coverUrl ? `<img src="${d.coverUrl}" class="w-full h-36 object-cover" />` : `<div class="w-full h-36 bg-gradient-to-br from-sea-200 to-sea-300 flex items-center justify-center text-4xl">${typeInfo.icon || '📍'}</div>`}
  ${d.type ? `<span class="absolute top-2 left-2 bg-sea-700/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">${typeInfo.label || ''}</span>` : ''}
</div>
<div class="p-4">
  <h3 class="font-display font-bold text-sea-800 text-sm leading-tight">${d.name || 'İşletme Adı'}</h3>
  ${d.summary ? `<p class="text-sea-600 text-xs mt-1 line-clamp-2">${d.summary}</p>` : ''}
  ${d.priceRange ? `<span class="inline-block mt-2 text-xs font-mono font-semibold text-sun-600">${d.priceRange}</span>` : ''}
  ${d.address ? `<p class="text-sea-500 text-[11px] mt-1">📍 ${d.address}</p>` : ''}
</div>`;
}

function _legacyRenderPreview($r) {
  const card = document.getElementById('ob-preview-card');
  if (card) card.innerHTML = _legacyBuildPreviewCard();
}

function _legacyBindNav($r) {
  document.addEventListener('click', _legacyHandleClick, true);
}

function _legacyBindStepEvents() {
  const sumEl    = document.getElementById('ob-summary');
  const sumCount = document.getElementById('ob-summary-count');
  if (sumEl && sumCount) {
    sumEl.addEventListener('input', () => { sumCount.textContent = `${sumEl.value.length}/280`; });
  }
  if (state.step === 3) _initMapPicker();
  if (state.step === 4) _legacyBindFilePickers();
}

function _legacyHandleClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'lw-select-type') {
    _legacySyncToState();
    state.data.type = btn.dataset.value;
    state.data.category = '';
    state.errors = {};
    _legacyReRender();
  }
  if (action === 'lw-select-price') {
    state.data.priceRange = btn.dataset.value;
    document.querySelectorAll('[data-action="lw-select-price"]').forEach(b => {
      const sel = b.dataset.value === state.data.priceRange;
      b.className = `px-4 py-2 rounded-lg border-2 font-mono font-semibold text-sm transition ${sel ? 'border-sea-600 bg-sea-600 text-white' : 'border-sea-200 bg-white text-sea-700 hover:border-sea-400'}`;
    });
  }
  if (action === 'lw-next') {
    _legacySyncToState();
    if (_legacyValidateStep(state.step)) { state.step++; state.errors = {}; _legacyReRender(); }
    else { _legacyRenderStep(); }
  }
  if (action === 'lw-prev') {
    _legacySyncToState();
    state.step = Math.max(1, state.step - 1);
    state.errors = {};
    _legacyReRender();
  }
  if (action === 'lw-save') {
    _legacySyncToState();
    if (_legacyValidateStep(state.step)) _save();
    else _legacyRenderStep();
  }
  if (action === 'lw-add-menu-item') {
    state.data.menuItems.push({ category: '', name: '', description: '', price: '' });
    const list = document.getElementById('ob-menu-list');
    if (list) list.innerHTML = state.data.menuItems.map((item, i) => _legacyMenuItem(item, i)).join('') || '<p class="text-sm text-sea-400 italic">Henüz ürün eklenmedi.</p>';
  }
  if (action === 'lw-remove-menu-item') {
    const idx = parseInt(btn.dataset.index, 10);
    state.data.menuItems.splice(idx, 1);
    const list = document.getElementById('ob-menu-list');
    if (list) list.innerHTML = state.data.menuItems.map((item, i) => _legacyMenuItem(item, i)).join('') || '<p class="text-sm text-sea-400 italic">Henüz ürün eklenmedi.</p>';
  }
  if (action === 'lw-move-menu') {
    const idx = parseInt(btn.dataset.index, 10);
    const dir = btn.dataset.direction;
    const items = state.data.menuItems;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < items.length) {
      [items[idx], items[targetIdx]] = [items[targetIdx], items[idx]];
      const list = document.getElementById('ob-menu-list');
      if (list) list.innerHTML = items.map((item, i) => _legacyMenuItem(item, i)).join('');
    }
  }
  if (action === 'lw-remove-gallery') {
    const idx = parseInt(btn.dataset.index, 10);
    state.data.galleryUrls.splice(idx, 1);
    state.data.galleryFiles.splice(idx, 1);
    _legacyRenderStep();
  }
}

function _legacyReRender() {
  _legacyRenderProgress();
  _legacyRenderStep();
  _legacyRenderPreview();
}

function _legacySyncToState() {
  const get = (id) => document.getElementById(id);
  if (state.step === 2) {
    state.data.name        = get('ob-name')?.value.trim() || '';
    state.data.category    = get('ob-category')?.value || '';
    state.data.summary     = get('ob-summary')?.value.trim() || '';
    state.data.description = get('ob-description')?.value.trim() || '';
  }
  if (state.step === 3) {
    state.data.address  = get('ob-address')?.value.trim() || '';
    state.data.phone    = get('ob-phone')?.value.trim() || '';
    state.data.whatsapp = get('ob-whatsapp')?.value.trim() || '';
    state.data.email    = get('ob-email')?.value.trim() || '';
    state.data.website  = get('ob-website')?.value.trim() || '';
  }
  document.querySelectorAll('[data-menu-field]').forEach(el => {
    const idx = parseInt(el.dataset.index, 10);
    const field = el.dataset.menuField;
    if (state.data.menuItems[idx]) state.data.menuItems[idx][field] = el.value;
  });
  _legacyRenderPreview();
}

function _legacyValidateStep(step) {
  state.errors = {};
  if (step === 1 && !state.data.type)     state.errors.type     = 'Lütfen bir hizmet tipi seçin.';
  if (step === 2 && !state.data.name)     state.errors.name     = 'İşletme adı zorunludur.';
  if (step === 2 && !state.data.category) state.errors.category = 'Kategori seçiniz.';
  if (step === 3 && !state.data.address)  state.errors.address  = 'Adres zorunludur.';
  if (step === 4 && !state.data.coverFile && !state.data.coverUrl) state.errors.cover = 'Kapak fotosu zorunludur.';
  return Object.keys(state.errors).length === 0;
}

function _legacyBindFilePickers() {
  const coverZone  = document.getElementById('ob-cover-zone');
  const coverInput = document.getElementById('ob-cover-input');
  if (coverZone && coverInput) {
    coverZone.addEventListener('click', () => coverInput.click());
    coverZone.addEventListener('dragover', e => { e.preventDefault(); coverZone.classList.add('border-sea-500'); });
    coverZone.addEventListener('dragleave', () => coverZone.classList.remove('border-sea-500'));
    coverZone.addEventListener('drop', e => { e.preventDefault(); coverZone.classList.remove('border-sea-500'); const f = e.dataTransfer.files[0]; if (f) _legacyCoverFile(f); });
    coverInput.addEventListener('change', () => { if (coverInput.files[0]) _legacyCoverFile(coverInput.files[0]); });
  }
  const galleryZone  = document.getElementById('ob-gallery-zone');
  const galleryInput = document.getElementById('ob-gallery-input');
  if (galleryZone && galleryInput) {
    galleryZone.addEventListener('click', () => galleryInput.click());
    galleryZone.addEventListener('dragover', e => { e.preventDefault(); galleryZone.classList.add('border-sea-500'); });
    galleryZone.addEventListener('dragleave', () => galleryZone.classList.remove('border-sea-500'));
    galleryZone.addEventListener('drop', e => { e.preventDefault(); galleryZone.classList.remove('border-sea-500'); _handleGalleryFiles(Array.from(e.dataTransfer.files)); });
    galleryInput.addEventListener('change', () => { _handleGalleryFiles(Array.from(galleryInput.files)); });
  }
}

function _legacyCoverFile(file) {
  if (!_validateFile(file)) return;
  state.data.coverFile = file;
  state.data.coverUrl  = URL.createObjectURL(file);
  state.errors.cover   = null;
  _legacyRenderStep();
  _legacyRenderPreview();
}

function _legacyAutosave() {
  if (!state.user) return;
  _legacySyncToState();
  _saveDraft();
}
