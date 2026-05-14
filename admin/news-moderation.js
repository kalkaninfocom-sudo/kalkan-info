/**
 * admin/news-moderation.js
 * Kalkan Info — Haber Moderasyon Paneli (Supabase port — Faz 2.5)
 *
 * Gereksinimler:
 *   - Supabase Auth oturumu + raw_app_meta_data.role = 'admin'
 *   - public.news_items tablosu (RLS: news_admin_write — sadece admin yazabilir)
 *   - Edge Function: TODO `verify-news-item` / `publish-news-item` (şimdilik manuel)
 *
 * Status eşleştirmesi (Firestore → Postgres enum moderation_status):
 *   pending  →  'pending'   (claude-verified, admin onayı bekleyen)
 *   active   →  'active'    (yayınlandı)
 *   rejected →  'rejected'
 *   archived →  'archived'
 *
 * Tab key'leri eski UI ile uyumlu:
 *   pending → status='pending'
 *   published → status='active'
 *   rejected → status='rejected'
 */

import { supabase } from '../js/supabase-client.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  currentTab:   'pending',
  items:        { pending: [], published: [], rejected: [] },
  selectedIds:  new Set(),
  editingId:    null,
  channels:     [],   // realtime channel subscriptions
};

const STATUS_MAP = {
  pending:   'pending',
  published: 'active',
  rejected:  'rejected',
};

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
async function _bootstrap() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Auto sign-in: OAuth redirect (Google)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      });
      if (error) throw error;
    } catch (err) {
      showAuthError('Giriş başarısız. Lütfen yönetici hesabınızla giriş yapın.');
    }
    return;
  }

  // Admin claim kontrolü — app_metadata.role veya raw_app_meta_data.role = 'admin'
  const isAdmin =
    user.app_metadata?.role === 'admin' ||
    user.user_metadata?.role === 'admin';

  if (!isAdmin) {
    showAuthError('Bu panele erişim yetkiniz yok. Lütfen yönetici hesabı kullanın.');
    return;
  }

  // Reveal UI
  document.getElementById('auth-guard').style.display = 'none';
  document.getElementById('user-email').textContent = user.email;
  document.getElementById('user-email').classList.remove('hidden');

  await startListeners();
}

// DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _bootstrap);
} else {
  _bootstrap();
}

function showAuthError(msg) {
  const guard = document.getElementById('auth-guard');
  if (!guard) return;
  guard.innerHTML = `
    <div class="text-center px-6">
      <p class="text-red-400 text-sm mb-4">${msg}</p>
      <button onclick="location.reload()" class="bg-sea-500 text-white px-5 py-2 rounded-lg text-sm">Tekrar dene</button>
    </div>`;
}

// ---------------------------------------------------------------------------
// İlk fetch + realtime listeners per tab
// ---------------------------------------------------------------------------
async function startListeners() {
  for (const [tab, status] of Object.entries(STATUS_MAP)) {
    // İlk dolum
    await _refreshTab(tab, status);

    // Realtime subscription — INSERT/UPDATE/DELETE
    const channel = supabase
      .channel(`news-${tab}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'news_items', filter: `status=eq.${status}` },
        () => _refreshTab(tab, status)
      )
      .subscribe();

    state.channels.push(channel);
  }
}

async function _refreshTab(tab, status) {
  try {
    const { data, error } = await supabase
      .from('news_items')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });
    if (error) throw error;
    state.items[tab] = data || [];
    updateBadge(tab, state.items[tab].length);
    if (state.currentTab === tab) renderTab(tab);
  } catch (err) {
    console.error('[moderation] _refreshTab error', err);
  }
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------
window.switchTab = function(tab) {
  state.currentTab = tab;
  state.selectedIds.clear();
  updateBulkButtons();

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== `tab-${tab}`);
  });

  renderTab(tab);
};

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------
function renderTab(tab) {
  const items = state.items[tab] || [];
  const list  = document.getElementById(`${tab}-list`);
  const empty = document.getElementById(`${tab}-empty`);
  if (!list || !empty) return;

  list.innerHTML = '';

  if (items.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const tpl = document.getElementById(`tpl-${tab === 'pending' ? 'pending' : tab}`);
  if (!tpl) return;

  items.forEach(item => {
    const clone = tpl.content.cloneNode(true);
    const card  = clone.querySelector('[data-news-id]');
    if (card) card.dataset.newsId = item.id;

    if (tab === 'pending')   fillPending(clone, item);
    if (tab === 'published') fillPublished(clone, item);
    if (tab === 'rejected')  fillRejected(clone, item);

    list.appendChild(clone);
  });
}

function categoryBadgeClass(category) {
  const map = {
    acil:     'bg-red-100 text-red-700',
    etkinlik: 'bg-purple-100 text-purple-700',
    genel:    'bg-sea-100 text-sea-700',
    eczane:   'bg-green-100 text-green-700',
    hava:     'bg-sky-100 text-sky-700',
  };
  return map[category] || 'bg-gray-100 text-gray-600';
}

function formatDate(ts) {
  if (!ts) return '';
  const d = typeof ts === 'string' ? new Date(ts) : (ts.toDate ? ts.toDate() : new Date(ts));
  return d.toLocaleString('tr-TR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

// Postgres news_items satırından eski Firestore alan adlarına eşleştirme yardımcısı
function _pick(item, snakeKey, camelKey) {
  return item[snakeKey] ?? item[camelKey] ?? null;
}

function _summaryML(item) {
  // social_status veya data JSONB içinde olabilir; tablo şemasında ayrı alan yok.
  // Eski Firestore'da summaryML.tr/en/ru/ja/ar vardı — şimdi data.summary_ml olarak tut.
  return item.summary_ml || item.data?.summary_ml || {};
}

function fillPending(clone, item) {
  const catEl = clone.querySelector('.badge-category');
  if (catEl) {
    catEl.textContent = item.category || 'genel';
    catEl.className   += ' ' + categoryBadgeClass(item.category);
  }
  const createdEl = clone.querySelector('.created-at');
  if (createdEl) createdEl.textContent = formatDate(item.created_at);

  const summaryEl = clone.querySelector('.summary-text');
  if (summaryEl) summaryEl.textContent = item.summary || item.content || '—';

  const rawEl = clone.querySelector('.raw-text');
  if (rawEl) rawEl.textContent = item.content || '—';

  // claude_confidence — data JSONB içinde tutuluyor (eski alan adı korundu)
  const conf = typeof item.data?.claude_confidence === 'number' ? item.data.claude_confidence : 0;
  const confLabel = clone.querySelector('.conf-label');
  if (confLabel) confLabel.textContent = `${Math.round(conf * 100)}%`;
  const confBar = clone.querySelector('.conf-bar-fill');
  if (confBar) {
    confBar.style.width = `${Math.round(conf * 100)}%`;
    if (conf >= 0.8) confBar.classList.replace('bg-sea-400', 'bg-green-400');
    else if (conf < 0.5) confBar.classList.replace('bg-sea-400', 'bg-coral-500');
  }

  // Checkbox
  const cb = clone.querySelector('.bulk-checkbox');
  if (cb) {
    cb.addEventListener('change', () => {
      const card   = cb.closest('[data-news-id]');
      const newsId = card?.dataset.newsId;
      if (!newsId) return;
      if (cb.checked) state.selectedIds.add(newsId);
      else            state.selectedIds.delete(newsId);
      updateBulkButtons();
    });
  }

  // Publish button
  clone.querySelector('.btn-publish')?.addEventListener('click', () => publishItem(item.id));
  // Reject button
  clone.querySelector('.btn-reject')?.addEventListener('click', () => rejectItem(item.id));
  // Edit button
  clone.querySelector('.btn-edit')?.addEventListener('click', () => openModal(item));
}

function fillPublished(clone, item) {
  const catEl = clone.querySelector('.badge-category');
  if (catEl) {
    catEl.textContent = item.category || 'genel';
    catEl.className  += ' ' + categoryBadgeClass(item.category);
  }
  const publishedEl = clone.querySelector('.published-at');
  if (publishedEl) publishedEl.textContent = formatDate(item.published_at);

  const summaryEl = clone.querySelector('.summary-text');
  if (summaryEl) summaryEl.textContent = item.summary || '—';

  // Platform icons — social_status JSONB içinde
  const container = clone.querySelector('.platform-icons');
  if (container) {
    const platforms = item.social_status || {};
    const iconMap = {
      youtube:   { label: 'YT',  color: 'bg-red-100 text-red-600' },
      instagram: { label: 'IG',  color: 'bg-pink-100 text-pink-600' },
      facebook:  { label: 'FB',  color: 'bg-blue-100 text-blue-700' },
      twitter:   { label: 'X',   color: 'bg-gray-100 text-gray-700' },
      tiktok:    { label: 'TT',  color: 'bg-black/5 text-gray-800' },
    };
    for (const [platform, res] of Object.entries(platforms)) {
      const meta = iconMap[platform] || { label: platform, color: 'bg-gray-100 text-gray-600' };
      // res string ('queued','posted','failed') veya object olabilir
      const success = typeof res === 'object' ? res.success : (res === 'posted');
      const title   = typeof res === 'object' ? (res.url || res.error || '') : res;
      const span = document.createElement('span');
      span.className = `badge ${meta.color} ${success ? '' : 'opacity-40 line-through'}`;
      span.title = title;
      span.textContent = meta.label;
      container.appendChild(span);
    }
  }
}

function fillRejected(clone, item) {
  const catEl = clone.querySelector('.badge-category');
  if (catEl) {
    catEl.textContent = item.category || 'genel';
    catEl.className  += ' ' + categoryBadgeClass(item.category);
  }
  const createdEl = clone.querySelector('.created-at');
  if (createdEl) createdEl.textContent = formatDate(item.created_at);

  const summaryEl = clone.querySelector('.summary-text');
  if (summaryEl) summaryEl.textContent = item.summary || item.content || '—';

  const reasonEl = clone.querySelector('.reason-text');
  if (reasonEl) reasonEl.textContent = item.data?.claude_reason ? `Sebep: ${item.data.claude_reason}` : '';

  clone.querySelector('.btn-restore')?.addEventListener('click', () => restoreItem(item.id));
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function publishItem(newsId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('news_items')
      .update({
        status:       'active',
        verified_at:  new Date().toISOString(),
        verified_by:  user?.id || null,
        published_at: new Date().toISOString(),
      })
      .eq('id', newsId);
    if (error) throw error;

    // TODO: edge function `publish-news-item` — sosyal medya entegrasyonu için
    // şu an manual approve. Berkay Faz 3'te yazacak.
    // await supabase.functions.invoke('publish-news-item', { body: { newsId } });

    showToast('Yayına alındı.', 'success');
  } catch (err) {
    console.error('[moderation] publishItem error', err);
    showToast(`Hata: ${err.message}`, 'error');
  }
}

async function rejectItem(newsId) {
  try {
    const { error } = await supabase
      .from('news_items')
      .update({ status: 'rejected' })
      .eq('id', newsId);
    if (error) throw error;
    showToast('Haber reddedildi.', 'info');
  } catch (err) {
    showToast(`Hata: ${err.message}`, 'error');
  }
}

async function restoreItem(newsId) {
  try {
    const { error } = await supabase
      .from('news_items')
      .update({ status: 'pending' })
      .eq('id', newsId);
    if (error) throw error;
    showToast('Haber onay kuyruğuna taşındı.', 'info');
  } catch (err) {
    showToast(`Hata: ${err.message}`, 'error');
  }
}

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------
window.bulkAction = async function(action) {
  const ids = [...state.selectedIds];
  if (ids.length === 0) return;

  const confirmed = confirm(`${ids.length} haberi ${action === 'publish' ? 'yayınlamak' : 'reddetmek'} istediğinizden emin misiniz?`);
  if (!confirmed) return;

  for (const newsId of ids) {
    if (action === 'publish') await publishItem(newsId);
    else                      await rejectItem(newsId);
  }

  state.selectedIds.clear();
  updateBulkButtons();
};

function updateBulkButtons() {
  const hasSelected = state.selectedIds.size > 0 && state.currentTab === 'pending';
  document.getElementById('bulk-publish-btn')?.classList.toggle('hidden', !hasSelected);
  document.getElementById('bulk-reject-btn')?.classList.toggle('hidden', !hasSelected);
}

// ---------------------------------------------------------------------------
// Edit modal
// ---------------------------------------------------------------------------
window.openModal = function(item) {
  state.editingId = item.id;
  const ml = _summaryML(item);
  document.getElementById('modal-category').value = item.category || 'genel';
  document.getElementById('modal-tr').value = ml.tr || item.summary || '';
  document.getElementById('modal-en').value = ml.en || '';
  document.getElementById('modal-ru').value = ml.ru || '';
  document.getElementById('modal-ja').value = ml.ja || '';
  document.getElementById('modal-ar').value = ml.ar || '';
  document.getElementById('modal-image').value = item.cover_image || '';

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-overlay').classList.add('flex');
};

window.closeModal = function() {
  state.editingId = null;
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-overlay').classList.remove('flex');
};

window.saveModal = async function() {
  if (!state.editingId) return;

  const summary_ml = {
    tr: document.getElementById('modal-tr').value.trim(),
    en: document.getElementById('modal-en').value.trim(),
    ru: document.getElementById('modal-ru').value.trim(),
    ja: document.getElementById('modal-ja').value.trim(),
    ar: document.getElementById('modal-ar').value.trim(),
  };
  const category    = document.getElementById('modal-category').value;
  const cover_image = document.getElementById('modal-image').value.trim() || null;

  try {
    // Mevcut data JSONB'sini koru, summary_ml'i içine yerleştir
    const { data: current } = await supabase
      .from('news_items')
      .select('data')
      .eq('id', state.editingId)
      .single();

    const newData = { ...(current?.data || {}), summary_ml };

    const { error } = await supabase
      .from('news_items')
      .update({
        summary:     summary_ml.tr,
        category,
        cover_image,
        data:        newData,
      })
      .eq('id', state.editingId);

    if (error) throw error;

    showToast('Kaydedildi.', 'success');
    closeModal();
  } catch (err) {
    showToast(`Kayıt hatası: ${err.message}`, 'error');
  }
};

// Close modal on overlay click
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
});

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
function updateBadge(tab, count) {
  const el = document.getElementById(`badge-${tab}`);
  if (el) el.textContent = count;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
function showToast(msg, type = 'info') {
  const colors = { success: 'bg-green-500', error: 'bg-coral-500', info: 'bg-sea-500' };
  const toast = document.createElement('div');
  toast.className = `fixed bottom-6 right-6 z-50 ${colors[type]} text-white text-sm font-500 px-5 py-3 rounded-xl shadow-deep transition-opacity`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}
