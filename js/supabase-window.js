// Classic script — window'a Supabase config'i assign eder.
// Legacy IIFE scripts (newsletter.js, lost-found.js) bu globals'tan okur.
// ESM modules (auth.js, supabase-client.js) supabase-config.js'i import eder.
// Build script (scripts/build-supabase-config.mjs) bu dosyayı production'da env'den override eder.
window.SUPABASE_URL = 'https://dgichfealzdpfhdgryym.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_26HXaUgGqxZUOuxbcPhiDQ_s3MvKVpr';
