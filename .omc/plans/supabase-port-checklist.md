# Supabase Port Plan — Kalkan Info

## 0. Singleton Client: `js/supabase-client.js`

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = '__SUPABASE_URL__';   // Berkay: gercel deger koy
const SUPABASE_ANON = '__SUPABASE_ANON__';  // Berkay: gercel deger koy

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// Auth helpers (her modül bunları kullanacak)
export const getUser    = async () => (await supabase.auth.getUser()).data.user;
export const onAuth     = (cb) => supabase.auth.onAuthStateChange((_ev, session) => cb(session?.user ?? null));
export const signOut    = () => supabase.auth.signOut();
export const signInGoogle   = () => supabase.auth.signInWithOAuth({ provider: 'google' });
export const signInFacebook = () => supabase.auth.signInWithOAuth({ provider: 'facebook' });
export const signInEmail    = (e, p) => supabase.auth.signInWithPassword({ email: e, password: p });
export const signUpEmail    = (e, p) => supabase.auth.signUp({ email: e, password: p });
export const resetPassword  = (e) => supabase.auth.resetPasswordForEmail(e);
```

ESM import line for all modules:
```js
import { supabase, getUser, onAuth } from './supabase-client.js';
```

---

## 1. JS Module Port Checklist

### `js/auth.js`
- [ ] **Remove:** All `firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js` imports, `initializeApp`, `getAuth`, `GoogleAuthProvider`, `FacebookAuthProvider`, `signInWithPopup`, `createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, `signOut`, `onAuthStateChanged`, `sendPasswordResetEmail`, `deleteUser`, `getFirestore`, `firebaseConfig` object
- [ ] **Add:** Re-export everything from `supabase-client.js`. Auth calls become `supabase.auth.*`. Delete user = `supabase.rpc('delete_own_account')` (needs a DB function). Firestore `setDoc(users/{uid})` on signup replaced by DB trigger (`handle_new_user` already in schema)
- [ ] **Import:** `import { supabase, getUser, onAuth, signOut, signInGoogle, signInFacebook, signInEmail, signUpEmail, resetPassword } from './supabase-client.js';`
- [ ] **Keep:** `isFirebaseConfigured` guard logic but rename to `isSupabaseConfigured` checking URL !== placeholder

### `js/profile.js`
- [ ] **Remove:** `firebase-firestore.js` import (`doc`, `getDoc`, `updateDoc`, `collection`, `query`, `where`, `getDocs`, `deleteDoc`), `safeOnAuthStateChanged` from auth.js
- [ ] **Add:** `supabase.from('users').select().eq('id', user.id).single()` for profile load. `supabase.from('users').update({...}).eq('id', user.id)` for save. `supabase.from('provider_profiles').select()` for listings
- [ ] **Import:** `import { supabase, onAuth } from './supabase-client.js';`

### `js/jobs.js`
- [ ] **Remove:** Entire `_getDb()` lazy Firebase init, `firebase-app.js`/`firebase-firestore.js` dynamic imports, `_firebaseAvailable` flag
- [ ] **Add:** `supabase.from('jobs').select().eq('status','active').order('created_at',{ascending:false})` for listing. `supabase.from('job_applications').insert({...})` for apply. Keep `DEMO_JOBS` fallback if supabase unreachable
- [ ] **Import:** `import { supabase, getUser } from './supabase-client.js';`

### `js/onboarding.js`
- [ ] **Remove:** Firebase Auth/Firestore/Storage dynamic imports, `_getStorage`, `_ref`, `_uploadBytes`, `_getDownloadURL`, `_collection`, `_doc`, `_setDoc`, `_serverTimestamp`
- [ ] **Add:** `supabase.from('provider_profiles').upsert({...})` for profile save. `supabase.storage.from('provider-photos').upload(path, file)` for images. `supabase.storage.from('provider-photos').getPublicUrl(path)` for URLs
- [ ] **Import:** `import { supabase, getUser } from './supabase-client.js';`

### `js/reviews.js`
- [ ] **Remove:** All `firebase-firestore.js` + `firebase-storage.js` imports (`collection`, `query`, `where`, `orderBy`, `limit`, `startAfter`, `addDoc`, `serverTimestamp`, `getDocs`, `doc`, `updateDoc`, `increment`, `getStorage`, `ref`, `uploadBytes`, `getDownloadURL`)
- [ ] **Add:** `supabase.from('reviews').select().eq('target_id', id).order('created_at')` for reads. `.insert({...})` for new review. `supabase.storage.from('review-photos').upload()` for images. Rating aggregation handled by DB trigger (`update_provider_rating` already in schema)
- [ ] **Import:** `import { supabase, getUser } from './supabase-client.js';`

### `js/vacation-planner.js`
- [ ] **Remove:** All Firebase imports (`firebase-app.js`, `firebase-functions.js`, `firebase-firestore.js`, `firebase-auth.js`), `httpsCallable`, `window.__FIREBASE_CONFIG__`
- [ ] **Add:** Call Supabase Edge Function: `supabase.functions.invoke('vacation-planner', { body: { dates, group, budget } })`. Save plan: `supabase.from('vacation_plans').insert({...})`
- [ ] **Import:** `import { supabase, onAuth } from './supabase-client.js';`

---

## 2. Cloud Function Port Checklist

### `vacationPlanner` --> Supabase Edge Function
**Target:** `supabase/functions/vacation-planner/index.ts`
**Why Edge:** 540s timeout in original; Vercel Hobby caps at 10s. Supabase Edge = 150s (sufficient with streaming).
**Env vars:** `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

```ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.39.0';

serve(async (req) => {
  const { dates, group, budget, userId } = await req.json();
  const ai = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // Claude tool_use call — reuse existing prompt from functions/lib/claude.js
  const msg = await ai.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 4096,
    system: 'Sen Kalkan tatil planlayicisisin...', messages: [{ role: 'user', content: JSON.stringify({ dates, group, budget }) }] });
  const plan = msg.content[0].type === 'text' ? JSON.parse(msg.content[0].text) : {};
  if (userId) await sb.from('vacation_plans').insert({ user_id: userId, plan, created_at: new Date().toISOString() });
  return new Response(JSON.stringify(plan), { headers: { 'Content-Type': 'application/json' } });
});
```

### `whatsappWebhook` --> Vercel API Route
**Target:** `api/whatsapp.js` (Vercel serverless)
**Why Vercel:** Fixed URL stability for Meta webhook verification, simple GET/POST handler.
**Env vars:** `META_VERIFY_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

```ts
// api/whatsapp.js — Vercel serverless
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) return res.send(challenge);
    return res.status(403).end();
  }
  // POST: parse WhatsApp message, insert into news_items
  const body = req.body;
  const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (msg?.type === 'text') {
    await sb.from('news_items').insert({ raw_text: msg.text.body, source: 'whatsapp', status: 'pending' });
  }
  res.status(200).json({ ok: true });
}
```

### `verifyNewsItem` --> Supabase Edge Function
**Target:** `supabase/functions/verify-news/index.ts`
**Why Edge:** Claude API call, may exceed 10s. Original was Pub/Sub triggered; now invoke via `supabase.functions.invoke()` or DB webhook trigger on `news_items` insert.
**Env vars:** `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

```ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.39.0';

serve(async (req) => {
  const { newsId } = await req.json();
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: item } = await sb.from('news_items').select('raw_text').eq('id', newsId).single();
  const ai = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const msg = await ai.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1024,
    messages: [{ role: 'user', content: `Verify this news: ${item.raw_text}` }] });
  const status = /* parse confidence from msg */ 'verified';
  await sb.from('news_items').update({ status, verified_at: new Date().toISOString() }).eq('id', newsId);
  return new Response(JSON.stringify({ status }), { headers: { 'Content-Type': 'application/json' } });
});
```

### `publishToSocial` --> Supabase Edge Function
**Target:** `supabase/functions/publish-social/index.ts`
**Why Edge:** External API calls to social platforms may exceed 10s.
**Env vars:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BUFFER_API_KEY` or `PUBLER_API_KEY`

```ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { newsId } = await req.json();
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: item } = await sb.from('news_items').select('*').eq('id', newsId).single();
  if (item.status !== 'verified' || !item.admin_approved) return new Response('skip', { status: 200 });
  // Call Buffer/Publer API — port lib/social.js logic
  const results = { mock: true }; // placeholder
  await sb.from('news_items').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', newsId);
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
});
```

### `sendWelcomeEmail` --> Supabase Auth Hook
**Target:** `supabase/functions/send-welcome-email/index.ts`
**Why Hook:** Triggered by signup event. Configure in Supabase Dashboard > Auth > Hooks > After sign up.
**Env vars:** `RESEND_API_KEY` (or `SENDGRID_API_KEY`)

```ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  const { user } = await req.json(); // Supabase Auth Hook payload
  const lang = user.user_metadata?.lang || 'tr';
  // Send via Resend/SendGrid — port TEMPLATES from functions/src/sendWelcomeEmail.js
  await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'noreply@kalkaninfo.com', to: user.email, subject: 'Hosgeldiniz!', html: `<h1>Welcome</h1>` }),
  });
  return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } });
});
```

---

## 3. Env Vars Summary

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | Browser (inline) + Edge Functions + Vercel | Client init |
| `SUPABASE_ANON_KEY` | Browser (inline) | Client init (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions + Vercel only | Server-side admin |
| `ANTHROPIC_API_KEY` | Edge Functions | vacation-planner, verify-news |
| `META_VERIFY_TOKEN` | Vercel env | WhatsApp webhook verification |
| `BUFFER_API_KEY` / `PUBLER_API_KEY` | Edge Function | Social publishing |
| `RESEND_API_KEY` | Edge Function | Welcome email |

---

## 4. Execution Order

1. **Create `js/supabase-client.js`** -- singleton, zero Firebase deps
2. **Port `js/auth.js`** -- everything else depends on this
3. **Port `js/profile.js` + `js/jobs.js`** (parallel, independent)
4. **Port `js/onboarding.js` + `js/reviews.js`** (parallel, independent)
5. **Port `js/vacation-planner.js`** + deploy `supabase/functions/vacation-planner/index.ts`
6. **Deploy remaining Edge Functions:** verify-news, publish-social, send-welcome-email
7. **Deploy `api/whatsapp.js`** to Vercel, update Meta webhook URL
8. **Remove `functions/` directory** and Firebase dependencies from project
