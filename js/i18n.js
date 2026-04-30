const CACHE_KEY = 'kalkan_lang_v1';
const SUPPORTED = ['en', 'tr', 'ru', 'ja', 'ar'];
const RTL_LANGS = ['ar'];

let _cache = {};
let _current = null;
let _strings = {};

function _resolveLangCode(raw) {
  if (!raw) return 'en';
  const code = raw.toLowerCase().split('-')[0];
  return SUPPORTED.includes(code) ? code : 'en';
}

export function getCurrentLang() {
  const stored = localStorage.getItem(CACHE_KEY);
  if (stored && SUPPORTED.includes(stored)) return stored;
  return _resolveLangCode(navigator.language);
}

export async function loadLang(code) {
  if (_cache[code]) {
    _strings = _cache[code];
    return _strings;
  }
  try {
    const base = import.meta.url
      ? new URL('../lang/' + code + '.json', import.meta.url).href
      : 'lang/' + code + '.json';
    const res = await fetch(base);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    _cache[code] = data;
    _strings = data;
    return data;
  } catch (e) {
    console.warn('[i18n] Failed to load lang:', code, e);
    if (code !== 'en') return loadLang('en');
    return {};
  }
}

export function t(key) {
  const parts = key.split('.');
  let node = _strings;
  for (const p of parts) {
    if (node == null || typeof node !== 'object') return key;
    node = node[p];
  }
  return (node != null && typeof node === 'string') ? node : key;
}

export function applyTranslations(rootEl) {
  const root = rootEl || document;

  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val !== key) el.textContent = val;
  });

  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    const raw = el.getAttribute('data-i18n-attr');
    raw.split(',').forEach(pair => {
      const [attr, key] = pair.trim().split(':');
      if (attr && key) {
        const val = t(key.trim());
        if (val !== key.trim()) el.setAttribute(attr.trim(), val);
      }
    });
  });

  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const val = t(key);
    if (val !== key) el.innerHTML = val;
  });
}

export async function setLang(code) {
  const safe = SUPPORTED.includes(code) ? code : 'en';
  await loadLang(safe);

  _current = safe;
  localStorage.setItem(CACHE_KEY, safe);

  const html = document.documentElement;
  html.setAttribute('lang', safe);
  html.setAttribute('dir', RTL_LANGS.includes(safe) ? 'rtl' : 'ltr');

  document.body.classList.remove(...SUPPORTED.map(l => 'lang-' + l));
  document.body.classList.add('lang-' + safe);

  if (RTL_LANGS.includes(safe)) {
    document.body.classList.add('rtl');
  } else {
    document.body.classList.remove('rtl');
  }

  applyTranslations();

  document.dispatchEvent(new CustomEvent('langchange', {
    detail: { lang: safe, rtl: RTL_LANGS.includes(safe) }
  }));
}

document.addEventListener('DOMContentLoaded', () => {
  setLang(getCurrentLang());
});
