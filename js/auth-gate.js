// Auth gate — admin/profil sayfalarına inject edilir
// Supabase session check; yoksa /login.html?next=...'ye redirect.
// Role gerektiren sayfalar için <body data-auth-role="admin"> attr ekle.
(async function () {
  function redirectToLogin() {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/login.html?next=${next}`);
  }

  function forbidden() {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:grid;place-items:center;background:#dce6ef;font-family:'Inter',system-ui,sans-serif;color:#0a2e4c;text-align:center;padding:24px;">
        <div style="max-width:480px;">
          <div style="font-size:56px;margin-bottom:12px;">🔒</div>
          <h1 style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:28px;margin:0 0 10px;">Yetkili Erişim Gerekli</h1>
          <p style="color:#5d97c4;margin:0 0 20px;line-height:1.6;">Bu sayfa yalnızca yetkili kullanıcılara açıktır. Featured plan partneriyseniz panel erişimi için bizimle iletişime geçin.</p>
          <a href="/" style="display:inline-block;background:#0a2e4c;color:#f4b53d;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none;font-family:'Montserrat',sans-serif;">Anasayfaya dön</a>
        </div>
      </div>
    `;
  }

  async function gate() {
    const requiredRole = document.body?.dataset?.authRole || null;
    try {
      // Wait for supabase client (loaded via supabase-window.js)
      let tries = 0;
      while (!window.SUPABASE_CLIENT && tries < 50) {
        await new Promise(r => setTimeout(r, 60));
        tries++;
      }
      const sb = window.SUPABASE_CLIENT;
      if (!sb) {
        // No supabase yet — defer to login
        return redirectToLogin();
      }
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return redirectToLogin();

      if (requiredRole) {
        const userRole = user.app_metadata?.role || null;
        if (userRole !== requiredRole && userRole !== 'admin') {
          return forbidden();
        }
      }
      // Authorized — emit ready signal
      document.documentElement.setAttribute('data-auth', 'ready');
    } catch (e) {
      console.error('[auth-gate]', e);
      redirectToLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gate);
  } else {
    gate();
  }
})();
