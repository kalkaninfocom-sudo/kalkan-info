/**
 * Kalkan Info — İş İlanları Listing Page Controller
 *
 * Supabase'den aktif ilanları çeker, filtre/arama uygular, modal'da detay açar,
 * ItemList JSON-LD enjekte eder (Google için).
 *
 * Bağımlılıklar:
 *   - js/jobs.js — listJobs, getJob, renderJobDetail
 *   - DOM: #jobs-grid, #empty-state, #result-count, filtreler, #job-modal
 *
 * Detay sayfası: gerçek URL /ilan/[slug] (api/ilan-page.js tarafından SSR).
 * Modal sadece hızlı önizleme; "Detay sayfasını aç" butonu paylaşılabilir URL'ye gider.
 */

import { listJobs, getJob, renderJobDetail } from './jobs.js';

(function () {
  'use strict';

  const CATEGORIES = { restoran:'Restoran & Cafe', villa:'Villa & Konaklama', otel:'Otel & Pansiyon', tur:'Tekne & Tur', hizmet:'Hizmet & Bakım', ofis:'Ofis & Yönetim', diger:'Diğer' };
  const TYPES = { full:'Tam zamanlı', part:'Yarı zamanlı', seasonal:'Sezonluk', freelance:'Serbest' };
  const LANG = { tr:'TR', en:'EN', de:'DE', ru:'RU', ar:'AR', fr:'FR' };
  const POSTER = { kisi:'Şahıs', isletme:'İşletme' };
  const PROFILE_KEY = 'kalkan_candidate_v1';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' }); } catch (e) { return iso; } };
  const $ = (id) => document.getElementById(id);

  let _jobs = [];

  // ----- Aday Profil (localStorage, KVKK uyumlu)
  function loadProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { return null; } }
  function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }
  function clearProfile() { localStorage.removeItem(PROFILE_KEY); }

  function profileSummaryForWA(p) {
    if (!p) return '';
    const lines = ['', '— Aday Profilim —', `Ad: ${p.name}`];
    if (p.phone) lines.push(`Telefon: ${p.phone}`);
    if (p.email) lines.push(`E-posta: ${p.email}`);
    if (p.position) lines.push(`Pozisyon: ${p.position}`);
    if (p.experience) lines.push(`Tecrübe: ${p.experience}`);
    if (p.languages) lines.push(`Diller: ${p.languages}`);
    if (p.skills) lines.push(`Yetenekler: ${p.skills}`);
    if (p.linkedin) lines.push(`LinkedIn: ${p.linkedin}`);
    if (p.bio) lines.push(`Hakkımda: ${p.bio}`);
    return lines.join('\n');
  }

  function buildProfileModal() {
    if (document.getElementById('candidate-modal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
<div id="candidate-modal" class="hidden fixed inset-0 z-[70] p-4 overflow-y-auto" style="background:rgba(7,33,54,0.55);backdrop-filter:blur(2px);" role="dialog" aria-modal="true">
  <div class="max-w-lg mx-auto my-6 bg-white rounded-2xl shadow-xl p-6 md:p-8">
    <div class="flex items-start justify-between mb-4">
      <div>
        <div class="text-[10px] font-bold uppercase tracking-wider text-sun-500">Aday Profili</div>
        <h2 class="font-display font-extrabold text-xl text-sea-800 mt-1">Profilini Oluştur</h2>
        <p class="text-xs text-sea-700/70 mt-1">Bilgilerin sadece bu tarayıcıda saklanır. Başvuruda WhatsApp mesajına otomatik eklenir.</p>
      </div>
      <button id="cm-close" aria-label="Kapat" class="w-9 h-9 grid place-items-center rounded-full hover:bg-sea-50 flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <form id="cm-form" class="space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Ad Soyad *</label>
          <input name="name" required class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none"/></div>
        <div><label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Pozisyon</label>
          <input name="position" placeholder="Örn: Garson" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none"/></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Telefon</label>
          <input name="phone" type="tel" placeholder="+90 5xx xxx xx xx" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none"/></div>
        <div><label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">E-posta</label>
          <input name="email" type="email" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none"/></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Tecrübe</label>
          <input name="experience" placeholder="Örn: 3 yıl restoran" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none"/></div>
        <div><label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Diller</label>
          <input name="languages" placeholder="TR, EN, DE" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none"/></div>
      </div>
      <div><label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Yetenekler</label>
        <input name="skills" placeholder="Müşteri iletişimi, kasa, ehliyet B" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none"/></div>
      <div><label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">LinkedIn</label>
        <input name="linkedin" type="url" placeholder="https://linkedin.com/in/..." class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none"/></div>
      <div><label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Kısa Biyo</label>
        <textarea name="bio" rows="3" placeholder="Neden bu pozisyonlar? Hangi günler müsaitsin?" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none"></textarea></div>
      <div class="flex flex-col sm:flex-row gap-2 pt-2">
        <button type="submit" class="flex-1 bg-gradient-to-br from-sun-400 to-sun-500 text-sea-900 font-display font-extrabold py-2.5 rounded-xl shadow-sm hover:from-sun-500 hover:to-sun-600 transition">Profili Kaydet</button>
        <button type="button" id="cm-clear" class="text-sea-600 hover:text-coral-500 text-sm font-semibold">Profili Sil</button>
      </div>
      <p class="text-[10px] text-sea-500 text-center">Bilgilerin yalnızca senin tarayıcında saklanır — sunucuya gönderilmez.</p>
    </form>
  </div>
</div>`;
    document.body.appendChild(wrap.firstElementChild);

    const modal = $('candidate-modal');
    const form = $('cm-form');
    const close = () => { modal.classList.add('hidden'); document.body.style.overflow = ''; };

    $('cm-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    $('cm-clear').addEventListener('click', () => {
      if (!confirm('Profilini silmek istediğinden emin misin?')) return;
      clearProfile(); form.reset(); updateProfilePill(); close();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const profile = {};
      ['name','position','phone','email','experience','languages','skills','linkedin','bio'].forEach(k => {
        const v = (fd.get(k) || '').toString().trim();
        if (v) profile[k] = v;
      });
      if (!profile.name) return;
      saveProfile(profile); updateProfilePill(); close();
    });
  }

  function openProfileModal() {
    buildProfileModal();
    const modal = $('candidate-modal');
    const form = $('cm-form');
    const p = loadProfile() || {};
    ['name','position','phone','email','experience','languages','skills','linkedin','bio'].forEach(k => {
      const el = form.querySelector(`[name="${k}"]`);
      if (el) el.value = p[k] || '';
    });
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function updateProfilePill() {
    const pill = $('candidate-pill');
    if (!pill) return;
    const p = loadProfile();
    if (p && p.name) {
      pill.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>${esc(p.name)} · Profil aktif</span>`;
      pill.classList.add('bg-emerald-50','text-emerald-700','border-emerald-200');
      pill.classList.remove('bg-sun-50','text-sun-700','border-sun-200');
    } else {
      pill.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg><span>Aday Profili Oluştur</span>`;
      pill.classList.add('bg-sun-50','text-sun-700','border-sun-200');
      pill.classList.remove('bg-emerald-50','text-emerald-700','border-emerald-200');
    }
  }

  function cardHtml(j) {
    const langs = (j.languages || []).map(l =>
      '<span class="text-[10px] font-bold bg-sea-50 text-sea-700 px-2 py-0.5 rounded-full">' + esc(LANG[l] || l) + '</span>'
    ).join('');
    const employer = j.employer_name || j.employer || '';
    const desc = j.description || (j.description_html || '').replace(/<[^>]+>/g, ' ').trim();
    const slug = j.slug || j.id;
    return [
      '<article data-job-slug="', esc(slug), '" class="bg-white rounded-2xl border border-sea-100 p-5 cursor-pointer hover:border-sun-500 hover:shadow-[0_8px_28px_-12px_rgba(7,33,54,0.25)] transition flex flex-col gap-3" style="box-shadow:0 1px 3px rgba(7,33,54,0.06);">',
        '<div class="flex items-start justify-between gap-3">',
          '<div class="min-w-0">',
            '<div class="text-[10px] font-bold uppercase tracking-wider text-sun-500">', esc(CATEGORIES[j.category] || j.category), '</div>',
            '<h3 class="font-display font-extrabold text-sea-800 text-base leading-tight mt-1 line-clamp-2">', esc(j.title), '</h3>',
          '</div>',
          '<div class="flex-shrink-0 flex flex-col items-end gap-1">',
            '<span class="text-[10px] font-bold bg-sea-50 text-sea-700 px-2 py-1 rounded-full whitespace-nowrap">', esc(TYPES[j.type] || j.type), '</span>',
            j.poster_type === 'kisi' ? '<span class="text-[10px] font-bold bg-sun-400/10 text-sun-600 border border-sun-400/30 px-2 py-0.5 rounded-full whitespace-nowrap">Şahıs</span>' : '',
          '</div>',
        '</div>',
        '<div class="text-xs text-sea-700/70 flex flex-wrap items-center gap-x-2 gap-y-1"><span>📍 ', esc(j.location), '</span><span class="text-sea-300">·</span><span>', esc(employer), '</span></div>',
        '<p class="text-sm text-sea-700/80 line-clamp-2">', esc(desc), '</p>',
        '<div class="flex flex-wrap items-center gap-1.5">', langs, '</div>',
        '<div class="flex items-center justify-between pt-3 border-t border-sea-50">',
          '<span class="text-[11px] font-semibold text-sea-700">📅 ', esc(fmtDate(j.published_at || j.created_at)), '</span>',
          '<span class="text-[11px] text-sun-600 font-bold">Detay →</span>',
        '</div>',
      '</article>'
    ].join('');
  }

  function detailHtml(j) {
    const langs = (j.languages || []).map(l => esc(LANG[l] || l)).join(', ');
    const reqs = (j.requirements || []).map(r =>
      '<li class="flex gap-2 items-start"><span class="text-sun-500 mt-0.5 flex-shrink-0">✓</span><span>' + esc(r) + '</span></li>'
    ).join('');
    const employer = j.employer_name || '';
    const desc = j.description || (j.description_html || '').replace(/<[^>]+>/g, ' ').trim();
    const profileText = profileSummaryForWA(loadProfile());
    const baseMsg = 'Merhaba! Kalkan Info üzerinden "' + j.title + '" ilanına başvurmak istiyorum.';
    const phone = (j.contact_phone || '').replace(/[^0-9]/g, '');
    const wa = phone
      ? 'https://wa.me/' + phone + '?text=' + encodeURIComponent(baseMsg + profileText)
      : 'mailto:' + (j.contact_email || 'info@kalkaninfo.com') + '?subject=' + encodeURIComponent(baseMsg);

    const fullUrl = `https://kalkaninfo.com/ilan/${j.slug}`;
    return [
      '<div class="bg-white rounded-2xl p-6 md:p-8">',
        '<div class="text-[11px] font-bold uppercase tracking-wider text-sun-500">', esc(CATEGORIES[j.category] || j.category), ' · ', esc(TYPES[j.type] || j.type), ' · ', esc(POSTER[j.poster_type] || POSTER.isletme), '</div>',
        '<h2 class="font-display font-extrabold text-sea-800 text-2xl md:text-3xl mt-2">', esc(j.title), '</h2>',
        '<div class="text-sea-700/70 text-sm mt-1">', esc(employer), ' · 📍 ', esc(j.location), '</div>',
        '<div class="grid sm:grid-cols-3 gap-3 mt-5">',
          '<div class="bg-sea-50 rounded-lg p-3"><div class="text-[10px] font-bold text-sea-600 uppercase">Tecrübe</div><div class="font-bold text-sea-800 mt-0.5">', esc(j.experience || '—'), '</div></div>',
          '<div class="bg-sea-50 rounded-lg p-3"><div class="text-[10px] font-bold text-sea-600 uppercase">Diller</div><div class="font-bold text-sea-800 mt-0.5">', langs || '—', '</div></div>',
          '<div class="bg-sea-50 rounded-lg p-3"><div class="text-[10px] font-bold text-sea-600 uppercase">Son Başvuru</div><div class="font-bold text-sea-800 mt-0.5">', esc(j.expires_at ? fmtDate(j.expires_at) : '—'), '</div></div>',
        '</div>',
        '<div class="mt-5"><div class="text-[10px] font-bold text-sea-600 uppercase mb-2">İş Tanımı</div><p class="text-sea-800/90 leading-relaxed whitespace-pre-wrap">', esc(desc), '</p></div>',
        reqs ? '<div class="mt-5"><div class="text-[10px] font-bold text-sea-600 uppercase mb-2">Aranan Nitelikler</div><ul class="space-y-1.5 text-sea-800/90 text-sm">' + reqs + '</ul></div>' : '',
        '<div class="flex flex-col sm:flex-row gap-2 mt-6">',
          '<a href="', wa, '" target="_blank" rel="noopener" class="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-white font-display font-extrabold py-3 rounded-xl transition">',
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>',
            '<span>WhatsApp ile Başvur</span>',
          '</a>',
          '<a href="', esc(fullUrl), '" class="flex items-center justify-center gap-2 bg-white border-2 border-sea-200 text-sea-700 font-display font-bold py-3 px-5 rounded-xl hover:border-sea-500 hover:bg-sea-50 transition">',
            'Paylaşılabilir Sayfa',
          '</a>',
        '</div>',
        '<p class="text-[11px] text-sea-500 text-center mt-3">İşveren genelde 24–48 saat içinde geri döner.</p>',
      '</div>'
    ].join('');
  }

  // ----- ItemList JSON-LD (Google ItemList rich result)
  function injectItemListLD(jobs) {
    const old = document.getElementById('jobs-itemlist-ld');
    if (old) old.remove();
    if (!jobs.length) return;
    const items = jobs.slice(0, 50).map((j, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://kalkaninfo.com/ilan/${j.slug}`,
    }));
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: items,
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'jobs-itemlist-ld';
    script.textContent = JSON.stringify(ld);
    document.head.appendChild(script);
  }

  function getFilters(els) {
    return {
      search: els.searchInput ? els.searchInput.value.trim() : '',
      category: els.filterCat ? els.filterCat.value : 'all',
      type: els.filterType ? els.filterType.value : 'all',
      language: els.filterLang ? els.filterLang.value : 'all',
      poster: els.filterPoster ? els.filterPoster.value : 'all',
    };
  }

  async function render(els) {
    const filtered = _jobs.filter(j => {
      const f = getFilters(els);
      if (f.search) {
        const employer = j.employer_name || j.employer || '';
        const desc = j.description || (j.description_html || '');
        const blob = (j.title + ' ' + employer + ' ' + j.location + ' ' + desc).toLowerCase();
        if (!blob.includes(f.search.toLowerCase())) return false;
      }
      if (f.category && f.category !== 'all' && j.category !== f.category) return false;
      if (f.type && f.type !== 'all' && j.type !== f.type) return false;
      if (f.language && f.language !== 'all' && !(j.languages || []).includes(f.language)) return false;
      if (f.poster && f.poster !== 'all' && (j.poster_type || 'isletme') !== f.poster) return false;
      return true;
    });

    if (!filtered.length) {
      els.grid.classList.add('hidden');
      if (els.empty) els.empty.classList.remove('hidden');
      if (els.countEl) els.countEl.textContent = '0 sonuç';
      return;
    }
    els.grid.classList.remove('hidden');
    if (els.empty) els.empty.classList.add('hidden');
    els.grid.innerHTML = filtered.map(cardHtml).join('');
    if (els.countEl) els.countEl.textContent = filtered.length + ' ilan listeleniyor';
    injectItemListLD(filtered);
  }

  async function openJob(slug, modalBody, jobModal) {
    const j = _jobs.find(x => (x.slug || x.id) === slug) || await getJob(slug);
    if (!j) {
      modalBody.innerHTML = '<div class="bg-white rounded-2xl p-8 text-center text-sea-600">İlan bulunamadı.</div>';
    } else {
      modalBody.innerHTML = detailHtml(j);
    }
    jobModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // URL'i güncelle (paylaşılabilir state)
    try { history.replaceState(null, '', `?ilan=${encodeURIComponent(slug)}`); } catch (e) {}
  }

  async function init() {
    // Pill enjeksiyon
    const filterBar = document.getElementById('filter-language')?.closest('section');
    if (filterBar && !document.getElementById('candidate-pill')) {
      const bar = document.createElement('div');
      bar.className = 'max-w-7xl mx-auto px-4 mt-4 mb-5 flex flex-wrap items-center gap-2 text-xs';
      bar.innerHTML = `
        <button id="candidate-pill" type="button" class="inline-flex items-center gap-2 border font-bold px-3 py-1.5 rounded-full transition bg-sun-50 text-sun-700 border-sun-200 hover:bg-sun-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          <span>Aday Profili Oluştur</span>
        </button>
        <span class="text-sea-700/70">Profilini girersen başvurularda otomatik gönderilir.</span>`;
      filterBar.parentElement.insertBefore(bar, filterBar.nextSibling);
      document.getElementById('candidate-pill').addEventListener('click', openProfileModal);
      updateProfilePill();
    }

    const els = {
      grid: $('jobs-grid'),
      empty: $('empty-state'),
      countEl: $('result-count'),
      searchInput: $('search-input'),
      filterCat: $('filter-category'),
      filterType: $('filter-type'),
      filterLang: $('filter-language'),
      filterPoster: $('filter-poster'),
      clearBtn: $('clear-filters'),
    };
    const jobModal = $('job-modal');
    const modalBody = $('modal-body');
    const modalClose = $('modal-close');

    if (!els.grid || !jobModal || !modalBody) return;

    // İlk yükleme: Supabase'den çek
    if (els.countEl) els.countEl.textContent = 'Yükleniyor...';
    try {
      _jobs = await listJobs({});
    } catch (e) {
      console.error('[ilanlar] listJobs failed:', e);
      _jobs = [];
    }

    render(els);

    els.grid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-job-slug]');
      if (card) openJob(card.dataset.jobSlug, modalBody, jobModal);
    });
    if (modalClose) modalClose.addEventListener('click', () => {
      jobModal.classList.add('hidden');
      document.body.style.overflow = '';
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
    });
    jobModal.addEventListener('click', (e) => {
      if (e.target === jobModal) {
        jobModal.classList.add('hidden');
        document.body.style.overflow = '';
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !jobModal.classList.contains('hidden')) {
        jobModal.classList.add('hidden');
        document.body.style.overflow = '';
      }
    });

    let t;
    if (els.searchInput) els.searchInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => render(els), 180); });
    if (els.filterCat) els.filterCat.addEventListener('change', () => render(els));
    if (els.filterType) els.filterType.addEventListener('change', () => render(els));
    if (els.filterLang) els.filterLang.addEventListener('change', () => render(els));
    if (els.filterPoster) els.filterPoster.addEventListener('change', () => render(els));
    if (els.clearBtn) els.clearBtn.addEventListener('click', () => {
      if (els.searchInput) els.searchInput.value = '';
      if (els.filterCat) els.filterCat.value = 'all';
      if (els.filterType) els.filterType.value = 'all';
      if (els.filterLang) els.filterLang.value = 'all';
      if (els.filterPoster) els.filterPoster.value = 'all';
      render(els);
    });

    const dateEl = $('today-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });

    // Deep-link: ?ilan=slug
    try {
      const params = new URLSearchParams(location.search);
      const slug = params.get('ilan');
      if (slug) openJob(slug, modalBody, jobModal);
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
