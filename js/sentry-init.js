// Sentry browser SDK — lazy load + init
// Requires env injection (build-time): window.SENTRY_DSN_CLIENT, window.SENTRY_RELEASE
// Berkay: Vercel env SENTRY_DSN_CLIENT, sonra build-supabase-config.mjs benzeri bir scripte inject et.
(function () {
  if (!window.SENTRY_DSN_CLIENT) return; // not configured yet

  const SDK_URL = 'https://browser.sentry-cdn.com/8.0.0/bundle.tracing.min.js';

  function init() {
    if (!window.Sentry) return;
    try {
      window.Sentry.init({
        dsn: window.SENTRY_DSN_CLIENT,
        release: window.SENTRY_RELEASE || 'kalkan-info@dev',
        environment: location.hostname === 'kalkaninfo.com' ? 'production' : 'preview',
        tracesSampleRate: 0.05,
        // Filter out known harmless errors
        beforeSend(event, hint) {
          const msg = (hint?.originalException?.message || event?.message || '').toLowerCase();
          if (msg.includes('resizeobserver loop')) return null;
          if (msg.includes('script error.')) return null;
          // 2026-05-22 audit-trust: PII strip — newsletter/auth token'lar URL'de
          try {
            if (event.request && event.request.url) {
              const url = new URL(event.request.url);
              ['email','token','confirm_token','unsubscribe_token','access_token','refresh_token'].forEach(k => {
                if (url.searchParams.has(k)) url.searchParams.set(k, '[REDACTED]');
              });
              event.request.url = url.toString();
            }
            if (Array.isArray(event.breadcrumbs)) {
              event.breadcrumbs = event.breadcrumbs.map(b => {
                if (b && b.data && b.data.url) {
                  try {
                    const u = new URL(b.data.url, 'https://kalkaninfo.com');
                    ['email','token','confirm_token','unsubscribe_token'].forEach(k => {
                      if (u.searchParams.has(k)) u.searchParams.set(k, '[REDACTED]');
                    });
                    b.data.url = u.toString();
                  } catch (e) { /* noop */ }
                }
                return b;
              });
            }
          } catch (e) { /* noop */ }
          return event;
        },
      });
    } catch (e) { /* silent */ }
  }

  const s = document.createElement('script');
  s.src = SDK_URL;
  s.crossOrigin = 'anonymous';
  s.async = true;
  s.onload = init;
  document.head.appendChild(s);
})();
