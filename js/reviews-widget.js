// Reviews widget — <div data-reviews data-type="restaurant" data-id="xxx" data-name="..."></div>
// Liste approved review'leri + auth gerekli yazma form'u.
(function () {
  const SUPABASE = window.SUPABASE_CLIENT || (window.supabase && window.SUPABASE_URL ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null);

  const STR = {
    tr: { title:'Yorumlar', empty:'Henüz yorum yok — ilk siz olun.', write:'Yorum Yaz', login:'Yorum yazmak için giriş yapın', submit:'Gönder', cancel:'Vazgeç', rating:'Puanınız', body:'Yorumunuz', placeholder:'Deneyiminizi paylaşın…', thanks:'Teşekkürler — yorumunuz onaya gönderildi.', error:'Bir hata oluştu, tekrar deneyin.', stars:'%d yıldız' },
    en: { title:'Reviews', empty:'No reviews yet — be the first.', write:'Write a Review', login:'Sign in to write a review', submit:'Submit', cancel:'Cancel', rating:'Your rating', body:'Your review', placeholder:'Share your experience…', thanks:'Thank you — your review is pending approval.', error:'Something went wrong, please retry.', stars:'%d stars' },
    de: { title:'Bewertungen', empty:'Noch keine Bewertungen — sei der/die Erste.', write:'Bewertung schreiben', login:'Bitte einloggen, um zu bewerten', submit:'Senden', cancel:'Abbrechen', rating:'Deine Bewertung', body:'Dein Kommentar', placeholder:'Teile deine Erfahrung…', thanks:'Danke — deine Bewertung wartet auf Freigabe.', error:'Ein Fehler ist aufgetreten.', stars:'%d Sterne' },
    ru: { title:'Отзывы', empty:'Пока нет отзывов — будьте первыми.', write:'Написать отзыв', login:'Войдите, чтобы оставить отзыв', submit:'Отправить', cancel:'Отменить', rating:'Ваша оценка', body:'Ваш отзыв', placeholder:'Поделитесь опытом…', thanks:'Спасибо — ваш отзыв ожидает одобрения.', error:'Произошла ошибка.', stars:'%d звёзд' },
    fr: { title:'Avis', empty:'Pas encore d\'avis — soyez le premier.', write:'Écrire un avis', login:'Connectez-vous pour écrire un avis', submit:'Envoyer', cancel:'Annuler', rating:'Votre note', body:'Votre avis', placeholder:'Partagez votre expérience…', thanks:'Merci — votre avis attend modération.', error:'Une erreur est survenue.', stars:'%d étoiles' },
  };

  function getLang() {
    try { return (localStorage.getItem('lang') || document.documentElement.lang || 'tr').slice(0,2); } catch (_) { return 'tr'; }
  }

  function track(name, props) { if (window.plausible) window.plausible(name, props ? { props } : undefined); }

  function escapeHTML(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function starsHTML(rating) {
    let s = '';
    for (let i = 1; i <= 5; i++) {
      s += `<span style="color:${i<=rating?'#f4b53d':'#cfdfee'};">★</span>`;
    }
    return s;
  }

  function injectStyles() {
    if (document.getElementById('rv-styles')) return;
    const s = document.createElement('style'); s.id = 'rv-styles';
    s.textContent = [
      '.rv-section{margin:24px 0;font-family:"Inter",system-ui,sans-serif;color:#0a2e4c;}',
      '.rv-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;}',
      '.rv-title{font-family:"Montserrat",sans-serif;font-weight:800;font-size:18px;letter-spacing:-0.01em;}',
      '.rv-aggr{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#5d97c4;}',
      '.rv-write-btn{background:#0a2e4c;color:#fff;border:0;border-radius:8px;padding:9px 14px;font-family:"Montserrat",sans-serif;font-weight:700;font-size:12px;letter-spacing:0.04em;cursor:pointer;transition:background .18s ease,transform .15s ease;}',
      '.rv-write-btn:hover{background:#072136;transform:translateY(-1px);}',
      '.rv-list{display:grid;gap:10px;}',
      '.rv-item{background:#fff;border:1px solid #cfdfee;border-radius:10px;padding:12px 14px;}',
      '.rv-item-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}',
      '.rv-author{font-weight:700;font-size:13px;color:#0a2e4c;}',
      '.rv-date{font-size:11px;color:#5d97c4;}',
      '.rv-body{margin-top:6px;font-size:13.5px;line-height:1.55;color:#1f3b56;}',
      '.rv-empty{color:#5d97c4;font-size:13px;padding:14px 0;text-align:center;}',
      '.rv-form{background:#fff;border:1px solid #cfdfee;border-radius:10px;padding:14px;margin-top:10px;display:none;}',
      '.rv-form.open{display:block;}',
      '.rv-form label{display:block;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5d97c4;margin-bottom:6px;}',
      '.rv-form input,.rv-form textarea{width:100%;padding:10px 12px;border:1px solid #cfdfee;border-radius:8px;font-family:inherit;font-size:13px;color:#0a2e4c;}',
      '.rv-form textarea{min-height:80px;resize:vertical;}',
      '.rv-stars{display:flex;gap:4px;font-size:24px;cursor:pointer;}',
      '.rv-stars span{transition:transform .12s ease;}',
      '.rv-stars span:hover{transform:scale(1.15);}',
      '.rv-form-row{margin-bottom:12px;}',
      '.rv-form-actions{display:flex;gap:8px;justify-content:flex-end;}',
      '.rv-form-actions button{padding:9px 14px;border-radius:8px;font-family:"Montserrat",sans-serif;font-weight:700;font-size:12px;cursor:pointer;border:0;transition:background .18s ease;}',
      '.rv-submit{background:#e89812;color:#fff;}',
      '.rv-submit:hover{background:#c97b09;}',
      '.rv-cancel{background:#eef4f9;color:#0a2e4c;}',
      '.rv-msg{padding:10px;border-radius:8px;font-size:13px;margin-top:8px;}',
      '.rv-msg.ok{background:#dcfce7;color:#15803d;}',
      '.rv-msg.err{background:#fee2e2;color:#991b1b;}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function renderItem(r) {
    const date = new Date(r.created_at).toLocaleDateString('tr-TR', { year:'numeric', month:'short', day:'numeric' });
    return `
      <div class="rv-item">
        <div class="rv-item-head">
          <div>
            <div class="rv-author">${escapeHTML(r.author_name || 'Anonim')}</div>
            <div>${starsHTML(r.rating)}</div>
          </div>
          <div class="rv-date">${date}</div>
        </div>
        ${r.title ? `<div style="font-weight:700;margin-top:6px;">${escapeHTML(r.title)}</div>` : ''}
        ${r.body ? `<div class="rv-body">${escapeHTML(r.body)}</div>` : ''}
      </div>`;
  }

  function renderForm(host, str) {
    let selectedRating = 5;
    const formHtml = `
      <div class="rv-form open">
        <div class="rv-form-row">
          <label>${str.rating}</label>
          <div class="rv-stars" data-rv-stars>
            ${[1,2,3,4,5].map(i => `<span data-rv-star="${i}" style="color:${i<=5?'#f4b53d':'#cfdfee'};">★</span>`).join('')}
          </div>
        </div>
        <div class="rv-form-row">
          <label>${str.body}</label>
          <textarea data-rv-body placeholder="${str.placeholder}" maxlength="2000"></textarea>
        </div>
        <div class="rv-form-actions">
          <button type="button" class="rv-cancel" data-rv-cancel>${str.cancel}</button>
          <button type="button" class="rv-submit" data-rv-submit>${str.submit}</button>
        </div>
        <div data-rv-msg></div>
      </div>`;
    const wrap = document.createElement('div');
    wrap.innerHTML = formHtml;
    host.appendChild(wrap);

    const stars = wrap.querySelectorAll('[data-rv-star]');
    stars.forEach(st => {
      st.addEventListener('click', () => {
        selectedRating = parseInt(st.dataset.rvStar, 10);
        stars.forEach((s, i) => s.style.color = (i+1) <= selectedRating ? '#f4b53d' : '#cfdfee');
      });
    });

    wrap.querySelector('[data-rv-cancel]').addEventListener('click', () => wrap.remove());

    wrap.querySelector('[data-rv-submit]').addEventListener('click', async () => {
      const body = wrap.querySelector('[data-rv-body]').value.trim();
      const msg = wrap.querySelector('[data-rv-msg]');
      if (!SUPABASE) { msg.className = 'rv-msg err'; msg.textContent = str.error; return; }
      const { data: { user } } = await SUPABASE.auth.getUser();
      const payload = {
        entity_type: host.dataset.type,
        entity_id: host.dataset.id,
        rating: selectedRating,
        body: body || null,
        language: getLang(),
        user_id: user?.id || null,
        author_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || null,
        status: 'pending',
      };
      const { error } = await SUPABASE.from('reviews').insert(payload);
      if (error) { msg.className = 'rv-msg err'; msg.textContent = error.message || str.error; return; }
      msg.className = 'rv-msg ok'; msg.textContent = str.thanks;
      track('review_submit', { type: host.dataset.type, entity: host.dataset.id, rating: selectedRating });
      setTimeout(() => wrap.remove(), 2400);
    });
  }

  async function init() {
    const hosts = document.querySelectorAll('[data-reviews]:not([data-reviews-init])');
    if (!hosts.length) return;
    injectStyles();
    const lang = getLang();
    const str = STR[lang] || STR.tr;

    for (const host of hosts) {
      host.setAttribute('data-reviews-init', '1');
      const type = host.dataset.type;
      const id = host.dataset.id;
      if (!type || !id) continue;

      // Skeleton
      host.innerHTML = `
        <div class="rv-section">
          <div class="rv-head">
            <div>
              <div class="rv-title">${str.title}</div>
              <div class="rv-aggr" data-rv-aggr>—</div>
            </div>
            <button type="button" class="rv-write-btn" data-rv-write>${str.write}</button>
          </div>
          <div class="rv-list" data-rv-list><div class="rv-empty">${str.empty}</div></div>
        </div>
      `;

      // Fetch reviews
      if (SUPABASE) {
        try {
          const [{ data: list }, { data: aggr }] = await Promise.all([
            SUPABASE.from('reviews').select('id,author_name,rating,title,body,created_at').eq('entity_type', type).eq('entity_id', id).eq('status', 'approved').order('created_at', { ascending: false }).limit(50),
            SUPABASE.from('reviews_aggregate').select('rating_avg,review_count').eq('entity_type', type).eq('entity_id', id).maybeSingle(),
          ]);
          const listEl = host.querySelector('[data-rv-list]');
          if (list && list.length) {
            listEl.innerHTML = list.map(renderItem).join('');
          }
          if (aggr) {
            host.querySelector('[data-rv-aggr]').innerHTML = `${starsHTML(Math.round(aggr.rating_avg))} ${aggr.rating_avg} (${aggr.review_count})`;
          }
        } catch (e) {
          console.warn('[reviews]', e.message);
        }
      }

      host.querySelector('[data-rv-write]').addEventListener('click', async () => {
        if (!SUPABASE) return;
        track('review_open', { type, entity: id });
        renderForm(host.querySelector('.rv-section'), str);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
