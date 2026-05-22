/**
 * js/concierge-ai-modal.js — Kalkan Info
 *
 * AI Concierge chat panel (Claude Haiku fallback).
 * Mevcut concierge modal'ı içine "AI ile Sohbet Et" toggle açar.
 * window.openConciergeAI(opts) — opts: { context, item, source }
 *
 * Streaming SSE → /api/concierge-ai
 */
(function () {
  'use strict';
  if (window.__kalkan_concierge_ai_mounted) return;
  window.__kalkan_concierge_ai_mounted = true;

  const API_URL = '/api/concierge-ai';
  const SUPPORTED_LANGS = ['tr', 'en', 'de', 'ru', 'fr'];

  // -----------------------------------------------------------------
  // i18n strings
  // -----------------------------------------------------------------
  const STR = {
    tr: {
      title: 'AI Concierge',
      subtitle: 'Anlık sohbet · 7/24 açık',
      disclaimer: 'AI olduğum için fiyat ve rezervasyon kesin değil. Net cevap için Berkay\'a yazabilirsin.',
      welcome: 'Merhaba! Kalkan, Kaş ve Patara hakkında sorularını yanıtlayabilirim. Restoran, plaj, antik kent, villa veya tur konusunda nasıl yardımcı olabilirim?',
      placeholder: 'Mesajını yaz...',
      send: 'Gönder',
      sending: 'Yazıyor...',
      switchToWa: 'Berkay\'a yaz (WhatsApp)',
      close: 'Kapat',
      error: 'Bir hata oluştu, tekrar dene.',
      rate429: 'Çok hızlı yazıyorsun, biraz bekle.',
      rateMin: 'Dakikalık limit doldu, 1 dakika sonra dene.',
      rateHour: 'Saatlik limit doldu. Berkay\'a direkt yazabilirsin: wa.me/905306650794',
      waUrl: 'https://wa.me/905306650794',
      poweredBy: 'Claude Haiku 4.5',
    },
    en: {
      title: 'AI Concierge',
      subtitle: 'Instant chat · 24/7',
      disclaimer: 'I\'m AI — prices and reservations aren\'t guaranteed. For exact answers, message Berkay.',
      welcome: 'Hi! I can answer questions about Kalkan, Kaş and Patara. Need help with restaurants, beaches, ancient sites, villas or tours?',
      placeholder: 'Type your message...',
      send: 'Send',
      sending: 'Typing...',
      switchToWa: 'Message Berkay (WhatsApp)',
      close: 'Close',
      error: 'Something went wrong, try again.',
      rate429: 'Too fast, please slow down.',
      rateMin: 'Minute limit reached, try again in 1 min.',
      rateHour: 'Hourly limit reached. Message Berkay directly: wa.me/905306650794',
      waUrl: 'https://wa.me/905306650794',
      poweredBy: 'Claude Haiku 4.5',
    },
    de: {
      title: 'AI Concierge',
      subtitle: 'Sofortiger Chat · 24/7',
      disclaimer: 'Ich bin KI — Preise und Reservierungen sind nicht garantiert. Für genaue Antworten: Berkay anschreiben.',
      welcome: 'Hallo! Ich kann Fragen zu Kalkan, Kaş und Patara beantworten. Restaurants, Strände, antike Städte, Villen oder Touren?',
      placeholder: 'Nachricht eingeben...',
      send: 'Senden',
      sending: 'Schreibt...',
      switchToWa: 'Berkay anschreiben (WhatsApp)',
      close: 'Schließen',
      error: 'Etwas ist schiefgelaufen, bitte erneut versuchen.',
      rate429: 'Zu schnell, bitte langsamer.',
      rateMin: 'Minutenlimit erreicht, in 1 Min. erneut versuchen.',
      rateHour: 'Stundenlimit erreicht. Berkay direkt anschreiben: wa.me/905306650794',
      waUrl: 'https://wa.me/905306650794',
      poweredBy: 'Claude Haiku 4.5',
    },
    ru: {
      title: 'AI Concierge',
      subtitle: 'Мгновенный чат · 24/7',
      disclaimer: 'Я — ИИ, цены и брони не гарантированы. Для точных ответов напишите Berkay.',
      welcome: 'Здравствуйте! Я отвечу на вопросы о Калкане, Каше и Патаре. Помочь с рестораном, пляжем, античным городом, виллой или туром?',
      placeholder: 'Напишите сообщение...',
      send: 'Отправить',
      sending: 'Печатает...',
      switchToWa: 'Написать Berkay (WhatsApp)',
      close: 'Закрыть',
      error: 'Произошла ошибка, попробуйте снова.',
      rate429: 'Слишком быстро, помедленнее.',
      rateMin: 'Лимит в минуту достигнут, попробуйте через минуту.',
      rateHour: 'Часовой лимит достигнут. Напишите Berkay напрямую: wa.me/905306650794',
      waUrl: 'https://wa.me/905306650794',
      poweredBy: 'Claude Haiku 4.5',
    },
    fr: {
      title: 'AI Concierge',
      subtitle: 'Chat instantané · 24/7',
      disclaimer: 'Je suis une IA — les prix et réservations ne sont pas garantis. Pour une réponse précise, écrivez à Berkay.',
      welcome: 'Bonjour ! Je peux répondre à vos questions sur Kalkan, Kaş et Patara. Besoin d\'aide pour restaurants, plages, sites antiques, villas ou tours ?',
      placeholder: 'Tapez votre message...',
      send: 'Envoyer',
      sending: 'Écrit...',
      switchToWa: 'Écrire à Berkay (WhatsApp)',
      close: 'Fermer',
      error: 'Une erreur est survenue, réessayez.',
      rate429: 'Trop rapide, ralentissez.',
      rateMin: 'Limite par minute atteinte, réessayez dans 1 min.',
      rateHour: 'Limite horaire atteinte. Écrivez à Berkay directement : wa.me/905306650794',
      waUrl: 'https://wa.me/905306650794',
      poweredBy: 'Claude Haiku 4.5',
    },
  };

  function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function currentLang() {
    try {
      if (window.KalkanI18n && typeof window.KalkanI18n.get === 'function') {
        const l = window.KalkanI18n.get();
        if (l && SUPPORTED_LANGS.includes(l)) return l;
      }
    } catch (e) {}
    try {
      const stored = localStorage.getItem('lang');
      if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
    } catch (e) {}
    const docLang = (document.documentElement.lang || '').toLowerCase();
    if (SUPPORTED_LANGS.includes(docLang)) return docLang;
    return 'tr';
  }

  function fireEv(name, props) {
    try { if (window.plausibleEvent) window.plausibleEvent(name, props || {}); } catch (e) {}
  }

  // State
  let backdrop = null;
  let bodyEl = null;
  let inputEl = null;
  let sendBtn = null;
  let history = []; // [{role:'user'|'assistant', content:string}]
  let turnCount = 0;
  let lang = 'tr';
  let ctx = { context: 'genel', item: null };
  let isStreaming = false;

  function build() {
    const s = STR[lang] || STR.tr;

    backdrop = document.createElement('div');
    backdrop.id = 'kalkan-concierge-ai-modal';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', s.title);
    backdrop.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:10001',
      'background:rgba(7,33,54,0.72)',
      'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'display:flex',
      'align-items:flex-end',
      'justify-content:center',
      'animation:kalkan-aimodal-fade 0.22s ease',
    ].join(';');

    const sheet = document.createElement('div');
    sheet.style.cssText = [
      'width:100%',
      'max-width:480px',
      'height:min(640px,90vh)',
      'background:linear-gradient(180deg,#0c3858 0%,#0a2e4c 100%)',
      'border-radius:24px 24px 0 0',
      'box-shadow:0 -16px 48px -8px rgba(0,0,0,0.55)',
      'animation:kalkan-aimodal-slide 0.28s cubic-bezier(0.34,1.56,0.64,1)',
      'color:#fff',
      'font-family:Inter,system-ui,sans-serif',
      'display:flex',
      'flex-direction:column',
      'overflow:hidden',
    ].join(';');

    sheet.innerHTML = `
      <style>
        @keyframes kalkan-aimodal-fade { from { opacity:0; } to { opacity:1; } }
        @keyframes kalkan-aimodal-slide { from { transform:translateY(40px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @keyframes kalkan-aimodal-typing { 0%, 60%, 100% { opacity:0.3; } 30% { opacity:1; } }
        @media (min-width:640px) {
          #kalkan-concierge-ai-modal { align-items:center !important; padding:24px !important; }
          #kalkan-concierge-ai-modal > div { border-radius:24px !important; height:600px !important; }
        }
        .kalkan-ai-bubble-user {
          align-self:flex-end;
          background:#1a5e93;
          color:#fff;
          border-radius:14px 14px 4px 14px;
          padding:10px 14px;
          max-width:80%;
          font-size:14px;
          line-height:1.5;
          word-wrap:break-word;
        }
        .kalkan-ai-bubble-ai {
          align-self:flex-start;
          background:rgba(255,255,255,0.08);
          color:#fff;
          border:1px solid rgba(244,181,61,0.18);
          border-radius:14px 14px 14px 4px;
          padding:10px 14px;
          max-width:85%;
          font-size:14px;
          line-height:1.55;
          word-wrap:break-word;
          white-space:pre-wrap;
        }
        .kalkan-ai-bubble-ai a {
          color:#f4b53d;
          text-decoration:underline;
        }
        .kalkan-ai-typing span {
          display:inline-block;
          width:6px;
          height:6px;
          margin:0 1px;
          background:#f4b53d;
          border-radius:50%;
          animation:kalkan-aimodal-typing 1.2s infinite;
        }
        .kalkan-ai-typing span:nth-child(2) { animation-delay:0.2s; }
        .kalkan-ai-typing span:nth-child(3) { animation-delay:0.4s; }
      </style>

      <!-- Header -->
      <div style="flex-shrink:0;padding:18px 22px 14px;border-bottom:1px solid rgba(244,181,61,0.18);background:rgba(0,0,0,0.15);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#f4b53d,#e89812);display:flex;align-items:center;justify-content:center;font-size:18px;">✨</div>
            <div>
              <p style="margin:0;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:16px;letter-spacing:-0.01em;">${escapeHTML(s.title)}</p>
              <p style="margin:2px 0 0;font-size:11px;color:rgba(220,230,239,0.6);">${escapeHTML(s.subtitle)}</p>
            </div>
          </div>
          <button id="kalkan-ai-close" aria-label="${escapeHTML(s.close)}" style="
            flex-shrink:0;background:rgba(255,255,255,0.08);color:#fff;border:none;
            width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1;
            display:flex;align-items:center;justify-content:center;transition:background 0.15s;
          ">×</button>
        </div>
        <p style="margin:12px 0 0;padding:8px 10px;background:rgba(244,181,61,0.10);border-radius:8px;font-size:11px;line-height:1.5;color:rgba(220,230,239,0.85);border:1px solid rgba(244,181,61,0.18);">
          ⚠ ${escapeHTML(s.disclaimer)}
        </p>
      </div>

      <!-- Conversation -->
      <div id="kalkan-ai-body" style="flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:10px;"></div>

      <!-- Quick switch to WA -->
      <div style="flex-shrink:0;padding:10px 18px;border-top:1px solid rgba(255,255,255,0.05);">
        <a id="kalkan-ai-switch-wa" href="${escapeHTML(s.waUrl)}" target="_blank" rel="noopener noreferrer" style="
          display:flex;align-items:center;justify-content:center;gap:8px;
          padding:9px 14px;background:rgba(37,211,102,0.12);color:#25D366;
          border:1px solid rgba(37,211,102,0.3);border-radius:10px;
          text-decoration:none;font-weight:600;font-size:13px;
          transition:background 0.15s;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.92c0 1.92.55 3.78 1.6 5.39L2 22l4.86-1.7a9.93 9.93 0 0 0 5.18 1.45c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Z"/></svg>
          ${escapeHTML(s.switchToWa)}
        </a>
      </div>

      <!-- Input -->
      <div style="flex-shrink:0;padding:12px 18px 18px;border-top:1px solid rgba(244,181,61,0.18);background:rgba(0,0,0,0.20);">
        <form id="kalkan-ai-form" style="display:flex;gap:8px;align-items:flex-end;">
          <textarea
            id="kalkan-ai-input"
            rows="1"
            maxlength="1500"
            placeholder="${escapeHTML(s.placeholder)}"
            style="flex:1;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(244,181,61,0.25);border-radius:12px;padding:10px 12px;font-family:inherit;font-size:14px;line-height:1.4;resize:none;max-height:90px;outline:none;transition:border-color 0.15s;"
          ></textarea>
          <button type="submit" id="kalkan-ai-send" aria-label="${escapeHTML(s.send)}" style="
            flex-shrink:0;background:#f4b53d;color:#0a2e4c;border:none;
            width:42px;height:42px;border-radius:50%;cursor:pointer;
            display:flex;align-items:center;justify-content:center;
            transition:background 0.15s,opacity 0.15s;font-weight:700;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
          </button>
        </form>
        <p style="margin:8px 0 0;font-size:10px;color:rgba(220,230,239,0.4);text-align:center;">
          ${escapeHTML(s.poweredBy)} · <a href="${escapeHTML(s.waUrl)}" target="_blank" rel="noopener" style="color:rgba(220,230,239,0.6);text-decoration:underline;">Berkay</a>
        </p>
      </div>
    `;

    backdrop.appendChild(sheet);

    bodyEl = sheet.querySelector('#kalkan-ai-body');
    inputEl = sheet.querySelector('#kalkan-ai-input');
    sendBtn = sheet.querySelector('#kalkan-ai-send');
    const formEl = sheet.querySelector('#kalkan-ai-form');
    const closeBtn = sheet.querySelector('#kalkan-ai-close');
    const waBtn = sheet.querySelector('#kalkan-ai-switch-wa');

    closeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); close(); });
    waBtn.addEventListener('click', () => {
      fireEv('ai_fallback_to_wa', { turns: turnCount, lang, context: ctx.context });
    });

    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 90) + 'px';
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        formEl.requestSubmit();
      }
    });
    inputEl.addEventListener('focus', () => {
      inputEl.style.borderColor = 'rgba(244,181,61,0.6)';
    });
    inputEl.addEventListener('blur', () => {
      inputEl.style.borderColor = 'rgba(244,181,61,0.25)';
    });

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = inputEl.value.trim();
      if (!msg || isStreaming) return;
      sendMessage(msg);
    });

    sheet.addEventListener('click', (e) => e.stopPropagation());
    backdrop.addEventListener('click', () => close());
    document.addEventListener('keydown', escClose);

    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    // Welcome message
    addBubble('assistant', s.welcome);
    setTimeout(() => inputEl.focus(), 300);
  }

  function addBubble(role, text) {
    const div = document.createElement('div');
    div.className = role === 'user' ? 'kalkan-ai-bubble-user' : 'kalkan-ai-bubble-ai';
    div.textContent = text;
    bodyEl.appendChild(div);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return div;
  }

  function addTypingIndicator() {
    const wrap = document.createElement('div');
    wrap.className = 'kalkan-ai-bubble-ai kalkan-ai-typing';
    wrap.setAttribute('data-typing', '1');
    wrap.innerHTML = '<span></span><span></span><span></span>';
    bodyEl.appendChild(wrap);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return wrap;
  }

  // Linkify wa.me + http links (after streaming).
  function linkify(text) {
    const escaped = escapeHTML(text);
    return escaped
      .replace(/wa\.me\/(\d+)/g, '<a href="https://wa.me/$1" target="_blank" rel="noopener noreferrer">wa.me/$1</a>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  async function sendMessage(userText) {
    const s = STR[lang] || STR.tr;

    if (turnCount === 0) {
      fireEv('ai_conversation_start', { lang, context: ctx.context });
    }
    fireEv('ai_message_sent', { lang, context: ctx.context, len: userText.length });

    addBubble('user', userText);
    history.push({ role: 'user', content: userText });
    inputEl.value = '';
    inputEl.style.height = 'auto';

    isStreaming = true;
    sendBtn.style.opacity = '0.5';
    sendBtn.disabled = true;

    const typing = addTypingIndicator();
    let aiBubble = null;
    let aiText = '';

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({
          message: userText,
          lang,
          context: ctx.context,
          history: history.slice(-7, -1), // last 6 turns excluding current user msg
        }),
      });

      if (resp.status === 429) {
        typing.remove();
        let reason = '';
        try { const j = await resp.json(); reason = j.reason || ''; } catch {}
        const msg = reason === 'hour' ? s.rateHour : (reason === 'minute' ? s.rateMin : s.rate429);
        addBubble('assistant', msg);
        return;
      }
      if (!resp.ok || !resp.body) {
        typing.remove();
        addBubble('assistant', s.error);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let typingRemoved = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          const lines = rawEvent.split('\n');
          let evName = 'message';
          let dataStr = '';
          for (const ln of lines) {
            if (ln.startsWith('event:')) evName = ln.slice(6).trim();
            else if (ln.startsWith('data:')) dataStr += ln.slice(5).trim();
          }
          if (!dataStr) continue;

          let payload;
          try { payload = JSON.parse(dataStr); } catch { continue; }

          if (evName === 'delta' && payload.text) {
            if (!typingRemoved) { typing.remove(); typingRemoved = true; }
            if (!aiBubble) aiBubble = addBubble('assistant', '');
            aiText += payload.text;
            aiBubble.textContent = aiText;
            bodyEl.scrollTop = bodyEl.scrollHeight;
          } else if (evName === 'error') {
            if (!typingRemoved) { typing.remove(); typingRemoved = true; }
            if (!aiBubble) aiBubble = addBubble('assistant', '');
            aiBubble.textContent = payload.message || s.error;
            aiText = aiBubble.textContent;
          } else if (evName === 'done') {
            // Replace plain text with linkified HTML in the bubble.
            if (aiBubble && aiText) aiBubble.innerHTML = linkify(aiText);
          }
        }
      }

      if (!typingRemoved) typing.remove();

      if (aiText) {
        history.push({ role: 'assistant', content: aiText });
        turnCount += 1;
        if (turnCount === 3) {
          fireEv('ai_conversation_complete', { lang, context: ctx.context });
        }
        if (turnCount >= 3) {
          injectBookingCTA();
        }
      }
    } catch (err) {
      console.warn('[concierge-ai] fetch failed', err);
      try { typing.remove(); } catch {}
      addBubble('assistant', s.error);
    } finally {
      isStreaming = false;
      sendBtn.style.opacity = '1';
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  const BOOKING_CTA = {
    tr: {
      villa: 'Bu villaları rezerve etmek için:',
      tur: 'Bu turu rezerve edin:',
      genel: 'Tatil paketini onaylamak için:',
      btn: 'WhatsApp ile İletişim',
    },
    en: {
      villa: 'To book these villas:',
      tur: 'To book this tour:',
      genel: 'To confirm your holiday package:',
      btn: 'Contact via WhatsApp',
    },
    de: {
      villa: 'Um diese Villen zu buchen:',
      tur: 'Um diese Tour zu buchen:',
      genel: 'Um Ihr Urlaubspaket zu bestätigen:',
      btn: 'Per WhatsApp kontaktieren',
    },
    ru: {
      villa: 'Для бронирования вилл:',
      tur: 'Для бронирования тура:',
      genel: 'Для подтверждения пакета:',
      btn: 'Связаться через WhatsApp',
    },
    fr: {
      villa: 'Pour réserver ces villas :',
      tur: 'Pour réserver ce tour :',
      genel: 'Pour confirmer votre séjour :',
      btn: 'Contacter par WhatsApp',
    },
  };

  function injectBookingCTA() {
    if (!bodyEl) return;
    // Only inject once per session
    if (bodyEl.querySelector('.kalkan-ai-booking-cta')) return;

    const s = STR[lang] || STR.tr;
    const bc = BOOKING_CTA[lang] || BOOKING_CTA.tr;

    // Determine context label
    const ctxKey = (ctx.context || 'genel').toLowerCase();
    const isVilla = ctxKey.includes('villa');
    const isTur = ctxKey.includes('tur') || ctxKey.includes('tour');
    const label = isVilla ? bc.villa : (isTur ? bc.tur : bc.genel);

    const wrap = document.createElement('div');
    wrap.className = 'kalkan-ai-booking-cta';
    wrap.style.cssText = [
      'align-self:flex-start',
      'width:100%',
      'margin-top:4px',
      'padding:12px 14px',
      'background:linear-gradient(135deg,rgba(244,181,61,0.15) 0%,rgba(232,152,18,0.10) 100%)',
      'border:1px solid rgba(244,181,61,0.35)',
      'border-radius:12px',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
    ].join(';');

    wrap.innerHTML = `
      <p style="margin:0;font-size:12px;color:rgba(220,230,239,0.85);line-height:1.4;">${escapeHTML(label)}</p>
      <a
        href="${escapeHTML(s.waUrl)}"
        target="_blank"
        rel="noopener noreferrer"
        class="kalkan-ai-booking-cta-btn"
        style="
          display:inline-flex;align-items:center;justify-content:center;gap:8px;
          padding:10px 16px;
          background:linear-gradient(135deg,#f4b53d 0%,#e89812 100%);
          color:#0a2e4c;border-radius:9px;text-decoration:none;
          font-family:Montserrat,system-ui,sans-serif;font-weight:700;font-size:13px;
          box-shadow:0 4px 14px -4px rgba(244,181,61,0.55);
          transition:opacity .15s;
        "
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.92c0 1.92.55 3.78 1.6 5.39L2 22l4.86-1.7a9.93 9.93 0 0 0 5.18 1.45c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Z"/></svg>
        ${escapeHTML(bc.btn)}
      </a>
    `;

    const ctaBtn = wrap.querySelector('.kalkan-ai-booking-cta-btn');
    ctaBtn.addEventListener('click', () => {
      fireEv('concierge_ai_booking_cta_clicked', { lang, context: ctx.context, turns: turnCount });
    });

    bodyEl.appendChild(wrap);
    bodyEl.scrollTop = bodyEl.scrollHeight;

    fireEv('concierge_ai_booking_cta_shown', { lang, context: ctx.context, turns: turnCount });
  }

  function close() {
    if (!backdrop) return;
    fireEv('ai_concierge_close', { turns: turnCount, lang });
    backdrop.style.animation = 'kalkan-aimodal-fade 0.18s ease reverse';
    setTimeout(() => {
      if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      backdrop = null;
      bodyEl = null;
      inputEl = null;
      sendBtn = null;
      history = [];
      turnCount = 0;
      isStreaming = false;
      document.body.style.overflow = '';
    }, 180);
    document.removeEventListener('keydown', escClose);
  }

  function escClose(e) {
    if (e.key === 'Escape') close();
  }

  function open(opts) {
    if (backdrop) return;
    opts = opts || {};
    lang = currentLang();
    ctx = {
      context: opts.context || (document.body && document.body.getAttribute('data-concierge-context')) || 'genel',
      item: opts.item || null,
    };
    fireEv('ai_concierge_open', {
      source: opts.source || 'unknown',
      page: location.pathname,
      context: ctx.context,
      lang,
    });
    build();
  }

  window.openConciergeAI = open;
})();
