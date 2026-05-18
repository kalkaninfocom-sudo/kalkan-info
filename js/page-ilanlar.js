// Kalkan Info — İş İlanları (Vanilla, ESM bağımsız)
(function () {
  'use strict';

  // Demo veriler kaldırıldı — gerçek ilanlar Supabase'e bağlandığında doldurulur.
  // Şu anda kullanıcı empty state ("Henüz ilan yok") görür.
  const DEMO_JOBS = [];

  const CATEGORIES = { restoran:'Restoran & Cafe', villa:'Villa & Konaklama', otel:'Otel & Pansiyon', tur:'Tekne & Tur', hizmet:'Hizmet & Bakım', ofis:'Ofis & Yönetim', diger:'Diğer' };
  const TYPES = { full:'Tam zamanlı', part:'Yarı zamanlı', seasonal:'Sezonluk', freelance:'Serbest' };
  const LANG = { tr:'TR', en:'EN', de:'DE', ru:'RU', ar:'AR', fr:'FR' };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' }); } catch (e) { return iso; } };

  function $ (id) { return document.getElementById(id); }

  const PROFILE_KEY = 'kalkan_candidate_v1';
  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveProfile(p) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  }
  function clearProfile() {
    localStorage.removeItem(PROFILE_KEY);
  }

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
        <p class="text-xs text-sea-700/70 mt-1">Bilgilerin sadece bu tarayıcıda saklanır. Başvuru yaparken WhatsApp mesajına otomatik eklenir.</p>
      </div>
      <button id="cm-close" aria-label="Kapat" class="w-9 h-9 grid place-items-center rounded-full hover:bg-sea-50 flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <form id="cm-form" class="space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Ad Soyad *</label>
          <input name="name" required class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 focus:ring-2 focus:ring-sea-500/15 outline-none" />
        </div>
        <div>
          <label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Pozisyon (aradığın)</label>
          <input name="position" placeholder="Örn: Garson, Resepsiyonist…" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none" />
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Telefon</label>
          <input name="phone" type="tel" placeholder="+90 5xx xxx xx xx" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none" />
        </div>
        <div>
          <label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">E-posta</label>
          <input name="email" type="email" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none" />
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Tecrübe</label>
          <input name="experience" placeholder="Örn: 3 yıl restoran" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none" />
        </div>
        <div>
          <label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Diller</label>
          <input name="languages" placeholder="TR, EN, DE…" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none" />
        </div>
      </div>
      <div>
        <label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Yetenekler</label>
        <input name="skills" placeholder="Örn: müşteri iletişimi, kasa, mutfak, ehliyet B…" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none" />
      </div>
      <div>
        <label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">LinkedIn (opsiyonel)</label>
        <input name="linkedin" type="url" placeholder="https://linkedin.com/in/…" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none" />
      </div>
      <div>
        <label class="block text-[10px] font-display font-bold text-sea-700 uppercase tracking-wide mb-1">Kısa Biyo</label>
        <textarea name="bio" rows="3" placeholder="Neden bu pozisyonlar? Hangi günler müsaitsin?" class="w-full px-3 py-2 border border-sea-200 rounded-lg text-sm focus:border-sea-500 outline-none"></textarea>
      </div>
      <div class="flex flex-col sm:flex-row gap-2 pt-2">
        <button type="submit" class="flex-1 bg-gradient-to-br from-sun-400 to-sun-500 text-sea-900 font-display font-extrabold py-2.5 rounded-xl shadow-sm hover:from-sun-500 hover:to-sun-600 transition">Profili Kaydet</button>
        <button type="button" id="cm-clear" class="text-sea-600 hover:text-coral-500 text-sm font-semibold underline-grow">Profili Sil</button>
      </div>
      <p class="text-[10px] text-sea-500 text-center">Bilgilerin yalnızca senin tarayıcında saklanır — sunucuya gönderilmez. KVKK'ya tam uyumlu.</p>
    </form>
  </div>
</div>
    `;
    document.body.appendChild(wrap.firstElementChild);

    const modal = document.getElementById('candidate-modal');
    const form = document.getElementById('cm-form');
    const close = () => { modal.classList.add('hidden'); document.body.style.overflow = ''; };

    document.getElementById('cm-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.getElementById('cm-clear').addEventListener('click', () => {
      if (!confirm('Profilini silmek istediğinden emin misin?')) return;
      clearProfile();
      form.reset();
      updateProfilePill();
      close();
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
      saveProfile(profile);
      updateProfilePill();
      close();
    });
  }

  function openProfileModal() {
    buildProfileModal();
    const modal = document.getElementById('candidate-modal');
    const form = document.getElementById('cm-form');
    const p = loadProfile() || {};
    ['name','position','phone','email','experience','languages','skills','linkedin','bio'].forEach(k => {
      const el = form.querySelector(`[name="${k}"]`);
      if (el) el.value = p[k] || '';
    });
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function updateProfilePill() {
    const pill = document.getElementById('candidate-pill');
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

  function init() {
    // Pill'i hero altına dinamik enjekte et
    const filterBar = document.getElementById('filter-language')?.closest('section');
    if (filterBar && !document.getElementById('candidate-pill')) {
      const bar = document.createElement('div');
      bar.className = 'max-w-7xl mx-auto px-4 -mt-2 mb-4 flex items-center gap-2 text-xs';
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

    const grid = $('jobs-grid');
    const empty = $('empty-state');
    const countEl = $('result-count');
    const searchInput = $('search-input');
    const filterCat = $('filter-category');
    const filterType = $('filter-type');
    const filterLang = $('filter-language');
    const clearBtn = $('clear-filters');
    const jobModal = $('job-modal');
    const modalBody = $('modal-body');
    const modalClose = $('modal-close');

    if (!grid || !jobModal || !modalBody) return; // sayfa beklenen DOM'a sahip değil

    function getFilters () {
      return {
        search: searchInput ? searchInput.value.trim() : '',
        category: filterCat ? filterCat.value : 'all',
        type: filterType ? filterType.value : 'all',
        language: filterLang ? filterLang.value : 'all'
      };
    }

    function matches (j, f) {
      if (f.search) {
        const t = (j.title + ' ' + j.employer + ' ' + j.description).toLowerCase();
        if (!t.includes(f.search.toLowerCase())) return false;
      }
      if (f.category && f.category !== 'all' && j.category !== f.category) return false;
      if (f.type && f.type !== 'all' && j.type !== f.type) return false;
      if (f.language && f.language !== 'all' && !(j.languages || []).includes(f.language)) return false;
      return true;
    }

    function cardHtml (j) {
      const langs = (j.languages || []).map(l =>
        '<span class="text-[10px] font-bold bg-sea-50 text-sea-700 px-2 py-0.5 rounded-full">' + esc(LANG[l] || l) + '</span>'
      ).join('');
      return [
        '<article data-job-id="', esc(j.id), '" class="bg-white rounded-2xl border border-sea-100 p-5 cursor-pointer hover:border-sun-500 hover:shadow-[0_8px_28px_-12px_rgba(7,33,54,0.25)] transition flex flex-col gap-3" style="box-shadow:0 1px 3px rgba(7,33,54,0.06);">',
          '<div class="flex items-start justify-between gap-3">',
            '<div class="min-w-0">',
              '<div class="text-[10px] font-bold uppercase tracking-wider text-sun-500">', esc(CATEGORIES[j.category] || j.category), '</div>',
              '<h3 class="font-display font-extrabold text-sea-800 text-base leading-tight mt-1 line-clamp-2">', esc(j.title), '</h3>',
            '</div>',
            '<span class="flex-shrink-0 text-[10px] font-bold bg-sea-50 text-sea-700 px-2 py-1 rounded-full whitespace-nowrap">', esc(TYPES[j.type] || j.type), '</span>',
          '</div>',
          '<div class="text-xs text-sea-700/70 flex flex-wrap items-center gap-x-2 gap-y-1"><span>📍 ', esc(j.location), '</span><span class="text-sea-300">·</span><span>', esc(j.employer), '</span></div>',
          '<p class="text-sm text-sea-700/80 line-clamp-2">', esc(j.description), '</p>',
          '<div class="flex flex-wrap items-center gap-1.5">', langs, '</div>',
          '<div class="flex items-center justify-between pt-3 border-t border-sea-50">',
            '<span class="text-[11px] font-semibold text-sea-700">📅 ', fmtDate(j.published), '</span>',
            '<span class="text-[11px] text-sun-600 font-bold">Detay →</span>',
          '</div>',
        '</article>'
      ].join('');
    }

    function detailHtml (j) {
      const langs = (j.languages || []).map(l => esc(LANG[l] || l)).join(', ');
      const reqs = (j.requirements || []).map(r =>
        '<li class="flex gap-2 items-start"><span class="text-sun-500 mt-0.5 flex-shrink-0">✓</span><span>' + esc(r) + '</span></li>'
      ).join('');
      const profileText = profileSummaryForWA(loadProfile());
      const baseMsg = 'Merhaba! Kalkan Info üzerinden "' + j.title + '" ilanına başvurmak istiyorum.';
      const wa = 'https://wa.me/' + (j.contact_phone || '').replace(/[^0-9]/g, '')
        + '?text=' + encodeURIComponent(baseMsg + profileText);
      return [
        '<div class="bg-white rounded-2xl p-6 md:p-8">',
          '<div class="text-[11px] font-bold uppercase tracking-wider text-sun-500">', esc(CATEGORIES[j.category] || j.category), ' · ', esc(TYPES[j.type] || j.type), '</div>',
          '<h2 class="font-display font-extrabold text-sea-800 text-2xl md:text-3xl mt-2">', esc(j.title), '</h2>',
          '<div class="text-sea-700/70 text-sm mt-1">', esc(j.employer), ' · 📍 ', esc(j.location), '</div>',
          '<div class="grid sm:grid-cols-3 gap-3 mt-5">',
            '<div class="bg-sea-50 rounded-lg p-3"><div class="text-[10px] font-bold text-sea-600 uppercase">Tecrübe</div><div class="font-bold text-sea-800 mt-0.5">', esc(j.experience), '</div></div>',
            '<div class="bg-sea-50 rounded-lg p-3"><div class="text-[10px] font-bold text-sea-600 uppercase">Diller</div><div class="font-bold text-sea-800 mt-0.5">', langs, '</div></div>',
            '<div class="bg-sea-50 rounded-lg p-3"><div class="text-[10px] font-bold text-sea-600 uppercase">Son Başvuru</div><div class="font-bold text-sea-800 mt-0.5">', fmtDate(j.expires), '</div></div>',
          '</div>',
          '<div class="mt-5"><div class="text-[10px] font-bold text-sea-600 uppercase mb-2">İş Tanımı</div><p class="text-sea-800/90 leading-relaxed">', esc(j.description), '</p></div>',
          '<div class="mt-5"><div class="text-[10px] font-bold text-sea-600 uppercase mb-2">Aranan Nitelikler</div><ul class="space-y-1.5 text-sea-800/90 text-sm">', reqs, '</ul></div>',
          '<a href="', wa, '" target="_blank" rel="noopener" class="mt-6 flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1da851] text-white font-display font-extrabold py-3 rounded-xl transition">',
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/></svg>',
            '<span>WhatsApp ile Başvur</span>',
          '</a>',
          '<p class="text-[11px] text-sea-500 text-center mt-3">İşveren genelde 24–48 saat içinde geri döner.</p>',
        '</div>'
      ].join('');
    }

    function render () {
      const jobs = DEMO_JOBS.filter(j => matches(j, getFilters()));
      if (!jobs.length) {
        grid.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
        if (countEl) countEl.textContent = '0 sonuç';
        return;
      }
      grid.classList.remove('hidden');
      if (empty) empty.classList.add('hidden');
      grid.innerHTML = jobs.map(cardHtml).join('');
      if (countEl) countEl.textContent = jobs.length + ' ilan listeleniyor';
    }

    function openJob (id) {
      const j = DEMO_JOBS.find(x => x.id === id);
      if (!j) return;
      modalBody.innerHTML = detailHtml(j);
      jobModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeJob () {
      jobModal.classList.add('hidden');
      document.body.style.overflow = '';
    }

    grid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-job-id]');
      if (card) openJob(card.dataset.jobId);
    });
    if (modalClose) modalClose.addEventListener('click', closeJob);
    jobModal.addEventListener('click', (e) => { if (e.target === jobModal) closeJob(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !jobModal.classList.contains('hidden')) closeJob(); });

    let t;
    if (searchInput) searchInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 180); });
    if (filterCat) filterCat.addEventListener('change', render);
    if (filterType) filterType.addEventListener('change', render);
    if (filterLang) filterLang.addEventListener('change', render);
    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (filterCat) filterCat.value = 'all';
      if (filterType) filterType.value = 'all';
      if (filterLang) filterLang.value = 'all';
      render();
    });

    const dateEl = $('today-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });

    render();

    // Deep-link: ?ilan=j1
    try {
      const params = new URLSearchParams(location.search);
      const id = params.get('ilan');
      if (id) openJob(id);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
