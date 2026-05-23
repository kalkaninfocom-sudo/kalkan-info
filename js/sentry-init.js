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
