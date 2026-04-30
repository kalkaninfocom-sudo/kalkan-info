/**
 * Kalkan Info — Firebase Auth Wrapper
 * Firebase Modular SDK v10 (ES modules via CDN)
 *
 * TODO: Berkay buraya Firebase config'i ekleyecek
 * Firebase Console → Project Settings → Your apps → Web app → Config
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  deleteUser,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ---------------------------------------------------------------------------
// Firebase config — TODO: Berkay buraya Firebase config'i ekleyecek
// ---------------------------------------------------------------------------
const firebaseConfig = {
  // apiKey: "...",
  // authDomain: "...",
  // projectId: "...",
  // storageBucket: "...",
  // messagingSenderId: "...",
  // appId: "...",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const googleProvider   = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// ---------------------------------------------------------------------------
// Yardımcı — kullanıcı dokümanı oluştur / güncelle
// ---------------------------------------------------------------------------
async function _saveUserDoc(uid, data) {
  try {
    await setDoc(doc(db, 'users', uid), data, { merge: true });
  } catch (err) {
    console.error('[auth] Firestore kayıt hatası:', err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Google ile giriş */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user   = result.user;
    await _saveUserDoc(user.uid, {
      displayName:  user.displayName,
      email:        user.email,
      photoURL:     user.photoURL,
      provider:     'google',
      lastLoginAt:  serverTimestamp(),
      preferredLang: localStorage.getItem('ki_lang') || 'tr',
    });
    return { ok: true, user };
  } catch (err) {
    console.error('[auth] Google giriş hatası:', err);
    return { ok: false, code: err.code, message: _friendlyError(err.code) };
  }
}

/** Facebook ile giriş */
export async function loginWithFacebook() {
  try {
    const result = await signInWithPopup(auth, facebookProvider);
    const user   = result.user;
    await _saveUserDoc(user.uid, {
      displayName:  user.displayName,
      email:        user.email,
      photoURL:     user.photoURL,
      provider:     'facebook',
      lastLoginAt:  serverTimestamp(),
      preferredLang: localStorage.getItem('ki_lang') || 'tr',
    });
    return { ok: true, user };
  } catch (err) {
    console.error('[auth] Facebook giriş hatası:', err);
    return { ok: false, code: err.code, message: _friendlyError(err.code) };
  }
}

/** E-posta + şifre ile giriş */
export async function loginWithEmail(email, pwd) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pwd);
    return { ok: true, user: result.user };
  } catch (err) {
    console.error('[auth] E-posta giriş hatası:', err);
    return { ok: false, code: err.code, message: _friendlyError(err.code) };
  }
}

/**
 * E-posta + şifre ile kayıt
 * @param {string} name
 * @param {string} email
 * @param {string} pwd
 * @param {boolean} kvkkConsent   — zorunlu, false ise hata döner
 * @param {boolean} marketingOptIn — opsiyonel
 */
export async function register(name, email, pwd, kvkkConsent, marketingOptIn = false) {
  if (!kvkkConsent) {
    return { ok: false, code: 'kvkk-required', message: 'KVKK metnini okuyup onaylamanız zorunludur.' };
  }
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pwd);
    const user   = result.user;
    await _saveUserDoc(user.uid, {
      displayName:   name,
      email:         email,
      photoURL:      null,
      provider:      'email',
      createdAt:     serverTimestamp(),
      kvkkConsent: {
        version:   '1.0',
        timestamp: new Date().toISOString(),
        ip:        'tbd',   // Cloud Function tarafında doldurulacak
      },
      marketingOptIn,
      preferredLang: localStorage.getItem('ki_lang') || 'tr',
    });
    return { ok: true, user };
  } catch (err) {
    console.error('[auth] Kayıt hatası:', err);
    return { ok: false, code: err.code, message: _friendlyError(err.code) };
  }
}

/** Çıkış */
export async function logout() {
  try {
    await signOut(auth);
    return { ok: true };
  } catch (err) {
    console.error('[auth] Çıkış hatası:', err);
    return { ok: false, code: err.code, message: _friendlyError(err.code) };
  }
}

/** Mevcut kullanıcıyı döner (null = giriş yok) */
export function currentUser() {
  return auth.currentUser;
}

/**
 * Giriş zorunluluğu — giriş yoksa redirectTo sayfasına yönlendir
 * @param {string} redirectTo
 * @returns {Promise<import('firebase/auth').User|null>}
 */
export function requireAuth(redirectTo = 'login.html') {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}

/** Şifre sıfırlama e-postası */
export async function sendResetEmail(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { ok: true };
  } catch (err) {
    console.error('[auth] Şifre sıfırlama hatası:', err);
    return { ok: false, code: err.code, message: _friendlyError(err.code) };
  }
}

/** Auth state değişimini dinle */
export { onAuthStateChanged, auth, db, deleteUser };

// ---------------------------------------------------------------------------
// Hata mesajları
// ---------------------------------------------------------------------------
function _friendlyError(code) {
  const map = {
    'auth/user-not-found':       'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.',
    'auth/wrong-password':       'Şifre hatalı. Lütfen tekrar deneyin.',
    'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanımda.',
    'auth/weak-password':        'Şifre en az 6 karakter olmalıdır.',
    'auth/invalid-email':        'Geçersiz e-posta adresi.',
    'auth/popup-closed-by-user': 'Giriş penceresi kapatıldı.',
    'auth/account-exists-with-different-credential':
      'Bu e-posta farklı bir giriş yöntemiyle kayıtlı.',
    'auth/network-request-failed': 'Ağ hatası. İnternet bağlantınızı kontrol edin.',
    'kvkk-required': 'KVKK metnini okuyup onaylamanız zorunludur.',
  };
  return map[code] || 'Bir hata oluştu. Lütfen tekrar deneyin.';
}

// ---------------------------------------------------------------------------
// DOMContentLoaded — form listener'larını otomatik bağla
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // ----- LOGIN FORM -----
  const loginForm = document.querySelector('[data-action="login-form"]');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('[name="email"]').value.trim();
      const pwd   = loginForm.querySelector('[name="password"]').value;
      const btn   = loginForm.querySelector('[type="submit"]');
      _setLoading(btn, true);
      const res = await loginWithEmail(email, pwd);
      _setLoading(btn, false);
      if (res.ok) {
        window.location.href = 'profil.html';
      } else {
        _showError(loginForm, res.message);
      }
    });
  }

  // ----- REGISTER FORM -----
  const registerForm = document.querySelector('[data-action="register-form"]');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name    = registerForm.querySelector('[name="name"]').value.trim();
      const email   = registerForm.querySelector('[name="email"]').value.trim();
      const pwd     = registerForm.querySelector('[name="password"]').value;
      const pwd2    = registerForm.querySelector('[name="password2"]').value;
      const kvkk    = registerForm.querySelector('[name="kvkk"]').checked;
      const mkt     = registerForm.querySelector('[name="marketing"]')?.checked ?? false;

      if (pwd !== pwd2) {
        _showError(registerForm, 'Şifreler eşleşmiyor.');
        return;
      }
      if (!kvkk) {
        _showError(registerForm, 'KVKK metnini okuyup onaylamanız zorunludur.');
        return;
      }
      const btn = registerForm.querySelector('[type="submit"]');
      _setLoading(btn, true);
      const res = await register(name, email, pwd, kvkk, mkt);
      _setLoading(btn, false);
      if (res.ok) {
        window.location.href = 'profil.html';
      } else {
        _showError(registerForm, res.message);
      }
    });
  }

  // ----- GOOGLE LOGIN BUTTONS -----
  document.querySelectorAll('[data-action="google-login"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      // Register sayfasında KVKK kontrolü
      const kvkkCheck = document.querySelector('[name="kvkk"]');
      if (kvkkCheck && !kvkkCheck.checked) {
        _showError(btn.closest('form') || document.body, 'KVKK metnini okuyup onaylamanız zorunludur.');
        return;
      }
      _setLoading(btn, true);
      const res = await loginWithGoogle();
      _setLoading(btn, false);
      if (res.ok) {
        window.location.href = 'profil.html';
      } else {
        _showError(btn.closest('form') || document.body, res.message);
      }
    });
  });

  // ----- FACEBOOK LOGIN BUTTONS -----
  document.querySelectorAll('[data-action="facebook-login"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const kvkkCheck = document.querySelector('[name="kvkk"]');
      if (kvkkCheck && !kvkkCheck.checked) {
        _showError(btn.closest('form') || document.body, 'KVKK metnini okuyup onaylamanız zorunludur.');
        return;
      }
      _setLoading(btn, true);
      const res = await loginWithFacebook();
      _setLoading(btn, false);
      if (res.ok) {
        window.location.href = 'profil.html';
      } else {
        _showError(btn.closest('form') || document.body, res.message);
      }
    });
  });

  // ----- LOGOUT BUTTONS -----
  document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await logout();
      window.location.href = 'index.html';
    });
  });

  // ----- FORGOT PASSWORD -----
  const forgotBtn = document.querySelector('[data-action="forgot-password"]');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', async () => {
      const emailInput = document.querySelector('[name="email"]');
      const email = emailInput ? emailInput.value.trim() : prompt('E-posta adresinizi girin:');
      if (!email) return;
      const res = await sendResetEmail(email);
      if (res.ok) {
        alert('Şifre sıfırlama e-postası gönderildi. Gelen kutunuzu kontrol edin.');
      } else {
        alert(res.message);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// UI yardımcıları
// ---------------------------------------------------------------------------
function _setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'Lütfen bekleyin...';
  } else {
    btn.textContent = btn.dataset.originalText || btn.textContent;
  }
}

function _showError(container, message) {
  let errEl = container.querySelector?.('.auth-error');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.className = 'auth-error text-coral-600 text-sm mt-2 font-medium';
    if (container.tagName === 'FORM') {
      container.appendChild(errEl);
    } else {
      document.body.insertAdjacentElement('afterbegin', errEl);
    }
  }
  errEl.textContent = message;
  errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
