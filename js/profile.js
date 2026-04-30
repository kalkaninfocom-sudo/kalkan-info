/**
 * Kalkan Info — Profil Sayfası Logic
 * Firestore + Firebase Auth ile profil yönetimi
 */

import {
  onAuthStateChanged,
  auth,
  db,
  deleteUser,
} from './auth.js';

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ---------------------------------------------------------------------------
// Auth guard — giriş yoksa login.html'e yönlendir
// ---------------------------------------------------------------------------
let _currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  _currentUser = user;
  await _loadProfile(user);
});

// ---------------------------------------------------------------------------
// Profil yükleme & render
// ---------------------------------------------------------------------------
async function _loadProfile(user) {
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.exists() ? snap.data() : {};

    // Avatar
    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) {
      if (user.photoURL) {
        avatarEl.src = user.photoURL;
      } else {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=1a5e93&color=fff&size=128`;
      }
    }

    // Ad
    const nameEl = document.getElementById('profile-name');
    if (nameEl) nameEl.textContent = data.displayName || user.displayName || '—';

    // E-posta (read-only)
    const emailEl = document.getElementById('profile-email');
    if (emailEl) emailEl.value = user.email || '';

    // Dil dropdown
    const langEl = document.getElementById('profile-lang');
    if (langEl) {
      langEl.value = data.preferredLang || localStorage.getItem('ki_lang') || 'tr';
    }

    // Marketing toggle
    const mktEl = document.getElementById('profile-marketing');
    if (mktEl) {
      mktEl.checked = data.marketingOptIn || false;
    }

    // KVKK tarih
    const kvkkEl = document.getElementById('profile-kvkk-date');
    if (kvkkEl && data.kvkkConsent?.timestamp) {
      kvkkEl.textContent = new Date(data.kvkkConsent.timestamp).toLocaleDateString('tr-TR');
    }

    // Üyelik tarihi
    const joinEl = document.getElementById('profile-joined');
    if (joinEl && data.createdAt) {
      const ts = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      joinEl.textContent = ts.toLocaleDateString('tr-TR');
    }

  } catch (err) {
    console.error('[profile] Profil yükleme hatası:', err);
  }
}

// ---------------------------------------------------------------------------
// Dil değiştirme
// ---------------------------------------------------------------------------
const langSelect = document.getElementById('profile-lang');
if (langSelect) {
  langSelect.addEventListener('change', async () => {
    if (!_currentUser) return;
    const lang = langSelect.value;
    localStorage.setItem('ki_lang', lang);
    try {
      await updateDoc(doc(db, 'users', _currentUser.uid), { preferredLang: lang });
      _showToast('Dil tercihiniz kaydedildi.');
    } catch (err) {
      console.error('[profile] Dil güncelleme hatası:', err);
    }
  });
}

// ---------------------------------------------------------------------------
// Marketing opt-in toggle
// ---------------------------------------------------------------------------
const mktToggle = document.getElementById('profile-marketing');
if (mktToggle) {
  mktToggle.addEventListener('change', async () => {
    if (!_currentUser) return;
    try {
      await updateDoc(doc(db, 'users', _currentUser.uid), {
        marketingOptIn: mktToggle.checked,
      });
      _showToast(mktToggle.checked ? 'Pazarlama bildirimleri açıldı.' : 'Pazarlama bildirimleri kapatıldı.');
    } catch (err) {
      console.error('[profile] Marketing toggle hatası:', err);
    }
  });
}

// ---------------------------------------------------------------------------
// Hesabımı Sil (KVKK Madde 7)
// ---------------------------------------------------------------------------
const deleteBtn = document.getElementById('btn-delete-account');
const deleteModal = document.getElementById('modal-delete');
const deleteCancelBtn = document.getElementById('btn-delete-cancel');
const deleteConfirmBtn = document.getElementById('btn-delete-confirm');

if (deleteBtn) {
  deleteBtn.addEventListener('click', () => {
    if (deleteModal) deleteModal.classList.remove('hidden');
  });
}
if (deleteCancelBtn) {
  deleteCancelBtn.addEventListener('click', () => {
    if (deleteModal) deleteModal.classList.add('hidden');
  });
}
if (deleteConfirmBtn) {
  deleteConfirmBtn.addEventListener('click', async () => {
    if (!_currentUser) return;
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = 'Siliniyor...';
    try {
      // Firestore dokümanını sil
      await deleteDoc(doc(db, 'users', _currentUser.uid));
      // Firebase Auth kullanıcısını sil
      await deleteUser(_currentUser);
      window.location.href = 'index.html';
    } catch (err) {
      console.error('[profile] Hesap silme hatası:', err);
      // Firebase "requires-recent-login" hatası
      if (err.code === 'auth/requires-recent-login') {
        alert('Güvenlik nedeniyle bu işlem için yeniden giriş yapmanız gerekiyor. Çıkış yapılıyor...');
        window.location.href = 'login.html';
      } else {
        alert('Hesap silinirken bir hata oluştu. Lütfen info@kalkaninfo.com adresine yazın.');
      }
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.textContent = 'Hesabımı Sil';
    }
  });
}

// ---------------------------------------------------------------------------
// Verilerimi İndir (KVKK taşınabilirlik)
// ---------------------------------------------------------------------------
const downloadBtn = document.getElementById('btn-download-data');
if (downloadBtn) {
  downloadBtn.addEventListener('click', async () => {
    if (!_currentUser) return;
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Hazırlanıyor...';
    try {
      // Kullanıcı profili
      const userSnap = await getDoc(doc(db, 'users', _currentUser.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};

      // Kullanıcının yorumları
      const reviewsQ = query(
        collection(db, 'reviews'),
        where('authorUid', '==', _currentUser.uid)
      );
      const reviewsSnap = await getDocs(reviewsQ);
      const reviews = reviewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const exportData = {
        exportDate: new Date().toISOString(),
        exportVersion: '1.0',
        user: {
          uid: _currentUser.uid,
          email: _currentUser.email,
          ...userData,
        },
        reviews,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `kalkaninfo-verilerim-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      _showToast('Verileriniz indirildi.');
    } catch (err) {
      console.error('[profile] Veri indirme hatası:', err);
      alert('Veriler indirilemedi. Lütfen tekrar deneyin.');
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Verilerimi İndir';
    }
  });
}

// ---------------------------------------------------------------------------
// UI yardımcıları
// ---------------------------------------------------------------------------
function _showToast(message) {
  const toast = document.createElement('div');
  toast.className = [
    'fixed bottom-6 right-6 z-50 bg-sea-700 text-white text-sm font-medium',
    'px-5 py-3 rounded-lg shadow-deep',
    'transition-opacity duration-300',
  ].join(' ');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
