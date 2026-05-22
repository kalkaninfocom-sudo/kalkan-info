// middleware.js
// Vercel Edge Middleware — auth-gate (P1-9, audit-backend H1 HIGH)
// /admin/*, /profil*, /b2b-dashboard* için Supabase JWT cookie varlığı kontrolü.
// Defense-in-depth katmanı:
//   1. RLS (Supabase) — gerçek auth, veriyi korur (API katmanı).
//   2. middleware (bu dosya) — JS-disabled/curl gibi durumlarda HTML/DOM sızıntısını engeller.
//   3. js/auth-gate.js — client-side UX (role kontrolü, forbidden UI).
//
// NOT: JWT signature verify YAPILMAZ — sadece presence check (cookie varlığı).
//      Edge runtime'da gerçek verify için `jose` paketi gerekir; complexity ekliyor.
//      Gerçek yetki kontrolü Supabase RLS + client-side gate ile yapılır.

export const config = {
  matcher: [
    '/admin/:path*',
    '/admin.html',
    '/profil',
    '/profil.html',
    '/b2b-dashboard',
    '/b2b-dashboard.html',
    '/:lang(en|de|ru|fr)/admin/:path*',
    '/:lang(en|de|ru|fr)/admin.html',
    '/:lang(en|de|ru|fr)/profil',
    '/:lang(en|de|ru|fr)/profil.html',
    '/:lang(en|de|ru|fr)/b2b-dashboard',
    '/:lang(en|de|ru|fr)/b2b-dashboard.html',
  ],
};

export default function middleware(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  // Supabase auth cookie formatları:
  //   - sb-<project-ref>-auth-token (PKCE / yeni SSR client)
  //   - sb-access-token (legacy / older client)
  const hasAuth = /(?:^|;\s*)sb-(?:[\w-]+-auth-token|access-token)=/i.test(cookieHeader);
  if (hasAuth) return;

  const url = new URL(req.url);
  const next = url.pathname + url.search;
  const loginUrl = new URL('/login.html', url);
  loginUrl.searchParams.set('next', next);
  return Response.redirect(loginUrl, 302);
}
