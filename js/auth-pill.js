/**
 * auth-pill.js — Sağ üst köşe GİRİŞ YAP pill widget'ı
 * Tüm sayfalarda tutarlı oturum açma + admin panel girişi.
 *
 * Native HTML <details> kullanır — JS bağımsızdır.
 * Sayfa yüklendiğinde auto-mount, mevcut #ki-auth-details varsa atlar.
 */

(function mountAuthPill() {
  if (document.getElementById('ki-auth-details')) return;

  // Stiller (bir kez)
  if (!document.getElementById('ki-auth-styles')) {
    const style = document.createElement('style');
    style.id = 'ki-auth-styles';
    style.textContent = `
      #ki-auth-details {
        position:fixed !important; top:140px !important; right:18px !important;
        z-index:99999 !important;
        font-family:'Inter',system-ui,sans-serif;
      }
      #ki-auth-details > summary {
        list-style:none;
        display:inline-flex;align-items:center;gap:10px;
        background:linear-gradient(135deg,#f4b53d 0%,#e89812 100%);
        color:#072136;padding:12px 18px;border-radius:18px;
        font-size:15px;font-weight:800;letter-spacing:0.02em;
        box-shadow:0 8px 24px -6px rgba(232,152,18,0.55),0 1px 3px rgba(7,33,54,0.2);
        border:1px solid rgba(255,255,255,0.25);
        cursor:pointer;
        transition:transform .18s ease, box-shadow .18s ease;
        user-select:none;
      }
      #ki-auth-details > summary::-webkit-details-marker { display:none; }
      #ki-auth-details > summary:hover {
        transform:translateY(-1px);
        box-shadow:0 10px 28px -6px rgba(232,152,18,0.7),0 2px 4px rgba(7,33,54,0.25);
      }
      #ki-auth-menu {
        position:absolute;top:calc(100% + 8px);right:0;
        min-width:230px;
        background:linear-gradient(180deg,#0a2e4c 0%,#072136 100%);
        color:#fff;border-radius:14px;padding:6px;
        box-shadow:0 12px 36px -8px rgba(7,33,54,0.55);
        border:1px solid rgba(255,255,255,0.12);
        backdrop-filter:blur(10px);
      }
      #ki-auth-menu a {
        display:flex;align-items:center;gap:10px;
        padding:10px 12px;border-radius:10px;
        color:#fff;text-decoration:none;font-size:14px;font-weight:500;
        transition:background .15s ease;
      }
      #ki-auth-menu a:hover { background:rgba(255,255,255,0.10); }
      #ki-auth-menu a.admin { color:rgba(255,255,255,0.7);font-size:13px; }
      #ki-auth-divider { height:1px;background:rgba(255,255,255,0.12);margin:4px 8px; }
      @media (max-width:768px) {
        /* Mobilde gizle — bottom-nav.js zaten Giriş/Profil sunuyor */
        #ki-auth-details { display:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  // Pill HTML
  const details = document.createElement('details');
  details.id = 'ki-auth-details';
  details.innerHTML = `
    <summary aria-label="Giriş seçenekleri">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></svg>
      GİRİŞ YAP
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="margin-left:4px;"><path d="m6 9 6 6 6-6"/></svg>
    </summary>
    <div id="ki-auth-menu" role="menu">
      <a href="login.html">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></svg>
        Giriş Yap
      </a>
      <a href="register.html">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
        Üye Ol
      </a>
      <a href="profil.html">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
        Profilim
      </a>
      <a href="profil.html#ilanlarim">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 7h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M10 4h4v3h-4z"/></svg>
        İlanlarım
      </a>
      <div id="ki-auth-divider"></div>
      <a href="admin.html" class="admin">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Admin Paneli
      </a>
    </div>
  `;

  function attach() {
    if (document.body) {
      document.body.appendChild(details);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(details), { once: true });
    }
  }
  attach();

  // Sayfa içinde kapatma (link tıklandığında)
  details.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => details.removeAttribute('open'));
  });

  // Dış tıklamada kapat
  document.addEventListener('click', (e) => {
    if (!details.contains(e.target)) details.removeAttribute('open');
  });
})();
