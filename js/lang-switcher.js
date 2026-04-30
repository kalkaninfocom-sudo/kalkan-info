import { setLang, getCurrentLang } from './i18n.js';

const LANGS = [
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'tr', flag: '🇹🇷', label: 'TR' },
  { code: 'ru', flag: '🇷🇺', label: 'RU' },
  { code: 'ja', flag: '🇯🇵', label: 'JA' },
  { code: 'ar', flag: '🇸🇦', label: 'AR' },
];

function buildSwitcher() {
  const current = getCurrentLang();
  const currentLang = LANGS.find(l => l.code === current) || LANGS[0];

  const wrapper = document.createElement('div');
  wrapper.className = 'relative flex items-center';
  wrapper.setAttribute('id', 'lang-switcher');

  const btn = document.createElement('button');
  btn.className = 'flex items-center gap-1.5 px-3 py-3 text-xs font-display font-semibold uppercase tracking-[0.1em] text-white hover:bg-sea-700 transition-colors duration-150';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Select language');
  btn.innerHTML = `<span class="text-base leading-none">${currentLang.flag}</span><span>${currentLang.label}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60"><path d="m6 9 6 6 6-6"/></svg>`;

  const dropdown = document.createElement('ul');
  dropdown.className = 'absolute top-full right-0 z-50 min-w-[120px] py-1 rounded-md shadow-deep overflow-hidden hidden';
  dropdown.style.cssText = 'background:#0a2e4c;border:1px solid rgba(255,255,255,0.12);';
  dropdown.setAttribute('role', 'listbox');

  LANGS.forEach(lang => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', lang.code === current ? 'true' : 'false');

    const isActive = lang.code === current;
    li.className = 'flex items-center gap-2 px-4 py-2.5 text-xs font-display font-semibold uppercase tracking-[0.1em] cursor-pointer transition-colors duration-150 ' +
      (isActive ? 'text-sun-400 bg-white/8' : 'text-white/80 hover:bg-sea-700 hover:text-white');

    li.innerHTML = `<span class="text-base leading-none">${lang.flag}</span><span>${lang.label}</span>`;

    li.addEventListener('click', async () => {
      await setLang(lang.code);
      closeDropdown();
      refreshSwitcher(wrapper, lang);
    });

    dropdown.appendChild(li);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('hidden');
    closeAllDropdowns();
    if (isOpen) {
      dropdown.classList.remove('hidden');
      btn.setAttribute('aria-expanded', 'true');
    }
  });

  function closeDropdown() {
    dropdown.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
  }

  wrapper.appendChild(btn);
  wrapper.appendChild(dropdown);

  document.addEventListener('langchange', (e) => {
    const lang = LANGS.find(l => l.code === e.detail.lang) || LANGS[0];
    refreshSwitcher(wrapper, lang);
  });

  return wrapper;
}

function refreshSwitcher(wrapper, lang) {
  const btn = wrapper.querySelector('button');
  if (btn) {
    btn.innerHTML = `<span class="text-base leading-none">${lang.flag}</span><span>${lang.label}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60"><path d="m6 9 6 6 6-6"/></svg>`;
  }
  const items = wrapper.querySelectorAll('[role="option"]');
  items.forEach((item, i) => {
    const isActive = LANGS[i] && LANGS[i].code === lang.code;
    item.setAttribute('aria-selected', isActive ? 'true' : 'false');
    item.className = 'flex items-center gap-2 px-4 py-2.5 text-xs font-display font-semibold uppercase tracking-[0.1em] cursor-pointer transition-colors duration-150 ' +
      (isActive ? 'text-sun-400 bg-white/8' : 'text-white/80 hover:bg-sea-700 hover:text-white');
  });
}

function closeAllDropdowns() {
  document.querySelectorAll('#lang-switcher [role="listbox"]').forEach(d => {
    d.classList.add('hidden');
  });
  document.querySelectorAll('#lang-switcher button[aria-haspopup]').forEach(b => {
    b.setAttribute('aria-expanded', 'false');
  });
}

document.addEventListener('click', closeAllDropdowns);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllDropdowns();
});

export function mountLangSwitcher(targetSelector) {
  const target = typeof targetSelector === 'string'
    ? document.querySelector(targetSelector)
    : targetSelector;

  if (!target) {
    console.warn('[lang-switcher] Mount target not found:', targetSelector);
    return;
  }

  target.appendChild(buildSwitcher());
}

document.addEventListener('DOMContentLoaded', () => {
  mountLangSwitcher('#lang-switcher-mount');
});
