// scripts/create-test-admin.mjs
// Test admin user oluşturur — email_confirm true, app_metadata.role=admin.
// Kullanım: node scripts/create-test-admin.mjs [email] [password]
// Default: test-admin@kalkaninfo.com / TestAdmin2026!Long

import fs from 'fs';

const raw = fs.readFileSync('.env.local', 'utf8');
function pick(key) {
  const m = raw.match(new RegExp('^' + key + '=\"?([^\"\\r\\n]+)\"?', 'm'));
  if (!m) return '';
  return m[1].replace(/\\n$/g, '').replace(/\\n/g, '').replace(/\s+$/, '').trim();
}

const URL = pick('SUPABASE_URL');
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const EMAIL = process.argv[2] || 'test-admin@kalkaninfo.com';
const PASSWORD = process.argv[3] || 'TestAdmin2026!Long';

console.log('URL:', JSON.stringify(URL));
console.log('KEY length:', KEY.length);
console.log('Email:', EMAIL);

// 1) Create user with email_confirm:true so login works immediately
const create = await fetch(URL + '/auth/v1/admin/users', {
  method: 'POST',
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { full_name: 'Test Admin' },
  }),
});

const created = await create.json();
if (!create.ok) {
  // If already exists, fetch by email
  if (create.status === 422 || (created.msg || '').toLowerCase().includes('already')) {
    console.log('User already exists — fetching by email');
    const list = await fetch(URL + '/auth/v1/admin/users?filter=email.eq.' + encodeURIComponent(EMAIL), {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
    });
    const body = await list.json();
    const existing = (body.users || []).find(u => u.email === EMAIL);
    if (existing) {
      console.log('Found existing user:', existing.id, 'role:', existing.app_metadata?.role);
      // Update password + role just in case
      const upd = await fetch(URL + '/auth/v1/admin/users/' + existing.id, {
        method: 'PUT',
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: PASSWORD,
          email_confirm: true,
          app_metadata: { ...(existing.app_metadata || {}), role: 'admin' },
        }),
      });
      const updated = await upd.json();
      console.log('Updated:', upd.status, 'role:', updated.app_metadata?.role);
      console.log('\n✅ Test admin hazır:\n  Email:', EMAIL, '\n  Password:', PASSWORD);
      process.exit(0);
    }
  }
  console.error('Create fail:', create.status, JSON.stringify(created));
  process.exit(1);
}

console.log('✅ Created:', created.id, 'role:', created.app_metadata?.role);
console.log('\n✅ Test admin hazır:\n  Email:', EMAIL, '\n  Password:', PASSWORD);
