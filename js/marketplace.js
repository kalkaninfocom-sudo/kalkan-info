/**
 * Kalkan Info — Pazar Yeri (Marketplace) Module (Supabase — Letgo-tarzı al-sat)
 *
 * Supabase tablosu:
 *   - marketplace_listings   ilanlar (status='active' public)
 * Storage:
 *   - marketplace-photos     ilan fotoğrafları (public read, <uid>/ klasörüne yazma)
 *
 * jobs.js deseninin ikizi. Graceful degrade: Supabase yapılandırılmamışsa
 * veya tablo yoksa data/pazar-yeri.json örnek ilanları ile çalışır.
 */

import { supabase } from './supabase-client.js';
import { isSupabaseConfigured } from './auth.js';

// ----------------------------------------------------------------------------
// Kategoriler — sayfadaki chip'lerle tutarlı slug anahtarları
// ----------------------------------------------------------------------------
const CATEGORIES = {
  'ev-esyasi':     'Ev Eşyası',
  'elektronik':    'Elektronik',
  'arac-bisiklet': 'Araç & Bisiklet',
  'yerel-urun':    'Yerel Ürün',
  'bahce-yapi':    'Bahçe & Yapı',
  'giyim':         'Giyim',
  'hizmet':        'Hizmet',
  'diger':         'Diğer',
};

const CONDITIONS = { new: 'Yeni', used: 'İkinci el' };

const MAX_IMAGES = 6;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const RESIZE_MAX = 1600;

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export function getCategories() { return { ...CATEGORIES }; }
export function getConditions() { return { ...CONDITIONS }; }

export async function listListings(filters = {}) {
  if (!isSupabaseConfigured) {
    return _fallbackListings(filters);
  }
  try {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('status', 'active')
      .order('published_at', { ascending: false })
      .limit(60);
    if (error) throw error;
    const items = (data || []).map(_normalize);
    return items.filter(i => _matchesFilters(i, filters));
  } catch (err) {
    console.warn('[marketplace] listListings hatası, örnek ilanlara düşülüyor:', err.message);
    return _fallbackListings(filters);
  }
}

export async function getListing(idOrSlug) {
  if (!isSupabaseConfigured) {
    return _fallbackListings().find(i => String(i.id) === String(idOrSlug) || i.slug === idOrSlug) || null;
  }
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    if (isUuid) {
      const { data, error } = await supabase.from('marketplace_listings').select('*').eq('id', idOrSlug).maybeSingle();
      if (error) throw error;
      if (data) return _normalize(data);
    }
    const { data, error } = await supabase.from('marketplace_listings').select('*').eq('slug', idOrSlug).maybeSingle();
    if (error) throw error;
    return data ? _normalize(data) : null;
  } catch (err) {
    console.warn('[marketplace] getListing hatası:', err.message);
    return _fallbackListings().find(i => String(i.id) === String(idOrSlug) || i.slug === idOrSlug) || null;
  }
}

/**
 * Fotoğrafları Supabase Storage'a yükler, public URL[] döner.
 * path = `${uid}/${slug}-${i}-${Date.now()}.jpg`
 */
export async function uploadImages(files, uid, slug) {
  if (!isSupabaseConfigured) return { ok: false, error: 'Supabase yapılandırılmamış.', urls: [] };
  const list = Array.from(files || []).slice(0, MAX_IMAGES);
  const urls = [];
  try {
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      if (file.size > MAX_FILE_BYTES) {
        return { ok: false, error: `"${file.name}" 8 MB'den büyük. Lütfen daha küçük bir fotoğraf seçin.`, urls };
      }
      const blob = await _resizeToJpeg(file, RESIZE_MAX);
      const path = `${uid}/${_slugify(slug || 'ilan')}-${i}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('marketplace-photos')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('marketplace-photos').getPublicUrl(path);
      if (pub?.publicUrl) urls.push(pub.publicUrl);
    }
    return { ok: true, urls };
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('row-level security') || msg.includes('policy') || msg.includes('unauthorized')) {
      return { ok: false, error: 'Fotoğraf yükleme yetkiniz yok. E-postanızı doğrulayıp tekrar deneyin.', urls };
    }
    return { ok: false, error: err.message, urls };
  }
}

/** İlan oluşturur. images: uploadImages'ten dönen zaten-yüklenmiş URL[]. */
export async function createListing(data, ownerUid) {
  if (!isSupabaseConfigured) {
    console.warn('[marketplace] Supabase yok, ilan kaydedilmedi.');
    return { ok: false, error: 'Supabase yapılandırılmamış. Lütfen önce giriş yapın.' };
  }
  try {
    const slug = _slugify(data.title) + '-' + Math.random().toString(36).slice(2, 8);
    const row = {
      owner_id:         ownerUid,
      slug,
      title:            data.title,
      category:         data.category,
      condition:        data.condition === 'new' ? 'new' : 'used',
      price:            data.price != null && data.price !== '' ? Number(data.price) : null,
      currency:         data.currency || 'TRY',
      is_negotiable:    Boolean(data.isNegotiable ?? data.is_negotiable ?? false),
      location:         data.location || null,
      description:      data.description || null,
      images:           Array.isArray(data.images) ? data.images.slice(0, MAX_IMAGES) : [],
      contact_name:     data.contactName ?? data.contact_name ?? null,
      contact_phone:    data.contactPhone ?? data.contact_phone ?? null,
      contact_whatsapp: data.contactWhatsapp ?? data.contact_whatsapp ?? null,
      status:           'active',
    };
    const { data: inserted, error } = await supabase
      .from('marketplace_listings')
      .insert(row)
      .select('*')
      .single();
    if (error) throw error;
    return { ok: true, id: inserted.id, slug: inserted.slug, listing: _normalize(inserted) };
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('row-level security') || msg.includes('policy')) {
      const { data: { user } } = await supabase.auth.getUser();
      const verified = user?.email_confirmed_at ?? user?.user_metadata?.email_verified;
      if (!verified) {
        return { ok: false, error: 'E-posta adresinizi doğrulamanız gerekiyor. Gelen kutunuzdaki doğrulama linkine tıklayın, sonra tekrar deneyin.' };
      }
      return { ok: false, error: 'İlan yayınlama yetkiniz yok. Lütfen tekrar giriş yapın.' };
    }
    return { ok: false, error: err.message };
  }
}

export async function updateListing(id, patch, ownerUid) {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase yapılandırılmamış. Lütfen önce giriş yapın.' };
  }
  try {
    const row = { ...patch };
    delete row.id;
    delete row.owner_id;
    delete row.slug;
    let q = supabase.from('marketplace_listings').update(row).eq('id', id);
    if (ownerUid) q = q.eq('owner_id', ownerUid);
    const { data: updated, error } = await q.select('id, slug').single();
    if (error) throw error;
    return { ok: true, id: updated.id, slug: updated.slug };
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('row-level security') || msg.includes('policy')) {
      return { ok: false, error: 'Bu ilanı düzenleme yetkiniz yok. Lütfen tekrar giriş yapın.' };
    }
    return { ok: false, error: err.message };
  }
}

export async function deleteListing(id, ownerUid) {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase yapılandırılmamış. Lütfen önce giriş yapın.' };
  }
  try {
    let q = supabase.from('marketplace_listings').delete().eq('id', id);
    if (ownerUid) q = q.eq('owner_id', ownerUid);
    const { error } = await q;
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('row-level security') || msg.includes('policy')) {
      return { ok: false, error: 'Bu ilanı silme yetkiniz yok. Lütfen tekrar giriş yapın.' };
    }
    return { ok: false, error: err.message };
  }
}

export async function markSold(id, ownerUid) {
  return updateListing(id, { status: 'sold' }, ownerUid);
}

export async function getMyListings(uid) {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('owner_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(_normalize);
  } catch (err) {
    console.warn('[marketplace] getMyListings hatası:', err.message);
    return [];
  }
}

/** view_count'u best-effort artırır (hata yut). */
export async function incrementView(id) {
  if (!isSupabaseConfigured || !id) return;
  try {
    const { data } = await supabase.from('marketplace_listings').select('view_count').eq('id', id).maybeSingle();
    const next = (data?.view_count || 0) + 1;
    await supabase.from('marketplace_listings').update({ view_count: next }).eq('id', id);
  } catch (_) { /* best-effort */ }
}

/** Bildir — MVP: report_count best-effort artır. */
export async function reportListing(id) {
  if (!isSupabaseConfigured || !id) return { ok: false };
  try {
    const { data } = await supabase.from('marketplace_listings').select('report_count').eq('id', id).maybeSingle();
    const next = (data?.report_count || 0) + 1;
    const { error } = await supabase.from('marketplace_listings').update({ report_count: next }).eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// Render helpers
// ----------------------------------------------------------------------------

export function renderCard(item) {
  const catLabel = CATEGORIES[item.category] || 'Diğer';
  const img = (item.images && item.images[0]) || item.image ||
    'https://placehold.co/600x450/dce6ef/0a2e4c?text=Gorsel+Yok';
  const priceHtml = _formatPrice(item.price, item.currency);
  return `
    <article class="listing-card card-appear" role="listitem" data-listing-id="${_esc(item.id)}" tabindex="0" aria-label="${_esc(item.title)}">
      <div class="card-img-wrap">
        <img src="${_esc(img)}" alt="${_esc(item.title)}" loading="lazy" decoding="async"
          onerror="this.src='https://placehold.co/600x450/dce6ef/0a2e4c?text=Gorsel+Yok'">
        <div class="card-img-overlay"></div>
        ${item.demo ? '<span class="demo-tag" data-en="Sample" data-de="Beispiel" data-ru="Пример" data-fr="Exemple">Örnek İlan</span>' : ''}
        <span class="cat-badge">${_esc(catLabel)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${_esc(item.title)}</h3>
        <p class="card-desc">${_esc(item.description || item.desc || '')}</p>
        <div class="card-meta">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          ${_esc(item.location || '—')}
        </div>
        <div class="card-footer">
          <div class="card-price">${priceHtml}</div>
          <span class="btn-contact" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.92c0 1.92.55 3.78 1.6 5.39L2 22l4.86-1.7a9.93 9.93 0 0 0 5.18 1.45c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Z"/></svg>
            <span data-en="Details" data-de="Details" data-ru="Детали" data-fr="Détails">Detay</span>
          </span>
        </div>
      </div>
    </article>
  `;
}

export function renderDetail(item) {
  if (!item) return `<div class="text-center py-10" style="color:#5d7a8c;">İlan bulunamadı.</div>`;
  const catLabel = CATEGORIES[item.category] || 'Diğer';
  const cond = CONDITIONS[item.condition] || '';
  const priceHtml = _formatPrice(item.price, item.currency);
  const date = _formatDate(item.published_at || item.created_at);
  const images = (item.images && item.images.length) ? item.images
    : (item.image ? [item.image] : ['https://placehold.co/800x600/dce6ef/0a2e4c?text=Gorsel+Yok']);
  const waNumber = _digits(item.contact_whatsapp || item.contact_phone || item.contact || '');
  const contactHref = item.contact_whatsapp
    ? `https://wa.me/${waNumber}`
    : (item.contact && /^https?:/.test(item.contact) ? item.contact
      : (item.contact_phone ? `tel:${item.contact_phone}` : (waNumber ? `https://wa.me/${waNumber}` : '#')));
  const contactIsWa = contactHref.includes('wa.me');

  const thumbs = images.map((src, i) => `
    <button class="mk-thumb${i === 0 ? ' active' : ''}" data-idx="${i}" aria-label="Fotoğraf ${i + 1}">
      <img src="${_esc(src)}" alt="" loading="lazy" onerror="this.src='https://placehold.co/120x90/dce6ef/0a2e4c?text=—'">
    </button>`).join('');

  return `
    <div class="mk-detail">
      <div class="mk-gallery">
        <div class="mk-gallery-main">
          <img id="mk-gallery-img" src="${_esc(images[0])}" alt="${_esc(item.title)}"
            onerror="this.src='https://placehold.co/800x600/dce6ef/0a2e4c?text=Gorsel+Yok'">
          ${item.demo ? '<span class="demo-tag" style="top:12px;left:12px;">Örnek İlan</span>' : ''}
        </div>
        ${images.length > 1 ? `<div class="mk-thumbs" id="mk-thumbs">${thumbs}</div>` : ''}
      </div>
      <div class="mk-detail-body">
        <div class="mk-badges">
          <span class="mk-badge">${_esc(catLabel)}</span>
          ${cond ? `<span class="mk-badge mk-badge-alt">${_esc(cond)}</span>` : ''}
          ${item.is_negotiable ? `<span class="mk-badge mk-badge-alt" data-en="Negotiable" data-de="Verhandelbar" data-ru="Торг" data-fr="Négociable">Pazarlık payı var</span>` : ''}
        </div>
        <h2 class="mk-detail-title">${_esc(item.title)}</h2>
        <div class="mk-detail-price">${priceHtml}</div>
        <div class="mk-detail-meta">
          <div class="mk-meta-row">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            <span>${_esc(item.location || '—')}</span>
          </div>
          <div class="mk-meta-row">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span>${_esc(date)}</span>
          </div>
          ${item.contact_name ? `<div class="mk-meta-row">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>${_esc(item.contact_name)}</span>
          </div>` : ''}
        </div>
        ${item.description ? `<div class="mk-detail-desc">${_esc(item.description).replace(/\n/g, '<br>')}</div>` : ''}
        <div class="mk-detail-actions">
          <a href="${_esc(contactHref)}" ${contactHref.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}
             class="mk-contact-btn" id="mk-contact-btn">
            ${contactIsWa
              ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.92c0 1.92.55 3.78 1.6 5.39L2 22l4.86-1.7a9.93 9.93 0 0 0 5.18 1.45c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Z"/></svg><span data-en="Contact via WhatsApp" data-de="Per WhatsApp kontaktieren" data-ru="Написать в WhatsApp" data-fr="Contacter via WhatsApp">WhatsApp ile İletişim</span>`
              : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.94.36 1.86.68 2.75a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.33-1.33a2 2 0 0 1 2.11-.45c.89.32 1.81.55 2.75.68A2 2 0 0 1 22 16.92z"/></svg><span data-en="Call" data-de="Anrufen" data-ru="Позвонить" data-fr="Appeler">İletişim</span>`}
          </a>
          <button class="mk-report-btn" id="mk-report-btn" data-en="Report" data-de="Melden" data-ru="Пожаловаться" data-fr="Signaler">Bildir</button>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

let _fallbackCache = null;
function _fallbackListings(filters = {}) {
  // data/pazar-yeri.json senkron cache — page zaten fetch'liyor; burada bağımsız kullanım için lazy fetch yapmayız.
  const items = (_fallbackCache || []).map(i => ({ ...i, demo: true }));
  return items.filter(i => _matchesFilters(i, filters));
}

/** Sayfa data/pazar-yeri.json'u yüklediğinde çağırır (fallback için). */
export function setFallbackData(items) {
  _fallbackCache = (items || []).map(_normalize);
}

function _normalize(row) {
  if (!row) return row;
  return {
    ...row,
    // demo JSON eski kategori anahtarlarını yeni slug'a çevir (geriye dönük)
    category: _mapLegacyCategory(row.category),
    // demo JSON tek "image" alanı → images[]
    images: Array.isArray(row.images) && row.images.length ? row.images
      : (row.image ? [row.image] : []),
    description: row.description ?? row.desc ?? '',
  };
}

const LEGACY_CAT = {
  EvEsyasi: 'ev-esyasi', Elektronik: 'elektronik', Arac: 'arac-bisiklet',
  YerelUrun: 'yerel-urun', Bahce: 'bahce-yapi', Giyim: 'giyim', Hizmet: 'hizmet',
};
function _mapLegacyCategory(c) {
  if (!c) return 'diger';
  if (CATEGORIES[c]) return c;
  return LEGACY_CAT[c] || 'diger';
}

function _matchesFilters(item, f) {
  if (f.category && f.category !== 'all' && item.category !== f.category) return false;
  if (f.condition && f.condition !== 'all' && item.condition !== f.condition) return false;
  if (f.search) {
    const s = f.search.toLowerCase();
    const blob = [item.title, item.location, item.description, item.desc, CATEGORIES[item.category]]
      .filter(Boolean).join(' ').toLowerCase();
    if (!blob.includes(s)) return false;
  }
  return true;
}

function _slugify(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[ğ]/g, 'g').replace(/[ü]/g, 'u').replace(/[ş]/g, 's').replace(/[ı]/g, 'i').replace(/[ö]/g, 'o').replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function _esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function _digits(s) { return String(s || '').replace(/[^\d]/g, ''); }

function _formatPrice(price, currency) {
  if (price == null || price === '') {
    return `<span class="mk-price-ask" data-en="Contact for price" data-de="Preis auf Anfrage" data-ru="Цена по запросу" data-fr="Prix sur demande">Fiyat için iletişim</span>`;
  }
  const n = Number(price);
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺';
  return `${sym}${n.toLocaleString('tr-TR')}`;
}

function _formatDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Fotoğrafı canvas ile en fazla `max` px'e küçültür, JPEG blob döner.
 */
function _resizeToJpeg(file, max = RESIZE_MAX, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > max || height > max) {
        if (width >= height) { height = Math.round(height * (max / width)); width = max; }
        else { width = Math.round(width * (max / height)); height = max; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Fotoğraf işlenemedi.')),
        'image/jpeg', quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Fotoğraf okunamadı.')); };
    img.src = url;
  });
}
