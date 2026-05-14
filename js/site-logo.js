/**
 * site-logo.js — Admin'den yüklenen logoyu sayfa header'ına yansıt
 * data-site-logo attribute'una sahip elementlere img enjekte eder.
 * Veri kaynağı: localStorage.kalkan_info_admin_v1.config.site.logo (data URL veya https URL)
 */

(function () {
  'use strict';

  function _getLogo() {
    try {
      const raw = localStorage.getItem('kalkan_info_admin_v1');
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data?.config?.site?.logo || null;
    } catch { return null; }
  }

  function _esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function _apply() {
    const logoUrl = _getLogo();
    if (!logoUrl) return; // logo yoksa orijinal markup kalsın
    const safeUrl = _esc(logoUrl);
    document.querySelectorAll('[data-site-logo]').forEach(el => {
      el.innerHTML = `<img src="${safeUrl}" alt="Logo" style="max-height:120px;width:auto;display:block;" />`;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _apply);
  else _apply();

  // Admin panelden logo değişince diğer tab'larda anlık güncellensin
  window.addEventListener('storage', e => {
    if (e.key === 'kalkan_info_admin_v1') _apply();
  });
})();
