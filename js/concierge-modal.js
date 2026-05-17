/**
 * js/concierge-modal.js — Kalkan Info
 * Floating concierge butonu tıklandığında 2 profil seçim modali açar.
 * Agents: data/concierge.json
 */
(function () {
  'use strict';
  if (window.__kalkan_concierge_mounted) return;
  window.__kalkan_concierge_mounted = true;

  const DATA_URL = '/data/concierge.json';
  let agents = null;
  let backdrop = null;

  function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  async function loadAgents() {
    if (agents) return agents;
    try {
      const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
      const data = await res.json();
      agents = (data && Array.isArray(data.agents)) ? data.agents : [];
    } catch (err) {
      console.warn('[concierge] data load failed', err);
      agents = [];
    }
    return agents;
  }

  function build(agentsList) {
    backdrop = document.createElement('div');
    backdrop.id = 'kalkan-concierge-modal';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Concierge ekibinden birini seç');
    backdrop.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:10000',
      'background:rgba(7,33,54,0.72)',
      'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'display:flex',
      'align-items:flex-end',
      'justify-content:center',
      'animation:kalkan-concierge-fade 0.22s ease',
    ].join(';');

    const sheet = document.createElement('div');
    sheet.style.cssText = [
      'width:100%',
      'max-width:480px',
      'background:linear-gradient(180deg,#0c3858 0%,#0a2e4c 100%)',
      'border-radius:24px 24px 0 0',
      'padding:28px 22px 32px',
      'box-shadow:0 -16px 48px -8px rgba(0,0,0,0.55)',
      'animation:kalkan-concierge-slide 0.28s cubic-bezier(0.34,1.56,0.64,1)',
      'color:#fff',
      'font-family:Inter,system-ui,sans-serif',
    ].join(';');

    sheet.innerHTML = `
      <style>
        @keyframes kalkan-concierge-fade { from { opacity:0; } to { opacity:1; } }
        @keyframes kalkan-concierge-slide { from { transform:translateY(40px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @media (min-width:640px) {
          #kalkan-concierge-modal { align-items:center !important; padding:24px !important; }
          #kalkan-concierge-modal > div { border-radius:24px !important; }
        }
      </style>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div>
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#f4b53d;">Kalkan Info Concierge</p>
          <h2 style="margin:6px 0 0;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:20px;letter-spacing:-0.02em;">Kiminle konuşmak istersin?</h2>
        </div>
        <button id="kalkan-concierge-close" aria-label="Kapat" style="
          flex-shrink:0;background:rgba(255,255,255,0.08);color:#fff;border:none;
          width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:20px;line-height:1;
          display:flex;align-items:center;justify-content:center;transition:background 0.15s;
        ">×</button>
      </div>
      <p style="margin:6px 0 18px;font-size:13px;line-height:1.55;color:rgba(220,230,239,0.7);">Direkt WhatsApp üzerinden kişiye özel cevap alırsın. Tatil planlama, villa, restoran, transfer veya yerel rehberlik için seç.</p>
      <div id="kalkan-concierge-list" style="display:flex;flex-direction:column;gap:12px;"></div>
      <p style="margin:18px 0 0;font-size:11px;color:rgba(220,230,239,0.45);text-align:center;">
        Yanıt süresi genellikle 5-30 dk · Pazartesi-Pazar 09:00–22:00
      </p>
    `;

    backdrop.appendChild(sheet);

    const list = sheet.querySelector('#kalkan-concierge-list');
    agentsList.forEach(a => list.appendChild(buildAgentCard(a)));

    const closeBtn = sheet.querySelector('#kalkan-concierge-close');
    closeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); close(); });
    // Sheet üzerine tıklayınca bubble'ı kes (modal kapanmasın)
    sheet.addEventListener('click', (e) => e.stopPropagation());
    backdrop.addEventListener('click', () => close());
    document.addEventListener('keydown', escClose);

    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
  }

  function buildAgentCard(a) {
    const card = document.createElement('a');
    const available = a.available !== false && !!a.whatsappRaw;
    const msg = encodeURIComponent(a.defaultMessage || 'Merhaba!');
    const href = available
      ? `https://wa.me/${a.whatsappRaw}?text=${msg}`
      : '#';

    card.href = href;
    if (available) {
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
    } else {
      card.addEventListener('click', e => { e.preventDefault(); });
    }

    card.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:14px',
      'padding:14px 16px',
      `background:${available ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'}`,
      `border:1.5px solid ${available ? 'rgba(244,181,61,0.25)' : 'rgba(255,255,255,0.08)'}`,
      'border-radius:14px',
      'text-decoration:none',
      'color:inherit',
      `cursor:${available ? 'pointer' : 'not-allowed'}`,
      `opacity:${available ? '1' : '0.55'}`,
      'transition:background 0.18s,border-color 0.18s,transform 0.12s',
    ].join(';');

    if (available) {
      card.addEventListener('mouseenter', () => {
        card.style.background = 'rgba(244,181,61,0.10)';
        card.style.borderColor = 'rgba(244,181,61,0.55)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.background = 'rgba(255,255,255,0.06)';
        card.style.borderColor = 'rgba(244,181,61,0.25)';
      });
    }

    const flags = (a.languageFlags || []).map(f => `<span style="font-size:14px;">${escapeHTML(f)}</span>`).join('');
    const initial = escapeHTML((a.name || '?').slice(0, 1));
    const fallbackImg = a.avatarFallback ? escapeHTML(a.avatarFallback) : '';
    const linkedinHref = a.linkedin ? escapeHTML(a.linkedin) : '';

    card.innerHTML = `
      <div style="flex-shrink:0;width:54px;height:54px;border-radius:50%;overflow:hidden;background:#0a2e4c;border:2px solid rgba(244,181,61,0.4);display:flex;align-items:center;justify-content:center;">
        <img src="${escapeHTML(a.avatar || 'icons/icon-192.png')}" alt="${escapeHTML(a.name)}" style="width:100%;height:100%;object-fit:cover;" onerror="${fallbackImg ? `this.onerror=null;this.src='${fallbackImg}'` : `this.outerHTML='<span style=&quot;font-family:Montserrat;font-weight:800;color:#fff;font-size:22px;&quot;>${initial}</span>'`}" />
      </div>
      <div style="flex:1;min-width:0;">
        <p style="margin:0;font-family:Montserrat,system-ui,sans-serif;font-weight:700;font-size:15px;color:#fff;">${escapeHTML(a.name)}</p>
        <p style="margin:3px 0 0;font-size:12px;color:rgba(220,230,239,0.7);display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          ${flags}<span>${escapeHTML(a.role)}</span>
        </p>
        ${linkedinHref ? `<a href="${linkedinHref}" target="_blank" rel="noopener" onclick="event.stopPropagation();" style="display:inline-flex;align-items:center;gap:4px;margin-top:5px;font-size:11px;color:#4A9EF5;text-decoration:none;font-weight:600;letter-spacing:0.02em;"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>LinkedIn</a>` : ''}
        ${!available ? '<p style="margin:4px 0 0;font-size:11px;color:#f4b53d;font-weight:600;">Yakında aktif</p>' : ''}
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;gap:6px;color:#25D366;font-weight:700;font-size:13px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.92c0 1.92.55 3.78 1.6 5.39L2 22l4.86-1.7a9.93 9.93 0 0 0 5.18 1.45c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Z"/></svg>
        ${available ? '<span style="font-family:Montserrat;">WhatsApp</span>' : ''}
      </div>
    `;

    return card;
  }

  function close() {
    if (!backdrop) return;
    backdrop.style.animation = 'kalkan-concierge-fade 0.18s ease reverse';
    setTimeout(() => {
      if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      backdrop = null;
      document.body.style.overflow = '';
    }, 180);
    document.removeEventListener('keydown', escClose);
  }

  function escClose(e) {
    if (e.key === 'Escape') close();
  }

  async function open() {
    if (backdrop) return;
    const list = await loadAgents();
    if (!list.length) {
      // Fallback — default Berkay WA aç
      window.open('https://wa.me/905306650794?text=Merhaba+Kalkan+Info', '_blank', 'noopener');
      return;
    }
    build(list);
  }

  function bindTrigger() {
    const triggers = document.querySelectorAll('#concierge, [data-concierge-trigger]');
    triggers.forEach(el => {
      if (el.__kalkanBound) return;
      el.__kalkanBound = true;
      el.addEventListener('click', e => {
        e.preventDefault();
        open();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTrigger, { once: true });
  } else {
    bindTrigger();
  }

  // Expose for external triggers
  window.openConcierge = open;
})();
