/**
 * Kalkan Info — Villa Detay Modal + Yorum Sistemi
 * villa_reviews tablosu kullanır (villa_id: text, anon key + RLS)
 */

import { supabase } from './supabase-client.js';

// ---------------------------------------------------------------------------
// XSS yardımcısı
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

// ---------------------------------------------------------------------------
// Yıldız render
// ---------------------------------------------------------------------------
function starsHtml(rating) {
  const n = Math.round(rating || 0);
  return [1, 2, 3, 4, 5].map(i =>
    `<span style="color:${i <= n ? '#f4b53d' : '#d1d5db'};">★</span>`
  ).join('');
}

function starsInput(name) {
  return `
    <div class="vm-stars-input flex gap-1" data-name="${name}">
      ${[1,2,3,4,5].map(n => `
        <button type="button" class="vm-star-btn text-2xl leading-none transition-transform hover:scale-110"
          data-value="${n}" style="color:#d1d5db;" aria-label="${n} yıldız">★</button>
      `).join('')}
      <input type="hidden" name="${name}" value="0">
    </div>`;
}

// ---------------------------------------------------------------------------
// Tarih formatlama
// ---------------------------------------------------------------------------
function relTime(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} gün önce`;
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
function showToast(msg, ok = true) {
  const existing = document.querySelector('.vm-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'vm-toast fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg opacity-0 transition-opacity duration-300';
  t.style.background = ok ? '#0d6e3f' : '#c0392b';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; });
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3500);
}

// ---------------------------------------------------------------------------
// Reviews: fetch
// ---------------------------------------------------------------------------
async function fetchReviews(villaId) {
  const { data, error } = await supabase
    .from('villa_reviews')
    .select('id, reviewer_name, rating, title, body, created_at')
    .eq('villa_id', villaId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    console.error('[villa-modal] fetchReviews:', error.message);
    return [];
  }
  return data || [];
}

// ---------------------------------------------------------------------------
// Reviews: render listesi
// ---------------------------------------------------------------------------
function renderReviewList(reviews) {
  if (!reviews.length) {
    return `<p class="text-sm text-sea-400 text-center py-8">Henüz yorum yok. İlk yorumu sen yaz!</p>`;
  }
  return reviews.map(r => `
    <article class="bg-sea-50 rounded-xl p-4 flex flex-col gap-2 border border-sea-100">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-sea-200 grid place-items-center text-sea-700 text-xs font-bold flex-shrink-0">
            ${esc((r.reviewer_name || '?').slice(0, 2).toUpperCase())}
          </div>
          <span class="font-semibold text-sea-800 text-sm">${esc(r.reviewer_name)}</span>
        </div>
        <span class="text-xs text-sea-400">${relTime(r.created_at)}</span>
      </div>
      <div class="flex items-center gap-1 text-base">${starsHtml(r.rating)}</div>
      ${r.title ? `<p class="font-semibold text-sea-700 text-sm">${esc(r.title)}</p>` : ''}
      <p class="text-sm text-sea-700 leading-relaxed">${esc(r.body)}</p>
    </article>
  `).join('');
}

// ---------------------------------------------------------------------------
// Reviews: submit
// ---------------------------------------------------------------------------
async function submitReview({ villaId, reviewerName, rating, title, body, userId }) {
  const { error } = await supabase
    .from('villa_reviews')
    .insert({
      villa_id:      villaId,
      user_id:       userId || null,
      reviewer_name: reviewerName,
      rating,
      title:         title || null,
      body,
      status:        'pending',
    });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Modal HTML builder
// ---------------------------------------------------------------------------
function buildModalHtml(villa) {
  const images = (villa.gallery && villa.gallery.length) ? villa.gallery : [villa.image].filter(Boolean);
  const features = (villa.features || []).map(f => `
    <span class="inline-flex items-center gap-1 text-[11px] bg-sea-50 border border-sea-100 text-sea-700 px-2 py-1 rounded-full font-medium">${esc(f)}</span>
  `).join('');
  const tags = (villa.tags || []).map(t =>
    `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sea-600/10 text-sea-600">${esc(t)}</span>`
  ).join('');

  const gallerySlides = images.map((src, i) => `
    <div class="vm-slide absolute inset-0 transition-opacity duration-300" style="opacity:${i === 0 ? 1 : 0};">
      <img src="${esc(src)}" alt="${esc(villa.name)}" class="w-full h-full object-cover" loading="lazy">
    </div>
  `).join('');

  const galleryDots = images.length > 1 ? `
    <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
      ${images.map((_, i) => `<span class="vm-dot w-2 h-2 rounded-full cursor-pointer transition-colors ${i === 0 ? 'bg-white' : 'bg-white/45'}" data-idx="${i}"></span>`).join('')}
    </div>
  ` : '';
  const galleryArrows = images.length > 1 ? `
    <button type="button" class="vm-prev absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-ink-900/60 text-white grid place-items-center backdrop-blur hover:bg-ink-900/80 transition" aria-label="Önceki">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <button type="button" class="vm-next absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-ink-900/60 text-white grid place-items-center backdrop-blur hover:bg-ink-900/80 transition" aria-label="Sonraki">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  ` : '';

  const waMsg = encodeURIComponent(`Merhaba, ${villa.name} hakkında bilgi almak istiyorum.`);

  return `
    <div id="villa-modal-overlay"
      class="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-ink-900/70 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="${esc(villa.name)} Detayları">

      <div class="vm-panel relative bg-white w-full sm:max-w-2xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style="max-height:92vh;">

        <!-- Kapatma -->
        <button id="vm-close"
          class="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-ink-900/60 text-white grid place-items-center backdrop-blur hover:bg-ink-900/85 transition"
          aria-label="Kapat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        <!-- Galeri -->
        <div class="vm-gallery relative aspect-[16/9] bg-ink-900 flex-shrink-0" data-cur="0" data-total="${images.length}">
          ${gallerySlides}
          ${galleryArrows}
          ${galleryDots}
          ${villa.featured ? `<span class="absolute top-3 left-3 z-10 bg-sun-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">★ Öne Çıkan</span>` : ''}
        </div>

        <!-- İçerik: kaydırılabilir -->
        <div class="overflow-y-auto flex-1 px-5 py-5">

          <!-- Başlık + meta -->
          <div class="flex flex-col gap-1 mb-4">
            <div class="flex flex-wrap gap-1 mb-1">${tags}</div>
            <h2 class="font-display text-2xl font-extrabold text-sea-800 leading-tight">${esc(villa.name)}</h2>
            <div class="flex flex-wrap gap-3 text-sm text-sea-600 mt-1">
              ${villa.location ? `<span class="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-8-6.5-8-13a8 8 0 0 1 16 0c0 6.5-8 13-8 13z"/><circle cx="12" cy="8" r="3"/></svg>${esc(villa.location)}</span>` : ''}
              ${villa.capacity ? `<span class="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>${esc(villa.capacity)}</span>` : ''}
              ${villa.pool ? `<span class="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h20M2 12s4-5 10-5 10 5 10 5"/><path d="M2 12s4 5 10 5 10-5 10-5"/></svg>${esc(villa.pool)}</span>` : ''}
            </div>
          </div>

          <!-- Açıklama -->
          ${villa.summary ? `<p class="text-sm text-sea-700 leading-relaxed mb-4">${esc(villa.summary)}</p>` : ''}

          <!-- Özellikler -->
          ${features ? `<div class="flex flex-wrap gap-1.5 mb-5">${features}</div>` : ''}

          <!-- WhatsApp CTA -->
          <a href="https://wa.me/905306650794?text=${waMsg}" target="_blank" rel="noopener"
            class="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1da851] active:bg-[#179b44] text-white text-sm font-bold px-4 py-3 rounded-xl transition mb-5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/>
            </svg>
            WhatsApp ile İletişim
          </a>

          <!-- Tab: Yorumlar -->
          <div class="border-t border-sea-100 pt-5">
            <h3 class="font-display font-bold text-sea-800 text-base mb-4">Yorumlar</h3>

            <!-- Yorum yazma formu -->
            <div id="vm-write-section" class="mb-5"></div>

            <!-- Yorum listesi -->
            <div id="vm-review-list" class="flex flex-col gap-3">
              <div class="text-sm text-sea-400 text-center py-6">Yorumlar yükleniyor…</div>
            </div>
          </div>

        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Yorum formu: render
// ---------------------------------------------------------------------------
async function renderWriteSection(container, villaId) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    container.innerHTML = `
      <div class="flex items-center gap-2 bg-sea-50 border border-sea-100 rounded-xl p-4 text-sm text-sea-700">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        <span>Yorum yazmak için <a href="login.html" class="text-sea-600 underline font-semibold hover:text-sun-600">giriş yapın</a></span>
      </div>`;
    return;
  }

  // Profil adı için kısa sorgu
  let displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı';
  try {
    const { data: profile } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.display_name) displayName = profile.display_name;
  } catch { /* sessiz */ }

  container.innerHTML = `
    <div class="bg-sea-50 border border-sea-100 rounded-xl p-4">
      <h4 class="font-semibold text-sea-800 text-sm mb-3">Yorum Yaz</h4>
      <form id="vm-review-form" novalidate class="flex flex-col gap-3">
        <div>
          <label class="block text-xs font-medium text-sea-600 mb-1">Puanınız <span class="text-coral-500">*</span></label>
          ${starsInput('rating')}
        </div>
        <div>
          <label class="block text-xs font-medium text-sea-600 mb-1">Başlık (isteğe bağlı)</label>
          <input type="text" name="title" maxlength="80"
            placeholder="Kısa başlık…"
            class="w-full rounded-lg border border-sea-200 bg-white px-3 py-2 text-sm text-sea-800 placeholder-sea-300 focus:outline-none focus:ring-2 focus:ring-sea-400">
        </div>
        <div>
          <label class="block text-xs font-medium text-sea-600 mb-1">Yorumunuz <span class="text-coral-500">*</span></label>
          <textarea name="body" rows="4" maxlength="2000" required
            placeholder="Deneyiminizi paylaşın… (en az 10 karakter)"
            class="w-full rounded-lg border border-sea-200 bg-white px-3 py-2 text-sm text-sea-800 placeholder-sea-300 focus:outline-none focus:ring-2 focus:ring-sea-400 resize-none"></textarea>
        </div>
        <p id="vm-form-error" class="text-xs text-red-600 hidden"></p>
        <button type="submit"
          class="self-start px-5 py-2 rounded-lg bg-sea-600 hover:bg-sea-700 active:bg-sea-800 text-white font-semibold text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea-400 disabled:opacity-50 disabled:cursor-not-allowed">
          Gönder
        </button>
      </form>
    </div>`;

  // Star interaction
  const starContainer = container.querySelector('.vm-stars-input');
  const hiddenInput   = starContainer.querySelector('input[type=hidden]');
  let selectedRating  = 0;

  const updateStars = (val) => {
    starContainer.querySelectorAll('.vm-star-btn').forEach((btn, i) => {
      btn.style.color = i < val ? '#f4b53d' : '#d1d5db';
      btn.style.transform = i < val ? 'scale(1.1)' : 'scale(1)';
    });
  };

  starContainer.querySelectorAll('.vm-star-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => updateStars(+btn.dataset.value));
    btn.addEventListener('mouseleave', () => updateStars(selectedRating));
    btn.addEventListener('click', () => {
      selectedRating = +btn.dataset.value;
      hiddenInput.value = selectedRating;
      updateStars(selectedRating);
    });
  });

  // Form submit
  const form      = container.querySelector('#vm-review-form');
  const errorEl   = container.querySelector('#vm-form-error');
  const submitBtn = form.querySelector('button[type=submit]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');

    const rating = +hiddenInput.value;
    const body   = form.querySelector('[name=body]').value.trim();
    const title  = form.querySelector('[name=title]').value.trim();

    if (!rating) {
      errorEl.textContent = 'Lütfen bir puan seçin.';
      errorEl.classList.remove('hidden');
      return;
    }
    if (body.length < 10) {
      errorEl.textContent = 'Yorum en az 10 karakter olmalıdır.';
      errorEl.classList.remove('hidden');
      return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Gönderiliyor…';

    try {
      await submitReview({
        villaId:      villaId,
        reviewerName: displayName,
        rating,
        title,
        body,
        userId: user.id,
      });
      form.reset();
      selectedRating = 0;
      updateStars(0);
      showToast('Yorumun moderasyon için gönderildi, onaylanınca yayında olacak.');
    } catch (err) {
      console.error('[villa-modal] submitReview:', err);
      errorEl.textContent = err.message || 'Yorum gönderilemedi. Tekrar deneyin.';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Gönder';
    }
  });
}

// ---------------------------------------------------------------------------
// Gallery controller
// ---------------------------------------------------------------------------
function bindGallery(overlay) {
  const gallery = overlay.querySelector('.vm-gallery');
  if (!gallery) return;
  const total = parseInt(gallery.dataset.total || '1', 10);

  function goTo(idx) {
    const n    = ((idx % total) + total) % total;
    const slides = gallery.querySelectorAll('.vm-slide');
    const dots   = gallery.querySelectorAll('.vm-dot');
    slides.forEach((s, i) => { s.style.opacity = i === n ? '1' : '0'; });
    dots.forEach((d, i) => { d.style.background = i === n ? '#fff' : 'rgba(255,255,255,0.45)'; });
    gallery.dataset.cur = n;
  }

  const cur = () => parseInt(gallery.dataset.cur || '0', 10);

  overlay.querySelector('.vm-prev')?.addEventListener('click', (e) => { e.stopPropagation(); goTo(cur() - 1); });
  overlay.querySelector('.vm-next')?.addEventListener('click', (e) => { e.stopPropagation(); goTo(cur() + 1); });
  overlay.querySelectorAll('.vm-dot').forEach(dot => {
    dot.addEventListener('click', (e) => { e.stopPropagation(); goTo(parseInt(dot.dataset.idx, 10)); });
  });

  // Swipe
  let txStart = 0;
  gallery.addEventListener('touchstart', (e) => { txStart = e.touches[0].clientX; }, { passive: true });
  gallery.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - txStart;
    if (Math.abs(dx) > 40) goTo(cur() + (dx < 0 ? 1 : -1));
  });
}

// ---------------------------------------------------------------------------
// openVillaModal — public entry point
// ---------------------------------------------------------------------------
export async function openVillaModal(villa) {
  // Mevcut modal varsa kapat
  document.getElementById('villa-modal-overlay')?.remove();

  // Modal oluştur
  document.body.insertAdjacentHTML('beforeend', buildModalHtml(villa));
  const overlay = document.getElementById('villa-modal-overlay');
  document.body.style.overflow = 'hidden';

  // Galeri
  bindGallery(overlay);

  // Kapat: overlay tıklaması
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.querySelector('#vm-close')?.addEventListener('click', closeModal);

  // Escape
  const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', onKey);
  overlay._cleanupKey = onKey;

  // Yorumlar yükle
  const reviewListEl = overlay.querySelector('#vm-review-list');
  const writeSection = overlay.querySelector('#vm-write-section');

  const [reviews] = await Promise.all([
    fetchReviews(villa.id),
    renderWriteSection(writeSection, villa.id),
  ]);
  reviewListEl.innerHTML = renderReviewList(reviews);
}

function closeModal() {
  const overlay = document.getElementById('villa-modal-overlay');
  if (overlay) {
    document.removeEventListener('keydown', overlay._cleanupKey);
    overlay.remove();
  }
  document.body.style.overflow = '';
}

// ---------------------------------------------------------------------------
// Auto-init: villa kartlarına tıklama delegasyonu
// Render.js villaCard() çıktısına data-villa-id eklendikten sonra çalışır
// ---------------------------------------------------------------------------
export function initVillaModal(villaDataMap) {
  document.addEventListener('click', (e) => {
    // Whitelist: karta tıklandı ama WA linki veya carousel kontrolü değil
    const card = e.target.closest('.villa-card');
    if (!card) return;
    if (e.target.closest('a[href]')) return;          // WA butonu
    if (e.target.closest('.villa-arrow')) return;     // carousel ok
    if (e.target.closest('.villa-prev')) return;
    if (e.target.closest('.villa-next')) return;
    if (e.target.closest('.villa-dot')) return;       // carousel dot

    const villaId = card.dataset.villaId;
    if (!villaId || !villaDataMap[villaId]) return;
    openVillaModal(villaDataMap[villaId]);
  });
}
