(async () => {
  const data = await KalkanData.load('turlar');
  const grid = document.getElementById('card-grid');
  function render() {
    if (!grid) return;
    const items = (data.items || []);
    grid.innerHTML = items.map(KalkanData.turCard).join('') || '<div class="col-span-full text-center py-12 text-sea-700/60">Henüz tur yok.</div>';
  }
  render();

  // --- Tekne Operatörleri ---
  const opGrid = document.getElementById('tekne-operators-grid');
  if (!opGrid) return;

  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function stars(r){const f=Math.floor(r),h=r-f>=0.5;let s='';for(let i=0;i<5;i++){if(i<f)s+='<span style="color:#f4b53d;">★</span>';else if(i===f&&h)s+='<span style="color:#f4b53d;">½</span>';else s+='<span style="color:#d1dae3;">★</span>';}return s;}
  function fire(name,props){try{if(window.plausibleEvent)window.plausibleEvent(name,props||{});}catch(e){}}

  function opCard(p){
    const phoneRaw = (p.phoneRaw || (p.phone||'').replace(/\D/g,''));
    const waRaw = (p.whatsappRaw || phoneRaw);
    const concierge = p.contactVia === 'concierge';
    const msg = encodeURIComponent(p.defaultMessage || `Merhaba! Kalkan Info üzerinden ${p.name} ile tekne turu için bilgi istiyorum.`);
    const waHref = concierge
      ? `https://wa.me/905306650794?text=${msg}`
      : `https://wa.me/${waRaw}?text=${msg}`;

    const phoneBtn = !concierge && phoneRaw ? `
      <a href="tel:${esc(phoneRaw)}" data-op-phone="${esc(p.id)}" class="flex items-center justify-center gap-1.5 bg-sea-700 hover:bg-sea-800 text-white text-xs font-bold py-2.5 px-2 rounded transition" data-en="Call" data-de="Anrufen" data-ru="Звонить" data-fr="Appeler">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <span data-en="Call" data-de="Anrufen" data-ru="Звонить" data-fr="Appeler">Ara</span>
      </a>` : '';

    const igHref = p.instagram || '';
    const igBtn = igHref ? `
      <a href="${esc(igHref)}" target="_blank" rel="noopener" data-op-ig="${esc(p.id)}" class="flex items-center justify-center gap-1.5 bg-white border border-sea-200 hover:border-coral-500 hover:text-coral-600 text-sea-700 text-xs font-bold py-2.5 px-2 rounded transition">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6" r="1.2" fill="currentColor"/></svg>
        <span>Instagram</span>
      </a>` : '';

    const waBtn = `
      <a href="${esc(waHref)}" target="_blank" rel="noopener" data-op-wa="${esc(p.id)}" data-concierge="${concierge?'1':'0'}" class="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-2 rounded transition" data-en="WhatsApp" data-de="WhatsApp" data-ru="WhatsApp" data-fr="WhatsApp">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.48A11.84 11.84 0 0 0 12.06 0C5.5 0 .17 5.34.17 11.91c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.65a11.86 11.86 0 0 0 5.76 1.47h.01c6.55 0 11.89-5.34 11.89-11.91a11.83 11.83 0 0 0-3.44-8.43z"/></svg>
        <span>${concierge ? '<span data-en="Via Concierge" data-de="Via Concierge" data-ru="Через консьерж" data-fr="Via Concierge">Concierge</span>' : 'WhatsApp'}</span>
      </a>`;

    const verifiedBadge = p.verified ? `<span class="absolute top-3 right-3 inline-flex items-center gap-1 bg-emerald-500/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur" title="Doğrulandı"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> <span data-en="Verified" data-de="Verifiziert" data-ru="Проверено" data-fr="Vérifié">Doğrulandı</span></span>` : '';
    const featuredBadge = p.featured ? `<span class="absolute top-3 left-3 inline-flex items-center gap-1 bg-sun-500/95 text-sea-900 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur">★ <span data-en="Featured" data-de="Empfohlen" data-ru="Рекомендуем" data-fr="Mis en avant">Öne Çıkan</span></span>` : '';

    const specialties = (p.specialties || []).slice(0,3).map(s => `<span class="bg-sea-50 text-sea-700 border border-sea-100 text-[10px] font-semibold px-2 py-0.5 rounded-full">${esc(s)}</span>`).join('');

    return `
    <article class="group rounded-xl overflow-hidden bg-white border border-sea-100 card-hover transition" style="box-shadow:0 1px 3px rgba(7,33,54,0.07),0 8px 24px -8px rgba(7,33,54,0.16);">
      <div class="relative h-44 overflow-hidden bg-sea-100">
        <img width="600" height="400" loading="lazy" decoding="async" src="${esc(p.image||'/assets/img/f7ccb955f343.webp')}" alt="${esc(p.name)}" class="w-full h-full object-cover group-hover:scale-[1.05]" style="transition:transform .45s cubic-bezier(.25,.46,.45,.94);" onerror="this.src='/assets/img/f7ccb955f343.webp'">
        <div class="absolute inset-0 bg-gradient-to-t from-sea-900/70 via-sea-900/10 to-transparent"></div>
        ${featuredBadge}
        ${verifiedBadge}
      </div>
      <div class="p-4">
        <h3 class="font-display text-base font-extrabold text-sea-800 leading-tight">${esc(p.name)}</h3>
        <div class="flex items-center gap-1 mt-1 text-xs text-sea-600">
          ${stars(p.rating||4.7)} <span class="text-[11px] ml-1">${(p.rating||4.7).toFixed(1)}</span>
          ${p.location ? `<span class="ml-2 truncate text-sea-500">· ${esc(p.location)}</span>` : ''}
        </div>
        <p class="text-xs text-sea-700/80 mt-2 leading-relaxed line-clamp-3">${esc(p.summary||'')}</p>
        ${specialties ? `<div class="flex flex-wrap gap-1.5 mt-3">${specialties}</div>` : ''}
        <div class="grid grid-cols-${phoneBtn? '3':'2'} gap-1.5 mt-4">
          ${phoneBtn}${igBtn}${waBtn}
        </div>
      </div>
    </article>`;
  }

  try {
    const res = await fetch(`data/hizmet-saglayicilari.json?t=${Date.now()}`);
    const prov = await res.json();
    const teknePs = ((prov.services||{})['tekne-turu']||{}).providers || [];
    const sorted = teknePs.slice().sort((a,b) => (b.featured?1:0) - (a.featured?1:0) || (b.rating||0) - (a.rating||0));
    opGrid.innerHTML = sorted.map(opCard).join('') || '<div class="col-span-full text-center py-12 text-sea-700/60">Operatör yok.</div>';

    opGrid.addEventListener('click', e => {
      const phone = e.target.closest('[data-op-phone]');
      const ig = e.target.closest('[data-op-ig]');
      const wa = e.target.closest('[data-op-wa]');
      if (phone) fire('phone_click', { source: 'tekne_operator', provider_id: phone.dataset.opPhone });
      if (ig) fire('outbound_link', { source: 'tekne_operator', provider_id: ig.dataset.opIg, dest: 'instagram' });
      if (wa) fire('wa_click', { source: 'tekne_operator', provider_id: wa.dataset.opWa, agent: wa.dataset.concierge === '1' ? 'concierge' : 'direct' });
    });

    // i18n reapply
    try { if (window.applyI18n) window.applyI18n(); } catch(e) {}
  } catch (e) {
    console.error('[Turlar] tekne operatörleri yüklenemedi:', e);
    opGrid.innerHTML = '<div class="col-span-full text-center py-12 text-sea-700/60">Operatörler yüklenemedi.</div>';
  }
})();
