/* Kalkan Info — Admin Panel
   Tüm içerik JSON dosyalarını localStorage üzerinden yönetir.
   Değişiklikler "Tüm Değişiklikleri İndir" ile JSON olarak yedeklenir,
   kullanıcı bu dosyaları data/ klasörüne basarak canlıya yükler.
*/

const DATA_FILES = ['plajlar','villalar','turlar','restoranlar','hizmetler','haberler','config'];
const LS_KEY = 'kalkan_info_admin_v1';
// SECURITY 2026-05-15 (T2.5): Auth tamamen Supabase Auth + app_metadata.role='admin' claim'ine taşındı.
// admin.html sayfa yüklenmeden önce js/admin-auth.js → requireAdmin() çağırıyor; bu script
// SADECE auth doğrulandıktan sonra DOM'a inject ediliyor.
// Eski sessionStorage('kalkan_info_session') / hardcoded password pattern'i KALDIRILDI.

// ========== State ==========
const state = {
  data: {},        // {plajlar:{...}, villalar:{...}, ...}
  page: 'dashboard',
  loaded: false
};

// ========== Bootstrap ==========
async function bootstrap() {
  try {
    await loadAllData();
    showApp();
  } catch (err) {
    console.error('[admin] bootstrap failed', err);
    _renderBootstrapError(err);
  }
}

function _renderBootstrapError(err) {
  const guard = document.getElementById('auth-guard');
  if (!guard) return;
  guard.innerHTML = `
    <div style="max-width:480px;text-align:center;color:white;padding:2rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;">
      <div style="font-size:42px;margin-bottom:0.5rem;">⚠️</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 0.5rem;">Panel yüklenemedi</h1>
      <p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,0.7);margin:0 0 1.25rem;font-family:monospace;word-break:break-word;">${String(err && err.message || err).slice(0, 300)}</p>
      <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
        <button id="ki-admin-clear-cache" style="padding:0.625rem 1.25rem;background:#f4b53d;color:#11304d;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;">Cache Temizle &amp; Yeniden Dene</button>
        <a href="/login.html" style="display:inline-block;padding:0.625rem 1.25rem;background:rgba(255,255,255,0.1);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Tekrar Giriş Yap</a>
      </div>
    </div>`;
  document.getElementById('ki-admin-clear-cache')?.addEventListener('click', () => {
    try { localStorage.removeItem(LS_KEY); } catch {}
    try { localStorage.removeItem('kalkan_info_admin_verify_v1'); } catch {}
    location.reload();
  });
}

async function loadAllData() {
  // Önce localStorage, yoksa data/ JSON dosyalarından
  const cached = localStorage.getItem(LS_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        state.data = parsed;
        state.loaded = true;
        normalizeAllGalleries();
        return;
      }
      throw new Error('cache invalid shape');
    } catch (e) {
      console.warn('[admin] localStorage cache bozuk, temizleniyor', e);
      try { localStorage.removeItem(LS_KEY); } catch {}
    }
  }
  for (const file of DATA_FILES) {
    try {
      const res = await fetch(`data/${file}.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data[file] = await res.json();
    } catch(e) {
      console.error(`Yükleme hatası: ${file}`, e);
      state.data[file] = { items: [] };
    }
  }
  normalizeAllGalleries();
  saveLocal();
  state.loaded = true;
}

// Tüm içerik tiplerinde gallery normalleştirmesi:
// - gallery yoksa ama image varsa → gallery:[{url:image,alt:name}]
// - gallery varsa, string elemanlar varsa {url,alt:''} objesine çevir
function normalizeAllGalleries() {
  ['plajlar','villalar','turlar','restoranlar','hizmetler','haberler'].forEach(key => {
    const items = state.data[key]?.items || [];
    items.forEach(it => {
      let g = it.gallery;
      if (!Array.isArray(g) || !g.length) {
        g = it.image ? [{ url: it.image, alt: it.name || it.title || '' }] : [];
      } else {
        g = g.map(x => typeof x === 'string' ? { url: x, alt: it.name || it.title || '' } : x);
      }
      it.gallery = g;
      // legacy image alanı her zaman gallery[0].url ile sync
      it.image = g[0]?.url || '';
    });
  });
}

function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state.data));
  } catch (e) {
    console.warn('[admin] localStorage quota — cache yazılamadı', e);
  }
}

// ========== App ==========
function showApp() {
  document.getElementById('app-shell').classList.remove('hidden');
  document.getElementById('app-shell').style.display = 'flex';
  bindNav();
  bindHeader();
  navigate('dashboard');
}

// ========== Nav ==========
function bindNav() {
  document.querySelectorAll('.sidebar-link').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.page); });
  });
  document.getElementById('logout-btn').addEventListener('click', () => {
    // Auth admin.html üzerinden requireAdmin()/adminSignOut() ile yönetiliyor
    if (typeof window.__ADMIN_SIGNOUT__ === 'function') {
      window.__ADMIN_SIGNOUT__();
    } else {
      location.href = '/login.html';
    }
  });
}

function bindHeader() {
  document.getElementById('preview-btn').addEventListener('click', () => {
    window.open('index.html', '_blank');
  });
  document.getElementById('save-btn').addEventListener('click', exportAll);
  // Mobile sidebar toggle
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const menuBtn = document.getElementById('mobile-menu-btn');
  const closeSidebar = () => sidebar?.classList.remove('open');
  menuBtn?.addEventListener('click', () => sidebar?.classList.toggle('open'));
  backdrop?.addEventListener('click', closeSidebar);
  // Sidebar link tıklandığında mobilde otomatik kapat
  document.querySelectorAll('.sidebar-link').forEach(a => a.addEventListener('click', () => {
    if (window.innerWidth < 768) closeSidebar();
  }));
}

function navigate(page) {
  state.page = page;
  document.querySelectorAll('.sidebar-link').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
  const titles = {
    dashboard:'Anasayfa',
    config:'Site Ayarları',
    plajlar:'Plajlar',
    villalar:'Villalar',
    turlar:'Turlar',
    restoranlar:'Restoranlar',
    haberler:'Haberler',
    hizmetler:'Hizmet Listesi',
    eczane:'Bugün Nöbetçi Eczane',
    acil:'Acil Numaralar',
    taksi:'Taksi Durakları',
    kayip:'Kayıp & Bulunan Eşya',
    export:'Yedekle / İndir',
    import:'Geri Yükle',
    onaylar:'Kullanıcı Başvuruları'
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  document.getElementById('page-subtitle').textContent = pageSubtitle(page);
  renderPage(page);
}

function pageSubtitle(p) {
  const m = {
    dashboard: 'Site içeriğine genel bakış.',
    config: 'Logo, marka, iletişim bilgileri ve kahramanlığı düzenle.',
    plajlar: 'Plaj kayıtlarını ekle, düzenle, sil.',
    villalar: 'Villa kayıtlarını yönet.',
    turlar: 'Tekne, safari, at ve kano turlarını düzenle.',
    restoranlar: 'Restoran listesini yönet.',
    haberler: 'Haber ve duyuruları yayınla.',
    hizmetler: 'Genel hizmet listesi.',
    eczane: 'Bugün nöbetçi eczaneyi güncelle.',
    acil: 'Acil durum numaraları.',
    taksi: 'Taksi durakları listesi.',
    kayip: 'Kayıp / bulunan eşya kayıtları.',
    export: 'Tüm verileri JSON olarak indir.',
    import: 'Daha önce indirilmiş JSON dosyalarını içe aktar.',
    onaylar:'Kullanıcıların gönderdiği işletme/hizmet kayıtlarını incele, onayla veya reddet.'
  };
  return m[p] || '';
}

// ========== Render Page Dispatcher ==========
function renderPage(page) {
  const body = document.getElementById('page-body');
  switch(page) {
    case 'dashboard':   body.innerHTML = renderDashboard(); break;
    case 'config':      body.innerHTML = renderConfig(); bindConfigForm(); break;
    case 'plajlar':     body.innerHTML = renderListPage('plajlar', PLAJ_SCHEMA); bindListPage('plajlar', PLAJ_SCHEMA); break;
    case 'villalar':    body.innerHTML = renderListPage('villalar', VILLA_SCHEMA); bindListPage('villalar', VILLA_SCHEMA); break;
    case 'turlar':      body.innerHTML = renderListPage('turlar', TUR_SCHEMA); bindListPage('turlar', TUR_SCHEMA); break;
    case 'restoranlar': body.innerHTML = renderListPage('restoranlar', RESTORAN_SCHEMA); bindListPage('restoranlar', RESTORAN_SCHEMA); break;
    case 'haberler':    body.innerHTML = renderListPage('haberler', HABER_SCHEMA); bindListPage('haberler', HABER_SCHEMA); break;
    case 'hizmetler':   body.innerHTML = renderListPage('hizmetler', HIZMET_SCHEMA); bindListPage('hizmetler', HIZMET_SCHEMA); break;
    case 'eczane':      body.innerHTML = renderEczane(); bindEczane(); break;
    case 'acil':        body.innerHTML = renderAcil(); bindAcil(); break;
    case 'taksi':       body.innerHTML = renderTaksi(); bindTaksi(); break;
    case 'kayip':       body.innerHTML = renderKayip(); bindKayip(); break;
    case 'onaylar':     body.innerHTML = renderOnaylar(); bindOnaylar(); break;
    case 'export':      body.innerHTML = renderExport(); bindExport(); break;
    case 'import':      body.innerHTML = renderImport(); bindImport(); break;
    default: body.innerHTML = '<div class="text-ink-700/60">Sayfa bulunamadı.</div>';
  }
}

// ========== Dashboard ==========
function renderDashboard() {
  const stats = [
    { key:'plajlar', icon:'🏖️', label:'Plaj' },
    { key:'villalar', icon:'🏡', label:'Villa' },
    { key:'turlar', icon:'⛵', label:'Tur' },
    { key:'restoranlar', icon:'🍽️', label:'Restoran' },
    { key:'haberler', icon:'📰', label:'Haber' },
    { key:'hizmetler', icon:'🛠️', label:'Hizmet' }
  ].map(s => {
    const count = state.data[s.key]?.items?.length || 0;
    const featured = state.data[s.key]?.items?.filter(i => i.featured).length || 0;
    return `
      <div class="card p-5 cursor-pointer hover:shadow-lg transition" onclick="navigate('${s.key}')">
        <div class="flex items-center justify-between">
          <div class="text-3xl">${s.icon}</div>
          <div class="tag tag-sun">${featured} öne çıkan</div>
        </div>
        <div class="mt-3 text-3xl font-bold text-ink-900">${count}</div>
        <div class="text-sm text-ink-700/70">${s.label}</div>
      </div>`;
  }).join('');

  // Eczane: yeni veri kaynağı LS_KEY (kalkan_eczane_v1.today), legacy fallback hizmetler.nobetciEczane
  let ecz = state.data.hizmetler?.nobetciEczane || null;
  try {
    const eczLS = JSON.parse(localStorage.getItem(ECZ_LS_KEY) || 'null');
    if (eczLS?.today?.name) ecz = eczLS.today;
  } catch(_) {}
  const acilCount = state.data.hizmetler?.acilNumaralar?.items?.length || 0;
  const taksiCount = state.data.hizmetler?.taksiler?.items?.length || 0;
  // Kayıp & Bulunan: yeni veri kaynağı LF_KEY (kalkan_lost_found_v1)
  let kayipCount = 0;
  try { kayipCount = (JSON.parse(localStorage.getItem(LF_KEY) || '{"items":[]}').items || []).length; } catch(_) {}
  // Bekleyen başvuru sayısı (badge ile aynı kaynak)
  let pendingCount = 0;
  try { pendingCount = loadAllSubmissions().filter(p => (p.status || 'pending') === 'pending').length; } catch(_) {}

  return `
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">${stats}</div>

    ${pendingCount > 0 ? `
    <div class="card p-4 mt-6 flex items-center gap-3 border-l-4 border-amber-400 bg-amber-50/60">
      <div class="text-2xl">⏳</div>
      <div class="flex-1">
        <div class="text-sm font-semibold text-ink-900">${pendingCount} bekleyen başvuru</div>
        <div class="text-xs text-ink-700/70">Kullanıcı gönderimi onay bekliyor.</div>
      </div>
      <button class="btn btn-primary text-xs" onclick="navigate('onaylar')">İncele</button>
    </div>` : ''}

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      <div class="card p-5">
        <div class="flex items-center gap-2 text-sm font-semibold text-ink-900 mb-3"><span>💊</span>Bugün Nöbetçi</div>
        <div class="text-lg font-bold text-ink-900 truncate">${ecz?.name || '—'}</div>
        <div class="text-xs text-ink-700/70 mt-1 line-clamp-1">${ecz?.address || ''}</div>
        <button class="btn btn-ghost mt-3 text-xs" onclick="navigate('eczane')">Düzenle</button>
      </div>
      <div class="card p-5">
        <div class="flex items-center gap-2 text-sm font-semibold text-ink-900 mb-3"><span>🚨</span>Acil Numaralar</div>
        <div class="text-2xl font-bold text-ink-900">${acilCount}</div>
        <div class="text-xs text-ink-700/70">kayıt listede</div>
        <button class="btn btn-ghost mt-3 text-xs" onclick="navigate('acil')">Düzenle</button>
      </div>
      <div class="card p-5">
        <div class="flex items-center gap-2 text-sm font-semibold text-ink-900 mb-3"><span>🚕</span>Taksi Durakları</div>
        <div class="text-2xl font-bold text-ink-900">${taksiCount}</div>
        <div class="text-xs text-ink-700/70">durak</div>
        <button class="btn btn-ghost mt-3 text-xs" onclick="navigate('taksi')">Düzenle</button>
      </div>
      <div class="card p-5">
        <div class="flex items-center gap-2 text-sm font-semibold text-ink-900 mb-3"><span>🔍</span>Kayıp & Bulunan</div>
        <div class="text-2xl font-bold text-ink-900">${kayipCount}</div>
        <div class="text-xs text-ink-700/70">aktif ilan</div>
        <button class="btn btn-ghost mt-3 text-xs" onclick="navigate('kayip')">Düzenle</button>
      </div>
    </div>

    <div class="card p-5 mt-6">
      <div class="flex items-center justify-between mb-3">
        <div class="text-sm font-semibold text-ink-900">Hızlı Erişim</div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-ghost" onclick="navigate('config')">⚙️ Site Ayarları</button>
        <button class="btn btn-ghost" onclick="openAdd('plajlar', PLAJ_SCHEMA)">➕ Plaj Ekle</button>
        <button class="btn btn-ghost" onclick="openAdd('villalar', VILLA_SCHEMA)">➕ Villa Ekle</button>
        <button class="btn btn-ghost" onclick="openAdd('restoranlar', RESTORAN_SCHEMA)">➕ Restoran Ekle</button>
        <button class="btn btn-ghost" onclick="openAdd('turlar', TUR_SCHEMA)">➕ Tur Ekle</button>
        <button class="btn btn-ghost" onclick="openAdd('hizmetler', HIZMET_SCHEMA)">➕ Hizmet Ekle</button>
        <button class="btn btn-ghost" onclick="openAdd('haberler', HABER_SCHEMA)">📰 Haber Ekle</button>
        <button class="btn btn-ghost" onclick="navigate('export')">📤 Yedekle</button>
      </div>
    </div>`;
}

// ========== Config Page ==========
function renderConfig() {
  const c = state.data.config || {};
  const site = c.site || {};
  const contact = c.contact || {};
  const hero = c.hero || {};
  const footer = c.footer || {};
  return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card p-5">
        <div class="text-sm font-semibold text-ink-900 mb-3">Marka & Site</div>
        <label class="text-xs font-semibold text-ink-700/80">Site Adı</label>
        <input id="cf-name" type="text" value="${site.name||''}" class="mb-3" />
        <label class="text-xs font-semibold text-ink-700/80">Slogan</label>
        <input id="cf-tagline" type="text" value="${site.tagline||''}" class="mb-3" />
        <label class="text-xs font-semibold text-ink-700/80">Birincil Renk (HEX)</label>
        <input id="cf-pcolor" type="text" value="${site.primaryColor||''}" class="mb-3" />
        <label class="text-xs font-semibold text-ink-700/80">Vurgu Rengi (HEX)</label>
        <input id="cf-acolor" type="text" value="${site.accentColor||''}" class="mb-3" />
        <label class="text-xs font-semibold text-ink-700/80">Logo</label>
        <div class="flex items-center gap-3 mb-3">
          <div id="cf-logo-thumb" class="w-16 h-16 rounded border border-ink-700/10 bg-ink-700/5 grid place-items-center text-2xl overflow-hidden flex-shrink-0">
            ${site.logo ? `<img src="${escapeHtml(site.logo)}" class="w-full h-full object-contain" alt="logo">` : '🏷️'}
          </div>
          <div class="flex-1">
            <input id="cf-logo" type="url" placeholder="https://... veya Dosya Yükle" value="${site.logo||''}" class="mb-1" />
            <div class="flex items-center gap-2">
              <label class="btn btn-primary text-xs cursor-pointer" style="padding:4px 10px;">
                📁 Dosya Yükle
                <input type="file" accept="image/*" style="display:none" onchange="cfgUploadImage(event,'cf-logo','cf-logo-thumb',512)">
              </label>
              ${site.logo ? `<button class="btn btn-ghost text-xs" style="padding:4px 10px;color:#c0392b;" onclick="cfgClearImage('cf-logo','cf-logo-thumb','🏷️')">Kaldır</button>` : ''}
            </div>
          </div>
        </div>
        <label class="text-xs font-semibold text-ink-700/80">Favicon</label>
        <div class="flex items-center gap-3">
          <div id="cf-favicon-thumb" class="w-12 h-12 rounded border border-ink-700/10 bg-ink-700/5 grid place-items-center text-xl overflow-hidden flex-shrink-0">
            ${site.favicon ? `<img src="${escapeHtml(site.favicon)}" class="w-full h-full object-contain" alt="favicon">` : '🌐'}
          </div>
          <div class="flex-1">
            <input id="cf-favicon" type="url" placeholder="https://... veya Dosya Yükle" value="${site.favicon||''}" class="mb-1" />
            <div class="flex items-center gap-2">
              <label class="btn btn-primary text-xs cursor-pointer" style="padding:4px 10px;">
                📁 Dosya Yükle
                <input type="file" accept="image/*" style="display:none" onchange="cfgUploadImage(event,'cf-favicon','cf-favicon-thumb',128)">
              </label>
              ${site.favicon ? `<button class="btn btn-ghost text-xs" style="padding:4px 10px;color:#c0392b;" onclick="cfgClearImage('cf-favicon','cf-favicon-thumb','🌐')">Kaldır</button>` : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="card p-5">
        <div class="text-sm font-semibold text-ink-900 mb-3">İletişim</div>
        <label class="text-xs font-semibold text-ink-700/80">E-posta</label>
        <input id="cf-email" type="text" value="${contact.email||''}" class="mb-3" />
        <label class="text-xs font-semibold text-ink-700/80">Telefon</label>
        <input id="cf-phone" type="text" value="${contact.phone||''}" class="mb-3" />
        <label class="text-xs font-semibold text-ink-700/80">WhatsApp</label>
        <input id="cf-wapp" type="text" value="${contact.whatsapp||''}" class="mb-3" />
        <label class="text-xs font-semibold text-ink-700/80">Adres</label>
        <input id="cf-address" type="text" value="${contact.address||''}" class="mb-3" />
        <label class="text-xs font-semibold text-ink-700/80">Instagram URL</label>
        <input id="cf-ig" type="url" value="${contact.instagram||''}" class="mb-3" />
        <label class="text-xs font-semibold text-ink-700/80">Facebook URL</label>
        <input id="cf-fb" type="url" value="${contact.facebook||''}" />
      </div>
      <div class="card p-5">
        <div class="text-sm font-semibold text-ink-900 mb-3">Hero (Ana Sayfa)</div>
        <label class="text-xs font-semibold text-ink-700/80">Hero Görsel</label>
        <div class="flex items-center gap-3 mb-3">
          <div id="cf-hero-thumb" class="w-24 h-16 rounded border border-ink-700/10 bg-ink-700/5 grid place-items-center text-2xl overflow-hidden flex-shrink-0">
            ${hero.image ? `<img src="${escapeHtml(hero.image)}" class="w-full h-full object-cover" alt="hero">` : '🖼️'}
          </div>
          <div class="flex-1">
            <input id="cf-hero" type="url" placeholder="https://... veya Dosya Yükle" value="${hero.image||''}" class="mb-1" />
            <div class="flex items-center gap-2">
              <label class="btn btn-primary text-xs cursor-pointer" style="padding:4px 10px;">
                📁 Dosya Yükle
                <input type="file" accept="image/*" style="display:none" onchange="cfgUploadImage(event,'cf-hero','cf-hero-thumb',1920)">
              </label>
              ${hero.image ? `<button class="btn btn-ghost text-xs" style="padding:4px 10px;color:#c0392b;" onclick="cfgClearImage('cf-hero','cf-hero-thumb','🖼️')">Kaldır</button>` : ''}
            </div>
          </div>
        </div>
        <label class="flex items-center gap-2 mt-2 text-sm">
          <input id="cf-weather" type="checkbox" ${hero.showWeather?'checked':''}>
          Hava durumu göster
        </label>
      </div>
      <div class="card p-5">
        <div class="text-sm font-semibold text-ink-900 mb-3">Footer</div>
        <label class="text-xs font-semibold text-ink-700/80">Hakkında metni</label>
        <textarea id="cf-about" rows="5">${footer.about||''}</textarea>
      </div>
    </div>
    <div class="mt-6 flex gap-2">
      <button class="btn btn-primary" id="cf-save">💾 Kaydet</button>
      <button class="btn btn-ghost" onclick="navigate('dashboard')">İptal</button>
    </div>
  `;
}

function bindConfigForm() {
  document.getElementById('cf-save').addEventListener('click', () => {
    const c = state.data.config = state.data.config || {};
    c.site = c.site || {}; c.contact = c.contact || {}; c.hero = c.hero || {}; c.footer = c.footer || {};
    c.site.name = val('cf-name');
    c.site.tagline = val('cf-tagline');
    c.site.primaryColor = val('cf-pcolor');
    c.site.accentColor = val('cf-acolor');
    c.site.logo = val('cf-logo');
    c.site.favicon = val('cf-favicon');
    c.contact.email = val('cf-email');
    c.contact.phone = val('cf-phone');
    c.contact.whatsapp = val('cf-wapp');
    c.contact.address = val('cf-address');
    c.contact.instagram = val('cf-ig');
    c.contact.facebook = val('cf-fb');
    c.hero.image = val('cf-hero');
    c.hero.showWeather = document.getElementById('cf-weather').checked;
    c.footer.about = val('cf-about');
    saveLocal();
    toast('Site ayarları kaydedildi.');
  });
}

// ========== List Page (Plajlar / Villalar / Turlar / Restoranlar / Haberler / Hizmetler) ==========
function renderListPage(key, schema) {
  const data = state.data[key] || { items: [] };
  const items = data.items || [];
  const cats = data.categories || [];

  const filterBar = `
    <div class="card p-4 flex flex-wrap items-center gap-2 mb-4">
      <input id="search-${key}" type="text" placeholder="Ara: ${schema.searchHint || 'isim, kategori...'}" class="flex-1 min-w-[200px] max-w-md" />
      ${cats.length ? `<select id="cat-${key}"><option value="">Tüm Kategoriler</option>${cats.map(c=>`<option>${c}</option>`).join('')}</select>` : ''}
      <button class="btn btn-primary ml-auto" onclick="openAdd('${key}', ${schema.name})">➕ Yeni Ekle</button>
    </div>`;

  return `
    ${filterBar}
    <div class="card overflow-hidden">
      <table>
        <thead>
          <tr>
            <th style="width:60px">Görsel</th>
            <th>İsim</th>
            <th>Kategori</th>
            ${schema.extraColumns ? schema.extraColumns.map(c => `<th>${c.label}</th>`).join('') : ''}
            <th>Öne Çıkan</th>
            <th style="width:140px">İşlem</th>
          </tr>
        </thead>
        <tbody id="tbl-${key}">
          ${renderTbody(key, items, schema)}
        </tbody>
      </table>
    </div>
    <div id="empty-${key}" class="${items.length?'hidden':''} text-center py-12 text-ink-700/60 text-sm">Henüz kayıt yok. Sağ üstten yeni ekleyebilirsiniz.</div>
  `;
}

function renderTbody(key, items, schema) {
  return items.map((it) => {
    const img = it.image ? `<img src="${it.image}" class="w-12 h-12 object-cover rounded" />` : '<div class="w-12 h-12 rounded bg-ink-700/10 grid place-items-center text-lg">📷</div>';
    const cat = it.category ? `<span class="tag">${escapeHtml(it.category)}</span>` : '';
    const extras = schema.extraColumns ? schema.extraColumns.map(c => `<td>${formatField(it[c.field], c.format)}</td>`).join('') : '';
    const userBadge = it.__userSubmitted ? '<span class="tag" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;">👤 Kullanıcı</span>' : '';
    const star = it.featured ? '<span class="tag tag-sun">★ Öne</span>' : '<span class="tag tag-mute">—</span>';
    const title = it.name || it.title || '—';
    // ID-based lookup — filter sonrası yanlış kayıt açılmasın
    const recId = String(it.id || '').replace(/'/g, "\\'");
    return `
      <tr>
        <td>${img}</td>
        <td><div class="font-semibold text-ink-900">${escapeHtml(title)} ${userBadge}</div><div class="text-xs text-ink-700/60">${escapeHtml((it.summary||'').slice(0,80))}</div></td>
        <td>${cat}</td>
        ${extras}
        <td>${star}</td>
        <td>
          <button class="btn btn-ghost text-xs" onclick="openEdit('${key}', '${recId}', ${schema.name})">Düzenle</button>
          <button class="btn btn-danger text-xs" onclick="deleteItem('${key}', '${recId}')">Sil</button>
        </td>
      </tr>`;
  }).join('');
}

function formatField(v, fmt) {
  if (v == null || v === '') return '—';
  if (fmt === 'array') return (Array.isArray(v) ? v.slice(0,2).join(', ') : v);
  return escapeHtml(String(v));
}

function bindListPage(key, schema) {
  const search = document.getElementById(`search-${key}`);
  const catSel = document.getElementById(`cat-${key}`);
  const apply = () => {
    const q = (search?.value || '').toLowerCase();
    const cat = catSel?.value || '';
    let items = state.data[key]?.items || [];
    if (q) items = items.filter(it => JSON.stringify(it).toLowerCase().includes(q));
    if (cat) items = items.filter(it => it.category === cat);
    document.getElementById(`tbl-${key}`).innerHTML = renderTbody(key, items, schema);
    document.getElementById(`empty-${key}`).classList.toggle('hidden', items.length>0);
  };
  search?.addEventListener('input', apply);
  catSel?.addEventListener('change', apply);
}

// ========== CRUD via Modal Form ==========
function openAdd(key, schema) {
  openForm(key, null, schema);
}
function openEdit(key, idOrIdx, schema) {
  // ID veya index alabilir — id ise gerçek index'e çevir
  let idx = idOrIdx;
  if (typeof idOrIdx === 'string' && state.data[key]?.items) {
    idx = state.data[key].items.findIndex(i => String(i.id) === idOrIdx);
    if (idx < 0) { alert('Kayıt bulunamadı.'); return; }
  }
  openForm(key, idx, schema);
}

function openForm(key, idx, schema) {
  const isEdit = idx !== null;
  const item = isEdit ? structuredClone(state.data[key].items[idx]) : schema.defaults();
  const fields = schema.fields(state.data[key]).map(f => fieldHtml(f, item[f.key])).join('');
  const inner = document.getElementById('modal-inner');
  inner.innerHTML = `
    <div class="px-6 py-4 border-b border-ink-700/8 flex items-center justify-between">
      <div class="font-semibold text-ink-900">${isEdit ? 'Düzenle' : 'Yeni Ekle'}</div>
      <button class="text-ink-700/60 hover:text-bad-500 text-xl" onclick="closeModal()">×</button>
    </div>
    <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4" id="form-fields">
      ${fields}
    </div>
    <div class="px-6 py-4 border-t border-ink-700/8 flex justify-end gap-2">
      <button class="btn btn-ghost" onclick="closeModal()">İptal</button>
      <button class="btn btn-primary" id="form-save">💾 ${isEdit?'Güncelle':'Ekle'}</button>
    </div>
  `;
  document.getElementById('modal').classList.remove('hidden');
  // Gallery alanları için drag-drop (sıralama) ve dosya dropzone bind
  schema.fields(state.data[key]).forEach(f => {
    if (f.type === 'gallery') {
      bindGalleryDnD(`f-${f.key}`);
      bindGalleryDropzone(`f-${f.key}`);
    }
  });
  document.getElementById('form-save').addEventListener('click', () => {
    const out = {};
    schema.fields(state.data[key]).forEach(f => { out[f.key] = readField(f, item[f.key]); });
    if (!out.id && schema.idFromName) out.id = slugify(out.name || out.title || 'kayit-' + Date.now());
    // Gallery → legacy image sync (kapak)
    if (Array.isArray(out.gallery)) out.image = out.gallery[0]?.url || '';
    if (isEdit) state.data[key].items[idx] = { ...state.data[key].items[idx], ...out };
    else state.data[key].items.push(out);
    saveLocal();
    closeModal();
    renderPage(state.page);
    toast(isEdit ? 'Güncellendi.' : 'Yeni kayıt eklendi.');
  });
}

function fieldHtml(f, v) {
  const id = `f-${f.key}`;
  const span = f.full ? 'md:col-span-2' : '';
  if (f.type === 'textarea') {
    return `<div class="${span}"><label class="text-xs font-semibold text-ink-700/80">${f.label}</label><textarea id="${id}" rows="${f.rows||3}">${escapeHtml(v||'')}</textarea></div>`;
  }
  if (f.type === 'select') {
    const opts = (f.options||[]).map(o => `<option ${o===v?'selected':''}>${o}</option>`).join('');
    return `<div class="${span}"><label class="text-xs font-semibold text-ink-700/80">${f.label}</label><select id="${id}">${opts}</select></div>`;
  }
  if (f.type === 'checkbox') {
    return `<div class="${span} flex items-center gap-2 pt-5"><input type="checkbox" id="${id}" ${v?'checked':''}><label for="${id}" class="text-sm">${f.label}</label></div>`;
  }
  if (f.type === 'array') {
    return `<div class="${span}"><label class="text-xs font-semibold text-ink-700/80">${f.label} <span class="text-ink-700/50">(virgülle ayır)</span></label><input id="${id}" type="text" value="${escapeHtml((v||[]).join(', '))}" /></div>`;
  }
  if (f.type === 'number') {
    return `<div class="${span}"><label class="text-xs font-semibold text-ink-700/80">${f.label}</label><input id="${id}" type="number" step="${f.step||1}" value="${v||0}" /></div>`;
  }
  if (f.type === 'gallery') {
    const items = Array.isArray(v) ? v : [];
    const itemsHtml = items.map((g, i) => galleryRowHtml(id, g, i)).join('');
    return `
      <div class="${span}">
        <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <label class="text-xs font-semibold text-ink-700/80">${f.label} <span class="text-ink-700/50">(ilk görsel kapak olur — sürükle/oklarla sırala)</span></label>
          <div class="flex items-center gap-2">
            <button type="button" class="btn btn-ghost text-xs" onclick="galleryAdd('${id}')">+ URL Ekle</button>
            <label class="btn btn-primary text-xs cursor-pointer" title="Bilgisayardan yükle (otomatik sıkıştırılır)">
              📁 Dosya Yükle
              <input type="file" accept="image/*" multiple style="display:none" onchange="galleryUpload('${id}', this.files); this.value='';">
            </label>
          </div>
        </div>
        <div id="${id}-list" class="space-y-2 border border-ink-700/10 rounded-md p-2 bg-ink-700/2 gallery-dropzone" data-field="${id}">${itemsHtml || `<div id="${id}-empty" class="text-xs text-ink-700/50 text-center py-4">Henüz görsel yok. Yukarıdan dosya yükle veya URL ekle. Sürükle-bırak da yapabilirsin.</div>`}</div>
        <div id="${id}-progress" class="text-[11px] text-ink-700/60 mt-1 hidden"></div>
      </div>`;
  }
  return `<div class="${span}"><label class="text-xs font-semibold text-ink-700/80">${f.label}</label><input id="${id}" type="${f.type||'text'}" value="${escapeHtml(v||'')}" placeholder="${f.placeholder||''}" /></div>`;
}

function galleryRowHtml(fieldId, g, idx) {
  const url = g?.url || '';
  const alt = g?.alt || '';
  const thumb = url
    ? `<img src="${escapeHtml(url)}" class="w-14 h-14 object-cover rounded border border-ink-700/10" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'w-14 h-14 rounded bg-ink-700/10 grid place-items-center text-lg',textContent:'⚠️'}))" />`
    : `<div class="w-14 h-14 rounded bg-ink-700/10 grid place-items-center text-lg">📷</div>`;
  return `
    <div class="gallery-row flex items-start gap-2" data-idx="${idx}" draggable="true">
      <div class="flex flex-col items-center gap-1 pt-1">
        <span class="cursor-grab text-ink-700/40 select-none" title="Sürükle">⋮⋮</span>
        <div class="flex flex-col">
          <button type="button" class="text-ink-700/60 hover:text-sea-600 text-xs leading-none" onclick="galleryMove('${fieldId}', ${idx}, -1)" title="Yukarı">▲</button>
          <button type="button" class="text-ink-700/60 hover:text-sea-600 text-xs leading-none" onclick="galleryMove('${fieldId}', ${idx},  1)" title="Aşağı">▼</button>
        </div>
      </div>
      ${thumb}
      <div class="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-2">
        <input type="url" placeholder="Görsel URL (https://...)" value="${escapeHtml(url)}" data-gkey="url" class="text-sm" />
        <input type="text" placeholder="Açıklama (alt)" value="${escapeHtml(alt)}" data-gkey="alt" class="text-sm" />
      </div>
      <button type="button" class="text-bad-500 hover:text-bad-600 text-lg leading-none px-2" onclick="galleryRemove('${fieldId}', ${idx})" title="Sil">×</button>
    </div>`;
}

function galleryReadList(fieldId) {
  const list = document.getElementById(`${fieldId}-list`);
  if (!list) return [];
  return Array.from(list.querySelectorAll('.gallery-row')).map(row => {
    const url = row.querySelector('[data-gkey="url"]').value.trim();
    const alt = row.querySelector('[data-gkey="alt"]').value.trim();
    return { url, alt };
  }).filter(g => g.url);
}

function galleryRender(fieldId, items) {
  const list = document.getElementById(`${fieldId}-list`);
  if (!list) return;
  list.innerHTML = items.length
    ? items.map((g, i) => galleryRowHtml(fieldId, g, i)).join('')
    : `<div id="${fieldId}-empty" class="text-xs text-ink-700/50 text-center py-4">Henüz görsel yok.</div>`;
  bindGalleryDnD(fieldId);
  bindGalleryDropzone(fieldId);
}

function bindGalleryDnD(fieldId) {
  const list = document.getElementById(`${fieldId}-list`);
  if (!list) return;
  let dragIdx = null;
  list.querySelectorAll('.gallery-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragIdx = parseInt(row.dataset.idx, 10);
      row.style.opacity = '0.5';
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragIdx)); } catch(_) {}
    });
    row.addEventListener('dragend', () => { row.style.opacity = ''; dragIdx = null; });
    row.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    row.addEventListener('drop', e => {
      e.preventDefault();
      const from = dragIdx ?? parseInt(e.dataTransfer.getData('text/plain'), 10);
      const to = parseInt(row.dataset.idx, 10);
      if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
      const items = galleryReadList(fieldId);
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      galleryRender(fieldId, items);
    });
  });
}

window.galleryAdd = function(fieldId) {
  const items = galleryReadList(fieldId);
  items.push({ url: '', alt: '' });
  galleryRender(fieldId, items);
  // Yeni eklenen alanı focus'la
  requestAnimationFrame(() => {
    const list = document.getElementById(`${fieldId}-list`);
    const last = list?.querySelector('.gallery-row:last-child [data-gkey="url"]');
    last?.focus();
  });
};

window.galleryRemove = function(fieldId, idx) {
  const items = galleryReadList(fieldId);
  items.splice(idx, 1);
  galleryRender(fieldId, items);
};

window.galleryMove = function(fieldId, idx, delta) {
  const items = galleryReadList(fieldId);
  const to = idx + delta;
  if (to < 0 || to >= items.length) return;
  [items[idx], items[to]] = [items[to], items[idx]];
  galleryRender(fieldId, items);
};

// ----- Dosya yükleme + sıkıştırma -----
const GALLERY_MAX_DIM = 1600;        // px — uzun kenar
const GALLERY_QUALITY = 0.82;        // JPEG kalite
const GALLERY_MAX_FILE = 15 * 1024 * 1024; // 15MB ham dosya limiti

async function compressImage(file) {
  const img = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const ratio = Math.min(1, GALLERY_MAX_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width  * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  // PNG ise şeffaflık kaybedebilir — büyük çoğunluk için JPEG yeterli
  const isPng = /png$/i.test(file.type);
  return canvas.toDataURL(isPng && img.width*img.height < 1_000_000 ? 'image/png' : 'image/jpeg', GALLERY_QUALITY);
}

window.galleryUpload = async function(fieldId, fileList) {
  const files = Array.from(fileList || []).filter(f => /^image\//.test(f.type));
  if (!files.length) return;
  const progress = document.getElementById(`${fieldId}-progress`);
  const items = galleryReadList(fieldId);
  let added = 0, failed = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (progress) {
      progress.classList.remove('hidden');
      progress.textContent = `Yükleniyor ${i+1}/${files.length} — ${f.name} (${(f.size/1024).toFixed(0)} KB)…`;
    }
    if (f.size > GALLERY_MAX_FILE) {
      console.warn(`[gallery] ${f.name} çok büyük (${(f.size/1024/1024).toFixed(1)}MB), atlandı.`);
      failed++; continue;
    }
    try {
      const dataUrl = await compressImage(f);
      items.push({ url: dataUrl, alt: f.name.replace(/\.[^.]+$/, '') });
      added++;
    } catch (e) {
      console.error(`[gallery] ${f.name} işlenemedi:`, e);
      failed++;
    }
  }
  galleryRender(fieldId, items);
  if (progress) {
    const msg = `${added} görsel eklendi${failed?`, ${failed} başarısız`:''}.`;
    progress.textContent = msg;
    setTimeout(() => progress.classList.add('hidden'), 3000);
  }
  // localStorage doluluk uyarısı
  try {
    const usedKB = Math.round(JSON.stringify(state.data).length / 1024);
    if (usedKB > 4500) toast(`Dikkat: yerel depolama ~${usedKB} KB doldu. Yedek al.`, 'bad');
  } catch(_){}
};

function bindGalleryDropzone(fieldId) {
  const zone = document.getElementById(`${fieldId}-list`);
  if (!zone) return;
  ['dragenter','dragover'].forEach(ev => zone.addEventListener(ev, e => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      zone.style.outline = '2px dashed #1a5e93';
      zone.style.outlineOffset = '-4px';
    }
  }));
  ['dragleave','drop'].forEach(ev => zone.addEventListener(ev, e => {
    zone.style.outline = '';
    zone.style.outlineOffset = '';
  }));
  zone.addEventListener('drop', e => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    window.galleryUpload(fieldId, e.dataTransfer.files);
  });
}

function readField(f, prevValue) {
  const el = document.getElementById(`f-${f.key}`);
  if (f.type === 'gallery') return galleryReadList(`f-${f.key}`);
  if (!el) return prevValue;
  if (f.type === 'checkbox') return el.checked;
  if (f.type === 'array') return el.value.split(',').map(s=>s.trim()).filter(Boolean);
  if (f.type === 'number') return parseFloat(el.value)||0;
  return el.value.trim();
}

function deleteItem(key, idOrIdx) {
  let idx = idOrIdx;
  if (typeof idOrIdx === 'string' && state.data[key]?.items) {
    idx = state.data[key].items.findIndex(i => String(i.id) === idOrIdx);
    if (idx < 0) return;
  }
  const it = state.data[key].items[idx];
  if (!it) return;
  if (!confirm(`"${it.name||it.title||'Bu kayıt'}" silinsin mi?`)) return;
  state.data[key].items.splice(idx, 1);
  saveLocal();
  renderPage(state.page);
  toast('Silindi.');
}

function closeModal() { document.getElementById('modal').classList.add('hidden'); }

// ========== Special: Eczane / Acil / Taksi / Kayıp ==========
// Eczane verisi kalkan_eczane_v1 key'iyle localStorage'a kaydedilir.
// index.html bu key'i önce okur, yoksa data/eczane.json'a fallback yapar.
const ECZ_LS_KEY = 'kalkan_eczane_v1';

function loadEczaneLS() {
  try {
    const raw = localStorage.getItem(ECZ_LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function renderEczane() {
  const saved = loadEczaneLS() || {};
  const t = saved.today || {};
  const tm = saved.tomorrow || {};
  // Bugünün tarihi (YYYY-MM-DD) — varsayılan değer için
  const bugun = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  const yarin = new Date(Date.now() + 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  return `
    <div class="space-y-6 max-w-2xl">
      <!-- BUGÜN -->
      <div class="card p-6">
        <div class="flex items-center gap-2 text-sm font-semibold text-ink-900 mb-4"><span>💊</span>Bugün Nöbetçi Eczane</div>
        <div class="grid grid-cols-1 gap-3">
          <div>
            <label class="text-xs font-semibold text-ink-700/80 block mb-1">Tarih (YYYY-MM-DD)</label>
            <input id="ecz-today-date" type="text" value="${t.date || bugun}" />
          </div>
          <div>
            <label class="text-xs font-semibold text-ink-700/80 block mb-1">Eczane Adı</label>
            <input id="ecz-today-name" type="text" value="${t.name || ''}" />
          </div>
          <div>
            <label class="text-xs font-semibold text-ink-700/80 block mb-1">Adres</label>
            <textarea id="ecz-today-address" rows="2">${t.address || ''}</textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-semibold text-ink-700/80 block mb-1">Telefon (görünür)</label>
              <input id="ecz-today-phone" type="tel" value="${t.phone || ''}" />
            </div>
            <div>
              <label class="text-xs font-semibold text-ink-700/80 block mb-1">Telefon (raw, rakam)</label>
              <input id="ecz-today-phoneRaw" type="text" value="${t.phoneRaw || ''}" placeholder="02428443112" />
            </div>
          </div>
          <div>
            <label class="text-xs font-semibold text-ink-700/80 block mb-1">Google Maps URL</label>
            <input id="ecz-today-mapUrl" type="url" value="${t.mapUrl || ''}" />
          </div>
          <div>
            <label class="text-xs font-semibold text-ink-700/80 block mb-1">Çalışma Saati (opsiyonel)</label>
            <input id="ecz-today-hours" type="text" value="${t.hours || ''}" placeholder="09:00 (kapanış sonrası 24 saat nöbetçi)" />
          </div>
        </div>
      </div>

      <!-- YARIN -->
      <div class="card p-6">
        <div class="flex items-center gap-2 text-sm font-semibold text-ink-900 mb-4"><span>📅</span>Yarın Nöbetçi Eczane (opsiyonel)</div>
        <div class="grid grid-cols-1 gap-3">
          <div>
            <label class="text-xs font-semibold text-ink-700/80 block mb-1">Tarih (YYYY-MM-DD)</label>
            <input id="ecz-tmr-date" type="text" value="${tm.date || yarin}" />
          </div>
          <div>
            <label class="text-xs font-semibold text-ink-700/80 block mb-1">Eczane Adı</label>
            <input id="ecz-tmr-name" type="text" value="${tm.name || ''}" />
          </div>
          <div>
            <label class="text-xs font-semibold text-ink-700/80 block mb-1">Adres</label>
            <textarea id="ecz-tmr-address" rows="2">${tm.address || ''}</textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-semibold text-ink-700/80 block mb-1">Telefon (görünür)</label>
              <input id="ecz-tmr-phone" type="tel" value="${tm.phone || ''}" />
            </div>
            <div>
              <label class="text-xs font-semibold text-ink-700/80 block mb-1">Telefon (raw, rakam)</label>
              <input id="ecz-tmr-phoneRaw" type="text" value="${tm.phoneRaw || ''}" placeholder="02428443050" />
            </div>
          </div>
          <div>
            <label class="text-xs font-semibold text-ink-700/80 block mb-1">Google Maps URL</label>
            <input id="ecz-tmr-mapUrl" type="url" value="${tm.mapUrl || ''}" />
          </div>
        </div>
      </div>

      <button id="ecz-save" class="btn btn-primary">💾 Kaydet (localStorage)</button>
      <p class="text-xs text-ink-700/50 mt-1">Kaydedilen veri tarayıcıda saklanır. Site anında güncellenir. JSON dosyasını kalıcı güncellemek için "Tüm Değişiklikleri İndir" butonunu kullan.</p>
    </div>`;
}

function bindEczane() {
  document.getElementById('ecz-save').addEventListener('click', () => {
    const eczaneData = {
      _meta: {
        title: 'Bugün Nöbetçi Eczane',
        lastUpdated: new Date().toISOString()
      },
      today: {
        date:     val('ecz-today-date'),
        name:     val('ecz-today-name'),
        address:  val('ecz-today-address'),
        phone:    val('ecz-today-phone'),
        phoneRaw: val('ecz-today-phoneRaw'),
        mapUrl:   val('ecz-today-mapUrl'),
        hours:    val('ecz-today-hours')
      },
      tomorrow: {
        date:     val('ecz-tmr-date'),
        name:     val('ecz-tmr-name'),
        address:  val('ecz-tmr-address'),
        phone:    val('ecz-tmr-phone'),
        phoneRaw: val('ecz-tmr-phoneRaw'),
        mapUrl:   val('ecz-tmr-mapUrl')
      }
    };
    try {
      localStorage.setItem(ECZ_LS_KEY, JSON.stringify(eczaneData));
      toast('Nöbetçi eczane güncellendi.');
    } catch(e) {
      toast('Kayıt hatası: ' + e.message);
    }
  });
}

function renderAcil() {
  const items = state.data.hizmetler?.acilNumaralar?.items || [];
  const rows = items.map((it, i) => `
    <tr>
      <td><input data-i="${i}" data-k="icon" value="${escapeHtml(it.icon||'')}" /></td>
      <td><input data-i="${i}" data-k="name" value="${escapeHtml(it.name||'')}" /></td>
      <td><input data-i="${i}" data-k="number" value="${escapeHtml(it.number||'')}" /></td>
      <td><button class="btn btn-danger text-xs" onclick="removeAcil(${i})">Sil</button></td>
    </tr>`).join('');
  return `
    <div class="card overflow-hidden">
      <table>
        <thead><tr><th style="width:80px">İkon</th><th>Adı</th><th>Numara</th><th style="width:100px">İşlem</th></tr></thead>
        <tbody id="acil-tbody">${rows}</tbody>
      </table>
    </div>
    <div class="mt-4 flex gap-2">
      <button class="btn btn-primary" id="acil-add">➕ Yeni Numara</button>
      <button class="btn btn-success" id="acil-save">💾 Kaydet</button>
    </div>`;
}
function bindAcil() {
  document.getElementById('acil-add').addEventListener('click', () => {
    state.data.hizmetler.acilNumaralar = state.data.hizmetler.acilNumaralar || { items:[] };
    state.data.hizmetler.acilNumaralar.items.push({icon:'', name:'Yeni', number:''});
    saveLocal(); renderPage('acil');
  });
  document.getElementById('acil-save').addEventListener('click', () => {
    document.querySelectorAll('#acil-tbody input').forEach(inp => {
      const i = parseInt(inp.dataset.i); const k = inp.dataset.k;
      state.data.hizmetler.acilNumaralar.items[i][k] = inp.value;
    });
    saveLocal(); toast('Acil numaralar kaydedildi.');
  });
}
function removeAcil(i) {
  if (!confirm('Silinsin mi?')) return;
  state.data.hizmetler.acilNumaralar.items.splice(i,1);
  saveLocal(); renderPage('acil');
}

function renderTaksi() {
  const items = state.data.hizmetler?.taksiler?.items || [];
  const rows = items.map((it, i) => `
    <tr>
      <td><input data-i="${i}" data-k="name" value="${escapeHtml(it.name||'')}" /></td>
      <td><input data-i="${i}" data-k="location" value="${escapeHtml(it.location||'')}" /></td>
      <td><input data-i="${i}" data-k="phone" value="${escapeHtml(it.phone||'')}" /></td>
      <td><input data-i="${i}" data-k="phoneRaw" value="${escapeHtml(it.phoneRaw||'')}" /></td>
      <td><button class="btn btn-danger text-xs" onclick="removeTaksi(${i})">Sil</button></td>
    </tr>`).join('');
  return `
    <div class="card overflow-hidden">
      <table>
        <thead><tr><th>Durak Adı</th><th>Bölge</th><th>Telefon (görünen)</th><th>Telefon (tıklanır)</th><th style="width:100px">İşlem</th></tr></thead>
        <tbody id="taksi-tbody">${rows}</tbody>
      </table>
    </div>
    <div class="mt-4 flex gap-2">
      <button class="btn btn-primary" id="taksi-add">➕ Yeni Durak</button>
      <button class="btn btn-success" id="taksi-save">💾 Kaydet</button>
    </div>`;
}
function bindTaksi() {
  document.getElementById('taksi-add').addEventListener('click', () => {
    state.data.hizmetler.taksiler = state.data.hizmetler.taksiler || { items:[] };
    state.data.hizmetler.taksiler.items.push({name:'Yeni Durak', location:'', phone:'', phoneRaw:''});
    saveLocal(); renderPage('taksi');
  });
  document.getElementById('taksi-save').addEventListener('click', () => {
    document.querySelectorAll('#taksi-tbody input').forEach(inp => {
      const i = parseInt(inp.dataset.i); const k = inp.dataset.k;
      state.data.hizmetler.taksiler.items[i][k] = inp.value;
    });
    saveLocal(); toast('Taksi durakları kaydedildi.');
  });
}
function removeTaksi(i) {
  if (!confirm('Silinsin mi?')) return;
  state.data.hizmetler.taksiler.items.splice(i,1);
  saveLocal(); renderPage('taksi');
}

// === Kayıp & Bulunan — yeni veri kaynağı: kalkan_lost_found_v1 ===
const LF_KEY = 'kalkan_lost_found_v1';
const LF_CATEGORIES = {
  anahtar:'🔑 Anahtar', telefon:'📱 Telefon', cuzdan:'👛 Cüzdan/Para',
  canta:'🎒 Çanta', kiyafet:'👕 Kıyafet', ayakkabi:'👟 Ayakkabı',
  aksesuar:'⌚ Aksesuar', gozluk:'👓 Gözlük', belge:'📄 Belge',
  hayvan:'🐾 Hayvan', cocuk:'🧸 Çocuk eşyası', plaj:'🩴 Plaj eşyası', diger:'📦 Diğer',
};
function _lfRead() {
  try { return JSON.parse(localStorage.getItem(LF_KEY) || '{"items":[]}'); }
  catch { return { items: [] }; }
}
function _lfWrite(data) { localStorage.setItem(LF_KEY, JSON.stringify(data)); }

function renderKayip() {
  const data = _lfRead();
  const items = (data.items || []).slice().sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
  const counts = items.reduce((a,p)=>{a[p.type||'kayip']=(a[p.type||'kayip']||0)+1;return a;},{});
  const filterBar = `
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <button class="btn btn-ghost text-xs lf-filter active" data-filter="all">Tümü (${items.length})</button>
      <button class="btn btn-ghost text-xs lf-filter" data-filter="kayip">🔍 Kayıp (${counts.kayip||0})</button>
      <button class="btn btn-ghost text-xs lf-filter" data-filter="bulundu">✓ Bulundu (${counts.bulundu||0})</button>
      <input id="lf-admin-search" type="text" placeholder="Ara: eşya, yer, kod, telefon..." class="ml-auto flex-1 min-w-[200px] max-w-md text-sm" />
      <button class="btn btn-primary text-xs" id="lf-admin-add">➕ Manuel Ekle</button>
    </div>`;
  if (!items.length) {
    return `${filterBar}<div class="card p-12 text-center text-ink-700/60">
      <div class="text-5xl mb-3">📭</div>
      <p class="font-semibold">Henüz kayıt yok.</p>
      <p class="text-sm mt-1">Kullanıcılar hizmetler.html üzerinden ilan verdiğinde burada görünecek.</p>
    </div>`;
  }
  return `${filterBar}<div id="lf-admin-list" class="space-y-3">${items.map(_lfRow).join('')}</div>`;
}

function _lfRow(p) {
  const isLost = p.type === 'kayip';
  const tag = isLost
    ? '<span class="text-[10px] font-bold uppercase tracking-wide bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">🔍 Kayıp</span>'
    : '<span class="text-[10px] font-bold uppercase tracking-wide bg-sun-100 text-sun-700 px-2 py-0.5 rounded-full">✓ Bulundu</span>';
  const cover = (Array.isArray(p.images) && p.images[0]) || '';
  return `
    <article class="card p-4 flex gap-4" data-lf-id="${escapeHtml(p.id||'')}" data-lf-type="${escapeHtml(p.type||'kayip')}">
      <div class="w-20 h-20 rounded-lg bg-ink-700/10 grid place-items-center overflow-hidden flex-shrink-0 text-3xl">
        ${cover ? `<img src="${escapeHtml(cover)}" alt="" class="w-full h-full object-cover" />` : '📦'}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <h3 class="font-display font-bold text-ink-900 leading-tight">${escapeHtml(p.itemName||'—')}</h3>
            <div class="text-xs text-ink-700/70 mt-0.5">${escapeHtml(LF_CATEGORIES[p.category]||p.category||'')}${p.location?` · 📍 ${escapeHtml(p.location)}`:''}${p.date?` · 🕒 ${escapeHtml(p.date)}`:''}</div>
          </div>
          ${tag}
        </div>
        ${p.description ? `<p class="text-xs text-ink-700/80 mt-2 line-clamp-2">${escapeHtml(p.description)}</p>` : ''}
        <div class="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <div class="text-[11px] text-ink-700/60">
            ${p.ownerName ? `<span>👤 ${escapeHtml(p.ownerName)}</span>` : ''}
            ${p.phone ? `<span class="ml-2">📞 <a href="tel:${escapeHtml(p.phone)}" class="text-sea-600">${escapeHtml(p.phone)}</a></span>` : ''}
            ${p.whatsapp ? `<span class="ml-2">💬 ${escapeHtml(p.whatsapp)}</span>` : ''}
            ${p.email ? `<span class="ml-2">✉️ ${escapeHtml(p.email)}</span>` : ''}
          </div>
          <div class="flex items-center gap-2">
            ${p.deleteCode ? `<span class="text-[11px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-mono font-bold tracking-widest" title="Kullanıcının silme kodu — talep ederse paylaş">🔐 ${escapeHtml(p.deleteCode)}</span>` : ''}
            <button class="btn btn-ghost text-xs" data-lf-action="view" data-id="${escapeHtml(p.id||'')}">Detay</button>
            <button class="btn btn-danger text-xs" data-lf-action="delete" data-id="${escapeHtml(p.id||'')}">🗑 Sil</button>
          </div>
        </div>
      </div>
    </article>`;
}

function _lfDetail(p) {
  const gallery = (Array.isArray(p.images) ? p.images : []).filter(Boolean);
  const isLost = p.type === 'kayip';
  return `
    <div class="px-6 py-4 border-b border-ink-700/8 flex items-center justify-between">
      <div>
        <div class="font-semibold text-ink-900">${escapeHtml(p.itemName||'—')}</div>
        <div class="text-xs text-ink-700/60 mt-0.5">${isLost ? '🔍 Kayıp İlanı' : '✓ Bulundu İlanı'} · ${escapeHtml(LF_CATEGORIES[p.category]||p.category||'')}</div>
      </div>
      <button class="text-ink-700/60 hover:text-bad-500 text-xl" onclick="closeModal()">×</button>
    </div>
    <div class="p-6 space-y-4 text-sm overflow-y-auto" style="max-height:70vh;">
      ${gallery.length ? `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">${gallery.map(u => `<img src="${escapeHtml(u)}" class="w-full h-24 object-cover rounded" alt="">`).join('')}</div>` : ''}
      ${p.description ? `<div><div class="text-xs font-bold uppercase text-ink-700/60 mb-1">Açıklama</div><p class="whitespace-pre-wrap">${escapeHtml(p.description)}</p></div>` : ''}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><div class="text-xs font-bold uppercase text-ink-700/60 mb-1">Yer / Tarih</div><div>📍 ${escapeHtml(p.location||'—')}</div><div>🕒 ${escapeHtml(p.date||'—')}</div></div>
        <div><div class="text-xs font-bold uppercase text-ink-700/60 mb-1">İletişim</div>
          ${p.ownerName ? `<div>👤 ${escapeHtml(p.ownerName)}</div>` : ''}
          ${p.phone ? `<div>📞 <a href="tel:${escapeHtml(p.phone)}" class="text-sea-500 underline">${escapeHtml(p.phone)}</a></div>` : ''}
          ${p.whatsapp ? `<div>💬 <a href="https://wa.me/${escapeHtml((p.whatsapp||'').replace(/\D/g,''))}" target="_blank" class="text-sea-500 underline">${escapeHtml(p.whatsapp)}</a></div>` : ''}
          ${p.email ? `<div>✉️ <a href="mailto:${escapeHtml(p.email)}" class="text-sea-500 underline">${escapeHtml(p.email)}</a></div>` : ''}
        </div>
      </div>
      ${p.deleteCode ? `<div class="bg-amber-50 border-2 border-dashed border-amber-300 rounded-lg p-4 text-center">
        <div class="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-1">🔐 Silme Kodu (kullanıcıya verebilirsin)</div>
        <div class="font-mono font-bold text-2xl text-amber-900 tracking-widest">${escapeHtml(p.deleteCode)}</div>
      </div>` : ''}
      <div class="text-[11px] text-ink-700/50 border-t border-ink-700/8 pt-3">
        İlan ID: <code>${escapeHtml(p.id||'')}</code>${p.createdAt ? ` · ${new Date(p.createdAt).toLocaleString('tr-TR')}` : ''}
      </div>
    </div>
    <div class="px-6 py-4 border-t border-ink-700/8 flex justify-end gap-2">
      <button class="btn btn-ghost" onclick="closeModal()">Kapat</button>
      <button class="btn btn-danger" data-lf-action="delete" data-id="${escapeHtml(p.id||'')}" data-close-after="1">🗑 Sil</button>
    </div>`;
}

function bindKayip() {
  // Filter
  document.querySelectorAll('.lf-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lf-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      document.querySelectorAll('#lf-admin-list > article').forEach(a => {
        a.style.display = (f === 'all' || a.dataset.lfType === f) ? '' : 'none';
      });
    });
  });
  // Search
  const search = document.getElementById('lf-admin-search');
  if (search) search.addEventListener('input', () => {
    const q = search.value.toLowerCase().trim();
    document.querySelectorAll('#lf-admin-list > article').forEach(a => {
      a.style.display = (!q || a.textContent.toLowerCase().includes(q)) ? '' : 'none';
    });
  });
  // Manuel ekle (admin tarafından)
  const addBtn = document.getElementById('lf-admin-add');
  if (addBtn) addBtn.addEventListener('click', _lfAdminAdd);
  // Action buttons (event delegation idempotent)
  if (!_lfClickBound) {
    document.addEventListener('click', _lfClickHandler);
    _lfClickBound = true;
  }
}

let _lfClickBound = false;
function _lfClickHandler(e) {
  const btn = e.target.closest('[data-lf-action]');
  if (!btn) return;
  const action = btn.dataset.lfAction;
  const id = btn.dataset.id;
  if (!id) return;
  // Sadece admin sayfası: lf-admin-list veya modal-inner içinde olmalı (kullanıcı sayfasındaki sil butonlarıyla karışmasın)
  if (!btn.closest('#lf-admin-list') && !btn.closest('#modal-inner')) return;
  const data = _lfRead();
  const item = (data.items || []).find(p => p.id === id);
  if (!item) return;
  if (action === 'view') {
    document.getElementById('modal-inner').innerHTML = _lfDetail(item);
    document.getElementById('modal').classList.remove('hidden');
  } else if (action === 'delete') {
    if (!confirm(`"${item.itemName}" ilanı silinsin mi? (Kullanıcının kodu kontrol edilmez — admin yetkisi)`)) return;
    data.items = data.items.filter(p => p.id !== id);
    _lfWrite(data);
    if (btn.dataset.closeAfter) closeModal();
    if (state.page === 'kayip') renderPage('kayip');
    toast('İlan silindi.', 'bad');
  }
}

function _lfAdminAdd() {
  const inner = document.getElementById('modal-inner');
  inner.innerHTML = `
    <div class="px-6 py-4 border-b border-ink-700/8 flex items-center justify-between">
      <div class="font-semibold text-ink-900">Manuel İlan Ekle</div>
      <button class="text-xl" onclick="closeModal()">×</button>
    </div>
    <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div><label class="text-xs font-semibold">Tür</label>
        <select id="lf-type"><option value="kayip">🔍 Kayıp</option><option value="bulundu">✓ Bulundu</option></select></div>
      <div><label class="text-xs font-semibold">Kategori</label>
        <select id="lf-cat">${Object.entries(LF_CATEGORIES).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
      <div><label class="text-xs font-semibold">Eşya Adı *</label><input id="lf-item" type="text" /></div>
      <div><label class="text-xs font-semibold">Tarih</label><input id="lf-date" type="date" value="${new Date().toISOString().slice(0,10)}" /></div>
      <div><label class="text-xs font-semibold">Yer</label><input id="lf-loc" type="text" /></div>
      <div><label class="text-xs font-semibold">Telefon</label><input id="lf-phone" type="tel" /></div>
      <div class="md:col-span-2"><label class="text-xs font-semibold">Açıklama</label><textarea id="lf-desc" rows="3"></textarea></div>
    </div>
    <div class="px-6 py-4 border-t flex justify-end gap-2">
      <button class="btn btn-ghost" onclick="closeModal()">İptal</button>
      <button class="btn btn-primary" id="lf-admin-save">💾 Ekle</button>
    </div>`;
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('lf-admin-save').onclick = () => {
    const item = {
      id: 'lf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: val('lf-type'), category: val('lf-cat'), itemName: val('lf-item'),
      description: val('lf-desc'), location: val('lf-loc'), date: val('lf-date'),
      phone: val('lf-phone'), images: [],
      deleteCode: 'ADMIN' + Math.random().toString(36).slice(2, 5).toUpperCase(),
      createdAt: new Date().toISOString(),
      addedByAdmin: true,
    };
    if (!item.itemName) { alert('Eşya adı zorunlu.'); return; }
    const data = _lfRead();
    data.items = data.items || [];
    data.items.push(item);
    _lfWrite(data);
    closeModal();
    renderPage('kayip');
    toast('İlan eklendi.');
  };
}

function removeKayip(i) {
  // Geriye uyumluluk için; artık event delegation kullanılıyor
  const data = _lfRead();
  if (!data.items?.[i]) return;
  if (!confirm('Silinsin mi?')) return;
  data.items.splice(i, 1);
  _lfWrite(data);
  renderPage('kayip');
}

// ========== Export / Import ==========
function renderExport() {
  return `
    <div class="card p-6 max-w-2xl">
      <div class="text-sm font-semibold text-ink-900 mb-2">Tüm Verileri İndir</div>
      <p class="text-sm text-ink-700/70 mb-4">Tüm değişikliklerinizi <b>data/</b> klasörüne yüklenebilecek 7 ayrı JSON dosyası olarak veya tek birleşik bir yedek olarak indirebilirsiniz.</p>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-success" id="exp-each">📦 7 Dosya Olarak İndir</button>
        <button class="btn btn-primary" id="exp-bundle">🗄️ Tek Yedek Dosyası</button>
      </div>
      <div class="mt-6 text-xs text-ink-700/60">
        <div class="font-semibold mb-1">Canlıya yükleme adımları:</div>
        <ol class="list-decimal pl-5 space-y-1">
          <li>"7 Dosya Olarak İndir"e tıklayın.</li>
          <li>İndirilen dosyaları <code>kalkan-info/data/</code> klasörüne taşıyın (üzerine yazın).</li>
          <li>Site sayfaları otomatik olarak yeni içeriği gösterecektir.</li>
        </ol>
      </div>
    </div>`;
}
function bindExport() {
  document.getElementById('exp-each').addEventListener('click', exportEach);
  document.getElementById('exp-bundle').addEventListener('click', exportBundle);
}
function exportAll() { exportEach(); }
function exportEach() {
  for (const f of DATA_FILES) {
    if (state.data[f]) downloadJSON(`${f}.json`, state.data[f]);
  }
  toast('Tüm dosyalar indirildi.');
}
function exportBundle() {
  downloadJSON(`kalkan-info-yedek-${new Date().toISOString().slice(0,10)}.json`, state.data);
  toast('Yedek indirildi.');
}
function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function renderImport() {
  return `
    <div class="card p-6 max-w-2xl">
      <div class="text-sm font-semibold text-ink-900 mb-2">JSON Geri Yükle</div>
      <p class="text-sm text-ink-700/70 mb-4">Bir veya daha fazla JSON dosyasını içe aktarabilirsiniz. Tek birleşik yedek (kalkan-info-yedek-*.json) ya da tek tek bölüm dosyaları kabul edilir.</p>
      <input type="file" id="imp-file" accept="application/json" multiple class="text-sm" />
      <div class="mt-4 flex gap-2">
        <button class="btn btn-primary" id="imp-do">📥 İçe Aktar</button>
        <button class="btn btn-danger" id="imp-reset">⚠️ Tümünü Sıfırla</button>
      </div>
      <div class="text-xs text-ink-700/60 mt-3">"Sıfırla" tüm yerel değişiklikleri siler ve <code>data/</code> klasöründeki orijinal dosyalara döner.</div>
    </div>`;
}
function bindImport() {
  document.getElementById('imp-do').addEventListener('click', async () => {
    const files = document.getElementById('imp-file').files;
    if (!files.length) { toast('Önce dosya seçin.'); return; }
    for (const f of files) {
      try {
        const text = await f.text();
        const data = JSON.parse(text);
        const key = f.name.replace('.json','');
        if (DATA_FILES.includes(key)) {
          state.data[key] = data;
        } else if (data && typeof data === 'object') {
          // Tek birleşik yedek mi?
          const matched = DATA_FILES.filter(k => data[k]);
          if (matched.length) matched.forEach(k => state.data[k] = data[k]);
        }
      } catch(e) { toast(`Hata: ${f.name}`); }
    }
    saveLocal(); toast('İçe aktarıldı.'); renderPage('dashboard');
  });
  document.getElementById('imp-reset').addEventListener('click', async () => {
    if (!confirm('TÜM yerel değişiklikler silinecek. Emin misiniz?')) return;
    localStorage.removeItem(LS_KEY);
    state.data = {};
    await loadAllData();
    toast('Sıfırlandı.'); navigate('dashboard');
  });
}

// ========== Schemas ==========
const PLAJ_SCHEMA = {
  name: 'PLAJ_SCHEMA',
  searchHint: 'Kaputaş, Patara...',
  idFromName: true,
  extraColumns: [{label:'Mesafe', field:'distance'}, {label:'Puan', field:'rating'}],
  defaults: () => ({id:'', name:'', category:'Halk plajı', tags:[], image:'', gallery:[], rating:4.5, distance:'', drive:'', summary:'', highlights:[], facilities:[], tips:'', best:'', featured:false}),
  fields: () => [
    {key:'name', label:'Plaj Adı'},
    {key:'category', label:'Kategori', type:'select', options:['Halk plajı','Beach club koyu','Gizli koy','Tekne durağı','Doğal SİT','Doğal koy','Tekne koyu']},
    {key:'gallery', label:'Galeri', type:'gallery', full:true},
    {key:'rating', label:'Puan (1-5)', type:'number', step:0.1},
    {key:'distance', label:'Mesafe', placeholder:'7 km — Kalkan merkez'},
    {key:'drive', label:'Süre', placeholder:'10 dk araba'},
    {key:'best', label:'En İyi Mevsim', placeholder:'Mayıs–Ekim'},
    {key:'summary', label:'Özet', type:'textarea', full:true, rows:2},
    {key:'highlights', label:'Öne Çıkanlar', type:'array', full:true},
    {key:'facilities', label:'Olanaklar', type:'array', full:true},
    {key:'tags', label:'Etiketler', type:'array', full:true},
    {key:'tips', label:'İpuçları', type:'textarea', full:true, rows:2},
    {key:'featured', label:'Öne çıkar', type:'checkbox'}
  ]
};

const VILLA_SCHEMA = {
  name: 'VILLA_SCHEMA',
  searchHint: 'Villa adı, konum...',
  idFromName: true,
  extraColumns: [{label:'Kapasite', field:'capacity'}, {label:'Fiyat', field:'price'}],
  defaults: () => ({id:'', name:'', category:'4+1', capacity:'8 kişi', bedrooms:4, bathrooms:3, pool:'Özel havuz', seaView:true, image:'', gallery:[], price:'', priceWeek:'', location:'', tags:[], summary:'', features:[], featured:false}),
  fields: (data) => [
    {key:'name', label:'Villa Adı'},
    {key:'category', label:'Kategori', type:'select', options:data.categories||['2+1','3+1','4+1','5+1','6+1']},
    {key:'gallery', label:'Galeri', type:'gallery', full:true},
    {key:'capacity', label:'Kapasite', placeholder:'8 kişi'},
    {key:'bedrooms', label:'Yatak Odası', type:'number'},
    {key:'bathrooms', label:'Banyo', type:'number'},
    {key:'pool', label:'Havuz', placeholder:'Özel havuz'},
    {key:'location', label:'Konum', placeholder:'Kalamar'},
    {key:'price', label:'Fiyat (gece)', placeholder:'₺ 18.000 / gece'},
    {key:'priceWeek', label:'Fiyat (hafta)', placeholder:'₺ 105.000 / hafta'},
    {key:'seaView', label:'Deniz Manzarası', type:'checkbox'},
    {key:'summary', label:'Özet', type:'textarea', full:true, rows:2},
    {key:'features', label:'Özellikler', type:'array', full:true},
    {key:'tags', label:'Etiketler', type:'array', full:true},
    {key:'featured', label:'Öne çıkar', type:'checkbox'}
  ]
};

const TUR_SCHEMA = {
  name: 'TUR_SCHEMA',
  searchHint: 'Tekne, safari...',
  idFromName: true,
  extraColumns: [{label:'Süre', field:'duration'}, {label:'Fiyat', field:'price'}],
  defaults: () => ({id:'', name:'', category:'Tekne Turu', duration:'', price:'', priceNote:'', capacity:'', image:'', gallery:[], rating:4.5, summary:'', includes:[], excludes:[], meetingPoint:'', languages:['TR','EN'], featured:false}),
  fields: (data) => [
    {key:'name', label:'Tur Adı'},
    {key:'category', label:'Kategori', type:'select', options:data.categories||['Tekne Turu','Safari','At Turu','Kano Turu']},
    {key:'gallery', label:'Galeri', type:'gallery', full:true},
    {key:'duration', label:'Süre', placeholder:'08:30 – 18:00'},
    {key:'price', label:'Fiyat', placeholder:'₺ 850 / kişi'},
    {key:'priceNote', label:'Fiyat Notu', placeholder:'Öğle yemeği dahil'},
    {key:'capacity', label:'Kapasite', placeholder:'20–40 kişi'},
    {key:'rating', label:'Puan', type:'number', step:0.1},
    {key:'meetingPoint', label:'Buluşma Noktası', placeholder:'Kalkan Yat Limanı'},
    {key:'summary', label:'Özet', type:'textarea', full:true, rows:2},
    {key:'includes', label:'Dahil', type:'array', full:true},
    {key:'excludes', label:'Hariç', type:'array', full:true},
    {key:'languages', label:'Diller', type:'array'},
    {key:'featured', label:'Öne çıkar', type:'checkbox'}
  ]
};

const RESTORAN_SCHEMA = {
  name: 'RESTORAN_SCHEMA',
  searchHint: 'Restoran, mutfak...',
  idFromName: true,
  extraColumns: [{label:'Mutfak', field:'cuisine'}, {label:'Fiyat', field:'priceRange'}],
  defaults: () => ({id:'', name:'', category:'Türk Mutfağı', cuisine:'', priceRange:'₺₺', rating:4.5, location:'', phone:'', image:'', gallery:[], summary:'', specialties:[], hours:'', reservation:false, featured:false}),
  fields: (data) => [
    {key:'name', label:'Restoran Adı'},
    {key:'category', label:'Kategori', type:'select', options:data.categories||['Fine Dining','Türk Mutfağı','Deniz Ürünleri','Dünya Mutfağı','Kahvaltı & Brunch','Kafe']},
    {key:'cuisine', label:'Mutfak', placeholder:'Akdeniz / Türk'},
    {key:'priceRange', label:'Fiyat Aralığı', type:'select', options:['₺','₺₺','₺₺₺','₺₺₺₺']},
    {key:'gallery', label:'Galeri', type:'gallery', full:true},
    {key:'rating', label:'Puan', type:'number', step:0.1},
    {key:'location', label:'Konum', placeholder:'Yat Limanı'},
    {key:'phone', label:'Telefon'},
    {key:'hours', label:'Çalışma Saati', placeholder:'18:00–24:00'},
    {key:'reservation', label:'Rezervasyon Gerekli', type:'checkbox'},
    {key:'summary', label:'Özet', type:'textarea', full:true, rows:2},
    {key:'specialties', label:'Spesiyaller', type:'array', full:true},
    {key:'featured', label:'Öne çıkar', type:'checkbox'}
  ]
};

const HABER_SCHEMA = {
  name: 'HABER_SCHEMA',
  searchHint: 'Başlık, kategori...',
  idFromName: true,
  extraColumns: [{label:'Tarih', field:'date'}],
  defaults: () => ({id:'', title:'', category:'Etkinlik', date:new Date().toISOString().slice(0,10), image:'', gallery:[], summary:'', content:'', tags:[], featured:false}),
  fields: (data) => [
    {key:'title', label:'Başlık'},
    {key:'category', label:'Kategori', type:'select', options:data.categories||['Etkinlik','Belediye','Restoran','Plaj','Kültür','Hava']},
    {key:'gallery', label:'Galeri', type:'gallery', full:true},
    {key:'date', label:'Tarih (YYYY-MM-DD)'},
    {key:'summary', label:'Özet', type:'textarea', full:true, rows:2},
    {key:'content', label:'İçerik', type:'textarea', full:true, rows:5},
    {key:'tags', label:'Etiketler', type:'array', full:true},
    {key:'featured', label:'Öne çıkar', type:'checkbox'}
  ]
};

const HIZMET_SCHEMA = {
  name: 'HIZMET_SCHEMA',
  searchHint: 'Hizmet, kategori...',
  idFromName: true,
  extraColumns: [{label:'Telefon', field:'phone'}, {label:'Saatler', field:'hours'}],
  defaults: () => ({id:'', name:'', category:'Diğer', icon:'', image:'', gallery:[], summary:'', details:[], phone:'', whatsapp:'', hours:'', featured:false}),
  fields: (data) => [
    {key:'name', label:'Hizmet Adı'},
    {key:'category', label:'Kategori', type:'select', options:data.categories||['Sağlık','Ulaşım','Alışveriş','Bakım','Kiralama','Resmi','Diğer']},
    {key:'icon', label:'İkon (emoji)', placeholder:'🚐'},
    {key:'gallery', label:'Galeri', type:'gallery', full:true},
    {key:'phone', label:'Telefon'},
    {key:'whatsapp', label:'WhatsApp'},
    {key:'hours', label:'Çalışma Saatleri', placeholder:'08:00–20:00'},
    {key:'summary', label:'Özet', type:'textarea', full:true, rows:2},
    {key:'details', label:'Detaylar', type:'array', full:true},
    {key:'featured', label:'Öne çıkar', type:'checkbox'}
  ]
};

// ========== Utils ==========
function val(id) { return document.getElementById(id).value.trim(); }
function escapeHtml(s) {
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}
function slugify(s) {
  return String(s).toLowerCase()
    .replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
}
function toast(msg, kind='ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast';
  t.style.display = 'block';
  t.style.background = kind==='bad' ? '#ef4444' : '#10b981';
  setTimeout(() => { t.style.display = 'none'; }, 2500);
}

// expose globals for inline handlers
window.navigate = navigate;
window.openAdd = openAdd;
window.openEdit = openEdit;
window.deleteItem = deleteItem;
window.closeModal = closeModal;
window.removeAcil = removeAcil;
window.removeTaksi = removeTaksi;
window.removeKayip = removeKayip;
window.PLAJ_SCHEMA = PLAJ_SCHEMA;
window.VILLA_SCHEMA = VILLA_SCHEMA;
window.TUR_SCHEMA = TUR_SCHEMA;
window.RESTORAN_SCHEMA = RESTORAN_SCHEMA;
window.HABER_SCHEMA = HABER_SCHEMA;
window.HIZMET_SCHEMA = HIZMET_SCHEMA;

// ========== KULLANICI BAŞVURULARI (ONAYLAR) ==========
const SUBMISSION_TYPE_LABELS = {
  restoran:'🍽️ Restoran/Kafe', villa:'🏖️ Villa/Konaklama', tur:'🚤 Tur Şirketi', magaza:'🏪 Mağaza/Bayi',
  asci:'👨‍🍳 Aşçı/Catering', transfer:'🚐 Transfer/Şoför', rehber:'🧭 Tur Rehberi',
  teslimat:'🚚 Teslimat/Dağıtım', tamir:'🔧 Tamir/Usta', bakim:'💆 Kişisel Bakım',
  egitim:'🎓 Eğitim/Antrenör', hizmet:'🛠️ Diğer Hizmet'
};
const STATUS_LABELS = {
  pending:  { txt:'Onay Bekliyor', cls:'bg-amber-100 text-amber-700 border border-amber-200' },
  approved: { txt:'Yayında',       cls:'bg-sun-100 text-sun-700 border border-sun-200' },
  rejected: { txt:'Reddedildi',    cls:'bg-rose-100 text-rose-700 border border-rose-200' },
};

// localStorage'daki tüm kullanıcı başvurularını topla (demo modu)
function loadAllSubmissions() {
  const all = [];
  const usersRaw = localStorage.getItem('kalkan_local_users_v1');
  let users = {};
  try { users = JSON.parse(usersRaw || '{}'); } catch {}
  // uid → email/displayName ara
  const usersByUid = {};
  Object.values(users).forEach(u => { if (u?.uid) usersByUid[u.uid] = u; });
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('kalkan_local_profiles_')) continue;
    const uid = key.replace('kalkan_local_profiles_', '');
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch { continue; }
    list.forEach(p => {
      const owner = usersByUid[uid] || {};
      all.push({
        ...p,
        ownerUid:    uid,
        ownerEmail:  owner.email || p.ownerEmail || '—',
        ownerName:   owner.displayName || '—',
        _storageKey: key,
      });
    });
  }
  // En yeni başta
  all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return all;
}

function updateSubmissionStatus(storageKey, profileId, newStatus) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return false; }
  const idx = list.findIndex(p => p.id === profileId);
  if (idx < 0) return false;
  list[idx] = { ...list[idx], status: newStatus, updatedAt: new Date().toISOString() };
  localStorage.setItem(storageKey, JSON.stringify(list));
  return true;
}

// ========== ONAY → PUBLIC YAYIN ==========
// Her hizmet/işletme tipi → admin data store'unun hangi koleksiyonuna gider
const TYPE_TO_COLLECTION = {
  villa:    'villalar',
  restoran: 'restoranlar',
  tur:      'turlar',
  // Magaza ve tüm service tipleri Hizmet Listesi'nde görünür
  magaza:   'hizmetler',
  asci:     'hizmetler',
  transfer: 'hizmetler',
  rehber:   'hizmetler',
  teslimat: 'hizmetler',
  tamir:    'hizmetler',
  bakim:    'hizmetler',
  egitim:   'hizmetler',
  hizmet:   'hizmetler',
};
const TYPE_ICONS = {
  villa:'🏖️', restoran:'🍽️', tur:'🚤', magaza:'🏪',
  asci:'👨‍🍳', transfer:'🚐', rehber:'🧭', teslimat:'🚚',
  tamir:'🔧', bakim:'💆', egitim:'🎓', hizmet:'🛠️',
};

function _publicRecordFromSubmission(s) {
  const targetKey = TYPE_TO_COLLECTION[s.type] || 'hizmetler';
  const cover = s.coverImage || (Array.isArray(s.images) && s.images[0]) || '';
  const gallery = Array.isArray(s.images) ? s.images.map(u => ({ url: u, alt: s.name || '' })) : [];
  const id = `user_${(s.id || Date.now())}`;
  const base = {
    __sourceProfileId: s.id,                 // dönüş için iz
    __userSubmitted:   true,
    id,
    name:        s.name || '—',
    image:       cover,
    gallery,
    summary:     s.summary || '',
    description: s.descriptionML?.tr || s.description || '',
    tags:        Array.isArray(s.categories) ? s.categories.slice(0, 6) : [],
    featured:    false,
  };
  if (targetKey === 'villalar') {
    return { ...base, category: s.category || s.categories?.[0] || 'Standart Villa', location: s.location?.address || '', capacity: '', bedrooms: 0, bathrooms: 0, pool: '', seaView: false, price: '', priceWeek: '', features: [] };
  }
  if (targetKey === 'restoranlar') {
    return { ...base, category: s.category || s.categories?.[0] || 'Türk Mutfağı', cuisine: '', priceRange: s.priceRange || '₺₺', phone: s.contact?.phone || '', location: s.location?.address || '', hours: '', specialties: [], reservation: false, rating: 0 };
  }
  if (targetKey === 'turlar') {
    return { ...base, category: s.category || s.categories?.[0] || 'Tekne Turu', duration: '', price: '', priceNote: '', capacity: '', meetingPoint: s.location?.address || '', includes: [], excludes: [], languages: ['TR','EN'], rating: 0 };
  }
  // Hizmetler — magaza, asci, transfer, rehber, teslimat, tamir, bakim, egitim, hizmet
  const cats = Array.isArray(s.categories) && s.categories.length ? s.categories : (s.category ? [s.category] : []);
  return {
    ...base,
    category: cats[0] || 'Diğer',
    icon:     TYPE_ICONS[s.type] || '🛠️',
    phone:    s.contact?.phone || '',
    whatsapp: s.contact?.whatsapp || '',
    hours:    '',
    details:  cats.slice(0, 5),
  };
}

function _promoteToPublic(submission) {
  const targetKey = TYPE_TO_COLLECTION[submission.type] || 'hizmetler';
  if (!state.data[targetKey]) state.data[targetKey] = { items: [] };
  if (!Array.isArray(state.data[targetKey].items)) state.data[targetKey].items = [];
  const record = _publicRecordFromSubmission(submission);
  // Mevcut promoted varsa güncelle, yoksa ekle
  const items = state.data[targetKey].items;
  const idx = items.findIndex(i => i.__sourceProfileId === submission.id);
  if (idx >= 0) items[idx] = { ...items[idx], ...record };
  else items.push(record);
  saveLocal();
}

function _demoteFromPublic(submissionId) {
  ['villalar','restoranlar','turlar','hizmetler','plajlar','haberler'].forEach(key => {
    const arr = state.data[key]?.items;
    if (!Array.isArray(arr)) return;
    const idx = arr.findIndex(i => i.__sourceProfileId === submissionId);
    if (idx >= 0) arr.splice(idx, 1);
  });
  saveLocal();
}

function deleteSubmission(storageKey, profileId) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return false; }
  list = list.filter(p => p.id !== profileId);
  localStorage.setItem(storageKey, JSON.stringify(list));
  return true;
}

function refreshPendingBadge() {
  const badge = document.getElementById('pending-badge');
  if (!badge) return;
  const cnt = loadAllSubmissions().filter(p => (p.status || 'pending') === 'pending').length;
  if (cnt > 0) { badge.textContent = String(cnt); badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
}

function renderOnaylar() {
  const items = loadAllSubmissions();
  const counts = items.reduce((a, p) => {
    const s = p.status || 'pending'; a[s] = (a[s] || 0) + 1; return a;
  }, {});
  const filterBar = `
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <button class="btn btn-ghost text-xs filter-status active" data-filter="all">Tümü (${items.length})</button>
      <button class="btn btn-ghost text-xs filter-status" data-filter="pending">⏳ Bekleyen (${counts.pending || 0})</button>
      <button class="btn btn-ghost text-xs filter-status" data-filter="approved">✓ Yayında (${counts.approved || 0})</button>
      <button class="btn btn-ghost text-xs filter-status" data-filter="rejected">✕ Reddedilen (${counts.rejected || 0})</button>
      <input id="onay-search" type="text" placeholder="Ara: isim, e-posta, kategori..." class="ml-auto flex-1 min-w-[200px] max-w-md text-sm" />
    </div>`;
  if (!items.length) {
    return `${filterBar}<div class="card p-12 text-center text-ink-700/60">
      <div class="text-5xl mb-3">📭</div>
      <p class="font-semibold">Henüz başvuru yok.</p>
      <p class="text-sm mt-1">Kullanıcılar "İşletme/Hizmet Ekle" ile gönderim yaptığında burada görünecek.</p>
    </div>`;
  }
  return `${filterBar}<div id="onay-list" class="space-y-3">${items.map(submissionRow).join('')}</div>`;
}

function submissionRow(p) {
  const status = p.status || 'pending';
  const lbl = STATUS_LABELS[status] || STATUS_LABELS.pending;
  const cover = p.coverImage || (Array.isArray(p.images) && p.images[0]) || '';
  const cats = (p.categories?.length ? p.categories : (p.category ? [p.category] : [])).slice(0, 8);
  const date = p.createdAt ? new Date(p.createdAt).toLocaleString('tr-TR') : '';
  return `
    <article class="card p-4 flex gap-4" data-status="${status}" data-uid="${escapeHtml(p.ownerUid)}" data-id="${escapeHtml(p.id || '')}">
      <div class="w-24 h-24 rounded-lg bg-ink-700/10 grid place-items-center overflow-hidden flex-shrink-0 text-3xl">
        ${cover ? `<img src="${escapeHtml(cover)}" alt="" class="w-full h-full object-cover" />` : '📷'}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <h3 class="font-display font-bold text-ink-900 leading-tight">${escapeHtml(p.name || '—')}</h3>
            <div class="text-xs text-ink-700/70 mt-0.5">${escapeHtml(SUBMISSION_TYPE_LABELS[p.type] || p.type || '')}</div>
          </div>
          <span class="text-[10px] font-bold uppercase tracking-wide ${lbl.cls} px-2 py-0.5 rounded-full whitespace-nowrap">${lbl.txt}</span>
        </div>
        <div class="flex flex-wrap gap-1 mt-2">
          ${cats.map(c => `<span class="text-[10px] bg-sea-50 text-sea-700 px-1.5 py-0.5 rounded font-semibold">${escapeHtml(c)}</span>`).join('')}
        </div>
        ${p.summary ? `<p class="text-xs text-ink-700/80 mt-2 line-clamp-2">${escapeHtml(p.summary)}</p>` : ''}
        <div class="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <div class="text-[11px] text-ink-700/60">
            <span>👤 ${escapeHtml(p.ownerName || '—')}</span>
            <span class="ml-2">📧 ${escapeHtml(p.ownerEmail || '—')}</span>
            ${date ? `<span class="ml-2">🕒 ${escapeHtml(date)}</span>` : ''}
          </div>
          <div class="flex gap-1">
            <button class="btn btn-ghost text-xs" data-onay-action="view" data-key="${escapeHtml(p._storageKey)}" data-id="${escapeHtml(p.id || '')}">Detay</button>
            ${status !== 'approved' ? `<button class="btn text-xs" style="background:#10b981;color:#fff;" data-onay-action="approve" data-key="${escapeHtml(p._storageKey)}" data-id="${escapeHtml(p.id || '')}">✓ Onayla</button>` : ''}
            ${status !== 'rejected' ? `<button class="btn text-xs" style="background:#f59e0b;color:#fff;" data-onay-action="reject" data-key="${escapeHtml(p._storageKey)}" data-id="${escapeHtml(p.id || '')}">✕ Reddet</button>` : ''}
            <button class="btn btn-danger text-xs" data-onay-action="delete" data-key="${escapeHtml(p._storageKey)}" data-id="${escapeHtml(p.id || '')}">🗑 Sil</button>
          </div>
        </div>
      </div>
    </article>`;
}

function renderSubmissionDetail(p) {
  const status = p.status || 'pending';
  const lbl = STATUS_LABELS[status] || STATUS_LABELS.pending;
  const gallery = (Array.isArray(p.images) ? p.images : []).filter(Boolean);
  return `
    <div class="px-6 py-4 border-b border-ink-700/8 flex items-center justify-between">
      <div>
        <div class="font-semibold text-ink-900">${escapeHtml(p.name || '—')}</div>
        <div class="text-xs text-ink-700/60 mt-0.5">${escapeHtml(SUBMISSION_TYPE_LABELS[p.type] || p.type || '')} · <span class="${lbl.cls} px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">${lbl.txt}</span></div>
      </div>
      <button class="text-ink-700/60 hover:text-bad-500 text-xl" onclick="closeModal()">×</button>
    </div>
    <div class="p-6 space-y-4 text-sm overflow-y-auto" style="max-height:70vh;">
      ${p.coverImage ? `<img src="${escapeHtml(p.coverImage)}" class="w-full h-48 object-cover rounded" alt="" />` : ''}
      ${gallery.length > 1 ? `<div class="grid grid-cols-4 gap-2">${gallery.slice(1).map(u => `<img src="${escapeHtml(u)}" class="w-full h-16 object-cover rounded" alt="">`).join('')}</div>` : ''}
      ${p.summary ? `<div><div class="text-xs font-bold uppercase text-ink-700/60 mb-1">Özet</div><p>${escapeHtml(p.summary)}</p></div>` : ''}
      ${p.descriptionML?.tr || p.description ? `<div><div class="text-xs font-bold uppercase text-ink-700/60 mb-1">Açıklama</div><p class="whitespace-pre-wrap">${escapeHtml(p.descriptionML?.tr || p.description)}</p></div>` : ''}
      ${(p.categories?.length || p.category) ? `<div><div class="text-xs font-bold uppercase text-ink-700/60 mb-1">Kategoriler</div><div class="flex flex-wrap gap-1">${(p.categories?.length ? p.categories : [p.category]).map(c => `<span class="bg-sea-50 text-sea-700 px-2 py-0.5 rounded text-xs font-semibold">${escapeHtml(c)}</span>`).join('')}</div></div>` : ''}
      ${p.priceRange ? `<div><div class="text-xs font-bold uppercase text-ink-700/60 mb-1">Fiyat</div><span class="font-mono">${escapeHtml(p.priceRange)}</span></div>` : ''}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><div class="text-xs font-bold uppercase text-ink-700/60 mb-1">İletişim</div>
          ${p.contact?.phone ? `<div>📞 ${escapeHtml(p.contact.phone)}</div>` : ''}
          ${p.contact?.whatsapp ? `<div>💬 ${escapeHtml(p.contact.whatsapp)}</div>` : ''}
          ${p.contact?.email ? `<div>✉️ ${escapeHtml(p.contact.email)}</div>` : ''}
          ${p.contact?.website ? `<div>🌐 <a href="${escapeHtml(p.contact.website)}" target="_blank" class="text-sea-500 underline">${escapeHtml(p.contact.website)}</a></div>` : ''}
        </div>
        <div><div class="text-xs font-bold uppercase text-ink-700/60 mb-1">Konum</div>
          <div>${escapeHtml(p.location?.address || '—')}</div>
          ${(p.location?.lat && p.location?.lng) ? `<a href="https://www.google.com/maps?q=${p.location.lat},${p.location.lng}" target="_blank" class="text-sea-500 underline text-xs">Haritada gör</a>` : ''}
        </div>
      </div>
      <div class="text-[11px] text-ink-700/50 border-t border-ink-700/8 pt-3">
        Gönderen: <strong>${escapeHtml(p.ownerName || '—')}</strong> · ${escapeHtml(p.ownerEmail || '—')}
        ${p.createdAt ? ` · ${new Date(p.createdAt).toLocaleString('tr-TR')}` : ''}
      </div>
    </div>
    <div class="px-6 py-4 border-t border-ink-700/8 flex justify-end gap-2">
      <button class="btn btn-ghost" onclick="closeModal()">Kapat</button>
      ${status !== 'approved' ? `<button class="btn" style="background:#10b981;color:#fff;" data-onay-action="approve" data-key="${escapeHtml(p._storageKey)}" data-id="${escapeHtml(p.id || '')}" data-close-after="1">✓ Onayla</button>` : ''}
      ${status !== 'rejected' ? `<button class="btn" style="background:#f59e0b;color:#fff;" data-onay-action="reject" data-key="${escapeHtml(p._storageKey)}" data-id="${escapeHtml(p.id || '')}" data-close-after="1">✕ Reddet</button>` : ''}
    </div>`;
}

function bindOnaylar() {
  // Filter buttons
  document.querySelectorAll('.filter-status').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-status').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      document.querySelectorAll('#onay-list > article').forEach(a => {
        a.style.display = (f === 'all' || a.dataset.status === f) ? '' : 'none';
      });
    });
  });
  // Search
  const search = document.getElementById('onay-search');
  if (search) search.addEventListener('input', () => {
    const q = search.value.toLowerCase().trim();
    document.querySelectorAll('#onay-list > article').forEach(a => {
      a.style.display = (!q || a.textContent.toLowerCase().includes(q)) ? '' : 'none';
    });
  });
  // Action buttons (idempotent — sayfa her render olduğunda yeniden bind edilmesin)
  if (!_onayHandlerBound) {
    document.addEventListener('click', _onayClickHandler);
    _onayHandlerBound = true;
  }
}

let _onayHandlerBound = false;
function _onayClickHandler(e) {
  const btn = e.target.closest('[data-onay-action]');
  if (!btn) return;
  const action = btn.dataset.onayAction;
  const key    = btn.dataset.key;
  const id     = btn.dataset.id;
  if (!key || !id) return;
  if (action === 'view') {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
    const item = list.find(p => p.id === id);
    if (!item) return;
    // owner bilgisi
    const uid = key.replace('kalkan_local_profiles_', '');
    let users = {};
    try { users = JSON.parse(localStorage.getItem('kalkan_local_users_v1') || '{}'); } catch {}
    const owner = Object.values(users).find(u => u.uid === uid) || {};
    item._storageKey = key;
    item.ownerName  = owner.displayName || '—';
    item.ownerEmail = owner.email || '—';
    document.getElementById('modal-inner').innerHTML = renderSubmissionDetail(item);
    document.getElementById('modal').classList.remove('hidden');
    return;
  }
  // Submission objesini yükle (promote için gerekli)
  let submission = null;
  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    submission = list.find(p => p.id === id);
  } catch {}

  if (action === 'approve') {
    if (!updateSubmissionStatus(key, id, 'approved')) return;
    if (submission) {
      _promoteToPublic({ ...submission, id });
      toast('Başvuru onaylandı ve sitede yayına alındı.');
    } else {
      toast('Başvuru onaylandı.');
    }
  } else if (action === 'reject') {
    const reason = prompt('Red sebebi (opsiyonel — kullanıcıya bilgi olarak gösterilebilir):');
    if (reason === null) return; // İptal
    if (!updateSubmissionStatus(key, id, 'rejected')) return;
    _demoteFromPublic(id);
    toast('Başvuru reddedildi ve siteden kaldırıldı.');
  } else if (action === 'delete') {
    if (!confirm('Bu başvuru kalıcı olarak silinsin mi?')) return;
    if (!deleteSubmission(key, id)) return;
    _demoteFromPublic(id);
    toast('Başvuru silindi.', 'bad');
  } else {
    return;
  }
  if (btn.dataset.closeAfter) closeModal();
  refreshPendingBadge();
  if (state.page === 'onaylar') renderPage('onaylar');
}

// Sayfa açılır açılmaz badge'i güncelle
function bootstrapBadgeWatch() {
  refreshPendingBadge();
  // Diğer sayfada açılan tab'da güncelleme olduğunda da yansı
  window.addEventListener('storage', e => {
    if (e.key && (e.key.startsWith('kalkan_local_profiles_') || e.key === 'kalkan_local_users_v1')) {
      refreshPendingBadge();
    }
  });
}

window.refreshPendingBadge = refreshPendingBadge;

// ========== Config — image upload helpers ==========
const _CFG_CLEAR_FALLBACK = { 'cf-logo-thumb':'🏷️', 'cf-favicon-thumb':'🌐', 'cf-hero-thumb':'🖼️' };

function _cfgEnsureClearBtn(inputId, thumbId) {
  const inputEl = document.getElementById(inputId);
  if (!inputEl) return;
  // Sibling toolbar (input'un yanındaki .flex.items-center.gap-2 alt satırı)
  const toolbar = inputEl.parentElement?.querySelector('.flex.items-center.gap-2');
  if (!toolbar) return;
  if (toolbar.querySelector('[data-cfg-clear]')) return;
  const fallback = _CFG_CLEAR_FALLBACK[thumbId] || '🖼️';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-ghost text-xs';
  btn.style.cssText = 'padding:4px 10px;color:#c0392b;';
  btn.dataset.cfgClear = '1';
  btn.textContent = 'Kaldır';
  btn.addEventListener('click', () => window.cfgClearImage(inputId, thumbId, fallback));
  toolbar.appendChild(btn);
}

function _cfgRemoveClearBtn(inputId) {
  const inputEl = document.getElementById(inputId);
  const toolbar = inputEl?.parentElement?.querySelector('.flex.items-center.gap-2');
  toolbar?.querySelector('[data-cfg-clear]')?.remove();
}

window.cfgUploadImage = async function (event, inputId, thumbId, maxDim) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!/^image\//.test(file.type)) { toast('Lütfen bir görsel dosya seçin.', 'bad'); return; }
  if (file.size > 5 * 1024 * 1024) { toast('Maks 5MB.', 'bad'); return; }
  try {
    const dataUrl = await _cfgImageToDataUrl(file, maxDim || 1024);
    document.getElementById(inputId).value = dataUrl;
    const thumb = document.getElementById(thumbId);
    if (thumb) thumb.innerHTML = `<img src="${dataUrl}" class="w-full h-full object-${thumbId === 'cf-hero-thumb' ? 'cover' : 'contain'}" alt="">`;
    _cfgEnsureClearBtn(inputId, thumbId);
  } catch (e) {
    console.error('[admin] image upload:', e);
    toast('Yükleme başarısız.', 'bad');
  } finally {
    event.target.value = '';
  }
};

window.cfgClearImage = function (inputId, thumbId, fallbackEmoji) {
  document.getElementById(inputId).value = '';
  const thumb = document.getElementById(thumbId);
  if (thumb) thumb.innerHTML = fallbackEmoji || _CFG_CLEAR_FALLBACK[thumbId] || '🖼️';
  _cfgRemoveClearBtn(inputId);
};

async function _cfgImageToDataUrl(file, maxDim) {
  const img = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = fr.result; };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  // Logo/favicon için şeffaflık koru → PNG; hero için JPEG (boyut)
  const isLargeHero = maxDim >= 1024;
  if (isLargeHero) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL(isLargeHero ? 'image/jpeg' : 'image/png', 0.88);
}

// Mevcut bootstrap'i çağır + ek bootstrap
const __origBootstrap = bootstrap;
async function _enhancedBootstrap() {
  await __origBootstrap();
  // Backfill — daha önce onaylanmış ama henüz public'e geçmemiş kayıtları taşı
  _backfillApprovedToPublic();
  // Login screen geçildikten sonra session açıldığında badge'i güncelle
  const obs = new MutationObserver(() => {
    if (!document.getElementById('app-shell')?.classList.contains('hidden')) {
      bootstrapBadgeWatch();
      obs.disconnect();
    }
  });
  obs.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
}

function _backfillApprovedToPublic() {
  let count = 0;
  loadAllSubmissions().forEach(p => {
    if ((p.status || '') !== 'approved') return;
    const targetKey = TYPE_TO_COLLECTION[p.type] || 'hizmetler';
    const arr = state.data[targetKey]?.items || [];
    if (!arr.find(i => i.__sourceProfileId === p.id)) {
      _promoteToPublic(p);
      count++;
    }
  });
  if (count > 0) {
    console.info(`[admin] Backfill: ${count} onaylı kayıt yayına alındı.`);
    if (typeof toast === 'function') toast(`${count} onaylı başvuru sitede yayına alındı.`);
  }
}

_enhancedBootstrap();
