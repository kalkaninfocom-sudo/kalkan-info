/**
 * onboarding.js — Hizmet Ekle multi-step state machine (ES module)
 *
 * Bağımlılıklar (graceful degrade):
 *   js/auth.js  — requireAuth, currentUser, auth, db
 *   js/slug.js  — uniqueSlug
 *   Firebase Storage modular SDK (CDN)
 */

import { uniqueSlug } from './slug.js';

// ---------------------------------------------------------------------------
// Firebase imports — graceful degrade: config yoksa mock kullan
// ---------------------------------------------------------------------------
let _auth = null;
let _db   = null;
let _requireAuth = async () => null;
let _currentUser = () => null;
let _firebaseConfigured = false;

try {
  const authMod = await import('./auth.js');
  _requireAuth         = authMod.requireAuth;
  _currentUser         = authMod.currentUser;
  _auth                = authMod.auth;
  _db                  = authMod.db;
  _firebaseConfigured  = authMod.isFirebaseConfigured ?? false;
} catch {
  console.warn('[onboarding] auth.js yüklenemedi — graceful degrade');
}

// Firebase Storage
let _getStorage, _ref, _uploadBytes, _getDownloadURL;
try {
  const storageMod = await import(
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js'
  );
  _getStorage    = storageMod.getStorage;
  _ref           = storageMod.ref;
  _uploadBytes   = storageMod.uploadBytes;
  _getDownloadURL = storageMod.getDownloadURL;
} catch {
  console.warn('[onboarding] firebase-storage yüklenemedi');
}

// Firestore
let _collection, _doc, _setDoc, _serverTimestamp;
try {
  const fsm = await import(
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
  );
  _collection      = fsm.collection;
  _doc             = fsm.doc;
  _setDoc          = fsm.setDoc;
  _serverTimestamp = fsm.serverTimestamp;
} catch {
  console.warn('[onboarding] firebase-firestore yüklenemedi');
}

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

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  step: 1,
  totalSteps: 4,
  user: null,
  profileId: null,
  data: {
    type: '',
    name: '',
    category: '',
    summary: '',
    description: '',
    priceRange: '',
    address: '',
    lat: null,
    lng: null,
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    coverFile: null,
    coverUrl: '',
    galleryFiles: [],
    galleryUrls: [],
    menuItems: [],         // restoran için
  },
  errors: {},
  uploading: false,
  saving: false,
};

// ---------------------------------------------------------------------------
// DOM refs — init() sonrası dolu olur
// ---------------------------------------------------------------------------
let $root, $progressBar, $steps, $preview, $globalErr, $globalErrMsg;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export async function init(rootSelector = '#onboarding-root') {
  $root = document.querySelector(rootSelector);
  if (!$root) return;

  // Auth yumuşak kontrol — Firebase config yoksa veya hata olursa redirect yok
  // _firebaseConfigured false ise apiKey eksik → anında landing göster
  // Config varsa onAuthStateChanged bekle (max 4s: geçersiz config olursa hiç çağrılmaz)
  let user = null;
  if (!_firebaseConfigured) {
    // Firebase config yok — anında landing ekranı
    user = null;
  } else {
    try {
      user = await Promise.race([
        _requireAuth('login.html'),
        new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
    } catch {
      user = null;
    }
  }

  // Her durumda loading overlay'i kaldır (varsa)
  const _overlay = document.getElementById('page-loading');
  if (_overlay) {
    _overlay.style.opacity = '0';
    setTimeout(() => _overlay.remove(), 300);
  }

  // Auth yok (mock _requireAuth null döndü veya hata) → landing ekranı
  if (!user) {
    _renderLanding();
    return;
  }

  // Auth var ama e-posta doğrulanmamış → doğrulama ekranı
  if (!user.emailVerified) {
    state.user = user;
    _renderEmailVerification();
    return;
  }

  // Auth var ve doğrulanmış → normal onboarding akışı
  state.user = user;

  // Draft yükle
  _loadDraft();

  // Render
  _render();

  // Autosave
  document.addEventListener('change', _autosave);
  document.addEventListener('input', _autosave);
}

// ---------------------------------------------------------------------------
// Landing ekranı — auth olmadan görüntülenir
// ---------------------------------------------------------------------------
function _renderLanding() {
  $root.innerHTML = `
<div class="max-w-xl mx-auto">
  <div class="bg-white rounded-2xl shadow-card overflow-hidden">
    <!-- Başlık bandı -->
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

    <!-- Avantajlar -->
    <div class="px-8 py-6 space-y-3 border-b border-sea-100">
      <div class="flex items-start gap-3">
        <span class="w-6 h-6 rounded-full bg-sea-100 text-sea-700 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <span class="text-sea-700 text-sm"><strong class="text-sea-800">Ücretsiz kayıt</strong> — kredi kartı gerekmez, sözleşme yok</span>
      </div>
      <div class="flex items-start gap-3">
        <span class="w-6 h-6 rounded-full bg-sea-100 text-sea-700 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <span class="text-sea-700 text-sm"><strong class="text-sea-800">24-48 saat onay</strong> — admin inceleme sonrası profiliniz yayına alınır</span>
      </div>
      <div class="flex items-start gap-3">
        <span class="w-6 h-6 rounded-full bg-sea-100 text-sea-700 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <span class="text-sea-700 text-sm"><strong class="text-sea-800">Müşteri yorumları + WhatsApp Concierge</strong> entegrasyonu ile daha fazla müşteri</span>
      </div>
    </div>

    <!-- Butonlar -->
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

    <!-- Alt not -->
    <div class="px-8 pb-6 text-center">
      <p class="text-sea-400 text-xs">Hesap oluşturmak 1 dakika sürer · KVKK uyumlu</p>
    </div>
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// E-posta doğrulama ekranı
// ---------------------------------------------------------------------------
function _renderEmailVerification() {
  const resendEmail = async () => {
    try {
      const authMod = await import('./auth.js');
      if (authMod.auth?.currentUser) {
        const { sendEmailVerification } = await import(
          'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'
        );
        await sendEmailVerification(authMod.auth.currentUser);
        alert('Doğrulama e-postası gönderildi. Lütfen gelen kutunuzu kontrol edin.');
      }
    } catch {
      alert('E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin.');
    }
  };

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

  document.getElementById('ob-resend-btn')?.addEventListener('click', resendEmail);
}

// ---------------------------------------------------------------------------
// Render ana fonksiyon
// ---------------------------------------------------------------------------
function _render() {
  $root.innerHTML = _buildShell();
  $progressBar  = document.getElementById('ob-progress-bar');
  $steps        = document.getElementById('ob-steps');
  $preview      = document.getElementById('ob-preview');
  $globalErr    = document.getElementById('ob-global-err');
  $globalErrMsg = document.getElementById('ob-global-err-msg');

  _renderProgress();
  _renderStep();
  _renderPreview();
  _bindNav();
}

// ---------------------------------------------------------------------------
// Shell HTML
// ---------------------------------------------------------------------------
function _buildShell() {
  return `
<div id="ob-global-err" class="hidden mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
  <svg class="shrink-0 mt-0.5 text-red-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
  <p id="ob-global-err-msg" class="text-red-700 text-sm"></p>
</div>

<!-- Progress bar -->
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
  <!-- Steps -->
  <div id="ob-steps" class="flex-1 min-w-0"></div>

  <!-- Preview (md+) -->
  <div id="ob-preview" class="hidden lg:block w-72 shrink-0 sticky top-24">
    <div class="text-xs uppercase tracking-widest text-sea-500 font-bold mb-2">Önizleme</div>
    <div id="ob-preview-card" class="rounded-xl overflow-hidden border border-sea-100 bg-white shadow-card">
      ${_buildPreviewCard()}
    </div>
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------
function _renderProgress() {
  if (!$progressBar) return;
  $progressBar.style.width = `${(state.step / state.totalSteps) * 100}%`;
  for (let i = 1; i <= state.totalSteps; i++) {
    const el = document.getElementById(`ob-step-label-${i}`);
    if (el) el.className = state.step === i ? 'text-sea-800 font-bold' : 'text-sea-400';
  }
}

// ---------------------------------------------------------------------------
// Step render dispatcher
// ---------------------------------------------------------------------------
function _renderStep() {
  if (!$steps) return;
  const renderers = [null, _renderStep1, _renderStep2, _renderStep3, _renderStep4];
  $steps.innerHTML = renderers[state.step]?.() ?? '';
  _bindStepEvents();
}

// ---------------------------------------------------------------------------
// Step 1 — Tip seçimi
// ---------------------------------------------------------------------------
function _renderStep1() {
  return `
<div class="bg-white rounded-xl p-6 shadow-card">
  <h2 class="font-display font-bold text-xl text-sea-800 mb-1">Hizmet tipini seçin</h2>
  <p class="text-sea-600 text-sm mb-5">İşletmenizi en iyi tanımlayan kategoriyi seçin.</p>
  <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
    ${Object.entries(TYPE_LABELS).map(([value, {label, icon}]) => `
    <button
      type="button"
      data-action="select-type"
      data-value="${value}"
      class="ob-type-card flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition
        ${state.data.type === value
          ? 'border-sea-600 bg-sea-50 text-sea-800'
          : 'border-sea-100 bg-white text-sea-700 hover:border-sea-300 hover:bg-sea-50/40'}"
    >
      <span class="text-3xl">${icon}</span>
      <span class="font-display font-bold text-sm text-center leading-tight">${label}</span>
    </button>`).join('')}
  </div>
  ${state.errors.type ? `<p class="text-red-600 text-sm mt-3">${state.errors.type}</p>` : ''}
</div>
${_buildNavButtons(false, true)}`;
}

// ---------------------------------------------------------------------------
// Step 2 — Temel bilgiler
// ---------------------------------------------------------------------------
function _renderStep2() {
  const cats = CATEGORIES[state.data.type] || [];
  return `
<div class="bg-white rounded-xl p-6 shadow-card space-y-5">
  <h2 class="font-display font-bold text-xl text-sea-800">Temel bilgiler</h2>

  <div>
    <label class="ob-label">İşletme adı <span class="text-red-500">*</span></label>
    <input type="text" id="ob-name" name="name" maxlength="200"
      class="ob-input ${state.errors.name ? 'border-red-400' : ''}"
      placeholder="Örn: Aubergine Restaurant"
      value="${_esc(state.data.name)}" />
    ${state.errors.name ? `<p class="ob-field-err">${state.errors.name}</p>` : ''}
  </div>

  <div>
    <label class="ob-label">Kategori <span class="text-red-500">*</span></label>
    <select id="ob-category" name="category" class="ob-input ${state.errors.category ? 'border-red-400' : ''}">
      <option value="">Seçin...</option>
      ${cats.map(c => `<option value="${c}" ${state.data.category === c ? 'selected' : ''}>${c}</option>`).join('')}
    </select>
    ${state.errors.category ? `<p class="ob-field-err">${state.errors.category}</p>` : ''}
  </div>

  <div>
    <label class="ob-label">Kısa özet <span class="text-sea-400 text-xs">(max 280 karakter)</span></label>
    <div class="relative">
      <textarea id="ob-summary" name="summary" rows="2" maxlength="280"
        class="ob-input resize-none ${state.errors.summary ? 'border-red-400' : ''}"
        placeholder="Birkaç kelimeyle tanıtın...">${_esc(state.data.summary)}</textarea>
      <span id="ob-summary-count" class="absolute bottom-2 right-3 text-[11px] text-sea-400">${state.data.summary.length}/280</span>
    </div>
    ${state.errors.summary ? `<p class="ob-field-err">${state.errors.summary}</p>` : ''}
  </div>

  <div>
    <label class="ob-label">Tam açıklama</label>
    <textarea id="ob-description" name="description" rows="5"
      class="ob-input resize-y"
      placeholder="Detaylı açıklama, özellikler, öneriler...">${_esc(state.data.description)}</textarea>
  </div>

  <div>
    <label class="ob-label">Fiyat aralığı</label>
    <div class="flex gap-2 mt-1">
      ${['$','$$','$$$','$$$$'].map(p => `
      <button type="button" data-action="select-price" data-value="${p}"
        class="px-4 py-2 rounded-lg border-2 font-mono font-semibold text-sm transition
          ${state.data.priceRange === p
            ? 'border-sea-600 bg-sea-600 text-white'
            : 'border-sea-200 bg-white text-sea-700 hover:border-sea-400'}">
        ${p}
      </button>`).join('')}
    </div>
  </div>
</div>
${_buildNavButtons(true, true)}`;
}

// ---------------------------------------------------------------------------
// Step 3 — Konum & iletişim
// ---------------------------------------------------------------------------
function _renderStep3() {
  return `
<div class="bg-white rounded-xl p-6 shadow-card space-y-5">
  <h2 class="font-display font-bold text-xl text-sea-800">Konum & İletişim</h2>

  <div>
    <label class="ob-label">Adres <span class="text-red-500">*</span></label>
    <input type="text" id="ob-address" name="address" maxlength="300"
      class="ob-input ${state.errors.address ? 'border-red-400' : ''}"
      placeholder="Sokak, mahalle, ilçe..."
      value="${_esc(state.data.address)}" />
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
    <div>
      <label class="ob-label">Telefon</label>
      <input type="tel" id="ob-phone" name="phone"
        class="ob-input" placeholder="+90 242 000 00 00"
        value="${_esc(state.data.phone)}" />
    </div>
    <div>
      <label class="ob-label">WhatsApp</label>
      <input type="tel" id="ob-whatsapp" name="whatsapp"
        class="ob-input" placeholder="+90 5__ ___ __ __"
        value="${_esc(state.data.whatsapp)}" />
    </div>
    <div>
      <label class="ob-label">E-posta</label>
      <input type="email" id="ob-email" name="email"
        class="ob-input" placeholder="info@isletme.com"
        value="${_esc(state.data.email)}" />
    </div>
    <div>
      <label class="ob-label">Website</label>
      <input type="url" id="ob-website" name="website"
        class="ob-input" placeholder="https://isletme.com"
        value="${_esc(state.data.website)}" />
    </div>
  </div>
</div>
${_buildNavButtons(true, true)}`;
}

// ---------------------------------------------------------------------------
// Step 4 — Görseller & menü
// ---------------------------------------------------------------------------
function _renderStep4() {
  const isRestoran = state.data.type === 'restoran';
  return `
<div class="bg-white rounded-xl p-6 shadow-card space-y-6">
  <h2 class="font-display font-bold text-xl text-sea-800">Görseller${isRestoran ? ' & Menü' : ''}</h2>

  <!-- Kapak fotosu -->
  <div>
    <label class="ob-label">Kapak fotosu <span class="text-red-500">*</span></label>
    <p class="text-xs text-sea-500 mb-2">Max 5 MB · JPG, PNG, WebP</p>
    <div id="ob-cover-zone"
      class="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition
        ${state.errors.cover ? 'border-red-400 bg-red-50' : 'border-sea-200 bg-sea-50/40 hover:border-sea-400 hover:bg-sea-50'}">
      ${state.data.coverUrl
        ? `<img src="${state.data.coverUrl}" class="w-full h-36 object-cover rounded-lg mb-2" /><p class="text-xs text-sea-500">Değiştirmek için tıklayın</p>`
        : `<svg class="mx-auto mb-2 text-sea-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          <p class="text-sm font-semibold text-sea-700">Kapak fotosu yükle</p>
          <p class="text-xs text-sea-400 mt-1">veya sürükleyip bırakın</p>`}
    </div>
    <input type="file" id="ob-cover-input" accept="image/*" class="hidden" />
    ${state.errors.cover ? `<p class="ob-field-err">${state.errors.cover}</p>` : ''}
  </div>

  <!-- Galeri -->
  <div>
    <label class="ob-label">Galeri <span class="text-sea-400 text-xs">(max ${MAX_GALLERY} fotoğraf)</span></label>
    <p class="text-xs text-sea-500 mb-2">Her biri max 5 MB</p>
    <div id="ob-gallery-zone"
      class="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition
        border-sea-200 bg-sea-50/40 hover:border-sea-400 hover:bg-sea-50">
      ${state.data.galleryUrls.length
        ? `<div class="grid grid-cols-4 gap-2 mb-2">
            ${state.data.galleryUrls.map((u, i) => `
              <div class="relative group">
                <img src="${u}" class="w-full h-16 object-cover rounded" />
                <button type="button" data-action="remove-gallery" data-index="${i}"
                  class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs grid place-items-center opacity-0 group-hover:opacity-100 transition">
                  ×
                </button>
              </div>`).join('')}
            ${state.data.galleryUrls.length < MAX_GALLERY
              ? `<div class="h-16 rounded border-2 border-dashed border-sea-200 grid place-items-center text-sea-400 text-xl">+</div>`
              : ''}
           </div><p class="text-xs text-sea-500">Fotoğraf eklemek için tıklayın</p>`
        : `<svg class="mx-auto mb-2 text-sea-400" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.3-3.3a2 2 0 0 0-2.8 0L6 21"/></svg>
          <p class="text-sm font-semibold text-sea-700">Galeri fotoğrafları ekle</p>
          <p class="text-xs text-sea-400 mt-1">Birden fazla seçebilirsiniz</p>`}
    </div>
    <input type="file" id="ob-gallery-input" accept="image/*" multiple class="hidden" />
  </div>

  <!-- Menü editörü — sadece restoran -->
  ${isRestoran ? _renderMenuEditor() : ''}
</div>
${_buildNavButtons(true, false, true)}`;
}

// ---------------------------------------------------------------------------
// Menü editörü (restoran tipi)
// ---------------------------------------------------------------------------
function _renderMenuEditor() {
  const items = state.data.menuItems;
  return `
<div>
  <label class="ob-label">Menü</label>
  <p class="text-xs text-sea-500 mb-3">Ürün ekleyip sırayı ayarlayabilirsiniz.</p>
  <div id="ob-menu-list" class="space-y-2 mb-3">
    ${items.length === 0
      ? `<p class="text-sm text-sea-400 italic">Henüz ürün eklenmedi.</p>`
      : items.map((item, i) => _renderMenuItem(item, i)).join('')}
  </div>
  <button type="button" data-action="add-menu-item"
    class="flex items-center gap-2 text-sea-600 hover:text-sea-800 text-sm font-semibold transition">
    <span class="w-7 h-7 rounded-full border-2 border-sea-400 grid place-items-center text-lg leading-none">+</span>
    Ürün Ekle
  </button>
</div>`;
}

function _renderMenuItem(item, index) {
  return `
<div class="ob-menu-item border border-sea-100 rounded-lg p-3 bg-sea-50/40" data-menu-index="${index}">
  <div class="grid grid-cols-2 gap-2 mb-2">
    <input type="text" data-menu-field="category" data-index="${index}" value="${_esc(item.category)}"
      placeholder="Kategori (Başlangıç, Ana Yemek...)"
      class="ob-input-sm col-span-2" />
    <input type="text" data-menu-field="name" data-index="${index}" value="${_esc(item.name)}"
      placeholder="Ürün adı *"
      class="ob-input-sm" />
    <input type="text" data-menu-field="price" data-index="${index}" value="${_esc(item.price)}"
      placeholder="Fiyat (₺ veya $)"
      class="ob-input-sm" />
    <input type="text" data-menu-field="description" data-index="${index}" value="${_esc(item.description)}"
      placeholder="Açıklama"
      class="ob-input-sm col-span-2" />
  </div>
  <div class="flex justify-end gap-2">
    <button type="button" data-action="move-menu" data-direction="up" data-index="${index}"
      class="w-7 h-7 rounded border border-sea-200 grid place-items-center text-sea-500 hover:bg-sea-50 disabled:opacity-30"
      ${index === 0 ? 'disabled' : ''}>↑</button>
    <button type="button" data-action="move-menu" data-direction="down" data-index="${index}"
      class="w-7 h-7 rounded border border-sea-200 grid place-items-center text-sea-500 hover:bg-sea-50 disabled:opacity-30"
      ${index === state.data.menuItems.length - 1 ? 'disabled' : ''}>↓</button>
    <button type="button" data-action="remove-menu-item" data-index="${index}"
      class="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded transition">Sil</button>
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// Nav butonları
// ---------------------------------------------------------------------------
function _buildNavButtons(showBack, showNext, showSave = false) {
  return `
<div class="flex justify-between mt-4">
  ${showBack
    ? `<button type="button" data-action="prev-step"
        class="px-5 py-2.5 rounded-lg border-2 border-sea-200 text-sea-700 font-semibold text-sm hover:bg-sea-50 transition">
        ← Geri
       </button>`
    : '<span></span>'}
  ${showSave
    ? `<button type="button" id="ob-save-btn" data-action="save"
        class="px-6 py-2.5 rounded-lg bg-sea-600 text-white font-display font-bold text-sm
          hover:bg-sea-700 active:scale-95 transition shadow-deep disabled:opacity-50">
        Kaydet ve İncele
       </button>`
    : showNext
    ? `<button type="button" data-action="next-step"
        class="px-6 py-2.5 rounded-lg bg-sea-600 text-white font-display font-bold text-sm
          hover:bg-sea-700 active:scale-95 transition shadow-deep">
        İleri →
       </button>`
    : ''}
</div>`;
}

// ---------------------------------------------------------------------------
// Preview card
// ---------------------------------------------------------------------------
function _buildPreviewCard() {
  const d = state.data;
  const typeInfo = TYPE_LABELS[d.type] || {};
  return `
<div class="relative">
  ${d.coverUrl
    ? `<img src="${d.coverUrl}" class="w-full h-36 object-cover" />`
    : `<div class="w-full h-36 bg-gradient-to-br from-sea-200 to-sea-300 flex items-center justify-center text-4xl">${typeInfo.icon || '📍'}</div>`}
  ${d.type ? `<span class="absolute top-2 left-2 bg-sea-700/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">${typeInfo.label || ''}</span>` : ''}
</div>
<div class="p-4">
  <h3 class="font-display font-bold text-sea-800 text-sm leading-tight">${d.name || 'İşletme Adı'}</h3>
  ${d.summary ? `<p class="text-sea-600 text-xs mt-1 line-clamp-2">${d.summary}</p>` : ''}
  ${d.priceRange ? `<span class="inline-block mt-2 text-xs font-mono font-semibold text-sun-600">${d.priceRange}</span>` : ''}
  ${d.address ? `<p class="text-sea-500 text-[11px] mt-1">📍 ${d.address}</p>` : ''}
</div>`;
}

function _renderPreview() {
  const card = document.getElementById('ob-preview-card');
  if (card) card.innerHTML = _buildPreviewCard();
}

// ---------------------------------------------------------------------------
// Event binding
// ---------------------------------------------------------------------------
function _bindNav() {
  document.addEventListener('click', _handleClick, true);
}

function _bindStepEvents() {
  // Step 2: summary char count
  const sumEl = document.getElementById('ob-summary');
  const sumCount = document.getElementById('ob-summary-count');
  if (sumEl && sumCount) {
    sumEl.addEventListener('input', () => {
      sumCount.textContent = `${sumEl.value.length}/280`;
    });
  }

  // Step 3: map init
  if (state.step === 3) {
    _initMapPicker();
  }

  // Step 4: file drop zones
  if (state.step === 4) {
    _bindFilePickers();
  }
}

function _handleClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  switch (action) {
    case 'select-type':
      _syncToState(); // flush any prior changes
      state.data.type     = btn.dataset.value;
      state.data.category = ''; // reset kategori
      state.errors        = {};
      _render();
      break;

    case 'select-price':
      state.data.priceRange = btn.dataset.value;
      document.querySelectorAll('[data-action="select-price"]').forEach((b) => {
        const sel = b.dataset.value === state.data.priceRange;
        b.className = `px-4 py-2 rounded-lg border-2 font-mono font-semibold text-sm transition
          ${sel ? 'border-sea-600 bg-sea-600 text-white' : 'border-sea-200 bg-white text-sea-700 hover:border-sea-400'}`;
      });
      break;

    case 'next-step':
      _syncToState();
      if (_validateStep(state.step)) {
        state.step++;
        state.errors = {};
        _renderProgress();
        _renderStep();
      } else {
        _renderStep(); // re-render with errors
      }
      break;

    case 'prev-step':
      _syncToState();
      state.step = Math.max(1, state.step - 1);
      state.errors = {};
      _renderProgress();
      _renderStep();
      _renderPreview();
      break;

    case 'save':
      _syncToState();
      if (_validateStep(state.step)) {
        _save();
      } else {
        _renderStep();
      }
      break;

    case 'add-menu-item':
      state.data.menuItems.push({ category: '', name: '', description: '', price: '' });
      document.getElementById('ob-menu-list').innerHTML =
        state.data.menuItems.map((item, i) => _renderMenuItem(item, i)).join('') ||
        '<p class="text-sm text-sea-400 italic">Henüz ürün eklenmedi.</p>';
      break;

    case 'remove-menu-item': {
      const idx = parseInt(btn.dataset.index, 10);
      state.data.menuItems.splice(idx, 1);
      document.getElementById('ob-menu-list').innerHTML =
        state.data.menuItems.map((item, i) => _renderMenuItem(item, i)).join('') ||
        '<p class="text-sm text-sea-400 italic">Henüz ürün eklenmedi.</p>';
      break;
    }

    case 'move-menu': {
      const idx = parseInt(btn.dataset.index, 10);
      const dir = btn.dataset.direction;
      const items = state.data.menuItems;
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (targetIdx >= 0 && targetIdx < items.length) {
        [items[idx], items[targetIdx]] = [items[targetIdx], items[idx]];
        document.getElementById('ob-menu-list').innerHTML =
          items.map((item, i) => _renderMenuItem(item, i)).join('');
      }
      break;
    }

    case 'remove-gallery': {
      const idx = parseInt(btn.dataset.index, 10);
      state.data.galleryUrls.splice(idx, 1);
      state.data.galleryFiles.splice(idx, 1);
      _renderStep();
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Sync form values → state
// ---------------------------------------------------------------------------
function _syncToState() {
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

  // Menu items sync (step 4)
  document.querySelectorAll('[data-menu-field]').forEach((el) => {
    const idx   = parseInt(el.dataset.index, 10);
    const field = el.dataset.menuField;
    if (state.data.menuItems[idx]) {
      state.data.menuItems[idx][field] = el.value;
    }
  });

  _renderPreview();
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function _validateStep(step) {
  state.errors = {};
  if (step === 1) {
    if (!state.data.type) state.errors.type = 'Lütfen bir hizmet tipi seçin.';
  }
  if (step === 2) {
    if (!state.data.name) state.errors.name = 'İşletme adı zorunludur.';
    if (!state.data.category) state.errors.category = 'Kategori seçiniz.';
    if (state.data.summary.length > 280) state.errors.summary = 'Özet 280 karakteri aşamaz.';
  }
  if (step === 3) {
    if (!state.data.address) state.errors.address = 'Adres zorunludur.';
  }
  if (step === 4) {
    if (!state.data.coverFile && !state.data.coverUrl) {
      state.errors.cover = 'Kapak fotosu zorunludur.';
    }
  }
  return Object.keys(state.errors).length === 0;
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

  // Leaflet CSS
  if (!document.querySelector('link[href*="leaflet"]')) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  // Leaflet JS
  if (!window.L) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  if (_mapInstance) {
    _mapInstance.remove();
    _mapInstance = null;
  }

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
  _mapInstance.on('click', (e) => {
    marker.setLatLng(e.latlng);
    _updateCoords(e.latlng);
  });
}

// ---------------------------------------------------------------------------
// File pickers
// ---------------------------------------------------------------------------
function _bindFilePickers() {
  // Cover
  const coverZone  = document.getElementById('ob-cover-zone');
  const coverInput = document.getElementById('ob-cover-input');
  if (coverZone && coverInput) {
    coverZone.addEventListener('click', () => coverInput.click());
    coverZone.addEventListener('dragover', (e) => { e.preventDefault(); coverZone.classList.add('border-sea-500'); });
    coverZone.addEventListener('dragleave', () => coverZone.classList.remove('border-sea-500'));
    coverZone.addEventListener('drop', (e) => {
      e.preventDefault();
      coverZone.classList.remove('border-sea-500');
      const file = e.dataTransfer.files[0];
      if (file) _handleCoverFile(file);
    });
    coverInput.addEventListener('change', () => {
      if (coverInput.files[0]) _handleCoverFile(coverInput.files[0]);
    });
  }

  // Gallery
  const galleryZone  = document.getElementById('ob-gallery-zone');
  const galleryInput = document.getElementById('ob-gallery-input');
  if (galleryZone && galleryInput) {
    galleryZone.addEventListener('click', () => galleryInput.click());
    galleryZone.addEventListener('dragover', (e) => { e.preventDefault(); galleryZone.classList.add('border-sea-500'); });
    galleryZone.addEventListener('dragleave', () => galleryZone.classList.remove('border-sea-500'));
    galleryZone.addEventListener('drop', (e) => {
      e.preventDefault();
      galleryZone.classList.remove('border-sea-500');
      _handleGalleryFiles(Array.from(e.dataTransfer.files));
    });
    galleryInput.addEventListener('change', () => {
      _handleGalleryFiles(Array.from(galleryInput.files));
    });
  }
}

function _handleCoverFile(file) {
  if (!_validateFile(file)) return;
  state.data.coverFile = file;
  state.data.coverUrl  = URL.createObjectURL(file);
  state.errors.cover   = null;
  _renderStep();
  _renderPreview();
}

function _handleGalleryFiles(files) {
  const remaining = MAX_GALLERY - state.data.galleryUrls.length;
  const toAdd = files.filter(_validateFile).slice(0, remaining);
  toAdd.forEach((f) => {
    state.data.galleryFiles.push(f);
    state.data.galleryUrls.push(URL.createObjectURL(f));
  });
  _renderStep();
}

function _validateFile(file) {
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
// Save
// ---------------------------------------------------------------------------
async function _save() {
  if (state.saving) return;
  state.saving = true;

  const saveBtn = document.getElementById('ob-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Kaydediliyor...'; }
  _hideGlobalError();

  try {
    const uid       = state.user?.uid;
    const profileId = state.profileId || _generateProfileId();
    state.profileId = profileId;

    // Görselleri yükle
    let coverUrl   = state.data.coverUrl;
    let galleryUrls = [...state.data.galleryUrls];

    if (_getStorage && _ref && _uploadBytes && _getDownloadURL) {
      const storage = _getStorage();

      if (state.data.coverFile) {
        const coverRef = _ref(storage, `profiles/${profileId}/cover.jpg`);
        await _uploadBytes(coverRef, state.data.coverFile);
        coverUrl = await _getDownloadURL(coverRef);
      }

      for (let i = 0; i < state.data.galleryFiles.length; i++) {
        const file = state.data.galleryFiles[i];
        if (!file) continue;
        const gRef = _ref(storage, `profiles/${profileId}/gallery/${i}.jpg`);
        await _uploadBytes(gRef, file);
        galleryUrls[i] = await _getDownloadURL(gRef);
      }
    }

    // Firestore dokümanı
    const profileDoc = {
      ownerUid:    uid,
      type:        state.data.type,
      status:      'pending',
      name:        state.data.name,
      slug:        uniqueSlug(state.data.name),
      category:    state.data.category,
      summary:     state.data.summary,
      descriptionML: { tr: state.data.description },
      priceRange:  state.data.priceRange,
      coverImage:  coverUrl,
      images:      galleryUrls,
      menu:        state.data.menuItems.filter((m) => m.name),
      contact: {
        phone:    state.data.phone,
        whatsapp: state.data.whatsapp,
        email:    state.data.email,
        website:  state.data.website,
      },
      location: {
        address: state.data.address,
        lat:     state.data.lat,
        lng:     state.data.lng,
      },
      ratingAvg:   0,
      ratingCount: 0,
    };

    if (_db && _doc && _setDoc && _serverTimestamp) {
      profileDoc.createdAt = _serverTimestamp();
      profileDoc.updatedAt = _serverTimestamp();
      await _setDoc(_doc(_db, 'profiles', profileId), profileDoc);
    }

    // Draft temizle
    _clearDraft();

    // Başarı ekranı
    _renderSuccess(profileId);

  } catch (err) {
    console.error('[onboarding] save error:', err);
    _showGlobalError('Kayıt sırasında hata oluştu. Lütfen tekrar deneyin.');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Kaydet ve İncele'; }
  } finally {
    state.saving = false;
  }
}

function _renderSuccess(profileId) {
  $root.innerHTML = `
<div class="bg-white rounded-xl p-8 shadow-card text-center max-w-md mx-auto">
  <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
  </div>
  <h2 class="font-display font-bold text-xl text-sea-800 mb-2">Profilin Gönderildi!</h2>
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
function _autosave() {
  if (!state.user) return;
  _syncToState();
  const key = `${DRAFT_KEY_PREFIX}${state.user.uid}`;
  try {
    localStorage.setItem(key, JSON.stringify({
      step: state.step,
      data: {
        ...state.data,
        coverFile:    null,
        galleryFiles: [],
        coverUrl:     state.data.coverUrl?.startsWith('blob:') ? '' : state.data.coverUrl,
        galleryUrls:  state.data.galleryUrls.filter((u) => !u.startsWith('blob:')),
      },
    }));
  } catch { /* localStorage dolu olabilir */ }
}

function _loadDraft() {
  if (!state.user) return;
  const key = `${DRAFT_KEY_PREFIX}${state.user.uid}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.step = parsed.step || 1;
    Object.assign(state.data, parsed.data || {});
    state.data.coverFile    = null;
    state.data.galleryFiles = [];
  } catch { /* corrupted draft — ignore */ }
}

function _clearDraft() {
  if (!state.user) return;
  localStorage.removeItem(`${DRAFT_KEY_PREFIX}${state.user.uid}`);
}

// ---------------------------------------------------------------------------
// ID üretici
// ---------------------------------------------------------------------------
function _generateProfileId() {
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Global hata banner
// ---------------------------------------------------------------------------
function _showGlobalError(msg) {
  if ($globalErr && $globalErrMsg) {
    $globalErrMsg.textContent = msg;
    $globalErr.classList.remove('hidden');
    $globalErr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function _hideGlobalError() {
  if ($globalErr) $globalErr.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// HTML escape
// ---------------------------------------------------------------------------
function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
