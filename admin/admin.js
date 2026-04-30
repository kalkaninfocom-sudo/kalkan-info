/* Kalkan Info — Admin Panel
   Tüm içerik JSON dosyalarını localStorage üzerinden yönetir.
   Değişiklikler "Tüm Değişiklikleri İndir" ile JSON olarak yedeklenir,
   kullanıcı bu dosyaları data/ klasörüne basarak canlıya yükler.
*/

const DATA_FILES = ['plajlar','villalar','turlar','restoranlar','hizmetler','haberler','config'];
const LS_KEY = 'kalkan_info_admin_v1';
const SESSION_KEY = 'kalkan_info_session';
const PASSWORD = 'kalkan2026'; // config.json admin.passwordHash ile senkron

// ========== State ==========
const state = {
  data: {},        // {plajlar:{...}, villalar:{...}, ...}
  page: 'dashboard',
  loaded: false
};

// ========== Bootstrap ==========
async function bootstrap() {
  await loadAllData();
  bindLogin();
  if (sessionStorage.getItem(SESSION_KEY) === 'ok') showApp();
}

async function loadAllData() {
  // Önce localStorage, yoksa data/ JSON dosyalarından
  const cached = localStorage.getItem(LS_KEY);
  if (cached) {
    try { state.data = JSON.parse(cached); state.loaded = true; return; } catch(e){}
  }
  for (const file of DATA_FILES) {
    try {
      const res = await fetch(`data/${file}.json?t=${Date.now()}`);
      state.data[file] = await res.json();
    } catch(e) {
      console.error(`Yükleme hatası: ${file}`, e);
      state.data[file] = { items: [] };
    }
  }
  saveLocal();
  state.loaded = true;
}

function saveLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.data));
}

// ========== Login ==========
function bindLogin() {
  const pwdInput = document.getElementById('login-pwd');
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-err');
  const handle = () => {
    if (pwdInput.value === PASSWORD || pwdInput.value === (state.data.config?.admin?.passwordHash || '')) {
      sessionStorage.setItem(SESSION_KEY, 'ok');
      showApp();
    } else {
      err.classList.remove('hidden');
      pwdInput.focus(); pwdInput.select();
    }
  };
  btn.addEventListener('click', handle);
  pwdInput.addEventListener('keydown', e => { if (e.key==='Enter') handle(); });
  pwdInput.focus();
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
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
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  });
}

function bindHeader() {
  document.getElementById('preview-btn').addEventListener('click', () => {
    window.open('index.html', '_blank');
  });
  document.getElementById('save-btn').addEventListener('click', exportAll);
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
    import:'Geri Yükle'
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
    import: 'Daha önce indirilmiş JSON dosyalarını içe aktar.'
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

  const ecz = state.data.hizmetler?.nobetciEczane;
  const acilCount = state.data.hizmetler?.acilNumaralar?.items?.length || 0;
  const taksiCount = state.data.hizmetler?.taksiler?.items?.length || 0;
  const kayipCount = state.data.hizmetler?.kayipEsya?.items?.length || 0;

  return `
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">${stats}</div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
      <div class="card p-5">
        <div class="flex items-center gap-2 text-sm font-semibold text-ink-900 mb-3"><span>💊</span>Bugün Nöbetçi</div>
        <div class="text-lg font-bold text-ink-900">${ecz?.name || '—'}</div>
        <div class="text-xs text-ink-700/70 mt-1">${ecz?.address || ''}</div>
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
    </div>

    <div class="card p-5 mt-6">
      <div class="flex items-center justify-between mb-3">
        <div class="text-sm font-semibold text-ink-900">Hızlı Erişim</div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-ghost" onclick="navigate('config')">⚙️ Site Ayarları</button>
        <button class="btn btn-ghost" onclick="openAdd('plajlar', PLAJ_SCHEMA)">➕ Plaj Ekle</button>
        <button class="btn btn-ghost" onclick="openAdd('restoranlar', RESTORAN_SCHEMA)">➕ Restoran Ekle</button>
        <button class="btn btn-ghost" onclick="openAdd('turlar', TUR_SCHEMA)">➕ Tur Ekle</button>
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
        <label class="text-xs font-semibold text-ink-700/80">Logo URL</label>
        <input id="cf-logo" type="url" value="${site.logo||''}" class="mb-3" />
        <label class="text-xs font-semibold text-ink-700/80">Favicon URL</label>
        <input id="cf-favicon" type="url" value="${site.favicon||''}" />
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
        <label class="text-xs font-semibold text-ink-700/80">Hero Görsel URL</label>
        <input id="cf-hero" type="url" value="${hero.image||''}" class="mb-3" />
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
  return items.map((it, idx) => {
    const img = it.image ? `<img src="${it.image}" class="w-12 h-12 object-cover rounded" />` : '<div class="w-12 h-12 rounded bg-ink-700/10 grid place-items-center text-lg">📷</div>';
    const cat = it.category ? `<span class="tag">${it.category}</span>` : '';
    const extras = schema.extraColumns ? schema.extraColumns.map(c => `<td>${formatField(it[c.field], c.format)}</td>`).join('') : '';
    const star = it.featured ? '<span class="tag tag-sun">★ Öne</span>' : '<span class="tag tag-mute">—</span>';
    const title = it.name || it.title || '—';
    return `
      <tr>
        <td>${img}</td>
        <td><div class="font-semibold text-ink-900">${escapeHtml(title)}</div><div class="text-xs text-ink-700/60">${escapeHtml((it.summary||'').slice(0,80))}</div></td>
        <td>${cat}</td>
        ${extras}
        <td>${star}</td>
        <td>
          <button class="btn btn-ghost text-xs" onclick="openEdit('${key}', ${idx}, ${schema.name})">Düzenle</button>
          <button class="btn btn-danger text-xs" onclick="deleteItem('${key}', ${idx})">Sil</button>
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
function openEdit(key, idx, schema) {
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
  document.getElementById('form-save').addEventListener('click', () => {
    const out = {};
    schema.fields(state.data[key]).forEach(f => { out[f.key] = readField(f, item[f.key]); });
    if (!out.id && schema.idFromName) out.id = slugify(out.name || out.title || 'kayit-' + Date.now());
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
  return `<div class="${span}"><label class="text-xs font-semibold text-ink-700/80">${f.label}</label><input id="${id}" type="${f.type||'text'}" value="${escapeHtml(v||'')}" placeholder="${f.placeholder||''}" /></div>`;
}

function readField(f, prevValue) {
  const el = document.getElementById(`f-${f.key}`);
  if (!el) return prevValue;
  if (f.type === 'checkbox') return el.checked;
  if (f.type === 'array') return el.value.split(',').map(s=>s.trim()).filter(Boolean);
  if (f.type === 'number') return parseFloat(el.value)||0;
  return el.value.trim();
}

function deleteItem(key, idx) {
  const it = state.data[key].items[idx];
  if (!confirm(`"${it.name||it.title||'Bu kayıt'}" silinsin mi?`)) return;
  state.data[key].items.splice(idx, 1);
  saveLocal();
  renderPage(state.page);
  toast('Silindi.');
}

function closeModal() { document.getElementById('modal').classList.add('hidden'); }

// ========== Special: Eczane / Acil / Taksi / Kayıp ==========
function renderEczane() {
  const e = state.data.hizmetler?.nobetciEczane || {};
  return `
    <div class="card p-6 max-w-2xl">
      <div class="text-sm font-semibold text-ink-900 mb-3">Bugün Nöbetçi Eczane</div>
      <label class="text-xs font-semibold text-ink-700/80">Eczane Adı</label>
      <input id="ecz-name" type="text" value="${e.name||''}" class="mb-3" />
      <label class="text-xs font-semibold text-ink-700/80">Adres</label>
      <textarea id="ecz-address" rows="2">${e.address||''}</textarea>
      <label class="text-xs font-semibold text-ink-700/80 mt-3 block">Telefon</label>
      <input id="ecz-phone" type="tel" value="${e.phone||''}" class="mb-3" />
      <label class="text-xs font-semibold text-ink-700/80">Google Maps URL</label>
      <input id="ecz-map" type="url" value="${e.mapUrl||''}" class="mb-3" />
      <label class="text-xs font-semibold text-ink-700/80">Tarih (YYYY-MM-DD)</label>
      <input id="ecz-date" type="text" value="${e.date||''}" />
      <button id="ecz-save" class="btn btn-primary mt-4">💾 Kaydet</button>
    </div>`;
}
function bindEczane() {
  document.getElementById('ecz-save').addEventListener('click', () => {
    const h = state.data.hizmetler = state.data.hizmetler || {};
    h.nobetciEczane = h.nobetciEczane || {};
    h.nobetciEczane.name = val('ecz-name');
    h.nobetciEczane.address = val('ecz-address');
    h.nobetciEczane.phone = val('ecz-phone');
    h.nobetciEczane.mapUrl = val('ecz-map');
    h.nobetciEczane.date = val('ecz-date');
    saveLocal(); toast('Nöbetçi eczane güncellendi.');
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

function renderKayip() {
  const items = state.data.hizmetler?.kayipEsya?.items || [];
  const rows = items.length ? items.map((it, i) => `
    <tr>
      <td><span class="tag ${it.type==='bulundu'?'tag-ok':'tag-bad'}">${it.type==='bulundu'?'Bulundu':'Kayıp'}</span></td>
      <td>${escapeHtml(it.title||'')}</td>
      <td>${escapeHtml(it.location||'')}</td>
      <td>${escapeHtml(it.date||'')}</td>
      <td>${escapeHtml(it.contact||'')}</td>
      <td><button class="btn btn-danger text-xs" onclick="removeKayip(${i})">Sil</button></td>
    </tr>`).join('') : '<tr><td colspan="6" class="text-center text-ink-700/60 py-8">Henüz kayıt yok.</td></tr>';
  return `
    <div class="card overflow-hidden">
      <table>
        <thead><tr><th>Tür</th><th>Eşya</th><th>Yer</th><th>Tarih</th><th>İletişim</th><th style="width:90px">İşlem</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="mt-4">
      <button class="btn btn-primary" id="kayip-add">➕ Yeni Kayıt</button>
    </div>`;
}
function bindKayip() {
  document.getElementById('kayip-add').addEventListener('click', () => {
    const inner = document.getElementById('modal-inner');
    inner.innerHTML = `
      <div class="px-6 py-4 border-b border-ink-700/8 flex items-center justify-between">
        <div class="font-semibold text-ink-900">Yeni Kayıp/Bulunan</div>
        <button class="text-xl" onclick="closeModal()">×</button>
      </div>
      <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label class="text-xs font-semibold">Tür</label><select id="ky-type"><option value="kayip">Kayıp</option><option value="bulundu">Bulundu</option></select></div>
        <div><label class="text-xs font-semibold">Eşya</label><input id="ky-title" type="text" /></div>
        <div><label class="text-xs font-semibold">Yer</label><input id="ky-loc" type="text" /></div>
        <div><label class="text-xs font-semibold">Tarih</label><input id="ky-date" type="text" placeholder="YYYY-MM-DD" /></div>
        <div class="md:col-span-2"><label class="text-xs font-semibold">İletişim</label><input id="ky-contact" type="text" placeholder="Telefon ya da e-posta" /></div>
        <div class="md:col-span-2"><label class="text-xs font-semibold">Açıklama</label><textarea id="ky-desc" rows="3"></textarea></div>
      </div>
      <div class="px-6 py-4 border-t flex justify-end gap-2">
        <button class="btn btn-ghost" onclick="closeModal()">İptal</button>
        <button class="btn btn-primary" id="ky-save">💾 Ekle</button>
      </div>`;
    document.getElementById('modal').classList.remove('hidden');
    document.getElementById('ky-save').addEventListener('click', () => {
      state.data.hizmetler.kayipEsya = state.data.hizmetler.kayipEsya || { items:[] };
      state.data.hizmetler.kayipEsya.items.unshift({
        type: val('ky-type'), title: val('ky-title'), location: val('ky-loc'),
        date: val('ky-date'), contact: val('ky-contact'), description: val('ky-desc')
      });
      saveLocal(); closeModal(); renderPage('kayip'); toast('Eklendi.');
    });
  });
}
function removeKayip(i) {
  if (!confirm('Silinsin mi?')) return;
  state.data.hizmetler.kayipEsya.items.splice(i,1);
  saveLocal(); renderPage('kayip');
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
  defaults: () => ({id:'', name:'', category:'Halk plajı', tags:[], image:'', rating:4.5, distance:'', drive:'', summary:'', highlights:[], facilities:[], tips:'', best:'', featured:false}),
  fields: () => [
    {key:'name', label:'Plaj Adı'},
    {key:'category', label:'Kategori', type:'select', options:['Halk plajı','Beach club koyu','Gizli koy','Tekne durağı','Doğal SİT','Doğal koy','Tekne koyu']},
    {key:'image', label:'Görsel URL', type:'url', full:true},
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
  defaults: () => ({id:'', name:'', category:'4+1', capacity:'8 kişi', bedrooms:4, bathrooms:3, pool:'Özel havuz', seaView:true, image:'', price:'', priceWeek:'', location:'', tags:[], summary:'', features:[], featured:false}),
  fields: (data) => [
    {key:'name', label:'Villa Adı'},
    {key:'category', label:'Kategori', type:'select', options:data.categories||['2+1','3+1','4+1','5+1','6+1']},
    {key:'image', label:'Görsel URL', type:'url', full:true},
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
  defaults: () => ({id:'', name:'', category:'Tekne Turu', duration:'', price:'', priceNote:'', capacity:'', image:'', rating:4.5, summary:'', includes:[], excludes:[], meetingPoint:'', languages:['TR','EN'], featured:false}),
  fields: (data) => [
    {key:'name', label:'Tur Adı'},
    {key:'category', label:'Kategori', type:'select', options:data.categories||['Tekne Turu','Safari','At Turu','Kano Turu']},
    {key:'image', label:'Görsel URL', type:'url', full:true},
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
  defaults: () => ({id:'', name:'', category:'Türk Mutfağı', cuisine:'', priceRange:'₺₺', rating:4.5, location:'', phone:'', image:'', summary:'', specialties:[], hours:'', reservation:false, featured:false}),
  fields: (data) => [
    {key:'name', label:'Restoran Adı'},
    {key:'category', label:'Kategori', type:'select', options:data.categories||['Fine Dining','Türk Mutfağı','Deniz Ürünleri','Dünya Mutfağı','Kahvaltı & Brunch','Kafe']},
    {key:'cuisine', label:'Mutfak', placeholder:'Akdeniz / Türk'},
    {key:'priceRange', label:'Fiyat Aralığı', type:'select', options:['₺','₺₺','₺₺₺','₺₺₺₺']},
    {key:'image', label:'Görsel URL', type:'url', full:true},
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
  defaults: () => ({id:'', title:'', category:'Etkinlik', date:new Date().toISOString().slice(0,10), image:'', summary:'', content:'', tags:[], featured:false}),
  fields: (data) => [
    {key:'title', label:'Başlık'},
    {key:'category', label:'Kategori', type:'select', options:data.categories||['Etkinlik','Belediye','Restoran','Plaj','Kültür','Hava']},
    {key:'image', label:'Görsel URL', type:'url', full:true},
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
  defaults: () => ({id:'', name:'', category:'Diğer', icon:'', summary:'', details:[], phone:'', whatsapp:'', hours:'', featured:false}),
  fields: (data) => [
    {key:'name', label:'Hizmet Adı'},
    {key:'category', label:'Kategori', type:'select', options:data.categories||['Sağlık','Ulaşım','Alışveriş','Bakım','Kiralama','Resmi','Diğer']},
    {key:'icon', label:'İkon (emoji)', placeholder:'🚐'},
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

bootstrap();
