/*!
 * lyra-widget.js — KalkanInfo Lyra konsiyerj sohbet widget'ı (drop-in, build gerektirmez)
 * Mimari: docs/KALKANINFO_AI_ARCHITECTURE.md · Faz 0
 *
 * Kullanım (canlı siteye gömme):
 *   <script>
 *     window.LYRA_CONFIG = {
 *       endpoint: 'https://dgichfealzdpfhdgryym.supabase.co/functions/v1/lyra-chat',
 *       anonKey:  '<SUPABASE_ANON_KEY>'   // Supabase edge fn JWT doğrulaması için
 *     };
 *   </script>
 *   <script src="/ai/concierge-widget/lyra-widget.js" defer></script>
 *
 * anonKey yoksa veya endpoint hata verirse widget "çevrimdışı zarif mod"a düşer (yerel örnek yanıt),
 * böylece arayüz her zaman çalışır ve demolanabilir.
 */
(function () {
  'use strict';
  if (window.__lyraWidgetLoaded) return;
  window.__lyraWidgetLoaded = true;

  var CFG = window.LYRA_CONFIG || {};
  var ENDPOINT = CFG.endpoint || '';
  var ANON = CFG.anonKey || '';
  var CONCIERGE_URL = CFG.conciergeData || '/data/concierge.json';
  var conversationId = null;

  // İnsana bağlan (WhatsApp devri) — mevcut concierge ekibi. Fetch başarısızsa fallback.
  var HUMANS_FALLBACK = [
    { name: 'Berkay Elmastaş', role: 'Türkçe destek', flags: '🇹🇷', wa: '905306650794', msg: 'Merhaba Berkay, Kalkan Info üzerinden ulaştım.' },
  ];
  var humans = null;

  // ---- Marka tokenları (kalkaninfo golden-hour koyu lüks) ----
  var C = {
    navy0: '#08243c', navy1: '#061a2c', panel: '#0a2338',
    cream: '#f4ede0', muted: 'rgba(244,237,224,0.62)',
    gold: '#e8a020', goldDeep: '#d68a10', blue: '#4a9ef5',
  };

  // ---- Fontlar ----
  if (!document.getElementById('lyra-fonts')) {
    var f = document.createElement('link'); f.id = 'lyra-fonts'; f.rel = 'stylesheet';
    f.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500;600&display=swap';
    document.head.appendChild(f);
  }

  // ---- Stiller (SVG grain, katmanlı gölge, spring animasyon; yalnız transform/opacity) ----
  var css = ''
    + '#lyra-root{position:fixed;bottom:24px;right:24px;z-index:2147483000;font-family:Inter,system-ui,sans-serif;}'
    + '#lyra-fab{position:relative;width:64px;height:64px;border-radius:50%;border:0;cursor:pointer;'
    +   'background:radial-gradient(120% 120% at 30% 20%,' + C.gold + ' 0%,' + C.goldDeep + ' 70%);'
    +   'box-shadow:0 2px 6px rgba(214,138,16,.35),0 16px 34px -10px rgba(214,138,16,.6),inset 0 1px 0 rgba(255,255,255,.35);'
    +   'transition:transform .22s cubic-bezier(.2,.8,.2,1),box-shadow .25s ease;display:grid;place-items:center;}'
    + '#lyra-fab:hover{transform:translateY(-3px) scale(1.03);box-shadow:0 4px 12px rgba(214,138,16,.45),0 22px 46px -10px rgba(214,138,16,.7);}'
    + '#lyra-fab:active{transform:translateY(-1px) scale(.99);}'
    + '#lyra-fab:focus-visible{outline:3px solid rgba(232,160,32,.55);outline-offset:3px;}'
    + '#lyra-fab .mono{font-family:Montserrat;font-weight:800;font-size:26px;color:#3a1f04;letter-spacing:-.02em;}'
    + '#lyra-fab .ring{position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(232,160,32,.4);animation:lyra-ring 2.8s ease-out infinite;}'
    + '@keyframes lyra-ring{0%{transform:scale(.9);opacity:.8}100%{transform:scale(1.35);opacity:0}}'

    + '#lyra-panel{position:absolute;bottom:80px;right:0;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);'
    +   'display:flex;flex-direction:column;border-radius:22px;overflow:hidden;transform-origin:bottom right;'
    +   'background:linear-gradient(180deg,' + C.navy0 + ' 0%,' + C.navy1 + ' 100%);'
    +   'box-shadow:0 2px 6px rgba(0,0,0,.4),0 30px 70px -16px rgba(4,16,28,.85),0 0 0 1px rgba(255,255,255,.06);'
    +   'opacity:0;transform:translateY(14px) scale(.96);pointer-events:none;'
    +   'transition:opacity .28s ease,transform .32s cubic-bezier(.2,.8,.2,1);}'
    + '#lyra-root.open #lyra-panel{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}'
    + '#lyra-panel::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;'
    +   'background-image:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:3px 3px;}'

    + '.lyra-head{position:relative;padding:16px 18px;display:flex;align-items:center;gap:12px;'
    +   'background:radial-gradient(120% 140% at 20% 0%,rgba(26,94,147,.45),transparent 60%);'
    +   'border-bottom:1px solid rgba(255,255,255,.07);}'
    + '.lyra-av{width:42px;height:42px;border-radius:14px;flex:0 0 auto;display:grid;place-items:center;'
    +   'background:radial-gradient(120% 120% at 30% 20%,' + C.gold + ',' + C.goldDeep + ');'
    +   'font-family:Montserrat;font-weight:800;color:#3a1f04;font-size:19px;box-shadow:inset 0 1px 0 rgba(255,255,255,.35);}'
    + '.lyra-title{font-family:Montserrat;font-weight:700;color:' + C.cream + ';font-size:16px;letter-spacing:-.01em;line-height:1.1;}'
    + '.lyra-sub{font-size:12px;color:' + C.muted + ';display:flex;align-items:center;gap:6px;margin-top:2px;}'
    + '.lyra-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 3px rgba(74,222,128,.18);}'
    + '.lyra-x{background:transparent;border:0;color:' + C.muted + ';cursor:pointer;font-size:20px;line-height:1;'
    +   'width:32px;height:32px;border-radius:10px;transition:background .2s,color .2s;}'
    + '.lyra-x:hover{background:rgba(255,255,255,.08);color:' + C.cream + ';}'
    + '.lyra-x:focus-visible{outline:2px solid rgba(232,160,32,.5);outline-offset:2px;}'

    + '.lyra-body{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin;}'
    + '.lyra-body::-webkit-scrollbar{width:6px}.lyra-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:3px}'
    + '.lyra-msg{max-width:82%;padding:11px 14px;border-radius:16px;font-size:14px;line-height:1.5;opacity:0;transform:translateY(6px);'
    +   'animation:lyra-in .32s cubic-bezier(.2,.8,.2,1) forwards;white-space:pre-wrap;word-wrap:break-word;}'
    + '@keyframes lyra-in{to{opacity:1;transform:none}}'
    + '.lyra-msg.bot{align-self:flex-start;background:rgba(255,255,255,.06);color:' + C.cream + ';border:1px solid rgba(255,255,255,.08);border-bottom-left-radius:6px;}'
    + '.lyra-msg.me{align-self:flex-end;color:#2a1702;border-bottom-right-radius:6px;'
    +   'background:linear-gradient(180deg,' + C.gold + ',' + C.goldDeep + ');box-shadow:0 8px 20px -8px rgba(214,138,16,.55);}'
    + '.lyra-typing{align-self:flex-start;display:flex;gap:4px;padding:12px 15px;background:rgba(255,255,255,.06);border-radius:16px;border-bottom-left-radius:6px;}'
    + '.lyra-typing span{width:7px;height:7px;border-radius:50%;background:' + C.muted + ';animation:lyra-bounce 1.2s infinite ease-in-out}'
    + '.lyra-typing span:nth-child(2){animation-delay:.15s}.lyra-typing span:nth-child(3){animation-delay:.3s}'
    + '@keyframes lyra-bounce{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}'

    + '.lyra-chips{display:flex;flex-wrap:wrap;gap:8px;padding:0 18px 6px;}'
    + '.lyra-chip{padding:9px 14px;border-radius:999px;cursor:pointer;font-size:13px;color:rgba(244,237,224,.9);'
    +   'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);transition:transform .18s,background .2s,border-color .2s;}'
    + '.lyra-chip:hover{transform:translateY(-1px);background:rgba(232,160,32,.16);border-color:rgba(232,160,32,.5);}'
    + '.lyra-chip:focus-visible{outline:2px solid rgba(232,160,32,.5);outline-offset:2px;}'
    + '.lyra-human{margin-left:auto;background:transparent;border:0;color:rgba(244,237,224,.6);cursor:pointer;font-size:16px;width:32px;height:32px;border-radius:10px;transition:background .2s,color .2s;}'
    + '.lyra-human:hover{background:rgba(74,222,128,.14);color:#4ade80;}'
    + '.lyra-human:focus-visible{outline:2px solid rgba(74,222,128,.5);outline-offset:2px;}'
    + '.lyra-humans{display:flex;flex-direction:column;gap:7px;margin-top:9px;}'
    + '.lyra-hchip{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:12px;text-decoration:none;font-size:13px;'
    +   'color:#eafff1;background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.28);transition:background .2s,transform .18s;}'
    + '.lyra-hchip:hover{background:rgba(74,222,128,.2);transform:translateY(-1px);}'
    + '.lyra-hchip b{font-weight:600}.lyra-hchip span{color:rgba(234,255,241,.6);font-size:12px}'

    + '.lyra-input{display:flex;gap:10px;padding:14px;border-top:1px solid rgba(255,255,255,.07);background:rgba(0,0,0,.15);}'
    + '.lyra-input textarea{flex:1;resize:none;max-height:96px;min-height:24px;background:rgba(255,255,255,.06);color:' + C.cream + ';'
    +   'border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:11px 13px;font:500 14px Inter,sans-serif;outline:none;transition:border-color .2s;}'
    + '.lyra-input textarea::placeholder{color:rgba(244,237,224,.4)}'
    + '.lyra-input textarea:focus{border-color:rgba(232,160,32,.55)}'
    + '.lyra-send{flex:0 0 auto;width:44px;height:44px;border-radius:13px;border:0;cursor:pointer;display:grid;place-items:center;'
    +   'background:linear-gradient(180deg,' + C.gold + ',' + C.goldDeep + ');color:#2a1702;'
    +   'box-shadow:0 8px 20px -8px rgba(214,138,16,.6);transition:transform .18s,box-shadow .2s,filter .2s;}'
    + '.lyra-send:hover{transform:translateY(-2px)}.lyra-send:active{transform:translateY(0) scale(.97)}'
    + '.lyra-send:disabled{filter:grayscale(.5) opacity(.6);cursor:default;transform:none;box-shadow:none;}'
    + '.lyra-send:focus-visible{outline:3px solid rgba(232,160,32,.5);outline-offset:2px;}'
    + '.lyra-foot{text-align:center;font-size:11px;color:rgba(244,237,224,.35);padding:0 0 10px;}';

  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ---- DOM ----
  var root = document.createElement('div'); root.id = 'lyra-root';
  root.innerHTML =
    '<div id="lyra-panel" role="dialog" aria-label="Lyra konsiyerj sohbeti">'
    + '<div class="lyra-head">'
    +   '<div class="lyra-av">L</div>'
    +   '<div><div class="lyra-title">Lyra</div><div class="lyra-sub"><span class="lyra-dot"></span>Yapay zeka konsiyerj · çevrimiçi</div></div>'
    +   '<button class="lyra-human" aria-label="İnsana bağlan" title="İnsana bağlan">👤</button>'
    +   '<button class="lyra-x" aria-label="Kapat">&times;</button>'
    + '</div>'
    + '<div class="lyra-body" id="lyra-body"></div>'
    + '<div class="lyra-chips" id="lyra-chips"></div>'
    + '<div class="lyra-input">'
    +   '<textarea id="lyra-ta" rows="1" placeholder="Kalkan\'da ne planlıyorsun?"></textarea>'
    +   '<button class="lyra-send" id="lyra-send" aria-label="Gönder">'
    +     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 12l16-8-6 8 6 8-16-8z" fill="currentColor"/></svg>'
    +   '</button>'
    + '</div>'
    + '<div class="lyra-foot">KalkanInfo AI · öneriler tahminîdir</div>'
    + '</div>'
    + '<button id="lyra-fab" aria-label="Lyra ile konuş"><span class="ring"></span><span class="mono">L</span></button>';
  document.body.appendChild(root);

  var body = root.querySelector('#lyra-body');
  var chips = root.querySelector('#lyra-chips');
  var ta = root.querySelector('#lyra-ta');
  var sendBtn = root.querySelector('#lyra-send');
  var fab = root.querySelector('#lyra-fab');
  var greeted = false;

  var SUGGEST = ['Akşam yemeği ön-', 'En iyi plaj?', 'Tekne turu', 'Villa öner'];
  var SUGGEST_FULL = { 'Akşam yemeği ön-': 'Akşam yemeği için güzel bir yer önerir misin?', 'En iyi plaj?': 'Kalkan\'da en iyi plaj hangisi?', 'Tekne turu': 'Tekne turu hakkında bilgi verir misin?', 'Villa öner': 'Deniz manzaralı villa önerir misin?' };

  function scroll() { body.scrollTop = body.scrollHeight; }
  function addMsg(text, who) { var d = document.createElement('div'); d.className = 'lyra-msg ' + (who === 'me' ? 'me' : 'bot'); d.textContent = text; body.appendChild(d); scroll(); return d; }
  function showTyping() { var t = document.createElement('div'); t.className = 'lyra-typing'; t.id = 'lyra-typing'; t.innerHTML = '<span></span><span></span><span></span>'; body.appendChild(t); scroll(); return t; }
  function hideTyping() { var t = document.getElementById('lyra-typing'); if (t) t.remove(); }

  function renderChips() {
    chips.innerHTML = '';
    SUGGEST.forEach(function (label) {
      var b = document.createElement('button'); b.className = 'lyra-chip'; b.textContent = label;
      b.onclick = function () { send(SUGGEST_FULL[label] || label); };
      chips.appendChild(b);
    });
  }

  function offlineReply(text) {
    var t = text.toLowerCase();
    if (/(merhaba|selam|hello|hi)/.test(t)) return 'Merhaba! Ben Lyra, Kalkan\'ın yapay zeka konsiyerji. Bugün ne planlıyorsun — yemek, plaj, tekne turu?';
    if (/(yemek|restoran|akşam|aksam)/.test(t)) return 'Deniz manzarası seversen Zeugma\'nın terası akşamüstü çok güzel; daha samimi bir şey istersen The Proper\'ı öneririm. Kaç kişilik bakayım?';
    if (/(plaj|beach|kumsal)/.test(t)) return 'Kalamar sakin ve berrak; hareketli bir gün istersen Kaputaş nefes kesici. Yürüyüş mesafesi mi olsun, arabayla mı?';
    if (/(tekne|boat|tur)/.test(t)) return 'Günlük 12 koy turu klasik favori; daha sakini için gün batımı cruise\'u öneririm. Kaç kişi olacaksınız?';
    if (/(villa|konaklama|kal)/.test(t)) return 'Kalamar\'da deniz manzaralı, havuzlu villalar var. Kaç kişi ve hangi tarihler için bakayım?';
    return 'Buradayım — Kalkan\'da yemek, plaj, tekne ya da villa için ne istersin?';
  }

  var sending = false;
  function send(text) {
    text = (text || ta.value || '').trim();
    if (!text || sending) return;
    chips.style.display = 'none';
    addMsg(text, 'me');
    ta.value = ''; ta.style.height = 'auto';
    sending = true; sendBtn.disabled = true;
    var typing = showTyping();

    if (!ENDPOINT || !ANON) { // çevrimdışı zarif mod
      setTimeout(function () { hideTyping(); addMsg(offlineReply(text), 'bot'); sending = false; sendBtn.disabled = false; }, 650);
      return;
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON, 'Authorization': 'Bearer ' + ANON },
      body: JSON.stringify({ conversationId: conversationId, message: text, channel: 'web', lang: document.documentElement.lang || 'tr' }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        hideTyping();
        if (d && d.ok) { conversationId = d.conversationId || conversationId; addMsg(d.reply || offlineReply(text), 'bot'); }
        else { addMsg(offlineReply(text), 'bot'); }
      })
      .catch(function () { hideTyping(); addMsg(offlineReply(text), 'bot'); })
      .finally(function () { sending = false; sendBtn.disabled = false; ta.focus(); });
  }

  function openPanel() {
    root.classList.add('open');
    if (!greeted) {
      greeted = true;
      setTimeout(function () { addMsg('Merhaba, ben Lyra 👋 Kalkan\'ın yapay zeka konsiyerjiyim, sana rehberlik etmek için buradayım. Ne planlıyorsun?', 'bot'); renderChips(); }, 200);
    }
    setTimeout(function () { ta.focus(); }, 320);
  }
  function closePanel() { root.classList.remove('open'); }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // İnsana bağlan — ekip WhatsApp kartları (mevcut concierge devri Lyra içine taşındı)
  function renderHumans() {
    if (!root.classList.contains('open')) openPanel();
    var list = (humans && humans.length) ? humans : HUMANS_FALLBACK;
    var wrap = document.createElement('div'); wrap.className = 'lyra-msg bot';
    wrap.innerHTML = 'Dilersen ekibimizden biriyle doğrudan WhatsApp\'tan konuşabilirsin:' +
      '<div class="lyra-humans">' + list.map(function (h) {
        return '<a class="lyra-hchip" href="https://wa.me/' + esc(h.wa) + '?text=' + encodeURIComponent(h.msg || '') + '" target="_blank" rel="noopener">' +
          '<b>' + esc(h.flags || '') + ' ' + esc(h.name) + '</b><span>· ' + esc(h.role || '') + '</span></a>';
      }).join('') + '</div>';
    body.appendChild(wrap); scroll();
  }

  // Ekip verisini yükle (best-effort; başarısızsa fallback kullanılır)
  fetch(CONCIERGE_URL).then(function (r) { return r.json(); }).then(function (d) {
    if (d && Array.isArray(d.agents)) {
      humans = d.agents.map(function (a) {
        return { name: a.name, role: a.role, flags: (a.languageFlags || []).join(''), wa: a.whatsappRaw, msg: a.defaultMessage || '' };
      }).filter(function (x) { return x.wa; });
    }
  }).catch(function () {});

  fab.onclick = function () { root.classList.contains('open') ? closePanel() : openPanel(); };
  root.querySelector('.lyra-x').onclick = closePanel;
  root.querySelector('.lyra-human').onclick = renderHumans;
  sendBtn.onclick = function () { send(); };
  ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 96) + 'px'; });
  ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('open')) closePanel(); });

  // Public API — mevcut #concierge / [data-concierge] tetikleyicileri Lyra'yı açsın
  window.Lyra = { open: openPanel, close: closePanel, human: renderHumans };
})();
