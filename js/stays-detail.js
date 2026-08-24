/**
 * Kalkan Stays — Detay + Rezervasyon Modülü (stays-detail.js)
 *
 * Bağımlılıklar:
 *   - /js/supabase-client.js  → export { supabase }
 *   - /js/auth.js             → export { safeOnAuthStateChanged, isSupabaseConfigured }
 *
 * Akış:
 *   1) ?slug= querystring → stays tablosundan ilan çek (status='active')
 *   2) stay_blocked_dates + onaylı stay_bookings → takvim işaretleme
 *   3) Tarih seçimi → gece sayısı + toplam fiyat hesaplama
 *   4) Rezervasyon formu submit → auth kontrolü → stay_bookings insert (status='requested')
 */

import { supabase } from './supabase-client.js';
import { safeOnAuthStateChanged, isSupabaseConfigured } from './auth.js';

// ─── State ───────────────────────────────────────────────────────────────────
let _stay       = null;   // stays satırı
let _blocked    = new Set(); // YYYY-MM-DD string'leri (blocked_dates + confirmed bookings)
let _user       = null;
let _calYear    = 0;
let _calMonth   = 0;      // 0-indexed
let _checkIn    = null;   // Date | null
let _checkOut   = null;   // Date | null

// ─── Helpers ─────────────────────────────────────────────────────────────────
function _iso(date) {
  // Date → "YYYY-MM-DD" (yerel saat)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function _parseLocalDate(str) {
  // "YYYY-MM-DD" → Date (gece yarısı yerel saat, UTC kaymasından kaçınmak için)
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function _addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** check_in (dahil) ile check_out (hariç) arasındaki tüm günleri üretir */
function _rangeDays(checkIn, checkOut) {
  const days = [];
  let cur = new Date(checkIn);
  while (cur < checkOut) {
    days.push(_iso(cur));
    cur = _addDays(cur, 1);
  }
  return days;
}

/** confirmed booking aralığını bireysel günlere açar */
function _expandBooking(checkIn, checkOut) {
  return _rangeDays(_parseLocalDate(checkIn), _parseLocalDate(checkOut));
}

function _fmt(n) {
  return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 0 });
}

const LISTING_TYPE_TR = {
  room:           'Oda',
  apartment:      'Daire',
  villa:          'Villa',
  whole_building: 'Tüm Bina',
  couch:          'Kanepe / Misafir köşesi',
};

const AMENITY_TR = {
  wifi:     'Wi-Fi',
  pool:     'Havuz',
  ac:       'Klima',
  kitchen:  'Mutfak',
  parking:  'Otopark',
  seaview:  'Deniz Manzarası',
  washer:   'Çamaşır Makinesi',
  heating:  'Isıtma',
  tv:       'TV',
  balcony:  'Balkon',
  garden:   'Bahçe',
  bbq:      'Barbekü',
  pets:     'Evcil Hayvan Kabul',
  elevator: 'Asansör',
};

const MONTHS_TR = [
  'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
  'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık',
];

const DAYS_TR = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];

// ─── Entry point ─────────────────────────────────────────────────────────────
export async function init() {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) {
    _showError('İlan bulunamadı. Lütfen geçerli bir bağlantı kullanın.');
    return;
  }

  // Auth listener
  safeOnAuthStateChanged(u => { _user = u; _syncAuthUi(); });

  // Paralel: ilan + takvim verisi
  await _loadStay(slug);
}

// ─── Data fetching ────────────────────────────────────────────────────────────
async function _loadStay(slug) {
  _setLoadingState(true);
  try {
    const { data, error } = await supabase
      .from('stays')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      _showError('Bu ilan aktif değil veya bulunamadı.');
      return;
    }

    _stay = data;

    // Takvim verisini paralel çek
    await Promise.all([_loadBlockedDates(), _loadConfirmedBookings()]);

    _render();
  } catch (err) {
    console.error('[stays-detail] loadStay hatası:', err.message);
    _showError('İlan yüklenemedi: ' + err.message);
  } finally {
    _setLoadingState(false);
  }
}

async function _loadBlockedDates() {
  try {
    const { data, error } = await supabase
      .from('stay_blocked_dates')
      .select('day')
      .eq('stay_id', _stay.id);
    if (error) throw error;
    (data || []).forEach(r => _blocked.add(r.day));
  } catch (err) {
    console.warn('[stays-detail] blocked_dates yüklenemedi:', err.message);
  }
}

async function _loadConfirmedBookings() {
  try {
    const { data, error } = await supabase
      .from('stay_bookings')
      .select('check_in, check_out')
      .eq('stay_id', _stay.id)
      .eq('status', 'confirmed');
    if (error) throw error;
    (data || []).forEach(b => {
      _expandBooking(b.check_in, b.check_out).forEach(d => _blocked.add(d));
    });
  } catch (err) {
    console.warn('[stays-detail] confirmed bookings yüklenemedi:', err.message);
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────
function _render() {
  const s = _stay;
  document.title = `${s.title} — Kalkan Stays`;

  // Galeri
  _renderGallery(s.images || []);

  // Meta — tip + is_verified rozeti
  const typeBadge = document.getElementById('stay-type-badge');
  if (typeBadge) {
    typeBadge.textContent = LISTING_TYPE_TR[s.listing_type] || s.listing_type;
  }
  const verifiedBadge = document.getElementById('stay-verified');
  if (verifiedBadge) {
    verifiedBadge.classList.toggle('hidden', !s.is_verified);
  }

  // Başlık
  _setText('stay-title', s.title);
  _setText('stay-location', s.location || '');

  // Kapasite satırı
  _setText('stay-capacity', s.capacity);
  _setText('stay-bedrooms', s.bedrooms ?? '—');
  _setText('stay-beds', s.beds ?? '—');
  _setText('stay-bathrooms', s.bathrooms ?? '—');

  // Fiyat
  _setText('stay-price', `₺${_fmt(s.price_per_night)}`);
  const cleanEl = document.getElementById('stay-cleaning');
  if (cleanEl) {
    const fee = Number(s.cleaning_fee || 0);
    cleanEl.textContent = fee > 0 ? `+ ₺${_fmt(fee)} temizlik ücreti` : 'Temizlik ücreti yok';
  }

  // Min/max gece
  const minmaxEl = document.getElementById('stay-minmax');
  if (minmaxEl) {
    const parts = [];
    if (s.min_nights && s.min_nights > 1) parts.push(`Min. ${s.min_nights} gece`);
    if (s.max_nights) parts.push(`Maks. ${s.max_nights} gece`);
    minmaxEl.textContent = parts.join(' · ') || '';
    minmaxEl.classList.toggle('hidden', parts.length === 0);
  }

  // Açıklama
  const descEl = document.getElementById('stay-description');
  if (descEl && s.description) {
    descEl.innerHTML = s.description
      .split('\n\n')
      .map(p => `<p>${p.replace(/\n/g, '<br>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
      .join('');
  }

  // Amenities
  const amenEl = document.getElementById('stay-amenities');
  if (amenEl && s.amenities?.length) {
    amenEl.innerHTML = s.amenities.map(a => `
      <span class="stays-pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
        ${AMENITY_TR[a] || a}
      </span>`).join('');
  } else if (amenEl) {
    amenEl.closest('section')?.classList.add('hidden');
  }

  // Ev kuralları
  const rulesEl = document.getElementById('stay-rules');
  if (rulesEl) {
    if (s.house_rules) {
      rulesEl.textContent = s.house_rules;
    } else {
      rulesEl.closest('section')?.classList.add('hidden');
    }
  }

  // Sezon bilgisi
  const seasonEl = document.getElementById('stay-season');
  if (seasonEl) {
    if (s.available_from || s.available_to) {
      const from = s.available_from ? new Date(s.available_from).toLocaleDateString('tr-TR') : '—';
      const to   = s.available_to   ? new Date(s.available_to).toLocaleDateString('tr-TR')   : '—';
      seasonEl.textContent = `${from} – ${to} arasında müsait`;
    } else {
      seasonEl.closest('.season-row')?.classList.add('hidden');
    }
  }

  // WhatsApp iletişim
  const waEl = document.getElementById('stay-whatsapp');
  if (waEl && s.contact_whatsapp) {
    const num = s.contact_whatsapp.replace(/\D/g, '');
    waEl.href = `https://wa.me/${num}`;
    waEl.classList.remove('hidden');
  }

  // Takvim — bu ayı göster
  const today = new Date();
  _calYear  = today.getFullYear();
  _calMonth = today.getMonth();
  _renderCalendar();

  // Booking guests sayacı max kapasiteye bağla
  const guestsInput = document.getElementById('booking-guests');
  if (guestsInput) guestsInput.max = s.capacity;

  _updatePriceSummary();
}

// ─── Galeri ───────────────────────────────────────────────────────────────────
function _renderGallery(images) {
  const el = document.getElementById('stay-gallery');
  if (!el) return;
  if (!images.length) {
    el.innerHTML = `<div class="gallery-placeholder">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-sea-300"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      <p class="text-sea-400 text-sm mt-2">Fotoğraf yok</p>
    </div>`;
    return;
  }

  const main = images[0];
  const thumbs = images.slice(1);

  el.innerHTML = `
    <div class="gallery-main" id="gallery-active" style="background-image:url('${main}')">
      <div class="gallery-overlay"></div>
      ${images.length > 1 ? `<div class="gallery-count">${images.length} fotoğraf</div>` : ''}
    </div>
    ${thumbs.length ? `<div class="gallery-thumbs">
      ${images.map((img, i) => `<button class="gallery-thumb${i===0?' active':''}" data-idx="${i}" style="background-image:url('${img}')" aria-label="Fotoğraf ${i+1}"></button>`).join('')}
    </div>` : ''}
  `;

  el.querySelectorAll('.gallery-thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const activeImg = document.getElementById('gallery-active');
      if (activeImg) activeImg.style.backgroundImage = `url('${images[idx]}')`;
      el.querySelectorAll('.gallery-thumb').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ─── Takvim ───────────────────────────────────────────────────────────────────
/**
 * Takvim mantığı:
 * 1) _blocked Set: stay_blocked_dates (manuel kapalı) + confirmed stay_bookings (her gün expand edilmiş)
 * 2) Sezon kısıtı: available_from/available_to dışı günler de devre dışı
 * 3) Geçmiş günler her zaman devre dışı
 * 4) Kullanıcı ilk tıklayınca check_in seçer, ikinci tıklayınca check_out seçer (check_in < check_out şartı)
 * 5) Seçilen aralıkta herhangi bir blocked gün varsa seçim iptal edilir (UX guard)
 */
function _renderCalendar() {
  const el = document.getElementById('stay-calendar');
  if (!el) return;

  const s = _stay;
  const today = new Date(); today.setHours(0,0,0,0);
  const seasonFrom = s.available_from ? _parseLocalDate(s.available_from) : null;
  const seasonTo   = s.available_to   ? _parseLocalDate(s.available_to)   : null;

  // Başlık
  const titleEl = document.getElementById('cal-title');
  if (titleEl) titleEl.textContent = `${MONTHS_TR[_calMonth]} ${_calYear}`;

  // Navigasyon butonları
  const prevBtn = document.getElementById('cal-prev');
  const nextBtn = document.getElementById('cal-next');
  if (prevBtn) {
    // Önceki aya gitme: bu aydan öncesine geçemezsin
    const isPast = (_calYear < today.getFullYear()) || (_calYear === today.getFullYear() && _calMonth <= today.getMonth());
    prevBtn.disabled = isPast;
    prevBtn.classList.toggle('opacity-30', isPast);
  }

  // Takvim grid'i
  const gridEl = document.getElementById('cal-grid');
  if (!gridEl) return;

  // Haftanın günleri başlığı (Pzt başlangıç)
  const headerHtml = DAYS_TR.map(d => `<div class="cal-day-label">${d}</div>`).join('');

  // Ayın ilk günü ve toplam gün sayısı
  const firstDay = new Date(_calYear, _calMonth, 1);
  const totalDays = new Date(_calYear, _calMonth + 1, 0).getDate();
  // firstDay.getDay(): 0=Pazar, Pazartesi başlangıç için offset
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6; // Pazar → 6 boş hücre

  let cellsHtml = headerHtml;
  // Boş hücreler
  for (let i = 0; i < startOffset; i++) {
    cellsHtml += `<div></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(_calYear, _calMonth, day);
    const iso  = _iso(date);

    const isPast     = date < today;
    const isBlocked  = _blocked.has(iso);
    const outSeason  = (seasonFrom && date < seasonFrom) || (seasonTo && date > seasonTo);
    const disabled   = isPast || isBlocked || outSeason;

    const isCheckIn  = _checkIn  && _iso(_checkIn)  === iso;
    const isCheckOut = _checkOut && _iso(_checkOut) === iso;
    const inRange    = _checkIn && _checkOut && date > _checkIn && date < _checkOut;

    let cls = 'cal-day';
    if (disabled)  cls += ' cal-disabled';
    if (isBlocked || isPast) cls += ' cal-blocked';
    if (outSeason && !isBlocked && !isPast) cls += ' cal-out-season';
    if (isCheckIn)  cls += ' cal-check-in';
    if (isCheckOut) cls += ' cal-check-out';
    if (inRange && !disabled) cls += ' cal-in-range';

    const title = isBlocked ? 'Müsait değil' : outSeason ? 'Sezon dışı' : isPast ? 'Geçmiş tarih' : iso;

    cellsHtml += `<button class="${cls}" data-date="${iso}" ${disabled ? 'disabled aria-disabled="true"' : ''} title="${title}">${day}</button>`;
  }

  gridEl.innerHTML = cellsHtml;

  // Gün tıklama
  gridEl.querySelectorAll('.cal-day:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => _onDayClick(btn.dataset.date));
  });
}

function _onDayClick(isoStr) {
  const clicked = _parseLocalDate(isoStr);

  if (!_checkIn || (_checkIn && _checkOut)) {
    // Yeni seçim başlat
    _checkIn  = clicked;
    _checkOut = null;
  } else {
    // İkinci tıklama: check_out belirle
    if (clicked <= _checkIn) {
      // Aynı gün veya öncesi: check_in'i yeniden seç
      _checkIn  = clicked;
      _checkOut = null;
    } else {
      // Aralıkta blocked gün var mı kontrol et (UX guard)
      const rangeDays = _rangeDays(_checkIn, clicked);
      const hasBlocked = rangeDays.some(d => _blocked.has(d));
      if (hasBlocked) {
        // Müsait olmayan gün içeriyor — check_in'i bu güne sıfırla
        _showBookingError('Seçilen tarihler arasında müsait olmayan gün var. Lütfen farklı tarihler seçin.');
        _checkIn  = clicked;
        _checkOut = null;
      } else {
        _checkOut = clicked;
        _clearBookingError();
      }
    }
  }

  _syncDateInputs();
  _renderCalendar();
  _updatePriceSummary();
}

function _syncDateInputs() {
  const ciEl = document.getElementById('booking-checkin');
  const coEl = document.getElementById('booking-checkout');
  if (ciEl) ciEl.value = _checkIn  ? _iso(_checkIn)  : '';
  if (coEl) coEl.value = _checkOut ? _iso(_checkOut) : '';

  // min/max kısıtları güncelle
  if (ciEl && _checkIn && !_checkOut) {
    if (coEl) {
      const minOut = _addDays(_checkIn, _stay?.min_nights || 1);
      coEl.min = _iso(minOut);
      if (_stay?.max_nights) {
        coEl.max = _iso(_addDays(_checkIn, _stay.max_nights));
      }
    }
  }
}

// ─── Fiyat özeti ──────────────────────────────────────────────────────────────
function _updatePriceSummary() {
  const summaryEl = document.getElementById('price-summary');
  if (!summaryEl || !_stay) return;

  if (!_checkIn || !_checkOut) {
    summaryEl.classList.add('hidden');
    return;
  }

  const nights = Math.round((_checkOut - _checkIn) / (1000 * 60 * 60 * 24));
  const pricePerNight = Number(_stay.price_per_night);
  const cleaningFee   = Number(_stay.cleaning_fee || 0);
  const subtotal      = nights * pricePerNight;
  const total         = subtotal + cleaningFee;

  const s = _stay;
  // Min/max gece doğrulama
  if (s.min_nights && nights < s.min_nights) {
    _showBookingError(`Minimum ${s.min_nights} gece rezervasyon yapılabilir.`);
    summaryEl.classList.add('hidden');
    return;
  }
  if (s.max_nights && nights > s.max_nights) {
    _showBookingError(`Maksimum ${s.max_nights} gece rezervasyon yapılabilir.`);
    summaryEl.classList.add('hidden');
    return;
  }
  _clearBookingError();

  _setText('summary-nights', `${nights} gece × ₺${_fmt(pricePerNight)}`);
  _setText('summary-subtotal', `₺${_fmt(subtotal)}`);
  const cleanRow = document.getElementById('summary-cleaning-row');
  if (cleanRow) {
    if (cleaningFee > 0) {
      cleanRow.classList.remove('hidden');
      _setText('summary-cleaning', `₺${_fmt(cleaningFee)}`);
    } else {
      cleanRow.classList.add('hidden');
    }
  }
  _setText('summary-total', `₺${_fmt(total)}`);

  summaryEl.classList.remove('hidden');
}

// ─── Auth UI ──────────────────────────────────────────────────────────────────
function _syncAuthUi() {
  const authNotice = document.getElementById('auth-notice');
  const bookingForm = document.getElementById('booking-form');
  if (!authNotice || !bookingForm) return;

  if (_user) {
    authNotice.classList.add('hidden');
    bookingForm.classList.remove('hidden');
  } else {
    authNotice.classList.remove('hidden');
    bookingForm.classList.add('hidden');
  }
}

// ─── Booking submit ───────────────────────────────────────────────────────────
async function _submitBooking(e) {
  e.preventDefault();

  if (!_user) {
    _showBookingError('Rezervasyon yapmak için giriş yapmalısın.');
    return;
  }
  if (!_stay) return;

  if (!_checkIn || !_checkOut) {
    _showBookingError('Lütfen giriş ve çıkış tarihlerini seçin.');
    return;
  }

  const nights = Math.round((_checkOut - _checkIn) / (1000 * 60 * 60 * 24));
  const s = _stay;

  if (s.min_nights && nights < s.min_nights) {
    _showBookingError(`Minimum ${s.min_nights} gece rezervasyon yapılabilir.`);
    return;
  }
  if (s.max_nights && nights > s.max_nights) {
    _showBookingError(`Maksimum ${s.max_nights} gece rezervasyon yapılabilir.`);
    return;
  }

  // UX-level çakışma kontrolü (DB exclusion constraint gerçek guard)
  const rangeDays = _rangeDays(_checkIn, _checkOut);
  const hasBlocked = rangeDays.some(d => _blocked.has(d));
  if (hasBlocked) {
    _showBookingError('Seçilen tarihlerde müsait olmayan gün var. Farklı tarihler seçin.');
    return;
  }

  const guestsEl = document.getElementById('booking-guests');
  const guests   = parseInt(guestsEl?.value) || 1;
  if (guests < 1 || guests > s.capacity) {
    _showBookingError(`Misafir sayısı 1-${s.capacity} arasında olmalı.`);
    return;
  }

  const messageEl = document.getElementById('booking-message');
  const guestMessage = messageEl?.value.trim() || null;

  const totalPrice = nights * Number(s.price_per_night) + Number(s.cleaning_fee || 0);

  const submitBtn = document.getElementById('booking-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Gönderiliyor...'; }

  try {
    const { error } = await supabase.from('stay_bookings').insert({
      stay_id:       s.id,
      guest_id:      _user.id,
      check_in:      _iso(_checkIn),
      check_out:     _iso(_checkOut),
      guests,
      total_price:   totalPrice,
      currency:      s.currency || 'TRY',
      status:        'requested',
      guest_message: guestMessage,
    });

    if (error) {
      // Exclusion constraint ihlali (çift rezervasyon)
      if (error.code === '23P01' || (error.message || '').includes('stay_no_overlap')) {
        _showBookingError('Bu tarihler için başka bir rezervasyon var. Farklı tarih seçin.');
      } else if ((error.message || '').toLowerCase().includes('email not confirmed')) {
        _showBookingError('Rezervasyon yapmak için e-posta adresini doğrulaman gerekiyor.');
      } else {
        _showBookingError('Rezervasyon gönderilemedi: ' + error.message);
      }
      return;
    }

    _showSuccess();
  } catch (err) {
    console.error('[stays-detail] booking insert hatası:', err);
    _showBookingError('Beklenmedik bir hata oluştu. Lütfen tekrar deneyin.');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Rezervasyon Talebi Gönder'; }
  }
}

function _showSuccess() {
  const form = document.getElementById('booking-form');
  const successEl = document.getElementById('booking-success');
  if (form) form.classList.add('hidden');
  if (successEl) successEl.classList.remove('hidden');
  successEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── UI yardımcıları ──────────────────────────────────────────────────────────
function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '';
}

function _showBookingError(msg) {
  const el = document.getElementById('booking-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function _clearBookingError() {
  const el = document.getElementById('booking-error');
  if (el) el.classList.add('hidden');
}

function _showError(msg) {
  const container = document.getElementById('detail-container');
  const loading   = document.getElementById('detail-loading');
  if (loading) loading.classList.add('hidden');
  if (container) {
    container.innerHTML = `<div class="stays-error-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e89812" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p>${msg}</p>
      <a href="kirala.html" class="stays-back-link">← İlanlara Dön</a>
    </div>`;
  }
}

function _setLoadingState(on) {
  const loading   = document.getElementById('detail-loading');
  const container = document.getElementById('detail-container');
  if (loading)   loading.classList.toggle('hidden', !on);
  if (container) container.classList.toggle('hidden', on);
}

// ─── Takvim navigasyon ────────────────────────────────────────────────────────
function _calPrev() {
  _calMonth--;
  if (_calMonth < 0) { _calMonth = 11; _calYear--; }
  _renderCalendar();
}

function _calNext() {
  _calMonth++;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  _renderCalendar();
}

// ─── Date input fallback (manual input → takvimi güncelle) ───────────────────
function _onDateInputChange() {
  const ciVal = document.getElementById('booking-checkin')?.value;
  const coVal = document.getElementById('booking-checkout')?.value;
  if (ciVal) _checkIn  = _parseLocalDate(ciVal);
  if (coVal) _checkOut = _parseLocalDate(coVal);
  _renderCalendar();
  _updatePriceSummary();
}

// ─── Bağla ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cal-prev')?.addEventListener('click', _calPrev);
  document.getElementById('cal-next')?.addEventListener('click', _calNext);

  document.getElementById('booking-checkin')?.addEventListener('change', _onDateInputChange);
  document.getElementById('booking-checkout')?.addEventListener('change', _onDateInputChange);

  document.getElementById('booking-form')?.addEventListener('submit', _submitBooking);

  document.getElementById('auth-login-btn')?.addEventListener('click', () => {
    window.location.href = `login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
  });

  init();
});
