/**
 * admin/news-moderation.js
 * Kalkan Info — Haber Moderasyon Paneli istemci scripti
 *
 * Gereksinimler:
 *   - Firebase Auth oturumu + custom claim admin:true
 *   - Firestore: newsItems koleksiyonu (firestore.rules: admin only write)
 *   - Cloud Function (callable): triggerPublish({ newsId })
 *   - news-moderation.html içinde import type="module" olarak yüklenir
 *
 * Firebase config: window.FIREBASE_CONFIG (index.html veya hosting env'den inject)
 */

import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider }
                                   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, query, where, orderBy, onSnapshot,
         doc, updateDoc, serverTimestamp, getDocs }
                                   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getFunctions, httpsCallable }
                                   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

// ---------------------------------------------------------------------------
// Firebase init — config gelmelidir (hosting env veya inline script)
// ---------------------------------------------------------------------------
const FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
  apiKey:            'REPLACE_ME',
  authDomain:        'kalkan-info-prod.firebaseapp.com',
  projectId:         'kalkan-info-prod',
  storageBucket:     'kalkan-info-prod.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId:             'REPLACE_ME',
};

const app       = initializeApp(FIREBASE_CONFIG, 'news-moderation');
const auth      = getAuth(app);
const db        = getFirestore(app);
const functions = getFunctions(app, 'europe-west3');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  currentTab:   'pending',
  items:        { pending: [], published: [], rejected: [] },
  selectedIds:  new Set(),
  editingId:    null,
  unsubscribes: [],
};

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Auto sign-in with Google for admin convenience
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch {
      showAuthError('Giriş iptal edildi. Lütfen yönetici hesabınızla giriş yapın.');
    }
    return;
  }

  // Check admin claim
  const token = await user.getIdTokenResult(true);
  if (!token.claims.admin) {
    showAuthError('Bu panele erişim yetkiniz yok. Lütfen yönetici hesabı kullanın.');
    return;
  }

  // Reveal UI
  document.getElementById('auth-guard').style.display = 'none';
  document.getElementById('user-email').textContent = user.email;
  document.getElementById('user-email').classList.remove('hidden');

  startListeners();
});

function showAuthError(msg) {
  const guard = document.getElementById('auth-guard');
  guard.innerHTML = `
    <div class="text-center px-6">
      <p class="text-red-400 text-sm mb-4">${msg}</p>
      <button onclick="location.reload()" class="bg-sea-500 text-white px-5 py-2 rounded-lg text-sm">Tekrar dene</button>
    </div>`;
}

// ---------------------------------------------------------------------------
// Real-time listeners per tab
// ---------------------------------------------------------------------------
function startListeners() {
  const statusMap = {
    pending:   'verified',
    published: 'published',
    rejected:  'rejected',
  };

  for (const [tab, status] of Object.entries(statusMap)) {
    const q = query(
      collection(db, 'newsItems'),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      state.items[tab] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateBadge(tab, state.items[tab].length);
      if (state.currentTab === tab) renderTab(tab);
    }, (err) => {
      console.error('[moderation] Firestore listener error', err);
    });

    state.unsubscribes.push(unsub);
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

  list.innerHTML = '';

  if (items.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const tpl = document.getElementById(`tpl-${tab === 'pending' ? 'pending' : tab}`);

  items.forEach(item => {
    const clone = tpl.content.cloneNode(true);
    const card  = clone.querySelector('[data-news-id]');
    card.dataset.newsId = item.id;

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
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('tr-TR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

function fillPending(clone, item) {
  clone.querySelector('.badge-category').textContent  = item.category || 'genel';
  clone.querySelector('.badge-category').className   += ' ' + categoryBadgeClass(item.category);
  clone.querySelector('.created-at').textContent      = formatDate(item.createdAt);
  clone.querySelector('.summary-text').textContent    = item.verifiedSummary || item.rawText || '—';
  clone.querySelector('.raw-text').textContent        = item.rawText || '—';

  const conf = typeof item.claudeConfidence === 'number' ? item.claudeConfidence : 0;
  clone.querySelector('.conf-label').textContent      = `${Math.round(conf * 100)}%`;
  clone.querySelector('.conf-bar-fill').style.width   = `${Math.round(conf * 100)}%`;
  if (conf >= 0.8) clone.querySelector('.conf-bar-fill').classList.replace('bg-sea-400', 'bg-green-400');
  else if (conf < 0.5) clone.querySelector('.conf-bar-fill').classList.replace('bg-sea-400', 'bg-coral-500');

  // Checkbox
  const cb = clone.querySelector('.bulk-checkbox');
  cb.addEventListener('change', () => {
    const card   = cb.closest('[data-news-id]');
    const newsId = card.dataset.newsId;
    if (cb.checked) state.selectedIds.add(newsId);
    else            state.selectedIds.delete(newsId);
    updateBulkButtons();
  });

  // Publish button
  clone.querySelector('.btn-publish').addEventListener('click', () => {
    const card = clone.querySelector('[data-news-id]') || document.querySelector(`[data-news-id="${item.id}"]`);
    publishItem(item.id);
  });

  // Reject button
  clone.querySelector('.btn-reject').addEventListener('click', () => rejectItem(item.id));

  // Edit button
  clone.querySelector('.btn-edit').addEventListener('click', () => openModal(item));
}

function fillPublished(clone, item) {
  clone.querySelector('.badge-category').textContent = item.category || 'genel';
  clone.querySelector('.badge-category').className  += ' ' + categoryBadgeClass(item.category);
  clone.querySelector('.published-at').textContent   = formatDate(item.publishedAt);
  clone.querySelector('.summary-text').textContent   = item.verifiedSummary || '—';

  // Platform icons
  const container = clone.querySelector('.platform-icons');
  const platforms = item.publishedTo || {};
  const iconMap = {
    youtube:   { label: 'YT',  color: 'bg-red-100 text-red-600' },
    instagram: { label: 'IG',  color: 'bg-pink-100 text-pink-600' },
    facebook:  { label: 'FB',  color: 'bg-blue-100 text-blue-700' },
    twitter:   { label: 'X',   color: 'bg-gray-100 text-gray-700' },
    tiktok:    { label: 'TT',  color: 'bg-black/5 text-gray-800' },
  };
  for (const [platform, res] of Object.entries(platforms)) {
    const meta = iconMap[platform] || { label: platform, color: 'bg-gray-100 text-gray-600' };
    const span = document.createElement('span');
    span.className = `badge ${meta.color} ${res.success ? '' : 'opacity-40 line-through'}`;
    span.title = res.success ? (res.url || 'Başarılı') : (res.error || 'Hata');
    span.textContent = meta.label;
    container.appendChild(span);
  }
}

function fillRejected(clone, item) {
  clone.querySelector('.badge-category').textContent = item.category || 'genel';
  clone.querySelector('.badge-category').className  += ' ' + categoryBadgeClass(item.category);
  clone.querySelector('.created-at').textContent     = formatDate(item.createdAt);
  clone.querySelector('.summary-text').textContent   = item.verifiedSummary || item.rawText || '—';
  clone.querySelector('.reason-text').textContent    = item.claudeReason ? `Sebep: ${item.claudeReason}` : '';
  clone.querySelector('.btn-restore').addEventListener('click', () => restoreItem(item.id));
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function publishItem(newsId) {
  try {
    // Step 1: set adminApproved in Firestore
    await updateDoc(doc(db, 'newsItems', newsId), {
      adminApproved: true,
      updatedAt: serverTimestamp(),
    });

    // Step 2: trigger Pub/Sub via callable wrapper
    const triggerPublish = httpsCallable(functions, 'triggerPublish');
    await triggerPublish({ newsId });

    showToast('Yayın kuyruğuna eklendi.', 'success');
  } catch (err) {
    console.error('[moderation] publishItem error', err);
    showToast(`Hata: ${err.message}`, 'error');
  }
}

async function rejectItem(newsId) {
  try {
    await updateDoc(doc(db, 'newsItems', newsId), {
      status:    'rejected',
      adminApproved: false,
      updatedAt: serverTimestamp(),
    });
    showToast('Haber reddedildi.', 'info');
  } catch (err) {
    showToast(`Hata: ${err.message}`, 'error');
  }
}

async function restoreItem(newsId) {
  try {
    await updateDoc(doc(db, 'newsItems', newsId), {
      status:    'verified',
      adminApproved: false,
      updatedAt: serverTimestamp(),
    });
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
  document.getElementById('bulk-publish-btn').classList.toggle('hidden', !hasSelected);
  document.getElementById('bulk-reject-btn').classList.toggle('hidden', !hasSelected);
}

// ---------------------------------------------------------------------------
// Edit modal
// ---------------------------------------------------------------------------
window.openModal = function(item) {
  state.editingId = item.id;
  const ml = item.summaryML || {};
  document.getElementById('modal-category').value = item.category || 'genel';
  document.getElementById('modal-tr').value = ml.tr || item.verifiedSummary || '';
  document.getElementById('modal-en').value = ml.en || '';
  document.getElementById('modal-ru').value = ml.ru || '';
  document.getElementById('modal-ja').value = ml.ja || '';
  document.getElementById('modal-ar').value = ml.ar || '';
  document.getElementById('modal-image').value = item.coverImageUrl || '';

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

  const summaryML = {
    tr: document.getElementById('modal-tr').value.trim(),
    en: document.getElementById('modal-en').value.trim(),
    ru: document.getElementById('modal-ru').value.trim(),
    ja: document.getElementById('modal-ja').value.trim(),
    ar: document.getElementById('modal-ar').value.trim(),
  };
  const category      = document.getElementById('modal-category').value;
  const coverImageUrl = document.getElementById('modal-image').value.trim() || null;

  try {
    await updateDoc(doc(db, 'newsItems', state.editingId), {
      summaryML,
      verifiedSummary: summaryML.tr,
      category,
      coverImageUrl,
      updatedAt: serverTimestamp(),
    });
    showToast('Kaydedildi.', 'success');
    closeModal();
  } catch (err) {
    showToast(`Kayıt hatası: ${err.message}`, 'error');
  }
};

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
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
