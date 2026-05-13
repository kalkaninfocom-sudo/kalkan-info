/**
 * Kalkan Info — Job Board Module
 *
 * Firestore koleksiyonları:
 *  - jobs/{jobId}            ilanlar
 *  - jobApplications/{appId} başvurular
 *
 * Graceful degrade: Firebase yapılandırılmamışsa demo veri ile çalışır.
 */

// auth.js'i lazy import: Firebase config boşsa init patlar, sayfa kırılmasın
let _firebaseAvailable = null;
async function _checkFirebase() {
  if (_firebaseAvailable !== null) return _firebaseAvailable;
  try {
    const mod = await import('./auth.js');
    _firebaseAvailable = Boolean(mod.isFirebaseConfigured);
  } catch {
    _firebaseAvailable = false;
  }
  return _firebaseAvailable;
}

let _firestore = null;

async function _getDb() {
  if (!(await _checkFirebase())) return null;
  if (_firestore) return _firestore;
  try {
    const { getFirestore, collection, query, where, orderBy, limit, getDocs, getDoc, doc, addDoc, setDoc, updateDoc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const apps = getApps();
    if (!apps.length) {
      console.warn('[jobs] firebase app henüz init edilmemiş');
      return null;
    }
    _firestore = {
      db: getFirestore(apps[0]),
      api: { collection, query, where, orderBy, limit, getDocs, getDoc, doc, addDoc, setDoc, updateDoc, serverTimestamp },
    };
    return _firestore;
  } catch (err) {
    console.warn('[jobs] firestore yüklenemedi, demo moda düşülüyor:', err.message);
    return null;
  }
}

// ----------------------------------------------------------------------------
// Demo veri (Firebase yoksa)
// ----------------------------------------------------------------------------
const DEMO_JOBS = [
  {
    id: 'demo-1',
    title: 'Restoran Garson — Sezonluk',
    slug: 'restoran-garson-sezonluk',
    category: 'restoran',
    type: 'seasonal',
    location: 'Kalkan Merkez',
    languages: ['tr', 'en'],
    experience: '1 yıl+',
    salaryMin: 25000, salaryMax: 35000, currency: 'TRY',
    descriptionHtml: '<p>Mayıs-Ekim sezonu boyunca, denize sıfır restoranımızda <strong>akşam vardiyası garsonu</strong> arıyoruz. İngilizce zorunlu, Almanca artı.</p>',
    requirements: ['Min. 1 yıl restoran deneyimi', 'İngilizce iletişim', 'Pazartesi-Pazar dönemli vardiya'],
    contactEmail: 'demo@kalkaninfo.com',
    publishedAt: new Date('2026-04-28'),
    expiresAt: new Date('2026-06-30'),
    employerName: 'Aubergine Kalkan',
    status: 'active',
  },
  {
    id: 'demo-2',
    title: 'Villa Concierge / Misafir Karşılama',
    slug: 'villa-concierge',
    category: 'villa',
    type: 'full',
    location: 'Kalkan',
    languages: ['tr', 'en', 'ru'],
    experience: '2 yıl+',
    salaryMin: 35000, salaryMax: 50000, currency: 'TRY',
    descriptionHtml: '<p>Lüks villa portföyümüzde misafir check-in/check-out, transfer koordinasyonu, günlük destek. Ehliyet zorunlu.</p>',
    requirements: ['Ehliyet B sınıfı', 'Akıcı İngilizce', 'Rusça veya Almanca tercih', 'Esnek çalışma saatleri'],
    contactEmail: 'demo@kalkaninfo.com',
    publishedAt: new Date('2026-04-25'),
    expiresAt: new Date('2026-07-15'),
    employerName: 'Kalkan Premium Villas',
    status: 'active',
  },
  {
    id: 'demo-3',
    title: 'Tekne Kaptanı — Günlük Tur',
    slug: 'tekne-kaptani',
    category: 'tur',
    type: 'seasonal',
    location: 'Kalkan Marina',
    languages: ['tr', 'en'],
    experience: '5 yıl+',
    salaryMin: 50000, salaryMax: 75000, currency: 'TRY',
    descriptionHtml: '<p>Günlük 12 kişilik tekne turlarımız için ehliyetli kaptan. Kaş-Kalkan-Kaputaş rotası.</p>',
    requirements: ['Amatör Denizci Belgesi (ADB) min.', 'Kalkan-Kaş bölge bilgisi', 'Misafirle iletişim becerisi'],
    contactEmail: 'demo@kalkaninfo.com',
    publishedAt: new Date('2026-04-20'),
    expiresAt: new Date('2026-05-31'),
    employerName: 'Likya Tekne Turları',
    status: 'active',
  },
  {
    id: 'demo-4',
    title: 'Ev Aşçısı / Catering',
    slug: 'ev-ascisi',
    category: 'hizmet',
    type: 'freelance',
    location: 'Kalkan Civarı',
    languages: ['tr'],
    experience: '3 yıl+',
    salaryMin: 1500, salaryMax: 3500, currency: 'TRY',
    descriptionHtml: '<p>Villa misafirlerine günlük ev yemeği. Esnek saatler, günlük ücret.</p>',
    requirements: ['Türk + Akdeniz mutfağı', 'Hijyen sertifikası', 'Kendi ulaşımı'],
    contactEmail: 'demo@kalkaninfo.com',
    publishedAt: new Date('2026-04-22'),
    expiresAt: new Date('2026-08-15'),
    employerName: 'Bireysel İşveren',
    status: 'active',
  },
];

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

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export function getCategories() { return { ...CATEGORIES }; }
export function getTypes() { return { ...TYPES }; }

export async function listJobs(filters = {}) {
  const fb = await _getDb();
  if (!fb) {
    return DEMO_JOBS.filter(j => _matchesFilters(j, filters));
  }
  try {
    const { db, api } = fb;
    let q = api.query(api.collection(db, 'jobs'), api.where('status', '==', 'active'), api.orderBy('publishedAt', 'desc'), api.limit(50));
    const snap = await api.getDocs(q);
    const jobs = [];
    snap.forEach(d => jobs.push({ id: d.id, ...d.data() }));
    return jobs.filter(j => _matchesFilters(j, filters));
  } catch (err) {
    console.warn('[jobs] listJobs hatası, demo moda düşülüyor:', err.message);
    return DEMO_JOBS.filter(j => _matchesFilters(j, filters));
  }
}

export async function getJob(idOrSlug) {
  const fb = await _getDb();
  if (!fb) {
    return DEMO_JOBS.find(j => j.id === idOrSlug || j.slug === idOrSlug) || null;
  }
  try {
    const { db, api } = fb;
    const ref = api.doc(db, 'jobs', idOrSlug);
    const snap = await api.getDoc(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    const q = api.query(api.collection(db, 'jobs'), api.where('slug', '==', idOrSlug), api.limit(1));
    const qsnap = await api.getDocs(q);
    if (!qsnap.empty) {
      const d = qsnap.docs[0];
      return { id: d.id, ...d.data() };
    }
    return null;
  } catch (err) {
    return DEMO_JOBS.find(j => j.id === idOrSlug || j.slug === idOrSlug) || null;
  }
}

export async function createJob(data, ownerUid) {
  const fb = await _getDb();
  if (!fb) {
    console.warn('[jobs] Firebase yok, ilan kaydedilmedi (demo).');
    return { ok: false, error: 'Firebase yapılandırılmamış. Lütfen önce giriş yapın.' };
  }
  try {
    const { db, api } = fb;
    const ref = api.doc(api.collection(db, 'jobs'));
    const slug = _slugify(data.title) + '-' + ref.id.slice(-6);
    await api.setDoc(ref, {
      ...data,
      ownerUid,
      slug,
      status: 'pending',
      viewCount: 0,
      applicationCount: 0,
      createdAt: api.serverTimestamp(),
      updatedAt: api.serverTimestamp(),
      publishedAt: null,
    });
    return { ok: true, id: ref.id, slug };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function applyToJob(jobId, applicantData, applicantUid) {
  const fb = await _getDb();
  if (!fb) return { ok: false, error: 'Önce giriş yapın.' };
  try {
    const { db, api } = fb;
    const job = await getJob(jobId);
    if (!job) return { ok: false, error: 'İlan bulunamadı.' };
    const ref = api.doc(api.collection(db, 'jobApplications'));
    await api.setDoc(ref, {
      jobId,
      jobOwnerUid: job.ownerUid,
      applicantUid,
      applicantName: applicantData.name,
      applicantPhone: applicantData.phone,
      applicantEmail: applicantData.email,
      coverNote: applicantData.coverNote || '',
      cvUrl: applicantData.cvUrl || null,
      status: 'pending',
      createdAt: api.serverTimestamp(),
      updatedAt: api.serverTimestamp(),
    });
    return { ok: true, id: ref.id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function getMyJobs(uid) {
  const fb = await _getDb();
  if (!fb) return [];
  try {
    const { db, api } = fb;
    const q = api.query(api.collection(db, 'jobs'), api.where('ownerUid', '==', uid), api.orderBy('createdAt', 'desc'));
    const snap = await api.getDocs(q);
    const jobs = [];
    snap.forEach(d => jobs.push({ id: d.id, ...d.data() }));
    return jobs;
  } catch (err) {
    return [];
  }
}

export async function getMyApplications(uid) {
  const fb = await _getDb();
  if (!fb) return [];
  try {
    const { db, api } = fb;
    const q = api.query(api.collection(db, 'jobApplications'), api.where('applicantUid', '==', uid), api.orderBy('createdAt', 'desc'));
    const snap = await api.getDocs(q);
    const apps = [];
    snap.forEach(d => apps.push({ id: d.id, ...d.data() }));
    return apps;
  } catch (err) {
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
  const salary = _formatSalary(job.salaryMin, job.salaryMax, job.currency);
  const date = _formatDate(job.publishedAt);
  return `
    <article class="card-base card-hover rounded-xl border border-sea-100 p-5 cursor-pointer" data-job-id="${_esc(job.id)}">
      <div class="flex items-center justify-between mb-3">
        <span class="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-sea-600 bg-sea-50 px-2 py-1 rounded">${_esc(cat)}</span>
        <span class="text-[11px] text-sea-500">${_esc(date)}</span>
      </div>
      <h3 class="font-display font-extrabold text-base text-sea-800 leading-tight mb-2">${_esc(job.title)}</h3>
      <p class="text-sm text-sea-600 mb-3">${_esc(job.employerName || '')}</p>
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
  const salary = _formatSalary(job.salaryMin, job.salaryMax, job.currency);
  const reqs = (job.requirements || []).map(r => `<li class="flex items-start gap-2 text-sm text-sea-700"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e89812" stroke-width="3" class="mt-0.5 flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg><span>${_esc(r)}</span></li>`).join('');

  return `
    <div class="bg-white rounded-2xl shadow-deep border border-sea-100">
      <header class="p-6 md:p-8 border-b border-sea-100 bg-gradient-to-br from-sea-50 to-white">
        <div class="flex items-start gap-3 mb-3">
          <span class="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-sea-600 bg-white border border-sea-200 px-2.5 py-1 rounded">${_esc(cat)}</span>
          <span class="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-sun-600 bg-sun-400/10 border border-sun-400/30 px-2.5 py-1 rounded">${_esc(type)}</span>
        </div>
        <h1 class="font-display font-extrabold text-2xl md:text-3xl text-sea-800 leading-tight mb-2">${_esc(job.title)}</h1>
        <p class="text-sea-600 font-semibold">${_esc(job.employerName || '')}</p>
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
        ${job.expiresAt ? `<div>
          <div class="text-[10px] uppercase tracking-wider font-bold text-sea-500 mb-1">Son Başvuru</div>
          <div class="text-sea-800 font-semibold">${_esc(_formatDate(job.expiresAt))}</div>
        </div>` : ''}
      </div>

      <div class="px-6 md:px-8 pb-6 md:pb-8">
        <h2 class="font-display font-bold text-lg text-sea-800 mb-3">İlan Detayı</h2>
        <div class="prose prose-sm max-w-none text-sea-700 leading-relaxed">${job.descriptionHtml || ''}</div>

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
    const blob = (job.title + ' ' + job.location + ' ' + (job.employerName || '') + ' ' + (job.descriptionHtml || '')).toLowerCase();
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

function _formatSalary(min, max, cur) {
  if (!min && !max) return '';
  const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '₺';
  const fmt = n => n.toLocaleString('tr-TR');
  if (min && max && min !== max) return `${sym}${fmt(min)} – ${sym}${fmt(max)}`;
  return `${sym}${fmt(min || max)}`;
}

function _formatDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : (d.seconds ? new Date(d.seconds * 1000) : new Date(d));
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}
