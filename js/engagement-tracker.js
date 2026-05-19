/**
 * js/engagement-tracker.js — Kalkan Info
 * 30 saniye sayfa içi + %50 scroll derinliği = `engaged` event
 * Newsletter / concierge / planner herhangi biri tetiklendiyse `qualified_lead`
 *
 * Bağımlılık: js/analytics.js (window.plausibleEvent)
 */
(function () {
  'use strict';
  if (window.__kalkan_engagement_mounted) return;
  window.__kalkan_engagement_mounted = true;

  var DWELL_MS = 30 * 1000;
  var SCROLL_PCT = 50;

  var dwellOk = false;
  var scrollOk = false;
  var engagedFired = false;
  var qualifiedFired = false;
  var startedAt = Date.now();
  var activeMs = 0;
  var lastTick = Date.now();
  var visible = (document.visibilityState !== 'hidden');

  function fireEngaged() {
    if (engagedFired) return;
    if (!(dwellOk && scrollOk)) return;
    engagedFired = true;
    if (window.plausibleEvent) {
      window.plausibleEvent('engaged', {
        page: location.pathname,
        dwell_s: Math.round(activeMs / 1000),
        scroll_pct: SCROLL_PCT
      });
    }
  }

  function fireQualifiedLead(source) {
    if (qualifiedFired) return;
    qualifiedFired = true;
    if (window.plausibleEvent) {
      window.plausibleEvent('qualified_lead', {
        source: source || 'unknown',
        page: location.pathname
      });
    }
  }
  // Public API — modüller tetikler
  window.kalkanQualifiedLead = fireQualifiedLead;

  // ── Dwell timer (sadece görünür sekme) ──────────────────────────────────────
  function tick() {
    if (!visible) { lastTick = Date.now(); return; }
    var now = Date.now();
    activeMs += (now - lastTick);
    lastTick = now;
    if (!dwellOk && activeMs >= DWELL_MS) {
      dwellOk = true;
      fireEngaged();
    }
  }
  setInterval(tick, 1000);

  document.addEventListener('visibilitychange', function () {
    visible = (document.visibilityState !== 'hidden');
    lastTick = Date.now();
  });

  // ── Scroll depth ────────────────────────────────────────────────────────────
  function maxScrollPct() {
    var doc = document.documentElement;
    var body = document.body;
    var scrollTop = window.scrollY || doc.scrollTop || 0;
    var viewport = window.innerHeight || doc.clientHeight;
    var full = Math.max(
      body.scrollHeight, doc.scrollHeight,
      body.offsetHeight, doc.offsetHeight,
      body.clientHeight, doc.clientHeight
    );
    if (full <= viewport) return 100; // sayfa zaten ekrana sığıyor
    return Math.round(((scrollTop + viewport) / full) * 100);
  }

  var rafToken = 0;
  function onScroll() {
    if (rafToken) return;
    rafToken = requestAnimationFrame(function () {
      rafToken = 0;
      if (!scrollOk && maxScrollPct() >= SCROLL_PCT) {
        scrollOk = true;
        fireEngaged();
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // İlk açılışta sayfa kısa olabilir → erken scroll check
  setTimeout(onScroll, 500);
})();
