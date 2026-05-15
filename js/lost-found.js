/**
 * lost-found.js — Kayıp & Bulunan ilan sistemi
 * Kayıt: kullanıcı form doldurur → silme kodu üretilir → localStorage'a yazılır
 * Sil: kullanıcı kodu girer → eşleşirse silinir
 * Admin: tüm kayıtları + kodu görür
 */

(function () {
  'use strict';

  const LS_KEY = 'kalkan_lost_found_v1';

  const CATEGORIES = [
    { v: 'anahtar',  l: 'Anahtar',           i: '🔑' },
    { v: 'telefon',  l: 'Telefon',           i: '📱' },
    { v: 'cuzdan',   l: 'Cüzdan / Para',     i: '👛' },
    { v: 'canta',    l: 'Çanta / Sırt çantası', i: '🎒' },
    { v: 'kiyafet',  l: 'Kıyafet',           i: '👕' },
    { v: 'ayakkabi', l: 'Ayakkabı',          i: '👟' },
    { v: 'aksesuar', l: 'Saat / Takı / Aksesuar', i: '⌚' },
    { v: 'gozluk',   l: 'Gözlük',            i: '👓' },
    { v: 'belge',    l: 'Belge / Kimlik',    i: '📄' },
    { v: 'hayvan',   l: 'Evcil hayvan',      i: '🐾' },
    { v: 'cocuk',    l: 'Çocuk eşyası',      i: '🧸' },
    { v: 'plaj',     l: 'Plaj eşyası',       i: '🩴' },
    { v: 'diger',    l: 'Diğer',             i: '📦' },
  ];

  const _icon = v => CATEGORIES.find(c => c.v === v)?.i || '📦';
  const _label = v => CATEGORIES.find(c => c.v === v)?.l || v;
  const _esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

  function _read() {
    try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : { items: [] }; }
    catch { return { items: [] }; }
  }
  function _write(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      return { ok: true };
    } catch (e) {
      // QuotaExceededError — büyük base64 görseller yüzünden olabilir
      console.warn('[lost-found] localStorage write failed:', e?.name || e);
      return { ok: false, error: e };
    }
  }

  function _genCode(len = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ambiguous chars (0/O, 1/I/L) excluded
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  async function _fileToDataUrl(file, maxDim = 1200, quality = 0.78) {
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
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', quality);
  }

  // ============== Public render (hizmetler.html) ==============
  function _itemCard(it) {
    const isLost = it.type === 'kayip';
    const tag = isLost
      ? '<span class="text-[10px] font-bold uppercase tracking-wide bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">🔍 Kayıp</span>'
      : '<span class="text-[10px] font-bold uppercase tracking-wide bg-sun-100 text-sun-700 border border-sun-200 px-2 py-0.5 rounded-full">✓ Bulundu</span>';
    const cover = (Array.isArray(it.images) && it.images[0]) || '';
    const tel = (it.phone || '').replace(/\s/g, '');
    return `
      <article class="rounded-xl bg-white border border-sea-100 overflow-hidden hover:border-sea-300 transition" data-lf-id="${_esc(it.id)}">
        <div class="aspect-[4/3] bg-sea-50 grid place-items-center text-5xl overflow-hidden">
          ${cover ? `<img src="${_esc(cover)}" alt="" class="w-full h-full object-cover" />` : _icon(it.category)}
        </div>
        <div class="p-4">
          <div class="flex items-center justify-between gap-2 mb-2">
            ${tag}
            <span class="text-[11px] text-sea-500">${_esc(it.date || '')}</span>
          </div>
          <h3 class="font-display font-bold text-sea-800 leading-tight">${_esc(it.itemName || '—')}</h3>
          <div class="text-xs text-sea-600/80 mt-1">${_icon(it.category)} ${_esc(_label(it.category))}${it.location ? ` · 📍 ${_esc(it.location)}` : ''}</div>
          ${it.description ? `<p class="text-xs text-sea-700/80 mt-2 line-clamp-3">${_esc(it.description)}</p>` : ''}
          <div class="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-sea-100">
            <div class="flex gap-2">
              ${it.phone ? `<a href="tel:${_esc(tel)}" class="text-xs bg-sea-50 hover:bg-sea-100 text-sea-700 px-2.5 py-1 rounded font-semibold">📞 Ara</a>` : ''}
              ${it.whatsapp ? `<a href="https://wa.me/${_esc(it.whatsapp.replace(/\D/g,''))}" target="_blank" rel="noopener" class="text-xs bg-sun-50 hover:bg-sun-100 text-sun-700 px-2.5 py-1 rounded font-semibold">💬 WhatsApp</a>` : ''}
            </div>
            <button data-lf-action="delete" data-id="${_esc(it.id)}" class="text-[11px] text-sea-500 hover:text-rose-500 transition" title="Sahibi misin? Kodunla sil.">🗑 Sil</button>
          </div>
        </div>
      </article>`;
  }

  function _renderList() {
    const data = _read();
    const items = (data.items || []).slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const lostList = document.getElementById('lf-list-lost');
    const foundList = document.getElementById('lf-list-found');
    const emptyEl = document.getElementById('lf-empty');
    if (!lostList || !foundList) return;
    const lost = items.filter(i => i.type === 'kayip');
    const found = items.filter(i => i.type === 'bulundu');
    const lostCnt = document.getElementById('lf-count-lost');
    const foundCnt = document.getElementById('lf-count-found');
    if (lostCnt) lostCnt.textContent = lost.length;
    if (foundCnt) foundCnt.textContent = found.length;
    lostList.innerHTML = lost.map(_itemCard).join('');
    foundList.innerHTML = found.map(_itemCard).join('');
    if (emptyEl) emptyEl.classList.toggle('hidden', items.length > 0);
  }

  // ============== Form modal ==============
  function _openForm(type) {
    const isLost = type === 'kayip';
    const overlay = document.createElement('div');
    overlay.id = 'lf-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(7,33,54,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);font-family:'Inter',system-ui,sans-serif;">
        <div style="padding:18px 22px;border-bottom:1px solid #cfdfee;display:flex;align-items:center;justify-content:space-between;">
          <h3 style="margin:0;font-family:'Montserrat',sans-serif;font-weight:800;color:#0a2e4c;font-size:18px;">${isLost ? '🔍 Kayıp Eşya Bildir' : '✓ Bulduğum Eşyayı Bildir'}</h3>
          <button id="lf-close" style="border:0;background:#eaf2f9;color:#0a2e4c;width:32px;height:32px;border-radius:9999px;cursor:pointer;font-size:18px;">×</button>
        </div>
        <div style="padding:18px 22px;display:grid;gap:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:700;color:#0d3a5f;margin-bottom:4px;">Eşyanın Adı / Cinsi *</label>
            <input id="lf-name" type="text" maxlength="80" placeholder="${isLost ? 'Örn: Mavi sırt çantası' : 'Örn: Bulduğum eşyanın kısa tanımı'}" style="width:100%;border:1.5px solid #9cc0dd;border-radius:8px;padding:10px 12px;font-size:14px;outline:none;" />
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:700;color:#0d3a5f;margin-bottom:4px;">Kategori *</label>
            <select id="lf-category" style="width:100%;border:1.5px solid #9cc0dd;border-radius:8px;padding:10px 12px;font-size:14px;outline:none;background:#fff;">
              ${CATEGORIES.map(c => `<option value="${c.v}">${c.i} ${c.l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:700;color:#0d3a5f;margin-bottom:4px;">Açıklama (renk, marka, ayırt edici özellikler) *</label>
            <textarea id="lf-desc" rows="3" maxlength="500" placeholder="Ne kadar detaylı olursa o kadar iyi…" style="width:100%;border:1.5px solid #9cc0dd;border-radius:8px;padding:10px 12px;font-size:14px;outline:none;resize:vertical;font-family:inherit;"></textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:700;color:#0d3a5f;margin-bottom:4px;">${isLost ? 'Kaybedildiği' : 'Bulunduğu'} Yer *</label>
              <input id="lf-location" type="text" maxlength="120" placeholder="Örn: Kalamar Plajı yakını" style="width:100%;border:1.5px solid #9cc0dd;border-radius:8px;padding:10px 12px;font-size:14px;outline:none;" />
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:700;color:#0d3a5f;margin-bottom:4px;">Tarih *</label>
              <input id="lf-date" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:100%;border:1.5px solid #9cc0dd;border-radius:8px;padding:10px 12px;font-size:14px;outline:none;" />
            </div>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:700;color:#0d3a5f;margin-bottom:4px;">Görsel (opsiyonel — birden çok seçebilirsiniz)</label>
            <input id="lf-files" type="file" accept="image/*" multiple style="font-size:13px;" />
            <div id="lf-thumbs" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;"></div>
          </div>
          <div style="border-top:1px solid #cfdfee;padding-top:14px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#0d3a5f;">İletişim Bilgileri *  <span style="font-weight:400;color:#5d97c4;">(en az bir yöntem)</span></p>
            <div style="display:grid;gap:8px;">
              <input id="lf-name-owner" type="text" maxlength="80" placeholder="Adınız (opsiyonel)" style="border:1.5px solid #9cc0dd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;" />
              <input id="lf-phone"      type="tel"  placeholder="Telefon" style="border:1.5px solid #9cc0dd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;" />
              <input id="lf-whatsapp"   type="tel"  placeholder="WhatsApp (uluslararası: +90...)" style="border:1.5px solid #9cc0dd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;" />
              <input id="lf-email"      type="email" placeholder="E-posta" style="border:1.5px solid #9cc0dd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;" />
            </div>
          </div>
          <div id="lf-err" style="display:none;color:#c0392b;font-size:13px;font-weight:600;background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;"></div>
        </div>
        <div style="padding:14px 22px;border-top:1px solid #cfdfee;display:flex;justify-content:flex-end;gap:8px;">
          <button id="lf-cancel" style="border:1.5px solid #9cc0dd;background:#fff;color:#134c79;font-weight:600;font-size:13px;padding:8px 16px;border-radius:8px;cursor:pointer;">İptal</button>
          <button id="lf-save"   style="border:0;background:#1a5e93;color:#fff;font-family:'Montserrat',sans-serif;font-weight:700;font-size:13px;padding:8px 18px;border-radius:8px;cursor:pointer;">${isLost ? 'Kayıp İlanını Yayınla' : 'Bulduğum İlanı Yayınla'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#lf-close').onclick = close;
    overlay.querySelector('#lf-cancel').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    let pendingImages = [];
    const filesInput = overlay.querySelector('#lf-files');
    const thumbs = overlay.querySelector('#lf-thumbs');
    filesInput.addEventListener('change', async () => {
      const files = Array.from(filesInput.files || []).slice(0, 4 - pendingImages.length);
      for (const f of files) {
        if (!/^image\//.test(f.type)) continue;
        try {
          const dataUrl = await _fileToDataUrl(f);
          pendingImages.push(dataUrl);
        } catch(e) { console.warn('[lost-found] image failed', e); }
      }
      filesInput.value = '';
      thumbs.innerHTML = pendingImages.map((u, i) => `
        <div style="position:relative;width:64px;height:64px;border-radius:6px;overflow:hidden;border:1px solid #cfdfee;">
          <img src="${u}" style="width:100%;height:100%;object-fit:cover;" />
          <button type="button" data-rm="${i}" style="position:absolute;top:2px;right:2px;width:18px;height:18px;border:0;border-radius:9999px;background:rgba(7,33,54,0.7);color:#fff;font-size:11px;cursor:pointer;">×</button>
        </div>`).join('');
      thumbs.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
        pendingImages.splice(parseInt(b.dataset.rm, 10), 1);
        filesInput.dispatchEvent(new Event('change'));
      });
    });

    overlay.querySelector('#lf-save').onclick = () => {
      const errEl = overlay.querySelector('#lf-err');
      const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
      const itemName = overlay.querySelector('#lf-name').value.trim();
      const category = overlay.querySelector('#lf-category').value;
      const desc     = overlay.querySelector('#lf-desc').value.trim();
      const location = overlay.querySelector('#lf-location').value.trim();
      const date     = overlay.querySelector('#lf-date').value;
      const ownerName = overlay.querySelector('#lf-name-owner').value.trim();
      const phone     = overlay.querySelector('#lf-phone').value.trim();
      const whatsapp  = overlay.querySelector('#lf-whatsapp').value.trim();
      const email     = overlay.querySelector('#lf-email').value.trim();
      if (!itemName) return showErr('Eşyanın adını girin.');
      if (!desc)     return showErr('Açıklama girin (renk, marka vb.).');
      if (!location) return showErr('Yer bilgisini girin.');
      if (!date)     return showErr('Tarih girin.');
      if (!phone && !whatsapp && !email) return showErr('En az bir iletişim yolu girin (telefon, whatsapp veya e-posta).');

      const id = 'lf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const code = _genCode(6);
      const item = {
        id, type, itemName, category, description: desc, location, date,
        ownerName, phone, whatsapp, email,
        images: pendingImages,
        deleteCode: code,
        createdAt: new Date().toISOString(),
      };
      const data = _read();
      data.items = data.items || [];
      data.items.push(item);
      let writeResult = _write(data);

      // Quota aşıldıysa görselleri düşürerek tekrar dene
      if (!writeResult.ok && pendingImages.length) {
        item.images = []; // görselsiz kaydet
        writeResult = _write(data);
      }
      if (!writeResult.ok) {
        // Yine de başarısızsa son eklenen kaydı geri al ve kullanıcıya bildir
        data.items.pop();
        return showErr('Tarayıcı depolama alanı dolu. Lütfen birkaç eski ilanı silin veya küçük görsel kullanın.');
      }

      // Success — show code modal
      overlay.querySelector('#lf-save').disabled = true;
      overlay.querySelector('div').innerHTML = `
        <div style="padding:32px 28px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">${type === 'kayip' ? '🔍' : '✓'}</div>
          <h3 style="margin:0 0 6px;font-family:'Montserrat',sans-serif;font-weight:800;color:#0a2e4c;font-size:20px;">İlan Yayınlandı!</h3>
          <p style="color:#134c79;font-size:14px;margin:0 0 16px;">İlanın diğer kullanıcılar tarafından görünüyor. ${type === 'kayip' ? 'Eşyanı bulduklarında sana ulaşabilirler.' : 'Sahibi olabilecek kişiler iletişime geçebilir.'}</p>
          <div style="background:#fff7ed;border:2px dashed #f59e0b;border-radius:12px;padding:16px;margin:20px 0;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#78350f;">Silme Kodun</p>
            <p style="margin:0;font-family:ui-monospace,monospace;font-size:32px;font-weight:800;color:#92400e;letter-spacing:0.15em;">${code}</p>
            <p style="margin:8px 0 0;font-size:12px;color:#78350f;">⚠️ Bu kodu kaybetme — ilanını silmek için <strong>tek yol</strong>. Kaybedersen Kalkan Info'ya yazıp talep edebilirsin.</p>
          </div>
          <div style="display:flex;gap:8px;justify-content:center;">
            <button id="lf-copy-code" style="border:1.5px solid #9cc0dd;background:#fff;color:#134c79;font-weight:600;font-size:13px;padding:10px 18px;border-radius:8px;cursor:pointer;">📋 Kodu Kopyala</button>
            <button id="lf-done" style="border:0;background:#1a5e93;color:#fff;font-family:'Montserrat',sans-serif;font-weight:700;font-size:13px;padding:10px 22px;border-radius:8px;cursor:pointer;">Tamam</button>
          </div>
        </div>`;
      overlay.querySelector('#lf-copy-code').onclick = async () => {
        try { await navigator.clipboard.writeText(code); overlay.querySelector('#lf-copy-code').textContent = '✓ Kopyalandı'; }
        catch { prompt('Kodu kopyala:', code); }
      };
      overlay.querySelector('#lf-done').onclick = () => { close(); _renderList(); };
    };
  }

  function _openDelete(id) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(7,33,54,0.7);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;max-width:380px;width:100%;padding:24px;font-family:'Inter',system-ui,sans-serif;text-align:center;">
        <div style="font-size:36px;margin-bottom:6px;">🔐</div>
        <h3 style="margin:0 0 6px;font-family:'Montserrat',sans-serif;font-weight:800;color:#0a2e4c;">İlanı Sil</h3>
        <p style="color:#134c79;font-size:13px;margin:0 0 14px;">İlanı yayınladığında verdiğimiz <strong>silme kodunu</strong> girin.</p>
        <input id="lf-del-code" type="text" maxlength="6" placeholder="ABC123" autocomplete="off" inputmode="text" style="width:100%;border:2px solid #9cc0dd;border-radius:8px;padding:12px;font-size:18px;font-family:ui-monospace,monospace;letter-spacing:0.15em;text-align:center;text-transform:uppercase;outline:none;" />
        <p id="lf-del-err" style="color:#c0392b;font-size:12px;margin:8px 0 0;display:none;"></p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;">
          <button id="lf-del-cancel" style="border:1.5px solid #9cc0dd;background:#fff;color:#134c79;font-weight:600;font-size:13px;padding:8px 16px;border-radius:8px;cursor:pointer;">İptal</button>
          <button id="lf-del-go" style="border:0;background:#e74c3c;color:#fff;font-family:'Montserrat',sans-serif;font-weight:700;font-size:13px;padding:8px 18px;border-radius:8px;cursor:pointer;">Sil</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#lf-del-cancel').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#lf-del-go').onclick = () => {
      const code = (overlay.querySelector('#lf-del-code').value || '').trim().toUpperCase();
      if (!code) return;
      const data = _read();
      const idx = (data.items || []).findIndex(i => i.id === id);
      if (idx < 0) { close(); return; }
      if (data.items[idx].deleteCode !== code) {
        const err = overlay.querySelector('#lf-del-err');
        err.textContent = '✕ Kod hatalı.';
        err.style.display = 'block';
        return;
      }
      data.items.splice(idx, 1);
      _write(data);
      close();
      _renderList();
    };
    overlay.querySelector('#lf-del-code').focus();
  }

  // ============== Mount ==============
  function _mount() {
    document.querySelectorAll('[data-action="lf-new"]').forEach(btn => {
      btn.addEventListener('click', () => _openForm(btn.dataset.lfType || 'kayip'));
    });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-lf-action="delete"]');
      if (!b) return;
      _openDelete(b.dataset.id);
    });
    _renderList();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _mount);
  else _mount();

  // Public API
  window.KalkanLostFound = { open: _openForm, render: _renderList, read: _read, categories: CATEGORIES };
})();
