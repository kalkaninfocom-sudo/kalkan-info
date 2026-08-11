/* ===========================================================================
   Kalkan Sipariş — Shared Ordering Engine (framework-free)
   i18n (TR/EN/DE/RU/FR) · modifiers · cart · checkout · WhatsApp handoff
   Menu strings may be plain strings OR {tr,en,de,ru,fr} objects (L() resolves).
   WhatsApp message is ALWAYS Turkish (the owner reads it), regardless of UI lang.
   Order handoff behind submitOrder(order) → sendViaWhatsApp today, card later.
   Usage:
     KalkanOrder.init({
       brand:{name, slug, whatsapp:'905...', currency:'₺', delivery:'both'|'pickup'|'delivery',
              deliveryFee, minOrder, upsellIds:[], defaultLang:'tr'},
       menuUrl:'./menu.json', mount:{nav:'#ko-nav', menu:'#ko-menu'}, lang:'tr'
     })
   =========================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const UI = {
    tr: { add:'Sepete ekle', required:'Zorunlu', optional:'İsteğe bağlı', maxN:(n)=>`en fazla ${n}`, note:'Not (isteğe bağlı)', notePh:'örn. az şekerli, extra sıcak...', cart:'Sepetin', viewCart:'Sepeti gör', checkout:'Siparişi tamamla', backToMenu:'Menüye dön', emptyTitle:'Sepetin boş', emptySub:'Menüden lezzet eklemeye başla', upsell:'Sıkça eklenenler', subtotal:'Ara toplam', delivery:'Teslimat', total:'Toplam', minOrder:(m)=>`Min. sipariş ${m}`, orderInfo:'Sipariş bilgileri', pickup:'Gel-al', deliveryTab:'Paket / Adres', name:'Ad Soyad', namePh:'Adın', phone:'Telefon', address:'Adres', addressPh:'Mahalle, sokak, bina/daire, tarif', time:'Zaman', orderNote:'Sipariş notu', orderNotePh:'Eklemek istediğin bir şey?', sendWa:'WhatsApp ile gönder', asap:'En kısa sürede', in15:'15 dk sonra', in30:'30 dk sonra', in60:'1 saat sonra', needNamePhone:'Ad ve telefon gerekli', needAddress:'Teslimat için adres gerekli', savedCart:'Sepetin hazır — kaldığın yerden devam et', sent:'Sipariş WhatsApp\'a iletildi ✓', removed:'Üründen çıkarıldı', undo:'Geri al', askPrice:'Fiyat için sorun', close:'Kapat' },
    en: { add:'Add to cart', required:'Required', optional:'Optional', maxN:(n)=>`max ${n}`, note:'Note (optional)', notePh:'e.g. less sugar, extra hot...', cart:'Your cart', viewCart:'View cart', checkout:'Checkout', backToMenu:'Back to menu', emptyTitle:'Your cart is empty', emptySub:'Start adding items from the menu', upsell:'Frequently added', subtotal:'Subtotal', delivery:'Delivery', total:'Total', minOrder:(m)=>`Min. order ${m}`, orderInfo:'Order details', pickup:'Pickup', deliveryTab:'Delivery', name:'Full name', namePh:'Your name', phone:'Phone', address:'Address', addressPh:'District, street, building/flat, notes', time:'Time', orderNote:'Order note', orderNotePh:'Anything to add?', sendWa:'Send via WhatsApp', asap:'As soon as possible', in15:'in 15 min', in30:'in 30 min', in60:'in 1 hour', needNamePhone:'Name and phone required', needAddress:'Address required for delivery', savedCart:'Your cart is saved — pick up where you left off', sent:'Order sent to WhatsApp ✓', removed:'Item removed', undo:'Undo', askPrice:'Ask for price', close:'Close' },
    de: { add:'In den Warenkorb', required:'Erforderlich', optional:'Optional', maxN:(n)=>`max. ${n}`, note:'Notiz (optional)', notePh:'z. B. weniger Zucker, extra heiß...', cart:'Dein Warenkorb', viewCart:'Warenkorb', checkout:'Zur Kasse', backToMenu:'Zurück zum Menü', emptyTitle:'Dein Warenkorb ist leer', emptySub:'Füge Artikel aus dem Menü hinzu', upsell:'Häufig hinzugefügt', subtotal:'Zwischensumme', delivery:'Lieferung', total:'Gesamt', minOrder:(m)=>`Mindestbestellung ${m}`, orderInfo:'Bestelldetails', pickup:'Abholung', deliveryTab:'Lieferung', name:'Name', namePh:'Dein Name', phone:'Telefon', address:'Adresse', addressPh:'Viertel, Straße, Gebäude/Wohnung, Hinweise', time:'Zeit', orderNote:'Bestellnotiz', orderNotePh:'Etwas hinzuzufügen?', sendWa:'Per WhatsApp senden', asap:'So schnell wie möglich', in15:'in 15 Min', in30:'in 30 Min', in60:'in 1 Stunde', needNamePhone:'Name und Telefon erforderlich', needAddress:'Adresse für Lieferung erforderlich', savedCart:'Dein Warenkorb ist gespeichert', sent:'Bestellung an WhatsApp gesendet ✓', removed:'Artikel entfernt', undo:'Rückgängig', askPrice:'Preis erfragen', close:'Schließen' },
    ru: { add:'В корзину', required:'Обязательно', optional:'Необязательно', maxN:(n)=>`макс. ${n}`, note:'Примечание', notePh:'напр. меньше сахара, погорячее...', cart:'Ваша корзина', viewCart:'Корзина', checkout:'Оформить', backToMenu:'Назад в меню', emptyTitle:'Корзина пуста', emptySub:'Добавьте блюда из меню', upsell:'Часто добавляют', subtotal:'Промежуточно', delivery:'Доставка', total:'Итого', minOrder:(m)=>`Мин. заказ ${m}`, orderInfo:'Данные заказа', pickup:'Самовывоз', deliveryTab:'Доставка', name:'Имя и фамилия', namePh:'Ваше имя', phone:'Телефон', address:'Адрес', addressPh:'Район, улица, дом/квартира, ориентир', time:'Время', orderNote:'Примечание к заказу', orderNotePh:'Что-нибудь добавить?', sendWa:'Отправить в WhatsApp', asap:'Как можно скорее', in15:'через 15 мин', in30:'через 30 мин', in60:'через 1 час', needNamePhone:'Нужны имя и телефон', needAddress:'Для доставки нужен адрес', savedCart:'Корзина сохранена', sent:'Заказ отправлен в WhatsApp ✓', removed:'Товар удалён', undo:'Отменить', askPrice:'Уточнить цену', close:'Закрыть' },
    fr: { add:'Ajouter au panier', required:'Obligatoire', optional:'Facultatif', maxN:(n)=>`max ${n}`, note:'Note (facultatif)', notePh:'ex. moins de sucre, très chaud...', cart:'Votre panier', viewCart:'Voir le panier', checkout:'Commander', backToMenu:'Retour au menu', emptyTitle:'Votre panier est vide', emptySub:'Ajoutez des articles du menu', upsell:'Souvent ajoutés', subtotal:'Sous-total', delivery:'Livraison', total:'Total', minOrder:(m)=>`Commande min. ${m}`, orderInfo:'Détails de la commande', pickup:'À emporter', deliveryTab:'Livraison', name:'Nom complet', namePh:'Votre nom', phone:'Téléphone', address:'Adresse', addressPh:'Quartier, rue, bâtiment/appart., indications', time:'Heure', orderNote:'Note de commande', orderNotePh:'Quelque chose à ajouter ?', sendWa:'Envoyer via WhatsApp', asap:'Dès que possible', in15:'dans 15 min', in30:'dans 30 min', in60:'dans 1 heure', needNamePhone:'Nom et téléphone requis', needAddress:'Adresse requise pour la livraison', savedCart:'Votre panier est enregistré', sent:'Commande envoyée sur WhatsApp ✓', removed:'Article supprimé', undo:'Annuler', askPrice:'Demander le prix', close:'Fermer' },
  };

  const LOC = {
    tr: { locHelp: 'Adresi bilmiyor musun? Konumunu paylaş, kuryemiz seni bulsun.', useGps: '📍 Konumumu bul', gotLoc: 'Konum alındı', locating: 'Konum alınıyor…', locErr: 'Konum alınamadı — haritadan işaretle', pinHint: 'Doğru değilse pini sürükle', hotel: 'Otel / Villa adı', hotelPh: 'örn. Villa Deniz / ... Otel, oda 12', addrOpt: 'Adres / tarif (isteğe bağlı)', needLoc: 'Teslimat için konum, otel adı veya adres gerekli' },
    en: { locHelp: "Don't know the address? Share your location and our courier will find you.", useGps: '📍 Use my location', gotLoc: 'Location captured', locating: 'Getting location…', locErr: 'Could not get location — mark it on the map', pinHint: 'Drag the pin if it is not exact', hotel: 'Hotel / Villa name', hotelPh: 'e.g. Villa Deniz / ... Hotel, room 12', addrOpt: 'Address / directions (optional)', needLoc: 'Location, hotel name or address required for delivery' },
    de: { locHelp: 'Adresse unbekannt? Teile deinen Standort, unser Kurier findet dich.', useGps: '📍 Meinen Standort verwenden', gotLoc: 'Standort erfasst', locating: 'Standort wird ermittelt…', locErr: 'Standort nicht möglich — auf der Karte markieren', pinHint: 'Ziehe den Pin, falls ungenau', hotel: 'Hotel / Villa Name', hotelPh: 'z. B. Villa Deniz / ... Hotel, Zimmer 12', addrOpt: 'Adresse / Wegbeschreibung (optional)', needLoc: 'Standort, Hotelname oder Adresse für Lieferung nötig' },
    ru: { locHelp: 'Не знаете адрес? Поделитесь геолокацией — курьер вас найдёт.', useGps: '📍 Определить моё местоположение', gotLoc: 'Местоположение получено', locating: 'Определяем…', locErr: 'Не удалось — отметьте на карте', pinHint: 'Перетащите метку, если неточно', hotel: 'Название отеля / виллы', hotelPh: 'напр. Villa Deniz / ... Otel, номер 12', addrOpt: 'Адрес / ориентир (необязательно)', needLoc: 'Для доставки нужны геолокация, отель или адрес' },
    fr: { locHelp: "Vous ne connaissez pas l'adresse ? Partagez votre position, notre coursier vous trouvera.", useGps: '📍 Utiliser ma position', gotLoc: 'Position enregistrée', locating: 'Localisation…', locErr: 'Impossible — marquez sur la carte', pinHint: "Déplacez le repère si ce n'est pas exact", hotel: 'Nom hôtel / villa', hotelPh: 'ex. Villa Deniz / ... Hôtel, chambre 12', addrOpt: 'Adresse / indications (facultatif)', needLoc: 'Position, nom d\'hôtel ou adresse requis pour la livraison' },
  };
  for (const l in LOC) Object.assign(UI[l], LOC[l]);

  const DINE = {
    tr: { dineinTab: 'Masada', tableNo: 'Masa No', tablePh: 'örn. 7', needTable: 'Masa numarası gerekli' },
    en: { dineinTab: 'Dine-in', tableNo: 'Table No', tablePh: 'e.g. 7', needTable: 'Table number required' },
    de: { dineinTab: 'Am Tisch', tableNo: 'Tisch-Nr', tablePh: 'z. B. 7', needTable: 'Tischnummer erforderlich' },
    ru: { dineinTab: 'За столом', tableNo: 'Стол №', tablePh: 'напр. 7', needTable: 'Нужен номер стола' },
    fr: { dineinTab: 'Sur place', tableNo: 'Table N°', tablePh: 'ex. 7', needTable: 'Numéro de table requis' },
  };
  for (const l in DINE) Object.assign(UI[l], DINE[l]);

  const KO = {
    brand: null, menu: null, groups: {}, cart: [], currency: '₺', lang: 'tr', geo: null,
    orderType: 'pickup', lastFocus: null,

    async init(opts) {
      this.brand = Object.assign({ currency: '₺', delivery: 'both', deliveryFee: 0, minOrder: 0, upsellIds: [], defaultLang: 'tr' }, opts.brand || {});
      this.currency = this.brand.currency;
      this.lang = opts.lang || this.brand.defaultLang || 'tr';
      if (!UI[this.lang]) this.lang = 'tr';
      this.orderType = this.brand.delivery === 'delivery' ? 'delivery' : 'pickup';
      if (this.brand.dineIn) this.orderType = 'dinein';
      this.mount = opts.mount || {};
      const data = opts.menu || await (await fetch(opts.menuUrl)).json();
      this.menu = data; this.groups = data.modifierGroups || {};
      if (data.currency) this.currency = data.currency;
      this.cart = this._loadCart();
      this._buildChrome(); this._renderNav(); this._renderMenu(); this._spy(); this._renderPill();
      if (this.cart.length) this._toast(this.t('savedCart'), null, 2600);
    },

    /* ---------- i18n ---------- */
    L(v, forceLang) {
      if (v == null) return '';
      if (typeof v === 'object') { const l = forceLang || this.lang; return v[l] || v.tr || v.en || Object.values(v)[0] || ''; }
      return v;
    },
    t(key, ...args) { const d = UI[this.lang] || UI.tr; const v = d[key] != null ? d[key] : UI.tr[key]; return typeof v === 'function' ? v(...args) : v; },
    setLang(l) {
      if (!UI[l]) return; this.lang = l;
      this._renderNav(); this._renderMenu(); this._spy(); this._renderPill();
      if (this.drawer) this._renderDrawer();
      document.documentElement.setAttribute('lang', l);
      window.dispatchEvent(new CustomEvent('ko:lang', { detail: { lang: l } }));
    },

    money(n) { return this.currency + Math.round(n).toLocaleString('tr-TR'); },
    _priced(it) { return typeof it.basePrice === 'number' && it.basePrice > 0; },

    /* ---------- rendering: nav + menu ---------- */
    _renderNav() {
      const nav = $(this.mount.nav); if (!nav) return;
      nav.className = 'ko-nav';
      const track = el('div', 'ko-nav__track');
      this.menu.categories.forEach((c, i) => {
        const chip = el('button', 'ko-chip' + (i === 0 ? ' is-active' : ''), esc(this.L(c.name)));
        chip.dataset.cat = c.id;
        chip.onclick = () => { const sec = document.getElementById('ko-sec-' + c.id); if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        track.appendChild(chip);
      });
      nav.innerHTML = ''; nav.appendChild(track);
    },

    _renderMenu() {
      const wrap = $(this.mount.menu); if (!wrap) return;
      wrap.className = 'ko ko-menu'; wrap.innerHTML = '';
      this.menu.categories.forEach(c => {
        const sec = el('section', 'ko-section'); sec.id = 'ko-sec-' + c.id; sec.dataset.cat = c.id;
        sec.appendChild(el('h2', 'ko-section__title', esc(this.L(c.name))));
        if (this.L(c.description)) sec.appendChild(el('p', 'ko-section__sub', esc(this.L(c.description))));
        const grid = el('div', 'ko-grid');
        (c.items || []).forEach(it => grid.appendChild(this._card(it)));
        sec.appendChild(grid); wrap.appendChild(sec);
      });
    },

    _card(it) {
      const hasImg = !!it.image;
      const card = el('article', 'ko-card' + (hasImg ? '' : ' ko-card--nomedia'));
      card.dataset.item = it.id;
      const body = el('div', 'ko-card__body');
      if (it.tags && it.tags[0]) body.appendChild(el('span', 'ko-tag', esc(this.L(it.tags[0]))));
      body.appendChild(el('h3', 'ko-card__name', esc(this.L(it.name))));
      if (this.L(it.description)) body.appendChild(el('p', 'ko-card__desc', esc(this.L(it.description))));
      const priceHtml = this._priced(it)
        ? this.money(it.basePrice) + (this._hasOptions(it) ? "<span style='color:var(--ko-muted);font-weight:600'> +</span>" : '')
        : `<span style="color:var(--ko-muted);font-weight:600">${esc(this.t('askPrice'))}</span>`;
      body.appendChild(el('div', 'ko-card__price', priceHtml));
      card.appendChild(body);
      if (hasImg) {
        const media = el('div', 'ko-card__media');
        const img = el('img'); img.src = it.image; img.alt = esc(this.L(it.name)); img.loading = 'lazy';
        media.appendChild(img); card.appendChild(media);
      }
      const control = el('div'); card.appendChild(control);
      this._paintControl(control, it, card);
      if (it.available === false) { card.style.opacity = '.5'; card.style.pointerEvents = 'none'; }
      return card;
    },

    _paintControl(slot, it, card) {
      const qty = this._simpleQtyInCart(it.id);
      slot.innerHTML = '';
      if (qty > 0 && !this._hasOptions(it)) {
        const step = el('div', 'ko-stepper');
        const minus = el('button', null, '−'); const span = el('span', null, String(qty)); const plus = el('button', null, '+');
        minus.onclick = (e) => { e.stopPropagation(); this._bumpSimple(it, -1); this._paintControl(slot, it, card); };
        plus.onclick = (e) => { e.stopPropagation(); this._bumpSimple(it, 1); this._paintControl(slot, it, card); this._fly(card); };
        step.append(minus, span, plus); slot.appendChild(step);
      } else {
        const add = el('button', 'ko-add', '+'); add.setAttribute('aria-label', this.t('add') + ': ' + esc(this.L(it.name)));
        add.onclick = (e) => {
          e.stopPropagation();
          if (this._hasOptions(it)) this._openItem(it, card);
          else { this._bumpSimple(it, 1); this._paintControl(slot, it, card); this._fly(card); }
        };
        slot.appendChild(add);
      }
    },

    _hasOptions(it) { return (it.modifierGroupIds || []).some(id => this.groups[id]); },
    _refreshCards() { document.querySelectorAll('.ko-card').forEach(card => { const it = this._findItem(card.dataset.item); if (it) this._paintControl(card.lastElementChild, it, card); }); },

    /* ---------- item modifier bottom-sheet ---------- */
    _openItem(it, card) {
      this.lastFocus = document.activeElement;
      const sel = {};
      (it.modifierGroupIds || []).forEach(gid => { const g = this.groups[gid]; if (!g) return; sel[gid] = new Set(); (g.options || []).forEach(o => { if (o.default) sel[gid].add(o.id); }); });
      let qty = 1, note = '';
      const back = el('div', 'ko-sheet-backdrop');
      const sheet = el('div', 'ko ko-sheet'); sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
      sheet.appendChild(el('div', 'ko-sheet__handle'));
      if (it.image) { const hero = el('div', 'ko-sheet__hero'); const img = el('img'); img.src = it.image; img.alt = esc(this.L(it.name)); hero.appendChild(img); sheet.appendChild(hero); }
      const close = el('button', 'ko-sheet__close', '✕'); close.setAttribute('aria-label', this.t('close')); sheet.appendChild(close);
      const scroll = el('div', 'ko-sheet__scroll');
      scroll.appendChild(el('h3', 'ko-sheet__title', esc(this.L(it.name))));
      if (this.L(it.description)) scroll.appendChild(el('p', 'ko-sheet__desc', esc(this.L(it.description))));

      (it.modifierGroupIds || []).forEach(gid => {
        const g = this.groups[gid]; if (!g) return;
        const multi = (g.max || 1) > 1 || g.max === 0; const required = (g.min || 0) >= 1;
        const box = el('div', 'ko-mgroup'); box.dataset.gid = gid;
        const head = el('div', 'ko-mgroup__head');
        head.appendChild(el('div', 'ko-mgroup__name', esc(this.L(g.name)) + (multi && g.max ? ` <span style="color:var(--ko-muted);font-weight:600;font-size:12px">(${esc(this.t('maxN', g.max))})</span>` : '')));
        head.appendChild(el('span', 'ko-mgroup__req ' + (required ? 'ko-mgroup__req--required' : 'ko-mgroup__req--optional'), required ? this.t('required') : this.t('optional')));
        box.appendChild(head);
        (g.options || []).forEach(o => {
          const row = el('label', 'ko-opt' + (sel[gid].has(o.id) ? ' is-selected' : ''));
          row.appendChild(el('span', 'ko-opt__mark' + (multi ? ' ko-opt__mark--sq' : '')));
          row.appendChild(el('span', 'ko-opt__name', esc(this.L(o.name))));
          if (o.priceDelta) row.appendChild(el('span', 'ko-opt__delta', '+' + this.money(o.priceDelta)));
          row.onclick = () => {
            if (multi) { if (sel[gid].has(o.id)) sel[gid].delete(o.id); else { if (g.max && sel[gid].size >= g.max) return this._shake(box); sel[gid].add(o.id); } }
            else { sel[gid].clear(); sel[gid].add(o.id); }
            box.querySelectorAll('.ko-opt').forEach((r, i) => r.classList.toggle('is-selected', sel[gid].has(g.options[i].id)));
            box.classList.remove('is-invalid'); updateFoot();
          };
          box.appendChild(row);
        });
        scroll.appendChild(box);
      });

      const ng = el('div', 'ko-mgroup');
      ng.appendChild(el('label', 'ko-label', this.t('note')));
      const ta = el('textarea', 'ko-note'); ta.maxLength = 200; ta.placeholder = this.t('notePh');
      ta.oninput = () => { note = ta.value; }; ng.appendChild(ta); scroll.appendChild(ng);
      sheet.appendChild(scroll);

      const foot = el('div', 'ko-sheet__foot');
      const qbox = el('div', 'ko-qtybox');
      const qm = el('button', null, '−'), qs = el('span', null, '1'), qp = el('button', null, '+');
      qm.onclick = () => { qty = Math.max(1, qty - 1); qs.textContent = qty; updateFoot(); };
      qp.onclick = () => { qty++; qs.textContent = qty; updateFoot(); };
      qbox.append(qm, qs, qp);
      const addBtn = el('button', 'ko-btn'); foot.append(qbox, addBtn); sheet.appendChild(foot);

      const base = this._priced(it) ? it.basePrice : 0;
      const unit = () => { let p = base; Object.keys(sel).forEach(gid => sel[gid].forEach(oid => { const o = (this.groups[gid].options || []).find(x => x.id === oid); if (o) p += (o.priceDelta || 0); })); return p; };
      const valid = () => (it.modifierGroupIds || []).every(gid => { const g = this.groups[gid]; return !g || (g.min || 0) === 0 || sel[gid].size >= g.min; });
      const updateFoot = () => { addBtn.disabled = !valid(); addBtn.innerHTML = `<span>${esc(this.t('add'))}</span><span class="ko-btn__price">${this.money(unit() * qty)}</span>`; };
      updateFoot();

      addBtn.onclick = () => {
        if (!valid()) { (it.modifierGroupIds || []).forEach(gid => { const g = this.groups[gid]; const gb = sheet.querySelector(`[data-gid="${gid}"]`); if (g && (g.min || 0) >= 1 && sel[gid].size < g.min && gb) { gb.classList.add('is-invalid'); this._shake(gb); } }); return; }
        const mods = [];
        (it.modifierGroupIds || []).forEach(gid => sel[gid].forEach(oid => { const o = (this.groups[gid].options || []).find(x => x.id === oid); if (o) mods.push({ gid, oid, name: o.name, delta: o.priceDelta || 0 }); }));
        this._addLine(it, mods, qty, note, unit());
        this._fly(card); closeSheet();
      };

      close.onclick = closeSheet; back.onclick = closeSheet;
      document.body.append(back, sheet); document.body.classList.add('ko-lock');
      requestAnimationFrame(() => { back.classList.add('is-open'); sheet.classList.add('is-open'); });
      function closeSheet() { back.classList.remove('is-open'); sheet.classList.remove('is-open'); document.body.classList.remove('ko-lock'); setTimeout(() => { back.remove(); sheet.remove(); }, 420); if (KO.lastFocus) KO.lastFocus.focus(); }
      this._escClose(closeSheet);
    },

    _shake(node) { node.classList.remove('is-shake'); void node.offsetWidth; node.classList.add('is-shake'); },

    /* ---------- cart model (stores name objects; resolves per-lang on render) ---------- */
    _lineKey(itemId, mods) { return itemId + '|' + mods.map(m => m.oid).sort().join(','); },
    _addLine(it, mods, qty, note, unit) {
      const key = this._lineKey(it.id, mods) + '|' + (note || '');
      const found = this.cart.find(l => l.key === key);
      if (found) found.qty += qty;
      else this.cart.push({ key, itemId: it.id, name: it.name, mods, qty, note: note || '', unit });
      this._saveCart(); this._renderPill(); this._renderDrawer(); this._refreshCards(); this._bumpBadge();
    },
    _simpleQtyInCart(itemId) { return this.cart.filter(l => l.itemId === itemId && l.mods.length === 0 && !l.note).reduce((s, l) => s + l.qty, 0); },
    _bumpSimple(it, d) {
      const key = this._lineKey(it.id, []) + '|';
      let line = this.cart.find(l => l.key === key);
      if (!line && d > 0) { this.cart.push({ key, itemId: it.id, name: it.name, mods: [], qty: 0, note: '', unit: this._priced(it) ? it.basePrice : 0 }); line = this.cart.find(l => l.key === key); }
      if (!line) return;
      line.qty += d; if (line.qty <= 0) this.cart = this.cart.filter(l => l !== line);
      this._saveCart(); this._renderPill(); this._renderDrawer(); this._bumpBadge();
    },
    _setLineQty(key, q) { const l = this.cart.find(x => x.key === key); if (!l) return; if (q <= 0) { this._removeLine(key); return; } l.qty = q; this._saveCart(); this._renderPill(); this._renderDrawer(); this._refreshCards(); },
    _removeLine(key) {
      const idx = this.cart.findIndex(x => x.key === key); if (idx < 0) return;
      const removed = this.cart[idx]; this.cart.splice(idx, 1);
      this._saveCart(); this._renderPill(); this._renderDrawer(); this._refreshCards();
      this._toast(this.t('removed'), () => { this.cart.splice(idx, 0, removed); this._saveCart(); this._renderPill(); this._renderDrawer(); this._refreshCards(); }, 4000, this.t('undo'));
    },
    _subtotal() { return this.cart.reduce((s, l) => s + l.unit * l.qty, 0); },
    _count() { return this.cart.reduce((s, l) => s + l.qty, 0); },
    _saveCart() { try { localStorage.setItem(this._ck(), JSON.stringify(this.cart)); } catch {} },
    _loadCart() { try { return JSON.parse(localStorage.getItem(this._ck()) || '[]'); } catch { return []; } },
    _ck() { return 'ko_cart_' + (this.brand.slug || this.brand.name || 'x'); },

    /* ---------- floating pill ---------- */
    _buildChrome() { this.pill = el('button', 'ko-pill'); this.pill.onclick = () => this._openDrawer(); document.body.appendChild(this.pill); },
    _renderPill() {
      const c = this._count();
      if (!c) { this.pill.classList.remove('is-visible'); return; }
      this.pill.innerHTML = `<span class="ko-pill__count">${c}</span><span class="ko-pill__label">${esc(this.t('viewCart'))}</span><span class="ko-pill__total">${this.money(this._subtotal())}</span>`;
      this.pill.classList.add('is-visible');
    },
    _bumpBadge() { const b = this.pill.querySelector('.ko-pill__count'); if (b) { b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump'); } },

    /* ---------- cart drawer ---------- */
    _openDrawer() {
      if (this.drawerBack) return this._syncDrawerOpen();
      this.drawerBack = el('div', 'ko-sheet-backdrop'); this.drawer = el('div', 'ko ko-drawer');
      document.body.append(this.drawerBack, this.drawer); this.drawerBack.onclick = () => this._closeDrawer();
      this._renderDrawer(); document.body.classList.add('ko-lock');
      requestAnimationFrame(() => { this.drawerBack.classList.add('is-open'); this.drawer.classList.add('is-open'); });
      this._escClose(() => this._closeDrawer());
    },
    _syncDrawerOpen() { document.body.classList.add('ko-lock'); this.drawerBack.classList.add('is-open'); this.drawer.classList.add('is-open'); },
    _closeDrawer() {
      if (!this.drawer) return;
      this.drawerBack.classList.remove('is-open'); this.drawer.classList.remove('is-open'); document.body.classList.remove('ko-lock');
      setTimeout(() => { if (this.drawerBack) this.drawerBack.remove(); if (this.drawer) this.drawer.remove(); this.drawer = this.drawerBack = null; }, 420);
    },
    _renderDrawer() {
      if (!this.drawer) return;
      const d = this.drawer; d.innerHTML = '';
      d.appendChild(el('div', 'ko-sheet__handle'));
      const head = el('div', 'ko-drawer__head');
      head.appendChild(el('div', 'ko-drawer__title', esc(this.t('cart'))));
      const x = el('button', 'ko-sheet__close', '✕'); x.style.position = 'static'; x.onclick = () => this._closeDrawer(); head.appendChild(x); d.appendChild(head);
      const scroll = el('div', 'ko-drawer__scroll');
      if (!this.cart.length) {
        scroll.appendChild(el('div', 'ko-empty', `<div class="ko-empty__emoji">🛒</div><div style="font-weight:700;color:var(--ko-text)">${esc(this.t('emptyTitle'))}</div><div style="margin-top:4px">${esc(this.t('emptySub'))}</div>`));
      } else {
        this.cart.forEach(l => {
          const line = el('div', 'ko-line'); const left = el('div');
          left.appendChild(el('div', 'ko-line__name', l.qty + '× ' + esc(this.L(l.name))));
          if (l.mods.length) left.appendChild(el('div', 'ko-line__mods', l.mods.map(m => esc(this.L(m.name))).join(' · ')));
          if (l.note) left.appendChild(el('div', 'ko-line__note', this.t('note').split(' ')[0] + ': ' + esc(l.note)));
          const right = el('div', 'ko-line__right');
          if (l.unit > 0) right.appendChild(el('div', 'ko-line__price', this.money(l.unit * l.qty)));
          const step = el('div', 'ko-stepper'); step.style.position = 'static';
          const m = el('button', null, '−'), s = el('span', null, String(l.qty)), p = el('button', null, '+');
          m.onclick = () => this._setLineQty(l.key, l.qty - 1); p.onclick = () => this._setLineQty(l.key, l.qty + 1);
          step.append(m, s, p); right.appendChild(step);
          line.append(left, right); scroll.appendChild(line);
        });
        const ups = this._upsell(); if (ups) scroll.appendChild(ups);
      }
      d.appendChild(scroll);
      const foot = el('div', 'ko-drawer__foot');
      if (this.cart.length) {
        const sub = this._subtotal();
        const r1 = el('div', 'ko-summary'); r1.innerHTML = `<span>${esc(this.t('subtotal'))}</span><span>${this.money(sub)}</span>`; foot.appendChild(r1);
        const r3 = el('div', 'ko-summary ko-summary--total'); r3.innerHTML = `<span>${esc(this.t('total'))}</span><span>${this.money(sub)}</span>`; foot.appendChild(r3);
        const btn = el('button', 'ko-btn ko-btn--block', esc(this.t('checkout')));
        if (this.brand.minOrder && sub < this.brand.minOrder) { btn.disabled = true; btn.textContent = this.t('minOrder', this.money(this.brand.minOrder)); }
        btn.onclick = () => this._openCheckout(); foot.appendChild(btn);
      } else { const btn = el('button', 'ko-btn ko-btn--block', esc(this.t('backToMenu'))); btn.onclick = () => this._closeDrawer(); foot.appendChild(btn); }
      d.appendChild(foot);
    },
    _upsell() {
      const ids = this.brand.upsellIds || []; if (!ids.length) return null;
      const inCart = new Set(this.cart.map(l => l.itemId));
      const items = ids.map(id => this._findItem(id)).filter(x => x && !inCart.has(x.id) && !this._hasOptions(x) && this._priced(x));
      if (!items.length) return null;
      const box = el('div', 'ko-upsell'); box.appendChild(el('div', 'ko-upsell__title', esc(this.t('upsell'))));
      const row = el('div', 'ko-upsell__row');
      items.slice(0, 6).forEach(it => { const b = el('button', 'ko-upsell__item', `+ ${esc(this.L(it.name))} · ${this.money(it.basePrice)}`); b.onclick = () => { this._addLine(it, [], 1, '', it.basePrice); }; row.appendChild(b); });
      box.appendChild(row); return box;
    },

    /* ---------- checkout ---------- */
    _openCheckout() {
      const back = el('div', 'ko-sheet-backdrop');
      const sheet = el('div', 'ko ko-sheet'); sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
      sheet.appendChild(el('div', 'ko-sheet__handle'));
      const close = el('button', 'ko-sheet__close', '✕'); close.onclick = () => closeSheet(); sheet.appendChild(close);
      const scroll = el('div', 'ko-sheet__scroll');
      scroll.appendChild(el('h3', 'ko-sheet__title', esc(this.t('orderInfo'))));
      const both = this.brand.delivery === 'both';
      const dine = !!this.brand.dineIn;
      const mk = (label, ph, type) => { scroll.appendChild(el('label', 'ko-label', label)); const f = el('input', 'ko-field'); f.placeholder = ph; f.type = type || 'text'; scroll.appendChild(f); return f; };
      let bp, bd, bDine;
      if (both || dine) {
        const tg = el('div', 'ko-toggle');
        if (dine) bDine = el('button', this.orderType === 'dinein' ? 'is-active' : '', this.t('dineinTab'));
        bp = el('button', this.orderType === 'pickup' ? 'is-active' : '', this.t('pickup'));
        if (both) bd = el('button', this.orderType === 'delivery' ? 'is-active' : '', this.t('deliveryTab'));
        [bDine, bp, bd].forEach(b => b && tg.appendChild(b)); scroll.appendChild(tg);
      }
      const name = mk(this.t('name') + ' *', this.t('namePh'), 'text');
      const phone = mk(this.t('phone') + (dine ? '' : ' *'), '05xx xxx xx xx', 'tel');
      let tableLbl = null, tableInp = null;
      if (dine) { tableLbl = el('label', 'ko-label', this.t('tableNo') + ' *'); scroll.appendChild(tableLbl); tableInp = el('input', 'ko-field'); tableInp.placeholder = this.t('tablePh'); tableInp.inputMode = 'numeric'; scroll.appendChild(tableInp); }
      this.geo = null;
      const deliv = el('div');
      deliv.appendChild(el('div', 'ko-lochelp', this.t('locHelp')));
      const gpsBtn = el('button', 'ko-locbtn', this.t('useGps'));
      const mapDiv = el('div', 'ko-map'); mapDiv.style.display = 'none';
      deliv.append(gpsBtn, mapDiv);
      deliv.appendChild(el('label', 'ko-label', this.t('hotel')));
      const hotel = el('input', 'ko-field'); hotel.placeholder = this.t('hotelPh'); deliv.appendChild(hotel);
      deliv.appendChild(el('label', 'ko-label', this.t('addrOpt')));
      const addr = el('textarea', 'ko-note'); addr.placeholder = this.t('addressPh'); deliv.appendChild(addr);
      gpsBtn.onclick = () => this._getLocation(mapDiv, gpsBtn);
      scroll.appendChild(deliv);
      const setType = (t) => {
        this.orderType = t;
        [[bDine, 'dinein'], [bp, 'pickup'], [bd, 'delivery']].forEach(([b, v]) => { if (b) b.classList.toggle('is-active', v === t); });
        deliv.style.display = t === 'delivery' ? '' : 'none';
        if (tableInp) { const s = t === 'dinein' ? '' : 'none'; tableInp.style.display = s; tableLbl.style.display = s; }
      };
      setType(this.orderType);
      if (bDine) bDine.onclick = () => setType('dinein');
      if (bp) bp.onclick = () => setType('pickup');
      if (bd) bd.onclick = () => setType('delivery');
      scroll.appendChild(el('label', 'ko-label', this.t('time')));
      const time = el('select', 'ko-field');
      [['asap', this.t('asap')], ['in15', this.t('in15')], ['in30', this.t('in30')], ['in60', this.t('in60')]].forEach(([, label]) => { const o = el('option', null, label); o.value = label; time.appendChild(o); });
      scroll.appendChild(time);
      scroll.appendChild(el('label', 'ko-label', this.t('orderNote')));
      const onote = el('textarea', 'ko-note'); onote.maxLength = 200; onote.placeholder = this.t('orderNotePh'); scroll.appendChild(onote);
      sheet.appendChild(scroll);

      const foot = el('div', 'ko-sheet__foot');
      const btn = el('button', 'ko-btn ko-btn--block');
      const totalNow = () => this._subtotal() + (this.orderType === 'delivery' ? (this.brand.deliveryFee || 0) : 0);
      btn.innerHTML = `<span>${esc(this.t('sendWa'))}</span><span class="ko-btn__price">${this.money(totalNow())}</span>`;
      foot.appendChild(btn); sheet.appendChild(foot);

      btn.onclick = () => {
        const needPhone = this.orderType !== 'dinein';
        if (!name.value.trim() || (needPhone && !phone.value.trim())) { this._toast(this.t('needNamePhone')); [name].concat(needPhone ? [phone] : []).forEach(f => { if (!f.value.trim()) f.style.borderColor = '#c0392b'; }); return; }
        if (this.orderType === 'delivery' && !this.geo && !hotel.value.trim() && !addr.value.trim()) { this._toast(this.t('needLoc')); return; }
        if (this.orderType === 'dinein' && tableInp && !tableInp.value.trim()) { this._toast(this.t('needTable')); tableInp.style.borderColor = '#c0392b'; return; }
        const order = {
          brand: this.brand.name, type: this.orderType === 'dinein' ? ('Masada — Masa ' + (tableInp ? tableInp.value.trim() : '')) : (this.orderType === 'delivery' ? 'Paket / Adres' : 'Gel-al'),
          items: this.cart.map(l => ({ name: this.L(l.name, 'tr'), qty: l.qty, mods: l.mods.map(m => this.L(m.name, 'tr')), note: l.note, lineTotal: l.unit * l.qty, unit: l.unit })),
          subtotal: this._subtotal(), deliveryFee: this.orderType === 'delivery' ? (this.brand.deliveryFee || 0) : 0,
          get total() { return this.subtotal + this.deliveryFee; },
          customer: { name: name.value.trim(), phone: phone.value.trim(), address: this.orderType === 'delivery' ? addr.value.trim() : '', hotel: this.orderType === 'delivery' ? hotel.value.trim() : '', geo: this.orderType === 'delivery' ? this.geo : null },
          time: time.value, note: onote.value.trim(), currency: this.currency,
        };
        this.submitOrder(order); closeSheet();
      };
      close.onclick = closeSheet; back.onclick = closeSheet;
      document.body.append(back, sheet); document.body.classList.add('ko-lock');
      requestAnimationFrame(() => { back.classList.add('is-open'); sheet.classList.add('is-open'); });
      function closeSheet() { back.classList.remove('is-open'); sheet.classList.remove('is-open'); document.body.classList.remove('ko-lock'); setTimeout(() => { back.remove(); sheet.remove(); }, 420); }
      this._escClose(closeSheet);
    },

    /* ---------- order handoff (swap point for card payment) ---------- */
    submitOrder(order) { return this.sendViaWhatsApp(order); },
    sendViaWhatsApp(order) {
      const m = this.money.bind(this);
      const lines = [
        `*Yeni Sipariş — ${order.brand}*`, '—————————————',
        ...order.items.map(l => `${l.qty}× ${l.name}` + (l.mods.length ? ` (${l.mods.join(', ')})` : '') + (l.unit > 0 ? ` — ${m(l.lineTotal)}` : '') + (l.note ? `\n   Not: ${l.note}` : '')),
        '', order.subtotal > 0 ? `*Ara toplam:* ${m(order.subtotal)}` : '',
        order.deliveryFee ? `*Teslimat:* ${m(order.deliveryFee)}` : '',
        order.total > 0 ? `*TOPLAM:* ${m(order.total)}` : '', '',
        `Tip: ${order.type}`, `İsim: ${order.customer.name}`, `Tel: ${order.customer.phone}`,
        order.customer.hotel ? `Otel/Villa: ${order.customer.hotel}` : '',
        order.customer.address ? `Adres: ${order.customer.address}` : '',
        order.customer.geo ? `📍 Konum: https://www.google.com/maps?q=${order.customer.geo.lat.toFixed(6)},${order.customer.geo.lng.toFixed(6)}` : '',
        `Zaman: ${order.time}`, order.note ? `Sipariş notu: ${order.note}` : '',
      ].filter(Boolean).join('\n');
      const url = `https://wa.me/${this.brand.whatsapp}?text=${encodeURIComponent(lines)}`;
      window.open(url, '_blank');
      this.cart = []; this._saveCart(); this._renderPill(); this._closeDrawer(); this._refreshCards();
      this._toast(this.t('sent'), null, 3200);
    },

    /* ---------- public: open/add an item by id (used by featured showcase) ---------- */
    openById(id) {
      const it = this._findItem(id); if (!it) return;
      const card = document.querySelector('.ko-card[data-item="' + id + '"]');
      if (this._hasOptions(it)) this._openItem(it, card || document.body);
      else { this._bumpSimple(it, 1); this._refreshCards(); if (card) this._fly(card); else this._bumpBadge(); }
    },

    /* ---------- helpers ---------- */
    _findItem(id) { for (const c of this.menu.categories) { const it = (c.items || []).find(x => x.id === id); if (it) return it; } return null; },
    _catOf(id) { for (const c of this.menu.categories) if ((c.items || []).some(x => x.id === id)) return c.id; return null; },

    /* ---------- location: GPS + draggable map pin (tourist-friendly delivery) ---------- */
    _getLocation(mapDiv, btn) {
      const fallback = this.brand.geo || { lat: 36.2647, lng: 29.4131 }; // Kalkan center
      const openMap = (center, ok) => { mapDiv.style.display = ''; this._initMap(mapDiv, center); if (ok) { btn.innerHTML = this.t('gotLoc') + ' ✓'; btn.classList.add('is-ok'); } };
      if (!navigator.geolocation) { this.geo = { ...fallback }; openMap(fallback, false); this._toast(this.t('locErr')); return; }
      btn.textContent = this.t('locating');
      navigator.geolocation.getCurrentPosition(
        (pos) => { this.geo = { lat: pos.coords.latitude, lng: pos.coords.longitude }; openMap(this.geo, true); this._toast(this.t('gotLoc') + ' ✓ — ' + this.t('pinHint'), null, 3400); },
        () => { this.geo = { ...fallback }; btn.textContent = this.t('useGps'); openMap(fallback, false); this._toast(this.t('locErr'), null, 3400); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    },
    _loadLeaflet() {
      if (window.L) return Promise.resolve();
      if (this._leafletP) return this._leafletP;
      this._leafletP = new Promise((res) => {
        const c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(c);
        const j = document.createElement('script'); j.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; j.onload = res; j.onerror = res; document.head.appendChild(j);
      });
      return this._leafletP;
    },
    async _initMap(div, center) {
      await this._loadLeaflet();
      const L = window.L; if (!L) return;
      if (this._map) { try { this._map.remove(); } catch {} this._map = null; }
      this._map = L.map(div, { attributionControl: false }).setView([center.lat, center.lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this._map);
      const marker = L.marker([center.lat, center.lng], { draggable: true }).addTo(this._map);
      marker.on('dragend', () => { const p = marker.getLatLng(); this.geo = { lat: p.lat, lng: p.lng }; });
      this._map.on('click', (e) => { marker.setLatLng(e.latlng); this.geo = { lat: e.latlng.lat, lng: e.latlng.lng }; });
      setTimeout(() => { try { this._map.invalidateSize(); } catch {} }, 250);
    },
    _spy() {
      const chips = [...document.querySelectorAll('.ko-chip')];
      const io = new IntersectionObserver((entries) => { entries.forEach(e => { if (e.isIntersecting) { const id = e.target.dataset.cat; chips.forEach(c => c.classList.toggle('is-active', c.dataset.cat === id)); const active = chips.find(c => c.dataset.cat === id); if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } }); }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
      document.querySelectorAll('.ko-section').forEach(s => io.observe(s));
    },
    _fly(card) {
      const img = card.querySelector('img'); const target = this.pill;
      if (!img || !target || !target.classList.contains('is-visible')) return;
      const s = img.getBoundingClientRect(), t = target.getBoundingClientRect();
      const ghost = img.cloneNode(); ghost.className = 'ko-ghost';
      ghost.style.left = s.left + 'px'; ghost.style.top = s.top + 'px'; ghost.style.width = s.width + 'px'; ghost.style.height = s.height + 'px';
      document.body.appendChild(ghost);
      requestAnimationFrame(() => { const dx = (t.left + t.width / 2) - (s.left + s.width / 2); const dy = (t.top + t.height / 2) - (s.top + s.height / 2); ghost.style.transform = `translate(${dx}px, ${dy}px) scale(.15)`; ghost.style.opacity = '0'; });
      setTimeout(() => ghost.remove(), 640);
    },
    _toast(msg, undo, ms, undoLabel) {
      if (this._toastEl) this._toastEl.remove();
      const t = el('div', 'ko-toast'); t.appendChild(el('span', null, esc(msg)));
      if (undo) { const b = el('button', null, undoLabel || this.t('undo')); b.onclick = () => { undo(); t.classList.remove('is-open'); }; t.appendChild(b); }
      document.body.appendChild(t); this._toastEl = t;
      requestAnimationFrame(() => t.classList.add('is-open'));
      clearTimeout(this._toastT); this._toastT = setTimeout(() => { t.classList.remove('is-open'); setTimeout(() => t.remove(), 320); }, ms || 2600);
    },
    _escClose(fn) { const h = (e) => { if (e.key === 'Escape') { fn(); document.removeEventListener('keydown', h); } }; document.addEventListener('keydown', h); },
  };

  window.KalkanOrder = KO;
})();
