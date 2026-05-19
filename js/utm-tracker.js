/**
 * js/utm-tracker.js — Kalkan Info
 * UTM parametrelerini sessionStorage'da tutar, ilk sayfa yüklemesinde geliş
 * kanalı için event fire eder (ig_arrival, fb_arrival, vs.).
 *
 * Bağımlılık: js/analytics.js (window.plausibleEvent)
 */
(function () {
  'use strict';
  if (window.__kalkan_utm_mounted) return;
  window.__kalkan_utm_mounted = true;

  var STORAGE_KEY = 'ki_utm';
  var FIRST_HIT_KEY = 'ki_utm_first_hit';

  function readUTMFromURL() {
    var params;
    try { params = new URLSearchParams(location.search || ''); } catch (e) { return null; }
    var src = params.get('utm_source');
    var med = params.get('utm_medium');
    var cmp = params.get('utm_campaign');
    var ref = params.get('utm_term');
    var con = params.get('utm_content');
    var gclid = params.get('gclid');
    var fbclid = params.get('fbclid');
    if (!src && !med && !cmp && !gclid && !fbclid) return null;
    return {
      source: src || '',
      medium: med || '',
      campaign: cmp || '',
      term: ref || '',
      content: con || '',
      gclid: gclid || '',
      fbclid: fbclid || '',
      landed_path: location.pathname,
      landed_at: Date.now()
    };
  }

  function load() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { return null; }
  }

  function save(utm) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm)); } catch (e) {}
  }

  function fireArrival(utm) {
    if (!window.plausibleEvent) return;
    var src = (utm.source || '').toLowerCase();

    // Marka odaklı arrival event'leri (Instagram öncelikli)
    if (src === 'ig' || src === 'instagram') {
      window.plausibleEvent('ig_arrival', {
        campaign: utm.campaign || '',
        landed_path: utm.landed_path || '/',
        medium: utm.medium || ''
      });
    } else if (utm.fbclid || src === 'fb' || src === 'facebook') {
      window.plausibleEvent('fb_arrival', {
        campaign: utm.campaign || '',
        landed_path: utm.landed_path || '/'
      });
    } else if (src) {
      window.plausibleEvent('utm_arrival', {
        source: src,
        medium: utm.medium || '',
        campaign: utm.campaign || '',
        landed_path: utm.landed_path || '/'
      });
    }
  }

  function init() {
    var current = load();
    var fromUrl = readUTMFromURL();

    if (fromUrl) {
      // Yeni UTM geldi — eskisinin üstüne yaz (first-touch + last-touch beraber)
      var merged = {
        first: current && current.first ? current.first : fromUrl,
        last: fromUrl
      };
      save(merged);
      // İlk gerçek hit'i tek sefer fire et
      var firstHit = false;
      try { firstHit = !sessionStorage.getItem(FIRST_HIT_KEY); } catch (e) {}
      if (firstHit) {
        try { sessionStorage.setItem(FIRST_HIT_KEY, String(Date.now())); } catch (e) {}
        fireArrival(fromUrl);
      }
    }

    // External API: utm payload'unu propsa eklemek isteyen kodlar için
    window.KalkanUTM = {
      get: load,
      attach: function (props) {
        var u = load();
        if (!u || !u.last) return props || {};
        var p = Object.assign({}, props || {});
        if (!p.utm_source && u.last.source) p.utm_source = u.last.source;
        if (!p.utm_campaign && u.last.campaign) p.utm_campaign = u.last.campaign;
        return p;
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
