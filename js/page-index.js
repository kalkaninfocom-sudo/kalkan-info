// Lost & Found marquee (index.html)
(function () {
  function _esc(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
  const ICONS = { anahtar:'🔑', telefon:'📱', cuzdan:'👛', canta:'🎒', kiyafet:'👕', ayakkabi:'👟', aksesuar:'⌚', gozluk:'👓', belge:'📄', hayvan:'🐾', cocuk:'🧸', plaj:'🩴', diger:'📦' };
  function pill(it) {
    const isLost = it.type === 'kayip';
    const cover = (Array.isArray(it.images) && it.images[0]) || '';
    return `<a href="hizmetler.html#kayip" class="lf-pill" title="${_esc(it.itemName||'')}">
      <span class="lf-thumb">${cover ? `<img src="${_esc(cover)}" alt="">` : (ICONS[it.category] || '📦')}</span>
      <span class="lf-tag ${isLost?'lost':'found'}">${isLost?'Kayıp':'Bulundu'}</span>
      <span class="lf-name">${_esc(it.itemName||'—')}</span>
      ${it.location ? `<span class="lf-meta">📍 ${_esc(it.location)}</span>` : ''}
    </a>`;
  }
  function render() {
    let data;
    try { data = JSON.parse(localStorage.getItem('kalkan_lost_found_v1') || '{"items":[]}'); }
    catch { data = { items: [] }; }
    const items = (data.items || []).slice().sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||'')).slice(0, 12);
    const wrap = document.getElementById('lf-marquee-wrap');
    const track = document.getElementById('lf-marquee');
    if (!wrap || !track) return;
    if (!items.length) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    track.innerHTML = items.map(pill).join('') + items.map(pill).join('');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
  window.addEventListener('storage', e => { if (e.key === 'kalkan_lost_found_v1') render(); });
})();

// Main data loader
(async () => {
  function _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

  const [hizmetler, haberler, turlar] = await Promise.all([
    KalkanData.load('hizmetler'),
    KalkanData.load('haberler'),
    KalkanData.load('turlar')
  ]);

  // Eczane
  (async () => {
    let eczaneData = null;
    try {
      const lsRaw = localStorage.getItem('kalkan_eczane_v1');
      if (lsRaw) eczaneData = JSON.parse(lsRaw);
    } catch(e) { /* ignore */ }

    if (!eczaneData) {
      try {
        const res = await fetch(`data/eczane.json?t=${Date.now()}`);
        eczaneData = await res.json();
      } catch(e) {
        console.error('[Eczane] eczane.json yüklenemedi:', e);
      }
    }

    const bugun = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
    let aktifVeri = eczaneData?.today || {};
    let gosterYarin = false;

    // Kalkan Info ekibi doğrulama tarihi + stale data uyarısı
    const verifiedDateEl = document.getElementById('ecz-verified-date');
    const verifiedBadge = document.getElementById('ecz-verified');
    const dataDate = aktifVeri.date || '';
    const isStale = dataDate && dataDate !== bugun;

    if (verifiedDateEl) {
      const raw = dataDate || bugun;
      try {
        verifiedDateEl.textContent = new Date(raw + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      } catch (e) { verifiedDateEl.textContent = raw; }
    }

    // Veri bugüne ait DEĞİLSE: yeşil rozeti sarı uyarıya çevir
    if (verifiedBadge && isStale) {
      verifiedBadge.classList.remove('text-emerald-700', 'bg-emerald-50', 'border-emerald-200');
      verifiedBadge.classList.add('text-amber-700', 'bg-amber-50', 'border-amber-200');
      verifiedBadge.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>Veri ' + _esc(verifiedDateEl?.textContent || dataDate || bugun) + ' tarihinden — aramadan önce teyit edin</span>';
    }

    const toggleBtn = document.getElementById('ecz-toggle-tomorrow');
    if (toggleBtn && eczaneData?.tomorrow?.name) {
      toggleBtn.classList.remove('hidden');
      toggleBtn.addEventListener('click', () => {
        gosterYarin = !gosterYarin;
        const veri = gosterYarin ? (eczaneData.tomorrow || {}) : (eczaneData.today || {});
        toggleBtn.textContent = gosterYarin ? '⬅ Bugünü Göster' : '📅 Yarın da Göster';
        doldurEczane(veri, gosterYarin);
      });
    }

    function doldurEczane(ecz, yarin) {
      const labelEl = document.getElementById('ecz-label');
      if (labelEl) labelEl.textContent = yarin ? 'Yarın Nöbetçi Eczane' : 'Bugün Nöbetçi Eczane';
      const eczNameEl = document.getElementById('ecz-name');
      if (eczNameEl) eczNameEl.textContent = ecz.name || '—';
      const eczAddrEl = document.getElementById('ecz-address');
      if (eczAddrEl) eczAddrEl.textContent = ecz.address || '';
      const eczHoursEl = document.getElementById('ecz-hours');
      if (eczHoursEl) eczHoursEl.textContent = ecz.hours || '';
      const eczPhoneEl = document.getElementById('ecz-phone');
      if (eczPhoneEl) {
        if (ecz.phone) {
          eczPhoneEl.href = 'tel:' + (ecz.phoneRaw || ecz.phone.replace(/\s/g,''));
          eczPhoneEl.classList.remove('hidden');
          eczPhoneEl.querySelector('svg') ? (eczPhoneEl.childNodes[eczPhoneEl.childNodes.length-1].textContent = ' ' + ecz.phone) : (eczPhoneEl.textContent = ecz.phone);
        } else {
          eczPhoneEl.classList.add('hidden');
        }
      }
      const eczMapEl = document.getElementById('ecz-map');
      if (eczMapEl) {
        if (ecz.mapUrl) {
          eczMapEl.href = ecz.mapUrl;
          eczMapEl.classList.remove('hidden');
        } else {
          eczMapEl.classList.add('hidden');
        }
      }
      const eczTileEl = document.getElementById('ecz-tile-summary');
      if (eczTileEl && !yarin) {
        const firstAddrPart = (ecz.address || '').split(',')[1]?.trim() || (ecz.address || '').split(',')[0]?.trim() || '';
        eczTileEl.textContent = ecz.name ? (ecz.name + (firstAddrPart ? ' · ' + firstAddrPart : '')) : '—';
      }
    }

    doldurEczane(aktifVeri, false);
  })();

  // Taksi
  const taksiList = document.getElementById('taksi-list');
  if (taksiList) {
    taksiList.innerHTML = (hizmetler.taksiler?.items || []).slice(0,4).map(t => `
      <a href="tel:${_esc((t.phoneRaw||'').replace(/\s/g,''))}" class="bg-white rounded-xl p-4 hover:shadow-lg transition block">
        <div class="text-xs uppercase tracking-widest text-sea-600 font-bold">${_esc(t.location||'')}</div>
        <div class="font-display font-bold text-sea-800 mt-1">${_esc(t.name||'')}</div>
        <div class="font-mono text-sm text-sea-700 mt-2">${_esc(t.phone||'')}</div>
      </a>`).join('');
  }

  // Haberler (4)
  const haberlerList = document.getElementById('haberler-list');
  if (haberlerList) {
    haberlerList.innerHTML = (haberler.items || []).slice(0,4).map(KalkanData.haberCard).join('');
  }

  // Turlar (featured 4)
  const turlarList = document.getElementById('turlar-list');
  if (turlarList) {
    const featured = (turlar.items || []).filter(t => t.featured).slice(0,4);
    const list = featured.length ? featured : (turlar.items || []).slice(0,4);
    turlarList.innerHTML = list.map(KalkanData.turCard).join('');
  }

  // Hizmetler (featured 8)
  const hizmetlerList = document.getElementById('hizmetler-list');
  if (hizmetlerList) {
    const providerCounts = {};
    try {
      const provRes = await fetch(`data/hizmet-saglayicilari.json?t=${Date.now()}`);
      const provData = await provRes.json();
      Object.entries(provData.services || {}).forEach(([key, svc]) => {
        providerCounts[key] = (svc.providers || []).length;
      });
    } catch(e) { /* graceful */ }
    const enriched = (hizmetler.items || []).map(it => ({ ...it, providerCount: providerCounts[it.id] || 0 }));
    const featured = enriched.filter(h => h.featured).slice(0,8);
    const list = featured.length ? featured : enriched.slice(0,8);
    hizmetlerList.innerHTML = list.map(KalkanData.hizmetCard).join('');
  }
})();

// Today date + scroll-spy
(function() {
  const fmt = new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric'});
  const el = document.getElementById('today-date'); if(el) el.textContent = fmt.format(new Date());

  const pairs = [
    ['#haberler','a[href="#haberler"]'],
    ['#villalar','a[href="#villalar"]'],
    ['#restoranlar','a[href="#restoranlar"]'],
    ['#plajlar','a[href="#plajlar"]'],
    ['#turlar','a[href="#turlar"]'],
    ['#hizmetler','a[href="#hizmetler"]'],
  ];
  const navLinks = pairs.map(([sec,sel])=>({
    section: document.querySelector(sec),
    links: document.querySelectorAll(sel)
  })).filter(p=>p.section);

  function onScroll(){
    const mid = window.scrollY + window.innerHeight * 0.4;
    navLinks.forEach(({section,links})=>{
      const top = section.offsetTop, bot = top + section.offsetHeight;
      const active = mid >= top && mid < bot;
      links.forEach(l=>{ l.classList.toggle('nav-active', active); });
    });
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
})();
