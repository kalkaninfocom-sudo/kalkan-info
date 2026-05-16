// Kalkan Info — İş İlanları (Vanilla, ESM bağımsız)
(function () {
  'use strict';

  const DEMO_JOBS = [
    { id:'j1', title:'Restoran Garson — Sezonluk', category:'restoran', type:'seasonal', location:'Kalkan Merkez', languages:['tr','en'], experience:'1 yıl+', salary:'25.000 – 35.000 ₺', employer:'Aubergine Kalkan', published:'2026-04-28', expires:'2026-06-30', description:'Mayıs–Ekim sezonu boyunca, denize sıfır restoranımızda akşam vardiyası garsonu arıyoruz. İngilizce zorunlu, Almanca artı.', requirements:['Min. 1 yıl restoran deneyimi','İngilizce iletişim','Pazartesi–Pazar dönemli vardiya'], contact_phone:'+905306650794' },
    { id:'j2', title:'Villa Concierge / Misafir Karşılama', category:'villa', type:'full', location:'Kalkan', languages:['tr','en','ru'], experience:'2 yıl+', salary:'35.000 – 50.000 ₺', employer:'Kalkan Premium Villas', published:'2026-04-25', expires:'2026-07-15', description:'Lüks villa portföyümüzde misafir check-in/check-out, transfer koordinasyonu, günlük destek. Ehliyet zorunlu.', requirements:['Ehliyet B sınıfı','Akıcı İngilizce','Rusça veya Almanca tercih','Esnek çalışma saatleri'], contact_phone:'+905306650794' },
    { id:'j3', title:'Tekne Kaptanı — Günlük Tur', category:'tur', type:'seasonal', location:'Kalkan Marina', languages:['tr','en'], experience:'5 yıl+', salary:'50.000 – 75.000 ₺', employer:'Likya Tekne Turları', published:'2026-04-20', expires:'2026-05-31', description:'Günlük 12 kişilik tekne turlarımız için ehliyetli kaptan. Kaş–Kalkan–Kaputaş rotası.', requirements:['Amatör Denizci Belgesi (ADB) min.','Kalkan–Kaş bölge bilgisi','Misafirle iletişim becerisi'], contact_phone:'+905306650794' },
    { id:'j4', title:'Ev Aşçısı / Catering', category:'hizmet', type:'freelance', location:'Kalkan Civarı', languages:['tr'], experience:'3 yıl+', salary:'1.500 – 3.500 ₺/gün', employer:'Bireysel İşveren', published:'2026-04-22', expires:'2026-08-15', description:'Villa misafirlerine günlük ev yemeği. Esnek saatler, günlük ücret.', requirements:['Türk + Akdeniz mutfağı','Hijyen sertifikası','Kendi ulaşımı'], contact_phone:'+905306650794' },
    { id:'j5', title:'Resepsiyonist — Otel', category:'otel', type:'seasonal', location:'Kalkan', languages:['tr','en','de'], experience:'1 yıl+', salary:'28.000 – 38.000 ₺', employer:'Patara Boutique Hotel', published:'2026-04-30', expires:'2026-07-31', description:'30 odalı butik otelde 8/16 vardiyalı resepsiyon. Sezonluk, konaklama dahil.', requirements:['İngilizce akıcı','Otel programı tecrübesi (Elektra/Sednabit) tercih','Almanca artı'], contact_phone:'+905306650794' },
    { id:'j6', title:'Havuz Bakım Teknisyeni', category:'hizmet', type:'full', location:'Kalkan + civar köyler', languages:['tr'], experience:'2 yıl+', salary:'30.000 – 42.000 ₺', employer:'Aqua Kalkan Servis', published:'2026-04-26', expires:'2026-09-30', description:'Villa havuzlarının haftalık bakımı, kimyasal dengeleme, motor onarımı. Servis aracı tahsis edilir.', requirements:['Havuz kimyası bilgisi','Ehliyet B','Sezon 6 ay'], contact_phone:'+905306650794' }
  ];

  const CATEGORIES = { restoran:'Restoran & Cafe', villa:'Villa & Konaklama', otel:'Otel & Pansiyon', tur:'Tekne & Tur', hizmet:'Hizmet & Bakım', ofis:'Ofis & Yönetim', diger:'Diğer' };
  const TYPES = { full:'Tam zamanlı', part:'Yarı zamanlı', seasonal:'Sezonluk', freelance:'Serbest' };
  const LANG = { tr:'TR', en:'EN', de:'DE', ru:'RU', ar:'AR', fr:'FR' };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' }); } catch (e) { return iso; } };

  function $ (id) { return document.getElementById(id); }

  function init() {
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
            '<span class="text-sm font-bold text-sea-800">', esc(j.salary), '</span>',
            '<span class="text-[11px] text-sea-500">', fmtDate(j.published), '</span>',
          '</div>',
        '</article>'
      ].join('');
    }

    function detailHtml (j) {
      const langs = (j.languages || []).map(l => esc(LANG[l] || l)).join(', ');
      const reqs = (j.requirements || []).map(r =>
        '<li class="flex gap-2 items-start"><span class="text-sun-500 mt-0.5 flex-shrink-0">✓</span><span>' + esc(r) + '</span></li>'
      ).join('');
      const wa = 'https://wa.me/' + (j.contact_phone || '').replace(/[^0-9]/g, '')
        + '?text=' + encodeURIComponent('Merhaba! Kalkan Info üzerinden "' + j.title + '" ilanına başvurmak istiyorum.');
      return [
        '<div class="bg-white rounded-2xl p-6 md:p-8">',
          '<div class="text-[11px] font-bold uppercase tracking-wider text-sun-500">', esc(CATEGORIES[j.category] || j.category), ' · ', esc(TYPES[j.type] || j.type), '</div>',
          '<h2 class="font-display font-extrabold text-sea-800 text-2xl md:text-3xl mt-2">', esc(j.title), '</h2>',
          '<div class="text-sea-700/70 text-sm mt-1">', esc(j.employer), ' · 📍 ', esc(j.location), '</div>',
          '<div class="grid sm:grid-cols-2 gap-3 mt-5">',
            '<div class="bg-sea-50 rounded-lg p-3"><div class="text-[10px] font-bold text-sea-600 uppercase">Maaş</div><div class="font-bold text-sea-800 mt-0.5">', esc(j.salary), '</div></div>',
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
