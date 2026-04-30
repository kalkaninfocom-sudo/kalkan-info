/**
 * Kalkan Info — Reviews Component
 * Faz 3: Yeniden kullanılabilir yorum & değerlendirme sistemi
 * Firebase Firestore SDK v10 (modular, CDN)
 *
 * Kullanım:
 *   import { mountReviews } from './reviews.js';
 *   mountReviews({ target: '#reviews-mount', targetType: 'profile', targetId: 'restoran-mehmet' });
 */

import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit as fsLimit,
  startAfter,
  addDoc,
  serverTimestamp,
  getDocs,
  doc,
  updateDoc,
  increment,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// ---------------------------------------------------------------------------
// Firebase bootstrap — auth.js'in init ettiği app'i kullan
// ---------------------------------------------------------------------------
let _db   = null;
let _stor = null;

function _getDB() {
  if (_db) return _db;
  try {
    const { getApp } = /** @type {any} */ (window.__firebaseModules || {});
    if (getApp) {
      const app = getApp();
      _db   = getFirestore(app);
      _stor = getStorage(app);
      return _db;
    }
    // CDN import path fallback
    throw new Error('getApp not found');
  } catch {
    console.warn('[reviews] Firebase henüz yapılandırılmadı. auth.js yüklendikten sonra çağırın.');
    return null;
  }
}

function _getStor() {
  if (_stor) return _stor;
  _getDB(); // side-effect: _stor da set edilir
  return _stor;
}

// auth.js'den currentUser import et — yoksa graceful fallback
let _currentUser = null;
try {
  const authMod = await import('./auth.js');
  _currentUser = authMod.currentUser;
} catch {
  _currentUser = () => null;
}

// ---------------------------------------------------------------------------
// i18n — js/i18n.js varsa kullan, yoksa Türkçe fallback
// ---------------------------------------------------------------------------
let _t = null;
try {
  const i18nMod = await import('./i18n.js');
  _t = i18nMod.t;
} catch {
  _t = null;
}

const _STRINGS = {
  'reviews.write_review':      'Yorum Yaz',
  'reviews.rating':            'Puanınız',
  'reviews.placeholder':       'Deneyiminizi paylaşın… (en az 10, en fazla 2000 karakter)',
  'reviews.add_photos':        'Fotoğraf Ekle (maks. 5)',
  'reviews.submit':            'Gönder',
  'reviews.submitting':        'Gönderiliyor…',
  'reviews.login_required':    'Yorum yazmak için giriş yapın',
  'reviews.verify_email':      'Yorum yazabilmek için e-posta adresinizi doğrulamanız gerekiyor.',
  'reviews.helpful':           'Yararlı',
  'reviews.report':            'Şikayet et',
  'reviews.load_more':         'Daha Fazla Yorum',
  'reviews.no_reviews':        'Henüz yorum yok. İlk yorumu sen yaz!',
  'reviews.reply_label':       'İşletme Yanıtı',
  'reviews.reply_btn':         'Yanıt Yaz',
  'reviews.reply_disabled':    'Yanıt özelliği yakında',
  'reviews.photo_limit':       'En fazla 5 fotoğraf yükleyebilirsiniz.',
  'reviews.photo_size':        'Her fotoğraf en fazla 3 MB olabilir.',
  'reviews.submit_success':    'Yorumunuz paylaşıldı!',
  'reviews.submit_error':      'Yorum gönderilemedi. Lütfen tekrar deneyin.',
  'reviews.text_min':          'Yorum en az 10 karakter olmalıdır.',
  'reviews.select_rating':     'Lütfen bir puan seçin.',
  'reviews.total_reviews':     'değerlendirme',
  'reviews.avg_rating':        'ortalama puan',
  'reviews.char_remaining':    'karakter kaldı',
  'reviews.helpful_toast':     'Teşekkürler! (yakında)',
  'reviews.report_toast':      'Şikayetiniz alındı. (yakında)',
  'reviews.lightbox_close':    'Kapat',
};

function t(key) {
  if (_t) {
    const val = _t(key);
    if (val !== key) return val;
  }
  return _STRINGS[key] || key;
}

// ---------------------------------------------------------------------------
// XSS koruması
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------
function _stars(rating, interactive = false, name = '') {
  const stars = [1, 2, 3, 4, 5];
  if (interactive) {
    return `
      <div class="stars-input flex gap-1" role="radiogroup" aria-label="${t('reviews.rating')}">
        ${stars.map(n => `
          <button type="button"
            class="star-btn text-2xl leading-none transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 rounded"
            data-value="${n}"
            aria-label="${n} yıldız"
            style="color:#d1d5db;">★</button>
        `).join('')}
      </div>`;
  }
  const full  = Math.round(rating);
  return `<span class="flex gap-0.5" aria-label="${rating} yıldız">` +
    stars.map(n => `<span style="color:${n <= full ? '#f4b53d' : '#d1d5db'};" aria-hidden="true">★</span>`).join('') +
    `</span>`;
}

function _avatar(name, photoURL) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  if (photoURL) {
    return `<img src="${escapeHtml(photoURL)}" alt="${escapeHtml(name)}" class="w-10 h-10 rounded-full object-cover" loading="lazy">`;
  }
  const colors = ['#1a5e93','#134c79','#0d3a5f','#e89812','#c97c08'];
  const bg = colors[initials.charCodeAt(0) % colors.length];
  return `<div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style="background:${bg};">${escapeHtml(initials)}</div>`;
}

function _relativeTime(ts) {
  if (!ts) return '';
  const now  = Date.now();
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 60)   return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dakika önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} gün önce`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function _ratingLabel(r) {
  const labels = { 5: 'Mükemmel', 4: 'Çok İyi', 3: 'İyi', 2: 'Orta', 1: 'Kötü' };
  return labels[r] || '';
}

// ---------------------------------------------------------------------------
// Firestore işlemleri
// ---------------------------------------------------------------------------

/**
 * Yorumları Firestore'dan yükler
 * @param {string} targetType
 * @param {string} targetId
 * @param {{ limit?: number, after?: any }} opts
 * @returns {Promise<{ reviews: any[], lastDoc: any }>}
 */
export async function loadReviews(targetType, targetId, { limit: lim = 10, after = null } = {}) {
  const db = _getDB();
  if (!db) return { reviews: [], lastDoc: null };

  try {
    const constraints = [
      where('targetType', '==', targetType),
      where('targetId',   '==', targetId),
      where('status',     '==', 'visible'),
      orderBy('createdAt', 'desc'),
      fsLimit(lim),
    ];
    if (after) constraints.push(startAfter(after));

    const q   = query(collection(db, 'reviews'), ...constraints);
    const snap = await getDocs(q);
    const reviews  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const lastDoc  = snap.docs[snap.docs.length - 1] || null;
    return { reviews, lastDoc };
  } catch (err) {
    console.error('[reviews] loadReviews hatası:', err);
    return { reviews: [], lastDoc: null };
  }
}

/**
 * Yorum gönder — auth + e-posta doğrulaması zorunlu
 * @param {{ targetType: string, targetId: string, rating: number, text: string, photos?: File[] }} params
 */
export async function submitReview({ targetType, targetId, rating, text, photos = [] }) {
  const db   = _getDB();
  const stor = _getStor();
  const user = _currentUser?.();

  if (!user)            return { ok: false, message: t('reviews.login_required') };
  if (!user.emailVerified) return { ok: false, message: t('reviews.verify_email') };
  if (!db)              return { ok: false, message: 'Firebase bağlantısı yok.' };

  const trimmed = text.trim();
  if (!rating || rating < 1 || rating > 5) return { ok: false, message: t('reviews.select_rating') };
  if (trimmed.length < 10)                  return { ok: false, message: t('reviews.text_min') };

  // Fotoğraf yükleme
  const photoPaths = [];
  if (photos.length && stor) {
    const tempId = doc(collection(db, 'reviews')).id;
    for (let i = 0; i < Math.min(photos.length, 5); i++) {
      try {
        const file     = photos[i];
        const fileRef  = storageRef(stor, `reviews/${tempId}/${i}.jpg`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        photoPaths.push(url);
      } catch (err) {
        console.error('[reviews] Fotoğraf yükleme hatası:', err);
      }
    }
  }

  try {
    const docRef = await addDoc(collection(db, 'reviews'), {
      targetType,
      targetId,
      authorUid:   user.uid,
      authorName:  user.displayName || 'Anonim',
      authorPhoto: user.photoURL    || null,
      rating,
      text:        trimmed,
      photos:      photoPaths,
      status:      'visible',
      helpful:     0,
      reply:       null,
      createdAt:   serverTimestamp(),
    });
    return { ok: true, id: docRef.id };
  } catch (err) {
    console.error('[reviews] submitReview hatası:', err);
    return { ok: false, message: t('reviews.submit_error') };
  }
}

/**
 * Profil sahibi yanıtı — şimdilik Cloud Function üzerinden yapılacak
 * TODO: Cloud Function `replyToReview(reviewId, text)` implemente edilince aktif et
 * @param {string} _reviewId
 * @param {string} _text
 */
export async function replyToReview(_reviewId, _text) {
  // TODO: getFunctions + httpsCallable ile Cloud Function çağrısı
  console.info('[reviews] replyToReview: Cloud Function henüz implemente edilmedi.');
  return { ok: false, message: 'Yanıt özelliği yakında aktif olacak.' };
}

/**
 * Yararlı işaretle — Cloud Function callable (TODO)
 * @param {string} _reviewId
 */
export async function markHelpful(_reviewId) {
  // TODO: Cloud Function `markHelpful` callable
  console.info('[reviews] markHelpful: Cloud Function henüz implemente edilmedi.');
  return { ok: false, message: 'Yakında' };
}

/**
 * Yorum şikayet et — Cloud Function callable (TODO)
 * @param {string} _reviewId
 * @param {string} _reason
 */
export async function reportReview(_reviewId, _reason) {
  // TODO: Cloud Function `reportReview` callable
  console.info('[reviews] reportReview: Cloud Function henüz implemente edilmedi.');
  return { ok: false, message: 'Yakında' };
}

// ---------------------------------------------------------------------------
// Özet bandı (ortalama puan, dağılım)
// ---------------------------------------------------------------------------
async function _buildSummary(targetType, targetId) {
  const db = _getDB();
  if (!db) return { avg: 0, count: 0, dist: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };

  try {
    const q    = query(
      collection(db, 'reviews'),
      where('targetType', '==', targetType),
      where('targetId',   '==', targetId),
      where('status',     '==', 'visible'),
    );
    const snap = await getDocs(q);
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let total  = 0;

    snap.docs.forEach(d => {
      const r = d.data().rating;
      if (r >= 1 && r <= 5) {
        dist[r]++;
        total += r;
      }
    });

    const count = snap.docs.length;
    const avg   = count ? Math.round((total / count) * 10) / 10 : 0;
    return { avg, count, dist };
  } catch (err) {
    console.error('[reviews] _buildSummary hatası:', err);
    return { avg: 0, count: 0, dist: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
  }
}

// ---------------------------------------------------------------------------
// HTML render fonksiyonları
// ---------------------------------------------------------------------------

function _renderSummaryBand(avg, count, dist) {
  const maxBar = Math.max(...Object.values(dist), 1);
  const distRows = [5, 4, 3, 2, 1].map(n => {
    const pct = Math.round((dist[n] / maxBar) * 100);
    return `
      <div class="flex items-center gap-2 text-sm">
        <span class="w-3 text-sea-600 font-medium text-right">${n}</span>
        <span style="color:#f4b53d;" class="text-xs">★</span>
        <div class="flex-1 bg-sea-100 rounded-full h-2 overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500"
               style="width:${pct}%; background:#f4b53d;"></div>
        </div>
        <span class="w-5 text-sea-500 text-xs text-right">${dist[n]}</span>
      </div>`;
  }).join('');

  return `
    <div class="reviews-summary card-base rounded-xl p-5 mb-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
      <div class="flex flex-col items-center gap-1 min-w-[88px]">
        <span class="text-5xl font-display font-extrabold text-sea-700 leading-none">${avg || '—'}</span>
        <div class="mt-1">${_stars(avg)}</div>
        <span class="text-xs text-sea-400 mt-1">${count} ${t('reviews.total_reviews')}</span>
      </div>
      <div class="flex-1 w-full flex flex-col gap-1.5">${distRows}</div>
    </div>`;
}

function _renderWriteCard(user) {
  if (!user) {
    return `
      <div class="reviews-login-prompt card-base rounded-xl p-5 mb-6 flex items-center gap-3 text-sea-600">
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        <a href="login.html" class="underline font-medium hover:text-sea-800 transition-colors">
          ${t('reviews.login_required')}
        </a>
      </div>`;
  }

  if (!user.emailVerified) {
    return `
      <div class="reviews-verify-prompt card-base rounded-xl p-5 mb-6 text-amber-700 bg-amber-50 border border-amber-200 text-sm">
        ${escapeHtml(t('reviews.verify_email'))}
      </div>`;
  }

  return `
    <div class="reviews-write-card card-base rounded-xl p-5 mb-6">
      <h3 class="font-display font-bold text-sea-800 text-base mb-4">${t('reviews.write_review')}</h3>
      <form class="reviews-form flex flex-col gap-4" novalidate>
        <!-- Yıldız seçici -->
        <div>
          <label class="block text-sm font-medium text-sea-700 mb-2">${t('reviews.rating')}</label>
          ${_stars(0, true)}
          <input type="hidden" name="rating" value="0">
        </div>

        <!-- Metin alanı -->
        <div>
          <textarea
            name="text"
            rows="4"
            maxlength="2000"
            placeholder="${escapeHtml(t('reviews.placeholder'))}"
            class="reviews-textarea w-full rounded-lg border border-sea-200 bg-white px-4 py-3 text-sm text-sea-800 placeholder-sea-300 focus:outline-none focus:ring-2 focus:ring-sea-400 resize-none transition"
          ></textarea>
          <p class="reviews-char-counter text-xs text-sea-400 text-right mt-1">2000 ${t('reviews.char_remaining')}</p>
        </div>

        <!-- Fotoğraf yükleme -->
        <div>
          <label class="flex items-center gap-2 text-sm font-medium text-sea-700 cursor-pointer w-fit">
            <span class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sea-200 hover:border-sea-400 transition-colors bg-sea-50 hover:bg-sea-100">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              ${t('reviews.add_photos')}
            </span>
            <input type="file" name="photos" accept="image/*" multiple class="sr-only">
          </label>
          <div class="reviews-photo-preview flex gap-2 flex-wrap mt-2"></div>
          <p class="reviews-file-error text-xs text-coral-500 mt-1 hidden"></p>
        </div>

        <!-- Hata / başarı mesajı -->
        <p class="reviews-form-error text-sm text-coral-500 hidden"></p>

        <!-- Gönder -->
        <button type="submit"
          class="reviews-submit-btn self-start px-6 py-2.5 rounded-lg bg-sea-500 hover:bg-sea-600 active:bg-sea-700 text-white font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
          ${t('reviews.submit')}
        </button>
      </form>
    </div>`;
}

function _renderReviewCard(review) {
  const photosHtml = (review.photos || []).map((url, i) => `
    <button type="button"
      class="review-photo-thumb w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea-400"
      data-photo="${escapeHtml(url)}"
      data-index="${i}"
      aria-label="Fotoğrafı büyüt">
      <img src="${escapeHtml(url)}" alt="" class="w-full h-full object-cover" loading="lazy">
    </button>`).join('');

  const replyHtml = review.reply ? `
    <div class="mt-3 pl-4 border-l-2 border-sea-200 bg-sea-50 rounded-r-lg py-3 pr-3">
      <p class="text-xs font-semibold text-sea-600 mb-1">${t('reviews.reply_label')}</p>
      <p class="text-sm text-sea-700 leading-relaxed">${escapeHtml(review.reply.text || '')}</p>
    </div>` : '';

  return `
    <article class="review-card card-base card-hover rounded-xl p-5 flex flex-col gap-3" data-review-id="${escapeHtml(review.id)}">
      <!-- Header -->
      <div class="flex items-start gap-3">
        ${_avatar(review.authorName, review.authorPhoto)}
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sea-800 text-sm truncate">${escapeHtml(review.authorName || 'Anonim')}</p>
          <div class="flex items-center gap-2 mt-0.5 flex-wrap">
            ${_stars(review.rating)}
            <span class="text-xs font-medium text-sun-500">${_ratingLabel(review.rating)}</span>
            <span class="text-xs text-sea-400">${_relativeTime(review.createdAt)}</span>
          </div>
        </div>
      </div>

      <!-- Metin -->
      <p class="text-sm text-sea-700 leading-relaxed whitespace-pre-line">${escapeHtml(review.text)}</p>

      <!-- Fotoğraflar -->
      ${photosHtml ? `<div class="flex gap-2 flex-wrap">${photosHtml}</div>` : ''}

      <!-- Yanıt -->
      ${replyHtml}

      <!-- Aksiyonlar -->
      <div class="flex items-center gap-4 pt-1 border-t border-sea-50">
        <button type="button"
          class="helpful-btn flex items-center gap-1.5 text-xs text-sea-400 hover:text-sea-600 active:text-sea-800 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sea-400 rounded"
          data-review-id="${escapeHtml(review.id)}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017a2 2 0 01-1.789-1.106l-3.5-7A2 2 0 017.236 10H12V5a1 1 0 011-1h.764l.072.005A2 2 0 0116 6v3.5L14 10z"/>
          </svg>
          ${t('reviews.helpful')} (${review.helpful || 0})
        </button>
        <button type="button"
          class="report-btn text-xs text-sea-300 hover:text-coral-500 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-coral-400 rounded"
          data-review-id="${escapeHtml(review.id)}">
          ${t('reviews.report')}
        </button>
        <button type="button"
          class="reply-owner-btn ml-auto text-xs text-sea-300 cursor-not-allowed opacity-50"
          disabled
          title="${t('reviews.reply_disabled')}">
          ${t('reviews.reply_btn')}
        </button>
      </div>
    </article>`;
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------
function _openLightbox(url, container) {
  const existing = container.querySelector('.reviews-lightbox');
  if (existing) existing.remove();

  const lb = document.createElement('div');
  lb.className = 'reviews-lightbox fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.innerHTML = `
    <button type="button"
      class="lightbox-close absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
      aria-label="${t('reviews.lightbox_close')}">✕</button>
    <img src="${escapeHtml(url)}" alt=""
      class="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-deep"
      style="box-shadow: 0 8px 32px rgba(0,0,0,0.6);">`;

  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.classList.contains('lightbox-close')) lb.remove();
  });

  const handleKey = (e) => { if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', handleKey); } };
  document.addEventListener('keydown', handleKey);

  document.body.appendChild(lb);
  lb.querySelector('.lightbox-close')?.focus();
}

// ---------------------------------------------------------------------------
// Yorum yazma formu — event binding
// ---------------------------------------------------------------------------
function _bindWriteCard(container, targetType, targetId, onSubmitted) {
  const form = container.querySelector('.reviews-form');
  if (!form) return;

  const starsContainer = form.querySelector('.stars-input');
  const ratingInput    = form.querySelector('[name="rating"]');
  const textarea       = form.querySelector('[name="text"]');
  const charCounter    = form.querySelector('.reviews-char-counter');
  const fileInput      = form.querySelector('[name="photos"]');
  const photoPreview   = form.querySelector('.reviews-photo-preview');
  const fileError      = form.querySelector('.reviews-file-error');
  const formError      = form.querySelector('.reviews-form-error');
  const submitBtn      = form.querySelector('.reviews-submit-btn');

  let selectedRating = 0;
  let selectedFiles  = [];

  // Yıldız seçici
  if (starsContainer) {
    const starBtns = starsContainer.querySelectorAll('.star-btn');

    const _updateStars = (val, isHover = false) => {
      starBtns.forEach((btn, i) => {
        btn.style.color = i < val ? '#f4b53d' : '#d1d5db';
        btn.style.transform = i < val ? 'scale(1.15)' : 'scale(1)';
      });
    };

    starBtns.forEach((btn) => {
      btn.addEventListener('mouseenter', () => _updateStars(+btn.dataset.value, true));
      btn.addEventListener('mouseleave', () => _updateStars(selectedRating));
      btn.addEventListener('click', () => {
        selectedRating = +btn.dataset.value;
        ratingInput.value = selectedRating;
        _updateStars(selectedRating);
      });
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectedRating = +btn.dataset.value;
          ratingInput.value = selectedRating;
          _updateStars(selectedRating);
        }
      });
    });
  }

  // Karakter sayacı
  if (textarea && charCounter) {
    textarea.addEventListener('input', () => {
      const remaining = 2000 - textarea.value.length;
      charCounter.textContent = `${remaining} ${t('reviews.char_remaining')}`;
      charCounter.style.color = remaining < 100 ? '#e74c3c' : '';
    });
  }

  // Fotoğraf seçimi
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      fileError.classList.add('hidden');
      const files = Array.from(fileInput.files || []);

      const overCount = files.length > 5;
      const overSize  = files.some(f => f.size > 3 * 1024 * 1024);

      if (overCount) { fileError.textContent = t('reviews.photo_limit'); fileError.classList.remove('hidden'); return; }
      if (overSize)  { fileError.textContent = t('reviews.photo_size');  fileError.classList.remove('hidden'); return; }

      selectedFiles = files;
      photoPreview.innerHTML = selectedFiles.map((f, i) => {
        const url = URL.createObjectURL(f);
        return `
          <div class="relative w-16 h-16">
            <img src="${url}" alt="" class="w-full h-full object-cover rounded-lg">
            <button type="button"
              class="photo-remove absolute -top-1 -right-1 w-5 h-5 bg-coral-500 text-white rounded-full text-xs flex items-center justify-center leading-none hover:bg-coral-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-coral-400"
              data-index="${i}" aria-label="Fotoğrafı kaldır">✕</button>
          </div>`;
      }).join('');

      photoPreview.querySelectorAll('.photo-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = +btn.dataset.index;
          selectedFiles.splice(idx, 1);
          fileInput.value = '';
          fileInput.dispatchEvent(new Event('change'));
        });
      });
    });
  }

  // Form gönder
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.classList.add('hidden');

    const text   = textarea?.value.trim() || '';
    const rating = +ratingInput.value;

    if (!rating)       { formError.textContent = t('reviews.select_rating'); formError.classList.remove('hidden'); return; }
    if (text.length < 10) { formError.textContent = t('reviews.text_min'); formError.classList.remove('hidden'); return; }

    submitBtn.disabled    = true;
    submitBtn.textContent = t('reviews.submitting');

    // Optimistic UI — anlık yorum
    const user = _currentUser?.();
    const optimisticReview = {
      id:          '_optimistic_' + Date.now(),
      targetType,  targetId,
      authorUid:   user?.uid || '',
      authorName:  user?.displayName || 'Anonim',
      authorPhoto: user?.photoURL    || null,
      rating,
      text,
      photos:      selectedFiles.map(f => URL.createObjectURL(f)),
      status:      'visible',
      helpful:     0,
      reply:       null,
      createdAt:   { toDate: () => new Date() },
    };

    if (onSubmitted) onSubmitted(optimisticReview, 'optimistic');

    const result = await submitReview({ targetType, targetId, rating, text, photos: selectedFiles });

    submitBtn.disabled    = false;
    submitBtn.textContent = t('reviews.submit');

    if (result.ok) {
      form.reset();
      selectedFiles  = [];
      selectedRating = 0;
      if (photoPreview) photoPreview.innerHTML = '';
      if (charCounter)  charCounter.textContent = `2000 ${t('reviews.char_remaining')}`;
      // Yıldızları sıfırla
      form.querySelectorAll('.star-btn').forEach(b => { b.style.color = '#d1d5db'; b.style.transform = 'scale(1)'; });

      if (onSubmitted) onSubmitted({ ...optimisticReview, id: result.id }, 'confirmed');

      const successMsg = document.createElement('p');
      successMsg.className = 'text-sm text-green-600 font-medium';
      successMsg.textContent = t('reviews.submit_success');
      form.insertAdjacentElement('afterend', successMsg);
      setTimeout(() => successMsg.remove(), 4000);
    } else {
      // Optimistik yorumu geri al
      if (onSubmitted) onSubmitted(optimisticReview, 'rollback');
      formError.textContent = result.message || t('reviews.submit_error');
      formError.classList.remove('hidden');
    }
  });
}

// ---------------------------------------------------------------------------
// mountReviews — ana public API
// ---------------------------------------------------------------------------

/**
 * Belirtilen DOM elementine yorum bloğunu render eder
 * @param {{ target: string|HTMLElement, targetType: string, targetId: string, locale?: string }} opts
 */
export async function mountReviews({ target, targetType, targetId, locale = 'tr' }) {
  // Locale load (i18n.js'e bildir)
  if (_t && typeof window !== 'undefined') {
    try {
      const i18nMod = await import('./i18n.js');
      if (i18nMod.loadLang) await i18nMod.loadLang(locale);
    } catch { /* sessiz geç */ }
  }

  const container = typeof target === 'string'
    ? document.querySelector(target)
    : target;

  if (!container) {
    console.warn('[reviews] mountReviews: hedef element bulunamadı:', target);
    return;
  }

  container.innerHTML = `
    <section class="reviews-root font-body max-w-2xl mx-auto" aria-label="Yorumlar">
      <div class="reviews-summary-placeholder animate-pulse bg-sea-100 rounded-xl h-28 mb-6"></div>
      <div class="reviews-list-container flex flex-col gap-4">
        <div class="animate-pulse bg-sea-100 rounded-xl h-32"></div>
        <div class="animate-pulse bg-sea-100 rounded-xl h-32"></div>
      </div>
    </section>`;

  const user = _currentUser?.();

  // Özet & liste paralel yükle
  const [summary, initial] = await Promise.all([
    _buildSummary(targetType, targetId),
    loadReviews(targetType, targetId, { limit: 10 }),
  ]);

  let lastDoc       = initial.lastDoc;
  let reviewsList   = [...initial.reviews];

  // Optimistik listesini track et
  const _optimisticIds = new Set();

  function _renderList() {
    const listEl = container.querySelector('.reviews-list-container');
    if (!listEl) return;
    if (!reviewsList.length) {
      listEl.innerHTML = `<p class="text-sm text-sea-400 text-center py-8">${t('reviews.no_reviews')}</p>`;
      return;
    }
    listEl.innerHTML = reviewsList.map(_renderReviewCard).join('') +
      (lastDoc ? `
        <button type="button"
          class="load-more-btn w-full py-3 rounded-xl border border-sea-200 text-sea-600 text-sm font-medium hover:bg-sea-50 hover:border-sea-400 active:bg-sea-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea-400 mt-2">
          ${t('reviews.load_more')}
        </button>` : '');

    // Fotoğraf lightbox
    listEl.querySelectorAll('.review-photo-thumb').forEach((btn) => {
      btn.addEventListener('click', () => _openLightbox(btn.dataset.photo, container));
    });

    // Yararlı
    listEl.querySelectorAll('.helpful-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await markHelpful(btn.dataset.reviewId);
        _showToast(container, t('reviews.helpful_toast'));
      });
    });

    // Şikayet
    listEl.querySelectorAll('.report-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await reportReview(btn.dataset.reviewId, 'inappropriate');
        _showToast(container, t('reviews.report_toast'));
      });
    });

    // Daha fazla
    const loadMoreBtn = listEl.querySelector('.load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', async () => {
        loadMoreBtn.disabled    = true;
        loadMoreBtn.textContent = 'Yükleniyor…';
        const more = await loadReviews(targetType, targetId, { limit: 10, after: lastDoc });
        lastDoc       = more.lastDoc;
        reviewsList   = [...reviewsList, ...more.reviews];
        _renderList();
      });
    }
  }

  // Optimistik callback
  function _onSubmitted(review, phase) {
    if (phase === 'optimistic') {
      _optimisticIds.add(review.id);
      reviewsList = [review, ...reviewsList.filter(r => !_optimisticIds.has(r.id))];
      _renderList();
    } else if (phase === 'confirmed') {
      // Optimistik kaydı gerçek ID ile değiştir
      _optimisticIds.delete(review.id.startsWith('_optimistic') ? review.id : null);
      reviewsList = reviewsList.map(r =>
        r.id.startsWith('_optimistic_') ? review : r
      );
      _renderList();
    } else if (phase === 'rollback') {
      reviewsList = reviewsList.filter(r => !r.id.startsWith('_optimistic_'));
      _renderList();
    }
  }

  // Final render
  container.innerHTML = `
    <section class="reviews-root font-body max-w-2xl mx-auto" aria-label="Yorumlar">
      ${_renderSummaryBand(summary.avg, summary.count, summary.dist)}
      ${_renderWriteCard(user)}
      <div class="reviews-list-container flex flex-col gap-4"></div>
    </section>`;

  _renderList();
  _bindWriteCard(container, targetType, targetId, _onSubmitted);
}

// ---------------------------------------------------------------------------
// Toast yardımcısı
// ---------------------------------------------------------------------------
function _showToast(container, message) {
  const existing = container.querySelector('.reviews-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'reviews-toast fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-sea-800 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-deep opacity-0 transition-opacity duration-300';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
