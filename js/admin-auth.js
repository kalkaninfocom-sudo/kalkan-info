/**
 * js/admin-auth.js — Admin sayfaları için merkezi auth guard.
 *
 * Kullanım (admin.html, admin/jobs.html, admin/news-moderation.html):
 *   import { requireAdmin } from './js/admin-auth.js';
 *   const user = await requireAdmin();
 *   if (!user) return; // redirect zaten yapıldı
 *
 * Kontroller (sırasıyla):
 *   1. supabase.auth.getUser() — oturum var mı?
 *      yoksa → /login.html?next=<current path>
 *   2. user.app_metadata.role === 'admin'  (user_metadata GÜVENİLMEZ)
 *      değilse → erişim engellendi ekranı + throw
 *
 * Performans: localStorage cache (5 dk). app_metadata sunucu tarafından set
 * edilir; client onu değiştiremez, bu yüzden cache güvenli.
 *
 * SECURITY NOTLARI:
 *   • Bu sadece UI guard — gerçek koruma RLS + Edge Function tarafında.
 *   • Eski sessionStorage('kalkan_info_session'='ok') pattern'i kaldırıldı.
 *   • app_metadata.role kontrolü user_metadata yerine MUTLAKA app_metadata
 *     üzerinden yapılır (user_metadata kullanıcı tarafından değiştirilebilir).
 */

import { supabase } from './supabase-client.js';

const CACHE_KEY  = 'kalkan_info_admin_verify_v1';
const CACHE_TTL  = 5 * 60 * 1000; // 5 dakika

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    if (Date.now() - (obj.ts || 0) > CACHE_TTL) return null;
    return obj;
  } catch { return null; }
}

function writeCache(user) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ts:    Date.now(),
      uid:   user.id,
      email: user.email,
      role:  user.app_metadata?.role || null,
    }));
  } catch { /* ignore quota */ }
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

function redirectToLogin() {
  const next = encodeURIComponent(location.pathname + location.search);
  location.href = `/login.html?next=${next}`;
}

function renderForbidden() {
  document.body.innerHTML = `
    <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
                background:#0a1626;color:#fff;font-family:Inter,system-ui,sans-serif;padding:1rem;">
      <div style="max-width:420px;text-align:center;background:rgba(255,255,255,0.05);
                  border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:2rem;">
        <div style="font-size:42px;margin-bottom:0.5rem;">🔒</div>
        <h1 style="font-size:20px;font-weight:700;margin:0 0 0.5rem;">Erişim Engellendi</h1>
        <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.7);margin:0 0 1.25rem;">
          Bu sayfaya erişim yetkin yok. Yönetici hesabıyla giriş yapman gerekiyor.
        </p>
        <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
          <a href="/login.html" style="display:inline-block;padding:0.625rem 1.25rem;
             background:#1a5e93;color:#fff;text-decoration:none;border-radius:8px;
             font-weight:600;font-size:14px;">Tekrar Giriş Yap</a>
          <a href="/" style="display:inline-block;padding:0.625rem 1.25rem;
             background:rgba(255,255,255,0.1);color:#fff;text-decoration:none;border-radius:8px;
             font-weight:600;font-size:14px;">Anasayfa</a>
        </div>
      </div>
    </div>`;
}

/**
 * Mevcut kullanıcının admin olduğundan emin ol.
 *
 * @returns {Promise<object|null>} user objesi (admin ise) — değilse redirect/throw
 * @throws {Error} 'not admin' — admin değilse (sayfa zaten engellendi ekranıyla doldu)
 */
export async function requireAdmin() {
  // Cache hit (son 5 dk içinde admin olduğu doğrulanmış) — yine de session var mı kısa kontrol
  const cached = readCache();
  if (cached?.role === 'admin') {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id === cached.uid) {
      return session.user;
    }
    // Session değişmiş veya yok — cache geçersiz
    clearCache();
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    clearCache();
    redirectToLogin();
    return null;
  }

  // SECURITY: SADECE app_metadata (user_metadata kullanıcı tarafından değiştirilebilir)
  const role = user.app_metadata?.role;
  if (role !== 'admin') {
    clearCache();
    renderForbidden();
    throw new Error('not admin');
  }

  writeCache(user);
  return user;
}

/**
 * Admin oturumunu sonlandır — cache temizle + supabase signOut.
 */
export async function adminSignOut() {
  clearCache();
  try { await supabase.auth.signOut(); } catch {}
  location.href = '/login.html';
}
