/**
 * Kalkan Stays — Host Panel Module
 *
 * Supabase tables:
 *   - stays               ilan (owner_id = auth uid)
 *   - stay_blocked_dates  manuel kapalı günler
 *   - stay_bookings       rezervasyonlar (talep→onay)
 * Storage:
 *   - stay-photos         fotoğraflar (public read, <uid>/ klasörüne yazma)
 *
 * marketplace.js deseninin ikizi — aynı upload, upsert ve RLS mantığı.
 */

import { supabase } from './supabase-client.js';
import { isSupabaseConfigured } from './auth.js';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const BUCKET       = 'stay-photos';
const MAX_IMAGES   = 12;
const MAX_BYTES    = 8 * 1024 * 1024; // 8 MB
const RESIZE_MAX   = 1600;

export const LISTING_TYPES = {
  room:           'Oda',
  apartment:      'Daire',
  villa:          'Villa',
  whole_building: 'Tüm Bina',
  couch:          'Kanepe / Yaşam Alanı',
};

export const AMENITIES_LIST = [
  { key: 'wifi',     label: 'Wi-Fi' },
  { key: 'pool',     label: 'Havuz' },
  { key: 'ac',       label: 'Klima' },
  { key: 'kitchen',  label: 'Mutfak' },
  { key: 'parking',  label: 'Otopark' },
  { key: 'seaview',  label: 'Deniz Manzarası' },
  { key: 'washer',   label: 'Çamaşır Makinesi' },
  { key: 'heating',  label: 'Isıtma' },
  { key: 'tv',       label: 'TV' },
  { key: 'bbq',      label: 'BBQ / Mangal' },
  { key: 'garden',   label: 'Bahçe / Teras' },
  { key: 'elevator', label: 'Asansör' },
  { key: 'pets',     label: 'Evcil Hayvan İzinli' },
  { key: 'smoking',  label: 'Sigara İzinli' },
];

export const BOOKING_STATUS_LABELS = {
  requested:  'Talep Edildi',
  confirmed:  'Onaylandı',
  rejected:   'Reddedildi',
  cancelled:  'İptal Edildi',
  completed:  'Tamamlandı',
};

// ----------------------------------------------------------------------------
// Photo Upload — mirrors marketplace.js uploadImages exactly
// ----------------------------------------------------------------------------

/**
 * Fotoğrafları Storage'a yükler, public URL[] döner.
 * path = `${uid}/${staySlug}-${i}-${Date.now()}.jpg`
 */
export async function uploadStayPhotos(files, uid, slug = 'konaklama') {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase yapılandırılmamış.', urls: [] };
  }
  const list = Array.from(files || []).slice(0, MAX_IMAGES);
  const urls = [];
  try {
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      if (file.size > MAX_BYTES) {
        return { ok: false, error: `"${file.name}" 8 MB'den büyük. Lütfen daha küçük bir fotoğraf seçin.`, urls };
      }
      const blob  = await _resizeToJpeg(file, RESIZE_MAX);
      const path  = `${uid}/${_slugify(slug)}-${i}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
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

// ----------------------------------------------------------------------------
// Stays CRUD
// ----------------------------------------------------------------------------

/** Kimlik doğrulu kullanıcının kendi ilanını getirir (edit modu). */
export async function getMyStay(id, uid) {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('stays')
      .select('*')
      .eq('id', id)
      .eq('owner_id', uid)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (err) {
    console.warn('[stays-host] getMyStay hatası:', err.message);
    return null;
  }
}

/** Tüm kendi ilanlarını listeler. */
export async function getMyStays(uid) {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('stays')
      .select('*')
      .eq('owner_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[stays-host] getMyStays hatası:', err.message);
    return [];
  }
}

/** Yeni stay ilanı oluşturur. images = yüklenmiş URL[]. */
export async function createStay(data, uid) {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase yapılandırılmamış. Lütfen önce giriş yapın.' };
  }
  try {
    const slug = _slugify(data.title) + '-' + Math.random().toString(36).slice(2, 7);
    const row  = _buildRow(data, uid, slug);
    const { data: inserted, error } = await supabase
      .from('stays')
      .insert(row)
      .select('id, slug')
      .single();
    if (error) throw error;
    return { ok: true, id: inserted.id, slug: inserted.slug };
  } catch (err) {
    return { ok: false, error: _rls(err) };
  }
}

/** Mevcut stay ilanını günceller (sadece owner). */
export async function updateStay(id, data, uid) {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase yapılandırılmamış. Lütfen önce giriş yapın.' };
  }
  try {
    const row = _buildRow(data, uid);
    delete row.owner_id; // RLS zaten kontrol eder; owner_id değiştirilmemeli
    delete row.slug;
    const { data: updated, error } = await supabase
      .from('stays')
      .update(row)
      .eq('id', id)
      .eq('owner_id', uid)
      .select('id, slug')
      .single();
    if (error) throw error;
    return { ok: true, id: updated.id, slug: updated.slug };
  } catch (err) {
    return { ok: false, error: _rls(err) };
  }
}

// ----------------------------------------------------------------------------
// Bookings — host tarafı
// ----------------------------------------------------------------------------

/**
 * Host'un kendi ilanlarına gelen tüm rezervasyonları getirir.
 * JOIN: stay title + slug.
 */
export async function getIncomingBookings(uid) {
  if (!isSupabaseConfigured) return [];
  try {
    // RLS: host kendi stay'ine ait booking'leri görebilir
    const { data, error } = await supabase
      .from('stay_bookings')
      .select('*, stays!inner(title, slug, owner_id)')
      .eq('stays.owner_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[stays-host] getIncomingBookings hatası:', err.message);
    return [];
  }
}

/** Host bir rezervasyonu onaylar (status → 'confirmed'). */
export async function confirmBooking(bookingId, hostResponse = '') {
  return _updateBookingStatus(bookingId, 'confirmed', hostResponse);
}

/** Host bir rezervasyonu reddeder (status → 'rejected'). */
export async function rejectBooking(bookingId, hostResponse = '') {
  return _updateBookingStatus(bookingId, 'rejected', hostResponse);
}

// ----------------------------------------------------------------------------
// Bookings — guest tarafı
// ----------------------------------------------------------------------------

/** Misafirin kendi rezervasyonlarını getirir (stay title dahil). */
export async function getMyBookings(uid) {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('stay_bookings')
      .select('*, stays(title, slug, images)')
      .eq('guest_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[stays-host] getMyBookings hatası:', err.message);
    return [];
  }
}

/** Misafir kendi rezervasyonunu iptal eder (status → 'cancelled'). */
export async function cancelBooking(bookingId) {
  return _updateBookingStatus(bookingId, 'cancelled');
}

// ----------------------------------------------------------------------------
// Blocked Dates
// ----------------------------------------------------------------------------

/** İlan için bloklu günleri getirir. */
export async function getBlockedDates(stayId) {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('stay_blocked_dates')
      .select('*')
      .eq('stay_id', stayId)
      .order('day', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[stays-host] getBlockedDates hatası:', err.message);
    return [];
  }
}

/** Bir günü manuel olarak bloklar. */
export async function addBlockedDate(stayId, day, reason = '') {
  if (!isSupabaseConfigured) return { ok: false, error: 'Supabase yapılandırılmamış.' };
  try {
    const { error } = await supabase
      .from('stay_blocked_dates')
      .upsert({ stay_id: stayId, day, reason }, { onConflict: 'stay_id,day' });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: _rls(err) };
  }
}

/** Bloklu günü kaldırır. */
export async function removeBlockedDate(stayId, day) {
  if (!isSupabaseConfigured) return { ok: false, error: 'Supabase yapılandırılmamış.' };
  try {
    const { error } = await supabase
      .from('stay_blocked_dates')
      .delete()
      .eq('stay_id', stayId)
      .eq('day', day);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: _rls(err) };
  }
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

function _buildRow(data, uid, slug) {
  const row = {
    owner_id:        uid,
    title:           data.title,
    listing_type:    data.listing_type,
    capacity:        _int(data.capacity, 1),
    bedrooms:        _int(data.bedrooms, 1),
    beds:            _int(data.beds, 1),
    bathrooms:       _int(data.bathrooms, 1),
    price_per_night: _num(data.price_per_night),
    cleaning_fee:    _num(data.cleaning_fee, 0),
    min_nights:      _int(data.min_nights, 1),
    max_nights:      data.max_nights ? _int(data.max_nights) : null,
    amenities:       Array.isArray(data.amenities) ? data.amenities : [],
    location:        data.location || null,
    images:          Array.isArray(data.images) ? data.images.slice(0, MAX_IMAGES) : [],
    house_rules:     data.house_rules || null,
    description:     data.description || null,
    available_from:  data.available_from || null,
    available_to:    data.available_to   || null,
    contact_whatsapp: data.contact_whatsapp || null,
    status:          'active',
    updated_at:      new Date().toISOString(),
  };
  if (slug) row.slug = slug;
  return row;
}

async function _updateBookingStatus(bookingId, status, hostResponse) {
  if (!isSupabaseConfigured) return { ok: false, error: 'Supabase yapılandırılmamış.' };
  try {
    const patch = { status, updated_at: new Date().toISOString() };
    if (hostResponse !== undefined) patch.host_response = hostResponse || null;
    const { error } = await supabase
      .from('stay_bookings')
      .update(patch)
      .eq('id', bookingId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: _rls(err) };
  }
}

function _rls(err) {
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('row-level security') || msg.includes('policy') || msg.includes('unauthorized')) {
    return 'Bu işlem için yetkiniz yok. E-postanızı doğrulayıp tekrar deneyin.';
  }
  return err.message;
}

function _slugify(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[ğ]/g, 'g').replace(/[ü]/g, 'u').replace(/[ş]/g, 's')
    .replace(/[ı]/g, 'i').replace(/[ö]/g, 'o').replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function _int(v, fallback = null) {
  const n = parseInt(v);
  return isNaN(n) ? fallback : n;
}

function _num(v, fallback = 0) {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

/**
 * Canvas ile görseli en fazla `max` px'e küçültür, JPEG blob döner.
 * marketplace.js _resizeToJpeg ile birebir aynı.
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
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Fotoğraf işlenemedi.')),
        'image/jpeg', quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Fotoğraf okunamadı.')); };
    img.src = url;
  });
}
