/**
 * Kalkan Info — Profil Sayfası Logic
 * Supabase Postgres + Auth ile profil yönetimi
 */

import {
  safeOnAuthStateChanged,
  isSupabaseConfigured,
  isFirebaseConfigured,
} from './auth.js';
import { supabase } from './supabase-client.js';

// ---------------------------------------------------------------------------
// Auth guard — giriş yoksa login.html'e yönlendir
// ---------------------------------------------------------------------------
let _currentUser = null;

safeOnAuthStateChanged(async (user) => {
  if (!user) {
    if (isSupabaseConfigured) {
      window.location.href = 'login.html';
    }
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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[profile] Profil yükleme hatası:', error.message);
    }

    const profile = data ?? {};

    // Avatar
    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) {
      const photoUrl = profile.photo_url || user.user_metadata?.avatar_url;
      if (photoUrl) {
        avatarEl.src = photoUrl;
      } else {
        const displayName = profile.display_name || user.email || '';
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1a5e93&color=fff&size=128`;
      }
    }

    // Ad — hem sidebar display hem form input
    const displayName = profile.display_name
      || user.user_metadata?.full_name
      || user.user_metadata?.name
      || user.email?.split('@')[0]
      || '—';
    const nameEl = document.getElementById('profile-name');
    if (nameEl) nameEl.textContent = displayName;
    const nameInput = document.getElementById('profile-name-input');
    if (nameInput) nameInput.value = displayName === '—' ? '' : displayName;

    // E-posta — disabled input + sidebar display
    const emailEl = document.getElementById('profile-email');
    if (emailEl) emailEl.value = user.email || '';
    const emailDisplay = document.getElementById('profile-email-display');
    if (emailDisplay) emailDisplay.textContent = user.email || '';

    // Dil dropdown
    const langEl = document.getElementById('profile-lang');
    if (langEl) {
      langEl.value = profile.preferred_lang || localStorage.getItem('ki_lang') || 'tr';
    }

    // Marketing toggle
    const mktEl = document.getElementById('profile-marketing');
    if (mktEl) {
      mktEl.checked = profile.marketing_opt_in || false;
    }

    // KVKK tarih
    const kvkkEl = document.getElementById('profile-kvkk-date');
    if (kvkkEl && profile.kvkk_consent?.timestamp) {
      kvkkEl.textContent = new Date(profile.kvkk_consent.timestamp).toLocaleDateString('tr-TR');
    }

    // Üyelik tarihi
    const joinEl = document.getElementById('profile-joined');
    if (joinEl && profile.created_at) {
      joinEl.textContent = new Date(profile.created_at).toLocaleDateString('tr-TR');
    }

  } catch (err) {
    console.error('[profile] Profil yükleme genel hatası:', err);
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
    const { error } = await supabase
      .from('users')
      .update({ preferred_lang: lang })
      .eq('id', _currentUser.id);
    if (error) {
      console.error('[profile] Dil güncelleme hatası:', error.message);
    } else {
      _showToast('Dil tercihiniz kaydedildi.');
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
    const { error } = await supabase
      .from('users')
      .update({ marketing_opt_in: mktToggle.checked })
      .eq('id', _currentUser.id);
    if (error) {
      console.error('[profile] Marketing toggle hatası:', error.message);
    } else {
      _showToast(mktToggle.checked ? 'Pazarlama bildirimleri açıldı.' : 'Pazarlama bildirimleri kapatıldı.');
    }
  });
}

// ---------------------------------------------------------------------------
// Hesabımı Sil (KVKK Madde 7)
// ---------------------------------------------------------------------------
const deleteBtn        = document.getElementById('btn-delete-account');
const deleteModal      = document.getElementById('modal-delete');
const deleteCancelBtn  = document.getElementById('btn-delete-cancel');
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
      // public.users satırını soft-delete: deleted_at doldur
      const { error: softErr } = await supabase
        .from('users')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', _currentUser.id);
      if (softErr) throw softErr;

      // TODO: auth.users hard-delete için Edge Function çağır:
      // await supabase.functions.invoke('delete-account')

      await supabase.auth.signOut();
      window.location.href = 'index.html';
    } catch (err) {
      console.error('[profile] Hesap silme hatası:', err);
      alert('Hesap silinirken bir hata oluştu. Lütfen info@kalkaninfo.com adresine yazın.');
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
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', _currentUser.id)
        .single();

      // Kullanıcının yorumları (reviews tablosu author_id ile)
      const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('author_id', _currentUser.id);

      const exportData = {
        exportDate:    new Date().toISOString(),
        exportVersion: '1.0',
        user: {
          id:    _currentUser.id,
          email: _currentUser.email,
          ...(userData ?? {}),
        },
        reviews: reviews ?? [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
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
