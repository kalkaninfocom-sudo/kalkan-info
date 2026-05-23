import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

// CDN timeout koruması: jsdelivr / esm.sh asılı kalırsa sayfayı 2sn'den
// fazla bekletme. Supabase yüklenemezse null export -> auth/db features
// devre dışı kalır ama sayfa çalışır.
let _createClient = null;
try {
  const mod = await Promise.race([
    import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'),
    new Promise((_, rej) => setTimeout(() => rej(new Error('supabase CDN timeout 2s')), 2000)),
  ]);
  _createClient = mod.createClient;
} catch (e) {
  console.warn('[supabase] disabled (CDN unreachable):', e.message);
}

export const supabase = _createClient
  ? _createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
