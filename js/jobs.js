/**
 * Kalkan Info — Job Board Module (Supabase port — Faz 2.5)
 *
 * Supabase tabloları:
 *   - jobs              ilanlar (status='active' public)
 *   - job_applications  başvurular
 *
 * Graceful degrade: Supabase yapılandırılmamışsa demo veri ile çalışır.
 */

import { supabase } from './supabase-client.js';
import { isSupabaseConfigured } from './auth.js';

// ----------------------------------------------------------------------------
// Supabase yapılandırılmamışsa fallback boş liste — kullanıcı empty state görür.
// Önceki demo veriler kaldırıldı (production'da fake iletişim göstermemek için).
// ----------------------------------------------------------------------------
const DEMO_JOBS = [];

const CATEGORIES = {
  restoran: 'Restoran & Cafe',
  villa: 'Villa & Konaklama',
  otel: 'Otel & Pansiyon',
  tur: 'Tekne & Tur',
  hizmet: 'Hizmet & Bakım',
  ofis: 'Ofis & Yönetim',
  diger: 'Diğer',
};

const TYPES = {
  full: 'Tam zamanlı',
  part: 'Yarı zamanlı',
  seasonal: 'Sezonluk',
  freelance: 'Serbest',
};

const LANG_LABELS = { tr: 'TR', en: 'EN', de: 'DE', ru: 'RU', ar: 'AR', fr: 'FR' };

const POSTER_TYPES = { kisi: 'Şahıs', isletme: 'İşletme' };

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export function getCategories() { return { ...CATEGORIES }; }
export function getTypes() { return { ...TYPES }; }

export async function listJobs(filters = {}) {
  if (!isSupabaseConfigured) {
    return DEMO_JOBS.filter(j => _matchesFilters(j, filters));
  }
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'active')
      .order('published_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    const jobs = data || [];
    return jobs.filter(j => _matchesFilters(j, filters));
  } catch (err) {
    console.warn('[jobs] listJobs hatası, demo moda düşülüyor:', err.message);
    return DEMO_JOBS.filter(j => _matchesFilters(j, filters));
  }
}

export async function getJob(idOrSlug) {
  if (!isSupabaseConfigured) {
    return DEMO_JOBS.find(j => j.id === idOrSlug || j.slug === idOrSlug) || null;
  }
  try {
    // UUID kontrolü — değilse direkt slug ile arar
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    if (isUuid) {
      const { data, error } = await supabase.from('jobs').select('*').eq('id', idOrSlug).maybeSingle();
      if (error) throw error;
      if (data) return data;
    }
    const { data, error } = await supabase.from('jobs').select('*').eq('slug', idOrSlug).maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (err) {
    console.warn('[jobs] getJob hatası:', err.message);
    return DEMO_JOBS.find(j => j.id === idOrSlug || j.slug === idOrSlug) || null;
  }
}

export async function createJob(data, ownerUid) {
  if (!isSupabaseConfigured) {
    console.warn('[jobs] Supabase yok, ilan kaydedilmedi (demo).');
    return { ok: false, error: 'Supabase yapılandırılmamış. Lütfen önce giriş yapın.' };
  }
  try {
    const slug = _slugify(data.title) + '-' + Math.random().toString(36).slice(2, 8);
    const row = {
      owner_id:         ownerUid,
      slug,
      title:            data.title,
      category:         data.category,
      type:             data.type,
      poster_type:      data.posterType ?? data.poster_type ?? 'isletme',
      location:         data.location,
      employer_name:    data.employerName ?? data.employer_name ?? '',
      contact_email:    data.contactEmail ?? data.contact_email ?? '',
      description_html: data.descriptionHtml ?? data.description_html ?? null,
      requirements:     data.requirements || [],
      languages:        data.languages || [],
      experience:       data.experience || null,
      salary_min:       data.salaryMin ?? data.salary_min ?? null,
      salary_max:       data.salaryMax ?? data.salary_max ?? null,
      currency:         data.currency || 'TRY',
      status:           'pending',
      expires_at:       data.expiresAt ?? data.expires_at ?? null,
    };
    const { data: inserted, error } = await supabase
      .from('jobs')
      .insert(row)
      .select('id, slug')
      .single();
    if (error) throw error;
    return { ok: true, id: inserted.id, slug: inserted.slug };
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('row-level security') || msg.includes('policy')) {
      const { data: { user } } = await supabase.auth.getUser();
      const verified = user?.user_metadata?.email_verified ?? user?.email_confirmed_at;
      if (!verified) {
        return { ok: false, error: 'E-posta adresinizi doğrulamanız gerekiyor. Gelen kutunuzdaki doğrulama linkine tıklayın, sonra tekrar deneyin.' };
      }
      return { ok: false, error: 'İlan yayınlama yetkiniz yok. Lütfen tekrar giriş yapın.' };
    }
    return { ok: false, error: err.message };
  }
}

export async function updateJob(id, patch, ownerUid) {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase yapılandırılmamış. Lütfen önce giriş yapın.' };
  }
  try {
    const row = { ...patch, status: 'pending', updated_at: new Date().toISOString() };
    // owner_id/id gibi immutable alanları patch'ten çıkar (defans)
    delete row.id;
    delete row.owner_id;
    delete row.slug;
    let q = supabase.from('jobs').update(row).eq('id', id);
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

export async function deleteJob(id, ownerUid) {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase yapılandırılmamış. Lütfen önce giriş yapın.' };
  }
  try {
    let q = supabase.from('jobs').delete().eq('id', id);
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

export async function applyToJob(jobId, applicantData, applicantUid) {
  if (!isSupabaseConfigured) return { ok: false, error: 'Önce giriş yapın.' };
  try {
    const job = await getJob(jobId);
    if (!job) return { ok: false, error: 'İlan bulunamadı.' };
    const row = {
      job_id:          job.id,
      job_owner_id:    job.owner_id,
      applicant_id:    applicantUid,
      applicant_name:  applicantData.name,
      applicant_phone: applicantData.phone,
      applicant_email: applicantData.email,
      cover_note:      applicantData.coverNote || null,
      cv_url:          applicantData.cvUrl || null,
      status:          'pending',
    };
    const { data: inserted, error } = await supabase
      .from('job_applications')
      .insert(row)
      .select('id')
      .single();
    if (error) throw error;
    return { ok: true, id: inserted.id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function getMyJobs(uid) {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('owner_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[jobs] getMyJobs hatası:', err.message);
    return [];
  }
}

export async function getMyApplications(uid) {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('job_applications')
      .select('*')
      .eq('applicant_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[jobs] getMyApplications hatası:', err.message);
    return [];
  }
}

// ----------------------------------------------------------------------------
// Render helpers
// ----------------------------------------------------------------------------

export function renderJobCard(job) {
  const cat = CATEGORIES[job.category] || 'Diğer';
  const type = TYPES[job.type] || '';
  const langs = (job.languages || []).map(l => LANG_LABELS[l] || l.toUpperCase()).join(' · ');
  const salary = _formatSalary(_pick(job, 'salary_min', 'salaryMin'), _pick(job, 'salary_max', 'salaryMax'), job.currency);
  const date = _formatDate(_pick(job, 'published_at', 'publishedAt'));
  const employer = _pick(job, 'employer_name', 'employerName') || '';
  return `
    <article class="card-base card-hover rounded-xl border border-sea-100 p-5 cursor-pointer" data-job-id="${_esc(job.id)}">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-1.5">
          <span class="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-sea-600 bg-sea-50 px-2 py-1 rounded">${_esc(cat)}</span>
          ${job.poster_type === 'kisi' ? `<span class="inline-flex items-center text-[10px] uppercase tracking-wider font-bold text-sun-600 bg-sun-400/10 border border-sun-400/30 px-2 py-1 rounded">${_esc(POSTER_TYPES.kisi)}</span>` : ''}
        </div>
        <span class="text-[11px] text-sea-500">${_esc(date)}</span>
      </div>
      <h3 class="font-display font-extrabold text-base text-sea-800 leading-tight mb-2">${_esc(job.title)}</h3>
      <p class="text-sm text-sea-600 mb-3">${_esc(employer)}</p>
      <div class="space-y-1.5 text-xs text-sea-700">
        <div class="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${_esc(job.location || '')}
        </div>
        <div class="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          ${_esc(type)}${langs ? ' · ' + _esc(langs) : ''}
        </div>
        ${salary ? `<div class="flex items-center gap-2 font-semibold text-sun-600">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          ${_esc(salary)}
        </div>` : ''}
      </div>
      <div class="mt-4 pt-3 border-t border-sea-100 flex items-center justify-between">
        <span class="text-[11px] text-sea-500 uppercase tracking-wider font-semibold">İlan Detayı</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a5e93" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </div>
    </article>
  `;
}

export function renderJobDetail(job) {
  if (!job) return `<div class="text-center py-10 text-sea-600">İlan bulunamadı.</div>`;
  const cat = CATEGORIES[job.category] || 'Diğer';
  const type = TYPES[job.type] || '';
  const langs = (job.languages || []).map(l => LANG_LABELS[l] || l.toUpperCase()).join(' · ');
  const salary = _formatSalary(_pick(job, 'salary_min', 'salaryMin'), _pick(job, 'salary_max', 'salaryMax'), job.currency);
  const employer = _pick(job, 'employer_name', 'employerName') || '';
  const expiresAt = _pick(job, 'expires_at', 'expiresAt');
  const descriptionHtml = _pick(job, 'description_html', 'descriptionHtml') || '';
  const reqs = (job.requirements || []).map(r => `<li class="flex items-start gap-2 text-sm text-sea-700"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e89812" stroke-width="3" class="mt-0.5 flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg><span>${_esc(r)}</span></li>`).join('');

  return `
    <div class="bg-white rounded-2xl shadow-deep border border-sea-100">
      <header class="p-6 md:p-8 border-b border-sea-100 bg-gradient-to-br from-sea-50 to-white">
        <div class="flex items-start gap-3 mb-3">
          <span class="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-sea-600 bg-white border border-sea-200 px-2.5 py-1 rounded">${_esc(cat)}</span>
          <span class="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-sun-600 bg-sun-400/10 border border-sun-400/30 px-2.5 py-1 rounded">${_esc(type)}</span>
          <span class="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-sea-600 bg-white border border-sea-200 px-2.5 py-1 rounded">${_esc(POSTER_TYPES[job.poster_type] || POSTER_TYPES.isletme)}</span>
        </div>
        <h1 class="font-display font-extrabold text-2xl md:text-3xl text-sea-800 leading-tight mb-2">${_esc(job.title)}</h1>
        <p class="text-sea-600 font-semibold">${_esc(employer)}</p>
      </header>

      <div class="p-6 md:p-8 grid md:grid-cols-3 gap-6 text-sm">
        <div>
          <div class="text-[10px] uppercase tracking-wider font-bold text-sea-500 mb-1">Konum</div>
          <div class="text-sea-800 font-semibold">${_esc(job.location || '—')}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wider font-bold text-sea-500 mb-1">Diller</div>
          <div class="text-sea-800 font-semibold">${_esc(langs || '—')}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wider font-bold text-sea-500 mb-1">Maaş Aralığı</div>
          <div class="text-sun-600 font-bold">${_esc(salary || 'Görüşülecek')}</div>
        </div>
        ${job.experience ? `<div>
          <div class="text-[10px] uppercase tracking-wider font-bold text-sea-500 mb-1">Deneyim</div>
          <div class="text-sea-800 font-semibold">${_esc(job.experience)}</div>
        </div>` : ''}
        ${expiresAt ? `<div>
          <div class="text-[10px] uppercase tracking-wider font-bold text-sea-500 mb-1">Son Başvuru</div>
          <div class="text-sea-800 font-semibold">${_esc(_formatDate(expiresAt))}</div>
        </div>` : ''}
      </div>

      <div class="px-6 md:px-8 pb-6 md:pb-8">
        <h2 class="font-display font-bold text-lg text-sea-800 mb-3">İlan Detayı</h2>
        <div class="prose prose-sm max-w-none text-sea-700 leading-relaxed">${_sanitizeRichText(descriptionHtml)}</div>

        ${reqs ? `<h2 class="font-display font-bold text-lg text-sea-800 mt-6 mb-3">Aranan Nitelikler</h2>
        <ul class="space-y-2">${reqs}</ul>` : ''}
      </div>

      <footer class="p-6 md:p-8 border-t border-sea-100 bg-sea-50 flex flex-col sm:flex-row gap-3">
        <button id="apply-btn" class="flex-1 bg-gradient-to-br from-sun-400 to-sun-500 text-sea-900 font-display font-extrabold py-3 px-6 rounded-xl shadow-deep hover:from-sun-500 hover:to-sun-600 transition">
          BAŞVUR
        </button>
        <button id="share-btn" class="flex-1 border-2 border-sea-200 bg-white text-sea-700 font-display font-bold py-3 px-6 rounded-xl hover:border-sea-500 hover:bg-sea-50 transition">
          PAYLAŞ
        </button>
      </footer>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

function _matchesFilters(job, f) {
  if (f.category && f.category !== 'all' && job.category !== f.category) return false;
  if (f.type && f.type !== 'all' && job.type !== f.type) return false;
  if (f.language && f.language !== 'all' && !(job.languages || []).includes(f.language)) return false;
  if (f.search) {
    const s = f.search.toLowerCase();
    const employer = _pick(job, 'employer_name', 'employerName') || '';
    const desc = _pick(job, 'description_html', 'descriptionHtml') || '';
    const blob = (job.title + ' ' + job.location + ' ' + employer + ' ' + desc).toLowerCase();
    if (!blob.includes(s)) return false;
  }
  return true;
}

function _pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return null;
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

// Defense-in-depth: ilan açıklamasında sadece <p> ve <br> tag'lerine izin ver, gerisini soy.
// Form tarafı zaten escape ediyor ama anon API üzerinden injection olasılığına karşı.
function _sanitizeRichText(html) {
  if (html == null) return '';
  return String(html)
    .replace(/<\s*\/?\s*(?!p\b|br\b)[a-z][^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
}

function _formatSalary(min, max, cur) {
  if (!min && !max) return '';
  const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '₺';
  const fmt = n => n.toLocaleString('tr-TR');
  if (min && max && min !== max) return `${sym}${fmt(min)} – ${sym}${fmt(max)}`;
  return `${sym}${fmt(min || max)}`;
}

function _formatDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : (typeof d === 'string' ? new Date(d) : (d.seconds ? new Date(d.seconds * 1000) : new Date(d)));
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}
