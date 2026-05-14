/**
 * Kalkan Info — Supabase Auth Wrapper
 * supabase-js v2 (CDN ESM via esm.sh)
 */

import { supabase } from './supabase-client.js';
import { SUPABASE_URL } from './supabase-config.js';

export const isSupabaseConfigured = Boolean(SUPABASE_URL);
// Backward-compat alias (profile.js geçiş dönemi)
export const isFirebaseConfigured = isSupabaseConfigured;

// ---------------------------------------------------------------------------
// Yardımcı — public.users tablosuna profil satırı yaz
// ---------------------------------------------------------------------------
async function _upsertUserRow(user, extra = {}) {
  const { error } = await supabase.from('users').upsert(
    {
      id:              user.id,
      email:           user.email,
      display_name:    extra.display_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      photo_url:       extra.photo_url    ?? user.user_metadata?.avatar_url ?? null,
      provider:        extra.provider     ?? (user.app_metadata?.provider ?? 'email'),
      preferred_lang:  extra.preferred_lang ?? localStorage.getItem('ki_lang') ?? 'tr',
      marketing_opt_in: extra.marketing_opt_in ?? false,
      kvkk_consent:    extra.kvkk_consent ?? { version: '1.0', timestamp: new Date().toISOString(), ip: null },
      last_login_at:   new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) console.error('[auth] users upsert hatası:', error.message);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Google ile giriş (OAuth redirect) */
export async function loginWithGoogle() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/profil.html' },
    });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error('[auth] Google giriş hatası:', err);
    return { ok: false, code: err.message, message: _friendlyError(err.message) };
  }
}

/** Facebook ile giriş (OAuth redirect) */
export async function loginWithFacebook() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: window.location.origin + '/profil.html' },
    });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error('[auth] Facebook giriş hatası:', err);
    return { ok: false, code: err.message, message: _friendlyError(err.message) };
  }
}

/** E-posta + şifre ile giriş */
export async function loginWithEmail(email, pwd) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) throw error;
    return { ok: true, user: data.user };
  } catch (err) {
    console.error('[auth] E-posta giriş hatası:', err);
    return { ok: false, code: err.message, message: _friendlyError(err.message) };
  }
}

/**
 * E-posta + şifre ile kayıt
 * @param {string} name
 * @param {string} email
 * @param {string} pwd
 * @param {boolean} kvkkConsent
 * @param {boolean} marketingOptIn
 */
export async function register(name, email, pwd, kvkkConsent, marketingOptIn = false) {
  if (!kvkkConsent) {
    return { ok: false, code: 'kvkk-required', message: 'KVKK metnini okuyup onaylamanız zorunludur.' };
  }
  try {
    const { data, error } = await supabase.auth.signUp({ email, password: pwd });
    if (error) throw error;
    const user = data.user;
    if (user) {
      await _upsertUserRow(user, {
        display_name:    name,
        provider:        'email',
        marketing_opt_in: marketingOptIn,
        kvkk_consent:    { version: '1.0', timestamp: new Date().toISOString(), ip: null },
        preferred_lang:  localStorage.getItem('ki_lang') ?? 'tr',
      });
    }
    return { ok: true, user };
  } catch (err) {
    console.error('[auth] Kayıt hatası:', err);
    return { ok: false, code: err.message, message: _friendlyError(err.message) };
  }
}

/** Çıkış */
export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error('[auth] Çıkış hatası:', err);
    return { ok: false, code: err.message, message: _friendlyError(err.message) };
  }
}

/** Mevcut kullanıcıyı döner (null = giriş yok) — sync, son session'dan */
export function currentUser() {
  return supabase.auth.getUser ? null : null; // async fallback — safeOnAuthStateChanged tercih edilmeli
}

/**
 * Giriş zorunluluğu — giriş yoksa redirectTo sayfasına yönlendir
 * @param {string} redirectTo
 * @returns {Promise<object|null>}
 */
export async function requireAuth(redirectTo = 'login.html') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session.user;
}

/** Şifre sıfırlama e-postası */
export async function sendResetEmail(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login.html',
    });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error('[auth] Şifre sıfırlama hatası:', err);
    return { ok: false, code: err.message, message: _friendlyError(err.message) };
  }
}

/**
 * Auth state değişimini dinle.
 * @param {function} callback — user objesi veya null alır
 * @returns unsubscribe fonksiyonu
 */
export function safeOnAuthStateChanged(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

/**
 * Hesap silme — client-side: public.users satırı soft-delete + signOut.
 * auth.users hard-delete için Edge Function gerekir.
 * TODO: supabase.functions.invoke('delete-account') çağrısı ile auth.users'ı sil
 */
export async function deleteUser() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Oturum bulunamadı');
    const uid = session.user.id;
    // Profil satırını sil (RLS: users_admin_delete — servis rolü gerekir)
    // Client-side yalnızca soft-delete yapılabilir; hard delete Edge Function'a bırakılıyor
    await supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', uid);
    // TODO: Edge Function çağrısı — await supabase.functions.invoke('delete-account')
    await supabase.auth.signOut();
    return { ok: true };
  } catch (err) {
    console.error('[auth] Hesap silme hatası:', err);
    return { ok: false, code: err.message, message: _friendlyError(err.message) };
  }
}

// Backward-compat re-exports (profile.js kullanır)
export { supabase as db };
export const onAuthStateChanged = safeOnAuthStateChanged;
export const auth = { get currentUser() { return null; } };

// ---------------------------------------------------------------------------
// Hata mesajları — Supabase error string'lerine güncellendi
// ---------------------------------------------------------------------------
function _friendlyError(msg) {
  if (!msg) return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials'))        return 'E-posta veya şifre hatalı.';
  if (m.includes('user already registered'))          return 'Bu e-posta adresi zaten kullanımda.';
  if (m.includes('password should be at least'))      return 'Şifre en az 6 karakter olmalıdır.';
  if (m.includes('unable to validate email'))         return 'Geçersiz e-posta adresi.';
  if (m.includes('email not confirmed'))              return 'E-posta adresinizi doğrulamanız gerekiyor.';
  if (m.includes('network'))                         return 'Ağ hatası. İnternet bağlantınızı kontrol edin.';
  if (m.includes('kvkk-required'))                   return 'KVKK metnini okuyup onaylamanız zorunludur.';
  return 'Bir hata oluştu. Lütfen tekrar deneyin.';
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
      const name  = registerForm.querySelector('[name="name"]').value.trim();
      const email = registerForm.querySelector('[name="email"]').value.trim();
      const pwd   = registerForm.querySelector('[name="password"]').value;
      const pwd2  = registerForm.querySelector('[name="password2"]').value;
      const kvkk  = registerForm.querySelector('[name="kvkk"]').checked;
      const mkt   = registerForm.querySelector('[name="marketing"]')?.checked ?? false;

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
      const kvkkCheck = document.querySelector('[name="kvkk"]');
      if (kvkkCheck && !kvkkCheck.checked) {
        _showError(btn.closest('form') || document.body, 'KVKK metnini okuyup onaylamanız zorunludur.');
        return;
      }
      _setLoading(btn, true);
      const res = await loginWithGoogle();
      _setLoading(btn, false);
      if (!res.ok) {
        _showError(btn.closest('form') || document.body, res.message);
      }
      // ok: true → OAuth redirect başladı, sayfa zaten gidecek
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
      if (!res.ok) {
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
