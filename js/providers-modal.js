/* providers-modal.js — Kalkan Info
   Hizmet kartı tıklandığında o hizmete ait sağlayıcıları modal ile gösterir.
   Brand: sea-800 (#0a2e4c), sun-400 (#f4b53d), Montserrat heading, Inter body
*/

(function () {
  'use strict';

  const WA_BASE = 'https://wa.me/905306650794';
  const DATA_URL = 'data/hizmet-saglayicilari.json';
  const CONCIERGE_PAGE = 'hizmet-ekle.html';

  let allData = null;
  let modalEl = null;
  let currentSort = 'featured'; // 'featured' | 'rating' | 'newest'

  // ── Util ─────────────────────────────────────────────────────────────────

  function fireEv(name, props) {
    try { if (window.plausibleEvent) window.plausibleEvent(name, props || {}); } catch (e) {}
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  function waUrl(name, serviceTitle) {
    const msg = encodeURIComponent(
      `Merhaba! Kalkan Info üzerinden "${serviceTitle}" hizmeti için "${name}" sağlayıcısı hakkında bilgi almak istiyorum.`
    );
    return `${WA_BASE}?text=${msg}`;
  }

  function stars(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    let html = '';
    for (let i = 0; i < 5; i++) {
      if (i < full) html += '<span style="color:#f4b53d;">★</span>';
      else if (i === full && half) html += '<span style="color:#f4b53d;">½</span>';
      else html += '<span style="color:#d1dae3;">★</span>';
    }
    return html;
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadData() {
    if (allData) return allData;
    try {
      const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
      allData = await res.json();
    } catch (e) {
      console.error('[ProvidersModal] Veri yüklenemedi:', e);
      allData = { services: {} };
    }
    return allData;
  }

  // ── Modal HTML ────────────────────────────────────────────────────────────

  function buildModal() {
    const el = document.createElement('div');
    el.id = 'providers-modal-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'pm-title');
    el.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      display:flex;align-items:center;justify-content:center;
      background:rgba(7,33,54,0.72);
      backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
      opacity:0;pointer-events:none;
      transition:opacity 0.22s ease;
    `;
    el.innerHTML = `
      <div id="pm-panel" style="
        position:relative;
        background:#fff;
        border-radius:20px;
        width:calc(100% - 32px);
        max-width:900px;
        max-height:90vh;
        display:flex;
        flex-direction:column;
        box-shadow:0 24px 64px -12px rgba(7,33,54,0.55),0 4px 16px rgba(7,33,54,0.18);
        transform:scale(0.95) translateY(12px);
        transition:transform 0.26s cubic-bezier(0.34,1.56,0.64,1),opacity 0.22s ease;
        overflow:hidden;
      ">

        <!-- Header -->
        <div id="pm-header" style="
          background:linear-gradient(135deg,#0a2e4c 0%,#072136 100%);
          color:#fff;
          padding:22px 24px 18px;
          flex-shrink:0;
          position:relative;
        ">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
            <div>
              <div id="pm-icon-title" style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                <span id="pm-icon" style="font-size:1.6rem;line-height:1;"></span>
                <h2 id="pm-title" style="
                  font-family:'Montserrat',system-ui,sans-serif;
                  font-size:1.2rem;font-weight:800;
                  letter-spacing:-0.02em;margin:0;color:#fff;
                "></h2>
              </div>
              <div id="pm-subtitle" style="font-size:0.75rem;color:rgba(255,255,255,0.6);margin-top:2px;"></div>
            </div>
            <button id="pm-close" aria-label="Kapat" style="
              flex-shrink:0;
              width:34px;height:34px;
              border:none;background:rgba(255,255,255,0.12);
              border-radius:8px;cursor:pointer;color:#fff;
              display:grid;place-items:center;
              transition:background 0.18s ease;
              font-size:1.1rem;line-height:1;
            ">✕</button>
          </div>

          <!-- Sort bar -->
          <div id="pm-sort-bar" style="
            display:flex;gap:6px;margin-top:14px;flex-wrap:wrap;
          ">
            <span style="font-size:0.7rem;color:rgba(255,255,255,0.5);align-self:center;margin-right:2px;">Sırala:</span>
            <button class="pm-sort-btn pm-sort-active" data-sort="featured" style="
              font-size:0.7rem;font-weight:700;
              padding:4px 10px;border-radius:20px;border:1px solid rgba(244,181,61,0.6);
              background:rgba(244,181,61,0.18);color:#f4b53d;cursor:pointer;
              transition:all 0.16s ease;
            ">Önerilen</button>
            <button class="pm-sort-btn" data-sort="rating" style="
              font-size:0.7rem;font-weight:700;
              padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);
              background:transparent;color:rgba(255,255,255,0.7);cursor:pointer;
              transition:all 0.16s ease;
            ">En Yüksek Puan</button>
            <button class="pm-sort-btn" data-sort="newest" style="
              font-size:0.7rem;font-weight:700;
              padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);
              background:transparent;color:rgba(255,255,255,0.7);cursor:pointer;
              transition:all 0.16s ease;
            ">En Yeni</button>
          </div>
        </div>

        <!-- Scrollable body -->
        <div id="pm-body" style="
          overflow-y:auto;flex:1;padding:20px;
          background:#f0f5f9;
        ">
          <div id="pm-grid" style="
            display:grid;
            grid-template-columns:repeat(auto-fill,minmax(260px,1fr));
            gap:16px;
          "></div>
        </div>

        <!-- CTA footer -->
        <div id="pm-footer" style="
          flex-shrink:0;
          background:linear-gradient(90deg,#eef4f9 0%,#e2edf5 100%);
          border-top:1px solid rgba(26,94,147,0.1);
          padding:14px 24px;
          display:flex;align-items:center;justify-content:space-between;gap:12px;
          flex-wrap:wrap;
        ">
          <div style="font-size:0.78rem;color:#0d3a5f;">
            <span style="font-weight:700;">Bu hizmeti veriyor musun?</span>
            <span style="color:#1a5e93;"> Kalkan Info'ya katıl, binlerce kişiye ulaş.</span>
          </div>
          <a href="${CONCIERGE_PAGE}" style="
            background:#e89812;color:#fff;
            font-family:'Montserrat',system-ui,sans-serif;
            font-weight:700;font-size:0.75rem;
            padding:8px 16px;border-radius:10px;
            text-decoration:none;white-space:nowrap;
            box-shadow:0 4px 14px -4px rgba(232,152,18,0.5);
            transition:background 0.18s ease;
          " onmouseover="this.style.background='#c97c08'" onmouseout="this.style.background='#e89812'">
            Sağlayıcı Ol →
          </a>
        </div>

      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  // ── Provider card HTML ────────────────────────────────────────────────────

  function providerCard(p, serviceTitle) {
    const verifiedBadge = p.verified
      ? `<span title="Onaylı Sağlayıcı" style="
          display:inline-flex;align-items:center;gap:3px;
          background:#dbeafe;color:#1e40af;
          font-size:0.65rem;font-weight:700;
          padding:2px 7px;border-radius:20px;
        ">✓ Onaylı</span>`
      : `<span title="İletişim bilgileri Kalkan Info concierge üzerinden teyit edilir" style="
          display:inline-flex;align-items:center;gap:3px;
          background:#fef3c7;color:#92400e;
          font-size:0.65rem;font-weight:700;
          padding:2px 7px;border-radius:20px;
        ">⏳ Concierge</span>`;

    const featuredRibbon = p.featured
      ? `<div style="
          position:absolute;top:12px;left:-1px;
          background:linear-gradient(90deg,#e89812,#f4b53d);
          color:#fff;font-size:0.6rem;font-weight:800;
          padding:3px 10px;border-radius:0 4px 4px 0;
          box-shadow:0 2px 8px rgba(232,152,18,0.4);
          letter-spacing:0.05em;text-transform:uppercase;
        ">⭐ Öne Çıkan</div>`
      : '';

    const specialtyTags = (p.specialties || []).slice(0, 3).map(s =>
      `<span style="
        background:rgba(26,94,147,0.08);color:#134c79;
        font-size:0.62rem;font-weight:600;
        padding:2px 8px;border-radius:20px;
      ">${esc(s)}</span>`
    ).join('');

    const waLink = waUrl(p.name, serviceTitle);

    return `
      <article style="
        background:#fff;border-radius:14px;overflow:hidden;
        box-shadow:0 1px 3px rgba(7,33,54,0.07),0 6px 20px -6px rgba(7,33,54,0.13);
        border:1px solid rgba(26,94,147,0.08);
        display:flex;flex-direction:column;
        position:relative;
        transition:transform 0.2s ease,box-shadow 0.2s ease;
      "
      onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(7,33,54,0.1),0 16px 40px -8px rgba(7,33,54,0.2)';"
      onmouseout="this.style.transform='';this.style.boxShadow='0 1px 3px rgba(7,33,54,0.07),0 6px 20px -6px rgba(7,33,54,0.13)';">

        ${featuredRibbon}

        <!-- Photo -->
        <div style="position:relative;height:140px;overflow:hidden;flex-shrink:0;">
          <img
            src="${esc(p.image)}"
            alt="${esc(p.name)}"
            loading="lazy"
            style="width:100%;height:100%;object-fit:cover;"
            onerror="this.style.display='none';this.parentElement.style.background='#cfe0ed';"
          />
          <div style="
            position:absolute;inset:0;
            background:linear-gradient(180deg,transparent 40%,rgba(7,33,54,0.65) 100%);
          "></div>
          <!-- Type badge -->
          <span style="
            position:absolute;bottom:8px;right:8px;
            background:rgba(255,255,255,0.15);
            backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
            color:#fff;font-size:0.62rem;font-weight:700;
            padding:2px 8px;border-radius:20px;
            border:1px solid rgba(255,255,255,0.2);
          ">${esc(p.type)}</span>
        </div>

        <!-- Content -->
        <div style="padding:14px 14px 0;flex:1;display:flex;flex-direction:column;gap:6px;">

          <!-- Name row -->
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;">
            <h3 style="
              font-family:'Montserrat',system-ui,sans-serif;
              font-size:0.9rem;font-weight:800;
              color:#0a2e4c;margin:0;line-height:1.2;
            ">${esc(p.name)}</h3>
            ${verifiedBadge}
          </div>

          <!-- Rating -->
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="font-size:0.82rem;letter-spacing:1px;">${stars(p.rating || 0)}</div>
            <span style="font-size:0.72rem;font-weight:700;color:#0a2e4c;">${Number(p.rating || 0).toFixed(1)}</span>
            <span style="font-size:0.68rem;color:#5d97c4;">(${p.reviewCount || 0} değerlendirme)</span>
          </div>

          <!-- Summary -->
          <p style="
            font-size:0.76rem;color:#0d3a5f;opacity:0.8;
            line-height:1.5;margin:0;
            display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
          ">${esc(p.summary)}</p>

          <!-- Specialty tags -->
          ${specialtyTags ? `<div style="display:flex;flex-wrap:wrap;gap:4px;">${specialtyTags}</div>` : ''}

          <!-- Meta -->
          <div style="
            display:flex;align-items:center;gap:10px;
            font-size:0.68rem;color:#5d97c4;
          ">
            <span>📍 ${esc(p.location)}</span>
            ${p.experience ? `<span>· 🕐 ${esc(p.experience)}</span>` : ''}
          </div>

        </div>

        <!-- CTA -->
        <div style="padding:12px 14px 14px;margin-top:auto;display:flex;flex-direction:column;gap:6px;">
          ${!p.verified ? `<p style="font-size:0.65rem;color:#92400e;background:#fef3c7;padding:6px 8px;border-radius:6px;margin:0;line-height:1.4;">ℹ️ İletişim bilgileri henüz onaylanmadı — Kalkan Info concierge yönlendirir.</p>` : ''}
          ${p.verified && p.phoneRaw ? `<a href="tel:${esc(p.phoneRaw)}" data-pm-action="phone" data-provider-id="${esc(p.id || p.name)}" data-service-title="${esc(serviceTitle)}" style="
            display:flex;align-items:center;justify-content:center;gap:7px;
            background:#0a2e4c;color:#fff;
            font-family:'Montserrat',system-ui,sans-serif;
            font-weight:700;font-size:0.75rem;
            padding:9px 14px;border-radius:10px;
            text-decoration:none;
            box-shadow:0 4px 14px -4px rgba(10,46,76,0.4);
            transition:background 0.18s ease;
          " onmouseover="this.style.background='#0d3a5f';" onmouseout="this.style.background='#0a2e4c';">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/></svg>
            ${esc(p.phone || p.phoneRaw)}
          </a>` : ''}
          ${p.verified && p.mapsUrl ? `<a href="${esc(p.mapsUrl)}" target="_blank" rel="noopener" data-pm-action="maps" data-provider-id="${esc(p.id || p.name)}" data-service-title="${esc(serviceTitle)}" style="
            display:flex;align-items:center;justify-content:center;gap:7px;
            background:#fff;color:#0a2e4c;border:1.5px solid #cce0ee;
            font-family:'Montserrat',system-ui,sans-serif;
            font-weight:700;font-size:0.72rem;
            padding:8px 14px;border-radius:10px;
            text-decoration:none;
            transition:background 0.18s ease;
          " onmouseover="this.style.background='#f0f7ff';" onmouseout="this.style.background='#fff';">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Yol Tarifi
          </a>` : ''}
          <a href="${waLink}" target="_blank" rel="noopener" data-pm-action="wa" data-provider-id="${esc(p.id || p.name)}" data-service-title="${esc(serviceTitle)}" data-verified="${p.verified ? '1' : '0'}" style="
            display:flex;align-items:center;justify-content:center;gap:7px;
            background:#16a34a;color:#fff;
            font-family:'Montserrat',system-ui,sans-serif;
            font-weight:700;font-size:0.75rem;
            padding:9px 14px;border-radius:10px;
            text-decoration:none;
            box-shadow:0 4px 14px -4px rgba(22,163,74,0.4);
            transition:background 0.18s ease,box-shadow 0.18s ease;
          "
          onmouseover="this.style.background='#15803d';this.style.boxShadow='0 6px 18px -4px rgba(22,163,74,0.55)';"
          onmouseout="this.style.background='#16a34a';this.style.boxShadow='0 4px 14px -4px rgba(22,163,74,0.4)';">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.92c0 1.92.55 3.78 1.6 5.39L2 22l4.86-1.7a9.93 9.93 0 0 0 5.18 1.45c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Z"/></svg>
            ${p.verified ? 'WhatsApp' : "Concierge'e Sor"}
          </a>
        </div>

      </article>
    `;
  }

  // ── Sort logic ────────────────────────────────────────────────────────────

  function sortProviders(providers) {
    const list = [...providers];
    if (currentSort === 'featured') {
      return list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }
    if (currentSort === 'rating') {
      return list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (currentSort === 'newest') {
      return list.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
    }
    return list;
  }

  // ── Render providers into modal ───────────────────────────────────────────

  function renderProviders(serviceId, serviceData) {
    const grid = document.getElementById('pm-grid');
    if (!grid) return;
    const sorted = sortProviders(serviceData.providers || []);
    grid.innerHTML = sorted.map(p => providerCard(p, serviceData.title)).join('');
  }

  // ── Open modal ────────────────────────────────────────────────────────────

  async function openModal(serviceId) {
    fireEv('providers_modal_open', { service: serviceId, page: location.pathname });
    const data = await loadData();
    const serviceData = data.services && data.services[serviceId];

    if (!serviceData) {
      // Fallback: concierge'e yönlendir
      window.open(`${WA_BASE}?text=${encodeURIComponent('Merhaba! Kalkan Info üzerinden hizmet sağlayıcısı hakkında bilgi almak istiyorum.')}`, '_blank');
      return;
    }

    // Ensure modal exists
    if (!modalEl) {
      modalEl = buildModal();
      attachModalEvents();
    }

    // Populate header
    document.getElementById('pm-icon').textContent = serviceData.icon || '';
    document.getElementById('pm-title').textContent =
      `Kalkan'da ${serviceData.title} Veren Sağlayıcılar`;
    document.getElementById('pm-subtitle').textContent =
      `${(serviceData.providers || []).length} onaylı sağlayıcı bulundu`;

    // Reset sort
    currentSort = 'featured';
    updateSortButtons();

    // Render cards
    renderProviders(serviceId, serviceData);

    // Store current service for re-render on sort
    modalEl._currentServiceId = serviceId;
    modalEl._currentServiceData = serviceData;

    // Show modal — double-raf ensures CSS transition fires after paint
    const panel = document.getElementById('pm-panel');
    if (panel) {
      panel.style.transform = 'scale(0.95) translateY(12px)';
      panel.style.opacity = '0';
    }
    modalEl.style.opacity = '0';
    modalEl.style.pointerEvents = 'auto';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modalEl.style.opacity = '1';
        if (panel) {
          panel.style.transform = 'scale(1) translateY(0)';
          panel.style.opacity = '1';
        }
      });
    });

    document.body.style.overflow = 'hidden';
    // Focus close button for accessibility
    setTimeout(() => {
      const closeBtn = document.getElementById('pm-close');
      if (closeBtn) closeBtn.focus();
    }, 280);
  }

  // ── Close modal ───────────────────────────────────────────────────────────

  function closeModal() {
    if (!modalEl) return;
    const panel = document.getElementById('pm-panel');
    if (panel) {
      panel.style.transform = 'scale(0.95) translateY(12px)';
      panel.style.opacity = '0';
    }
    modalEl.style.opacity = '0';
    setTimeout(() => {
      modalEl.style.pointerEvents = 'none';
      document.body.style.overflow = '';
    }, 250);
  }

  // ── Sort button state ─────────────────────────────────────────────────────

  function updateSortButtons() {
    document.querySelectorAll('.pm-sort-btn').forEach(btn => {
      const isActive = btn.dataset.sort === currentSort;
      if (isActive) {
        btn.style.background = 'rgba(244,181,61,0.18)';
        btn.style.borderColor = 'rgba(244,181,61,0.6)';
        btn.style.color = '#f4b53d';
        btn.classList.add('pm-sort-active');
      } else {
        btn.style.background = 'transparent';
        btn.style.borderColor = 'rgba(255,255,255,0.2)';
        btn.style.color = 'rgba(255,255,255,0.7)';
        btn.classList.remove('pm-sort-active');
      }
    });
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  function attachModalEvents() {
    // Close button
    document.getElementById('pm-close').addEventListener('click', closeModal);

    // Backdrop click
    modalEl.addEventListener('click', e => {
      if (e.target === modalEl) closeModal();
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modalEl && modalEl.style.pointerEvents !== 'none') {
        closeModal();
      }
    });

    // Provider card link tracking (delegated to grid)
    document.getElementById('pm-grid').addEventListener('click', e => {
      const link = e.target.closest('[data-pm-action]');
      if (!link) return;
      const action = link.dataset.pmAction;
      const providerId = link.dataset.providerId || 'unknown';
      const serviceTitle = link.dataset.serviceTitle || '';
      if (action === 'phone') {
        fireEv('phone_click', {
          provider_id: providerId,
          service: serviceTitle,
          page_url: location.pathname,
          source: 'providers_modal'
        });
      } else if (action === 'maps') {
        fireEv('maps_click', {
          provider_id: providerId,
          service: serviceTitle,
          page_url: location.pathname,
          source: 'providers_modal'
        });
      } else if (action === 'wa') {
        fireEv('wa_click', {
          provider_id: providerId,
          service: serviceTitle,
          page_url: location.pathname,
          agent: 'concierge',
          source: link.dataset.verified === '1' ? 'provider_verified' : 'provider_concierge'
        });
        try { if (window.kalkanQualifiedLead) window.kalkanQualifiedLead('concierge'); } catch (e) {}
      }
    });

    // Sort buttons (delegated)
    document.getElementById('pm-sort-bar').addEventListener('click', e => {
      const btn = e.target.closest('.pm-sort-btn');
      if (!btn) return;
      currentSort = btn.dataset.sort;
      updateSortButtons();
      if (modalEl._currentServiceId) {
        renderProviders(modalEl._currentServiceId, modalEl._currentServiceData);
      }
    });
  }

  // ── Mount — attach click listeners to service cards ───────────────────────
  // Cards are dynamically rendered by render.js, so we use event delegation
  // on the grid container instead of querying individual cards.

  // Title → service-id mapping (statik kartlar için)
  const TITLE_TO_SERVICE = {
    'catering': 'catering',
    'barmen': 'barmen',
    'tesisat': 'tesisat',
    'bahce': 'bahce', 'bahçe': 'bahce',
    'havuz': 'havuz',
    'havalimani': 'transfer-havalimani', 'havalimanı': 'transfer-havalimani', 'transfer': 'transfer-havalimani',
    'temizlik': 'temizlik',
    'nakliyat': 'nakliyat',
    'boya': 'boya',
    'tas duvar': 'tasduvar', 'taş duvar': 'tasduvar',
    'cocuk': 'cocukbakim', 'çocuk': 'cocukbakim',
    'evcil': 'evcilbakim'
  };

  function inferServiceId(card) {
    if (card.dataset.service) return card.dataset.service;
    const h3 = card.querySelector('h3');
    if (!h3) return null;
    const title = h3.textContent.toLowerCase();
    for (const [key, id] of Object.entries(TITLE_TO_SERVICE)) {
      if (title.includes(key)) return id;
    }
    return null;
  }

  function mountProvidersModal() {
    // Document-level event delegation — statik (hizmetler.html) + dinamik (#items-grid)
    document.addEventListener('click', e => {
      // Telefon/WhatsApp linklerini engelleme
      if (e.target.closest('a')) return;
      const card = e.target.closest('.service-card');
      if (!card) return;
      const serviceId = inferServiceId(card);
      if (serviceId) {
        e.preventDefault();
        openModal(serviceId);
      }
    });
    // Tüm service kartları görsel olarak tıklanabilir
    document.querySelectorAll('.service-card').forEach(c => {
      const sid = inferServiceId(c);
      if (sid) {
        c.style.cursor = 'pointer';
        if (!c.dataset.service) c.dataset.service = sid;
      }
    });

    // Hash auto-open: hizmetler.html#catering vb. derin link gelirse modal'ı aç
    const VALID_SERVICE_IDS = new Set(Object.values(TITLE_TO_SERVICE));
    async function maybeOpenFromHash() {
      const raw = (location.hash || '').replace(/^#/, '').toLowerCase().trim();
      if (!raw) return;
      const serviceId = TITLE_TO_SERVICE[raw] || raw;
      if (!VALID_SERVICE_IDS.has(serviceId)) return; // unknown hash → ignore
      // Modal API hazır olana kadar küçük gecikme — items-grid render olabilsin
      setTimeout(() => openModal(serviceId), 400);
    }
    maybeOpenFromHash();
    window.addEventListener('hashchange', maybeOpenFromHash);

    // Programatik erişim için global hook
    window.openProvidersModal = openModal;
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountProvidersModal);
  } else {
    mountProvidersModal();
  }

})();
