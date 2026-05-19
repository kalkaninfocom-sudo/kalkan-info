/**
 * js/newsletter.js — Kalkan Info
 * Footer newsletter formu, idempotent mount.
 * Şu anki Supabase config: window.SUPABASE_URL + SUPABASE_ANON_KEY
 * (build-time scripts/build-supabase-config.mjs ile inject)
 */
(function () {
  'use strict';

  function once(name) {
    const key = '__kalkan_' + name;
    if (window[key]) return false;
    window[key] = true;
    return true;
  }

  function el(tag, attrs, inner) {
    const node = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    }
    if (inner !== undefined && inner !== null) {
      if (typeof inner === 'string') node.innerHTML = inner;
      else if (Array.isArray(inner)) inner.forEach(c => c && node.appendChild(c));
      else node.appendChild(inner);
    }
    return node;
  }

  function buildForm() {
    const wrap = el('form', {
      class: 'nl-form mt-4 flex flex-col gap-2',
      'aria-label': 'Newsletter abonelik formu',
      novalidate: 'true'
    });

    const row = el('div', { class: 'flex flex-col sm:flex-row gap-2' });

    const input = el('input', {
      type: 'email',
      name: 'email',
      required: 'true',
      placeholder: 'E-posta adresiniz',
      autocomplete: 'email',
      class: 'flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-white/10 border border-white/15 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-sun-400 focus:border-transparent'
    });

    const btn = el('button', {
      type: 'submit',
      class: 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-sun-500 hover:bg-sun-600 text-sea-900 text-sm font-bold transition shadow'
    }, 'Abone Ol');

    row.appendChild(input);
    row.appendChild(btn);

    const consent = el('label', { class: 'flex items-start gap-2 text-[11px] text-white/55 leading-relaxed' });
    const check = el('input', { type: 'checkbox', name: 'gdpr', required: 'true', class: 'mt-0.5 accent-sun-500' });
    const span = el('span', { html: 'KVKK aydınlatma metnini okudum, e-posta almak istiyorum. <a href="/kvkk.html" class="underline hover:text-sun-400">KVKK</a>' });
    consent.appendChild(check);
    consent.appendChild(span);

    const status = el('div', { class: 'nl-status text-[12px] mt-1', 'aria-live': 'polite' });

    wrap.appendChild(row);
    wrap.appendChild(consent);
    wrap.appendChild(status);

    wrap.addEventListener('submit', (e) => onSubmit(e, wrap, input, check, status, btn));
    return wrap;
  }

  async function onSubmit(e, form, input, check, status, btn) {
    e.preventDefault();
    const email = (input.value || '').trim();
    const gdpr = !!check.checked;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setStatus(status, 'Geçerli bir e-posta adresi girin.', 'err');
    }
    if (!gdpr) return setStatus(status, 'KVKK onayı gerekli.', 'err');

    const url = window.SUPABASE_URL;
    const key = window.SUPABASE_ANON_KEY;
    if (!url || !key) return setStatus(status, 'Servis şu an kullanılamıyor.', 'err');

    btn.disabled = true;
    setStatus(status, 'Gönderiliyor…', 'info');

    try {
      const res = await fetch(`${url}/functions/v1/newsletter-subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          email,
          source_page: location.pathname.replace(/\/+$/, '') || '/',
          locale: (document.documentElement.lang || 'tr').slice(0, 2),
          gdpr_consent: true
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error === 'rate_limited'
          ? 'Çok fazla deneme. Lütfen biraz sonra tekrar deneyin.'
          : data?.error === 'invalid_email'
            ? 'Geçerli bir e-posta adresi girin.'
            : 'Abonelik tamamlanamadı. Daha sonra tekrar deneyin.';
        return setStatus(status, msg, 'err');
      }

      // Plausible event — başarılı abone (email PII gönderilmez)
      try {
        if (window.plausibleEvent) {
          window.plausibleEvent('newsletter_subscribe', {
            locale: (document.documentElement.lang || 'tr').slice(0, 2),
            source_page: location.pathname,
            status: data?.status || 'pending'
          });
        }
        if (window.kalkanQualifiedLead) window.kalkanQualifiedLead('newsletter');
      } catch (e) {}

      if (data?.status === 'already_confirmed') {
        setStatus(status, 'Zaten abonesiniz. Teşekkürler.', 'ok');
      } else {
        setStatus(status, 'E-posta adresinize onay bağlantısı gönderildi. Spam klasörünü de kontrol edin.', 'ok');
        input.value = '';
        check.checked = false;
      }
    } catch (err) {
      console.warn('[newsletter] submit error', err);
      setStatus(status, 'Bağlantı hatası. İnternetinizi kontrol edin.', 'err');
    } finally {
      btn.disabled = false;
    }
  }

  function setStatus(node, msg, kind) {
    node.textContent = msg;
    node.className = 'nl-status text-[12px] mt-1 ' + (
      kind === 'ok' ? 'text-sun-400'
        : kind === 'err' ? 'text-coral-500'
          : 'text-white/70'
    );
  }

  function mountAll() {
    document.querySelectorAll('[data-newsletter-mount]').forEach(mount => {
      if (mount.__nlMounted) return;
      mount.__nlMounted = true;
      mount.appendChild(buildForm());
    });
  }

  if (!once('newsletter_mount')) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll, { once: true });
  } else {
    mountAll();
  }
})();
