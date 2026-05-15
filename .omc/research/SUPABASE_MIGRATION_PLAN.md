# Kalkan Info — Firestore → Supabase Postgres Migration Plan

**Tarih:** 2026-05-13
**Hedef:** Firebase free spark tier (kredi kartı zorunlu) → Supabase free tier (kart yok)
**Veri durumu:** Firestore henüz prod'a deploy edilmemiş — temiz başlangıç, data loss riski YOK.
**Şema dosyası:** `.omc/research/SUPABASE_SCHEMA.sql`

---

## 1. Firestore Koleksiyonu → Postgres Tablosu Mapping

| Firestore | Postgres | Notlar |
|---|---|---|
| `users/{uid}` | `public.users` | FK `auth.users(id)`. KVKK alanları (`kvkkConsent`) JSONB. Tetikleyici `handle_new_user()` otomatik insert eder. |
| `users/{uid}/notifications` | (yok) | İhtiyaç doğunca `notifications` tablosu eklenir; v1'de skip. |
| `users/{uid}/sessions` | (yok) | Supabase Auth zaten session yönetiyor; ayrı tablo gereksiz. |
| `users/{uid}/exports` | `audit_log` (action='export') | Tek tabloda izlenebilirlik. |
| `profiles/{id}` (onboarding) | `public.providers` | `ownerUid`→`owner_id`, `type` korunur, `ratingAvg/Count`→`rating_avg/count`, `descriptionML.tr`→`description_i18n['tr']`. |
| `reviews/{id}` | `public.reviews` | `targetType` 'profile'→'provider', 'activity'→'listing', 'vacation' korunur. `authorUid`→`author_id`. |
| `jobs/{id}` | `public.jobs` | Alanlar 1:1, ENUM'lar (`category`, `type`, `status`) tipli. `descriptionHtml`→`description_html`. |
| `jobApplications/{id}` | `public.job_applications` | `applicantUid`→`applicant_id`, `jobOwnerUid`→`job_owner_id`. UNIQUE (job_id, applicant_id) eklendi (yeni). |
| `vacations/{id}` | `public.vacation_requests` | Plan içeriği `ai_plan` JSONB; `items[]` ayrı tablo değil (over-engineering). |
| `activities/{id}` | `public.listings (kind='aktivite')` | Statik içerik tek tabloda. |
| `newsItems/{id}` | `public.news_items` | Otomasyon yaşam döngüsü için ayrı tablo. |
| `automations/{key}` | `public.automations` | `whatsapp-allowlist`, `instagram-profiles`, `nobetci-eczane`. |
| `config/instagram_profiles` | `public.automations (key='instagram-profiles')` | Tek bayrak/config tablosu. |
| `kvkk-deletions/{docId}` | `public.audit_log (action='kvkk_delete')` | Tek audit tablosu. |
| `kvkk-exports/{uid}/{recordId}` | `public.audit_log (action='kvkk_export')` | Aynı. |
| `mail/{id}` (Trigger Email Ext.) | `public.mail_queue` | Edge Function ile Resend/Postmark'a aktarılır. |
| `_rate_limits/{key}` | `public.rate_limits` | vacationPlanner spam koruması. |
| **(yok — JSON dosyaları)** | `public.listings` | `data/*.json` tek polymorphic tabloda seed. |

### Niye `listings` polymorphic, `providers` ayrı?

- **listings**: editoryal/statik içerik. Sahibi admin. Lifecycle: `active` olarak gelir, nadiren değişir. 1.700 satır, tip başına ayrı tablo açmak gereksiz (kart+detay rendering benzer).
- **providers**: kullanıcı tarafından eklenen profil. Sahibi var, `pending→active` onay akışı var, RLS sıkı. Karıştırırsak owner_id NULL olur listings'de — kod karışır.

---

## 2. Statik JSON → Postgres Mapping (data/*.json)

| JSON dosyası | listings.kind | Satır sayısı (tahmini) | Özel data alanları |
|---|---|---|---|
| `villalar.json` | `villa` | ~50 (artar 1500'e) | bedrooms, bathrooms, capacity, pool, seaView, features, referenceUrl |
| `restoranlar.json` | `restoran` | 25 | cuisine, priceRange, phone, website, specialties, hours, reservation |
| `plajlar.json` | `plaj` | 10 | distance, drive, highlights, facilities, tips, best |
| `turlar.json` | `tur` | 10 | duration, price, capacity, includes, excludes, meetingPoint, languages |
| `antik-kentler.json` | `antik_kent` | 17 | entryFee, hours, duration, history, highlights, tips, transport |
| `aktiviteler.json` | `aktivite` | ~20 | season, dateStart, dateEnd, difficulty, bookingRequired, ageRange |
| `hizmetler.json` (items[]) | `hizmet` | ~30 | phone, hours, icon, details |
| `likya-yolu.json` (stages[]) | `likya_etap` | 25 etap | from, to, distance, duration, difficulty, highlights |
| `haberler.json` | (→ `news_items` tablosuna) | 10 | source='manual', published_at, content |
| `eczane.json` | `eczane` (tekil) | 1 (günlük overwrite) | today/tomorrow, otomasyon sync eder |
| `config.json` | `automations (key='site-config')` | 1 | site, contact, hero, footer |
| `hizmet-saglayicilari.json` | `providers` (seed) | ~20 | type, phone, whatsapp, verified, specialties |

i18n stratejisi: TR default tek dilli alanlarda; `name`, `summary`, `description` çok dilli olanlar JSONB (`name_i18n.en`, `name_i18n.ru`...). `aktiviteler.json` zaten `titleML/descriptionML` ile geliyor → doğrudan eşleşir.

### Seed scripti

Node.js loader: `scripts/seed-supabase.mjs` (yazılacak)

```javascript
// Pseudo
import { createClient } from '@supabase/supabase-js';
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const KIND_MAP = {
  villalar:    { kind: 'villa',      pickData: v => ({bedrooms:v.bedrooms,bathrooms:v.bathrooms,capacity:v.capacity,pool:v.pool,seaView:v.seaView,features:v.features,referenceUrl:v.referenceUrl}) },
  restoranlar: { kind: 'restoran',   pickData: v => ({cuisine:v.cuisine,priceRange:v.priceRange,phone:v.phone,website:v.website,specialties:v.specialties,hours:v.hours,reservation:v.reservation}) },
  plajlar:     { kind: 'plaj',       pickData: v => ({distance:v.distance,drive:v.drive,highlights:v.highlights,facilities:v.facilities,tips:v.tips,best:v.best}) },
  // ...
};

for (const [file, cfg] of Object.entries(KIND_MAP)) {
  const json = JSON.parse(fs.readFileSync(`data/${file}.json`,'utf8'));
  const rows = json.items.map(it => ({
    kind: cfg.kind,
    slug: it.id,
    external_id: it.id,
    name: it.name || it.title,
    name_i18n: it.titleML || {},
    summary: it.summary,
    description: it.descriptionML?.tr || it.description || it.history,
    description_i18n: it.descriptionML || {},
    category: it.category,
    tags: it.tags || [],
    lat: it.lat ?? it.location?.lat,
    lng: it.lng ?? it.location?.lng,
    address: it.location?.address || it.address,
    location_label: it.location && typeof it.location === 'string' ? it.location : null,
    cover_image: it.image || it.images?.[0],
    gallery: it.gallery || it.images || [],
    rating: it.rating,
    featured: !!it.featured,
    data: cfg.pickData(it),
    status: 'active',
  }));
  await sb.from('listings').upsert(rows, { onConflict: 'kind,slug' });
}
```

**Tahmini seed boyutu:** 1.700 listing × ~1.5 KB = ~2.5 MB. Free tier 500 MB içinde bol yer var.

---

## 3. JS Dosyaları — Migration Listesi (file:line referansıyla)

Bütün Firebase çağrıları `@supabase/supabase-js` ile değişecek. Esas yer:

### Yüksek öncelik (auth + içerik akışı)

| Dosya | Değişiklik | Tahmini satır |
|---|---|---|
| `js/auth.js:1-366` | Tüm dosya yeniden yazılır. `getAuth/initializeApp` → `createClient`; `signInWithPopup` → `supabase.auth.signInWithOAuth({provider:'google'})`; `createUserWithEmailAndPassword` → `supabase.auth.signUp`; `signInWithEmailAndPassword` → `supabase.auth.signInWithPassword`; `onAuthStateChanged` → `supabase.auth.onAuthStateChange`; user doc yazma → `supabase.from('users').upsert(...)` ya da `handle_new_user` trigger'ı zaten yapacak. | ~350 satır |
| `js/onboarding.js:12-66` | Firebase import bloğu kalkar. `js/onboarding.js:1005-1088` (`_save` fonksiyonu): Firestore `setDoc(profiles/{id})` → `supabase.from('providers').insert(...)`. Storage `uploadBytes` → `supabase.storage.from('profiles').upload(path, file)`. Görsel public URL: `supabase.storage.from('profiles').getPublicUrl(path)`. | ~80 satır |
| `js/jobs.js:24-275` | `_getDb()`/`_firestore` cache kaldırılır. `listJobs` → `supabase.from('jobs').select().eq('status','active').order('published_at',{ascending:false}).limit(50)`. `createJob` → `supabase.from('jobs').insert(...)`. `applyToJob` → `supabase.from('job_applications').insert(...)`. `getMyJobs` → `eq('owner_id', uid)`. `getMyApplications` → `eq('applicant_id', uid)`. | ~150 satır |
| `js/reviews.js:11-355` | `getFirestore/collection/query/where/...` Firebase importları kalkar. `loadReviews` → `supabase.from('reviews').select().eq('target_kind', targetType).eq('target_id', targetId).eq('status','visible').order('created_at',{ascending:false}).range(...)`. `submitReview` → `supabase.from('reviews').insert(...)`. Storage upload → `supabase.storage.from('reviews').upload(...)`. `_buildSummary` aynı query'nin agregat versiyonu — opsiyonel olarak RPC fonksiyonu yapılabilir. | ~180 satır |
| `js/profile.js:1-244` | `onAuthStateChanged` → `supabase.auth.onAuthStateChange`. `getDoc(users/{uid})` → `supabase.from('users').select().eq('id', user.id).single()`. `updateDoc` → `supabase.from('users').update({...}).eq('id',uid)`. `deleteDoc` + `deleteUser` → `supabase.rpc('soft_delete_user')` (yeni RPC) + `supabase.auth.signOut()`. KVKK export → `supabase.from('users').select(...)` + `supabase.from('reviews').select()`. | ~150 satır |
| `js/vacation-planner.js:14-42, 100-145, 373-417` | Cloud Function callable → Supabase Edge Function: `fetch('/functions/v1/vacation-planner', ...)` veya `supabase.functions.invoke('vacation-planner', { body: formData })`. Plan kaydetme `addDoc(vacations,...)` → `supabase.from('vacation_requests').insert({...})`. | ~80 satır |

### Orta öncelik (yardımcılar)

| Dosya | Değişiklik | Tahmini satır |
|---|---|---|
| `js/render.js` | Veriyi nereden çektiğine göre fetch path'leri Supabase'e döner. JSON fetch'ler (data/*.json) v1'de bırakılabilir — Postgres'e geçince `supabase.from('listings').select().eq('kind',X)`. | ~50 satır |
| `js/i18n.js`, `js/lang-switcher.js` | Değişmez. preferredLang kullanıcıdan Supabase'e yazılır. | 0 |
| `js/activities.js` | Firestore `collection('activities')` → `supabase.from('listings').select().eq('kind','aktivite').eq('status','active')`. | ~30 satır |
| `js/providers-modal.js` | Firestore queries → Supabase. | ~30 satır |
| `js/site-drawer.js`, `js/auth-pill.js` | onAuthStateChange dinleyicisi → Supabase variant. | ~10 satır |

### Düşük öncelik (otomasyon — Cloud Functions → Edge Functions)

`functions/` klasöründeki 7 dosya Edge Function olarak yeniden yazılır. Bu Faz 2 işi, frontend göçü sonrası:

| Cloud Function | Edge Function adı | Kullandığı tablolar | Tetikleyici |
|---|---|---|---|
| `vacationPlanner.js` | `vacation-planner` | rate_limits, vacation_requests | HTTPS callable (fetch) |
| `verifyNewsItem.js` | `verify-news-item` | news_items | HTTPS |
| `publishToSocial.js` | `publish-to-social` | news_items | HTTPS callable |
| `whatsappWebhook.js` | `whatsapp-webhook` | news_items, automations | Webhook (Twilio) |
| `instagramHarvester.js` | `instagram-harvester` | news_items, automations | pg_cron hourly |
| `scheduledNobetciEczaneSync.js` | `nobetci-eczane-sync` | listings (kind=eczane), automations | pg_cron daily 06:00 |
| `src/sendWelcomeEmail.js` | (DB trigger) → mail_queue insert | mail_queue, users | auth.users INSERT trigger |

---

## 4. Riskler ve Açık Sorular

### Riskler

1. **OAuth provider migration**: Google ve Facebook OAuth client_id'leri Firebase Console'da kayıtlı. Supabase'e geçerken Google Cloud Console → OAuth client'a Supabase'in redirect URL'sini eklemek gerekir. Facebook için aynı. Önceden yapılmış token/session kaybolur (henüz prod'da kullanıcı yok, sorun değil).
2. **Storage URL değişimi**: Firebase Storage URL'leri `firebasestorage.googleapis.com/...`. Supabase Storage URL'leri farklı. Henüz dış kullanıcı görseli yüklenmediği için backfill gerekmiyor.
3. **Edge Functions cold start**: Free tier'da Edge Functions 50ms+50ms (faturalandırma). vacationPlanner Anthropic API'sini çağırıyor; timeout 30 sn (Supabase free) → Cloud Functions'taki 545 sn timeout kaybedilir. Çözüm: vacationPlanner'ı 2 adımlı yap — anlık taslak döner, Anthropic'i background worker ile çalıştır.
4. **pg_cron free tier**: Mevcut. Sorun yok.
5. **Realtime**: Şu an `onSnapshot` kullanmıyoruz; risk yok. İleride Supabase Realtime'a geçilebilir.
6. **Custom claim/admin role**: Firebase'de `request.auth.token.admin == true`; Supabase'de `auth.jwt() -> 'app_metadata' ->> 'role'`. Migration sonrası Berkay'ın user satırına `raw_app_meta_data.role='admin'` manuel set.

### Açık Sorular (open-questions.md'ye taşınacak)

1. **Anonim vacation_request**: Şu an client-side fallback ile login olmadan plan üretiyoruz. Supabase'de owner_id NULL bırakabiliyoruz ama spam riski var. IP başına rate limit yeter mi?
2. **Görselleri Storage'a mı yoksa Unsplash'te mi tutalım?** Şu an JSON'larda Unsplash URL'leri var. Free tier 1 GB Storage limitli; gerçek villa fotoğraflarına geçerken sıkışırız. İlk versiyon: Unsplash dış URL'ler kalsın, sadece kullanıcı yüklemeleri (provider gallery, review fotoğrafları) Storage'da.
3. **Çok dilli için JSONB mi ayrı tablo mı?** Karar: JSONB. Niye? 1.500 villa × 5 dil = 7.500 satır gereksiz. JSONB tek satır, `name_i18n->>'en'` query'si index'lenebilir (varsa) ve render kodu basit. Ayrı tablo yalnızca FTS dil-spesifik index istesek anlamlı olur — Türkçe trigram zaten yeter.
4. **PostGIS gerekli mi?** Karar: HAYIR. 1.500 villa × 30 restoran × 17 antik = 2.000 nokta. Haversine SQL fonksiyonu + (lat,lng) btree index "yakındaki villalar" sorgusu için yeter. PostGIS 50+ MB yer kaplar ve free tier'da yazık. İleride 50k+ nokta olursa eklenir.
5. **News mi Listings mi?** `haberler.json` → ayrı `news_items` tablosu. Niye? Otomasyon workflow (Instagram harvester → pending → verified → published → social publish) listings'in basit `active` durumuna sığmaz.
6. **Trigger Email Extension yerine ne?** Karar: `public.mail_queue` + pg_cron her dakika boşaltan Edge Function + Resend.com API (3K mail/ay free).
7. **`hizmet-saglayicilari.json` seed mi yoksa provider olarak mı?** Karar: `providers` tablosuna `verified=true, status='active', owner_id=admin_uuid` ile seed et. Niye? Tip aynı, mantık aynı, kod basitlik.
8. **`likya-yolu.json` etapları**: 25 etap (id 1-25). `listings.kind='likya_etap'` ile seed, `data` içine `from/to/distance/duration/difficulty`. Stage sıralaması için `display_order = id`.

---

## 5. Migration Sırası (önerilen)

**Faz 0 — Hazırlık (1-2 saat)**
- [ ] Supabase projesi oluştur (kalkan-info-prod)
- [ ] `.omc/research/SUPABASE_SCHEMA.sql` dosyasını SQL Editor'a yapıştır, çalıştır
- [ ] Storage bucket'ları oluştur: `profiles` (public), `reviews` (public), `news` (public)
- [ ] Google + Facebook OAuth redirect URL'lerini Supabase'in callback URL'sine ekle
- [ ] `.env.local`'a `SUPABASE_URL`, `SUPABASE_ANON_KEY` ekle (service_role asla client'a koyma)

**Faz 1 — Statik içerik seed (1 saat)**
- [ ] `scripts/seed-supabase.mjs` yaz (yukarıdaki pseudo'dan)
- [ ] `data/*.json`'ları `listings` ve `news_items` tablolarına yükle
- [ ] Supabase Studio'dan kontrol — 1.700 satır görmeli

**Faz 2 — Auth göçü (3-4 saat)**
- [ ] `js/auth.js` baştan yaz (Supabase Auth)
- [ ] `js/profile.js` güncelle
- [ ] `js/auth-pill.js`, `js/site-drawer.js` küçük dokunuşlar
- [ ] Test: register/login/logout, KVKK consent kaydı, hesap silme, veri indir

**Faz 3 — İçerik göçü (4-5 saat)**
- [ ] `js/jobs.js` güncelle
- [ ] `js/reviews.js` güncelle
- [ ] `js/onboarding.js` güncelle + Storage upload
- [ ] `js/activities.js`, `js/providers-modal.js`, `js/render.js`

**Faz 4 — Vacation Planner (2 saat)**
- [ ] Edge Function: `supabase/functions/vacation-planner/index.ts`
- [ ] `js/vacation-planner.js` Supabase çağrısına geç
- [ ] Rate limit testleri

**Faz 5 — Otomasyon (Faz 1'den sonra istenildiği zaman)**
- [ ] Edge Functions: 7 Cloud Function'ı port et
- [ ] pg_cron job'ları kur
- [ ] Resend.com hesabı + mail_queue flush

**Faz 6 — Kesinleştirme**
- [ ] Firebase'i koddan tamamen söküp at
- [ ] `firebase.json`, `.firebaserc`, `functions/`, `firestore.rules`, `firestore.indexes.json` arşivle (sil değil)
- [ ] DNS / hosting: hosting Vercel/Netlify'a taşı (Firebase Hosting'i çıkar)

---

## 6. Storage Politikaları (SQL şemasının dışında, Supabase Studio veya SQL ile)

```sql
-- Bucket: profiles (onboarding cover + gallery)
CREATE POLICY "profiles_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'profiles');
CREATE POLICY "profiles_owner_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profiles'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "profiles_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id='profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Bucket: reviews (yorum fotoğrafları)
CREATE POLICY "reviews_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'reviews');
CREATE POLICY "reviews_author_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id='reviews' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 7. Geri Dönüş (Rollback) Planı

Firebase config dosyaları henüz canlı değil; rollback önemsiz. Yine de şu önlemleri al:

1. `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `.firebaserc` repo'da kalsın (silinmesin).
2. `functions/` klasörü `functions.deprecated/` olarak yeniden adlandırılsın — kod referansı için.
3. Eğer Supabase'de bir şey ters giderse `git revert` ile `js/*.js` dosyaları Firebase versiyonuna geri döner.
4. Supabase projesi free tier'da kaldığı sürece yan-yana çalıştırılabilir (Firebase ile birlikte) — geçişi yumuşatmak için.

---

## 8. Tahmini Toplam Çalışma

| Faz | Süre |
|---|---|
| 0 Hazırlık | 1-2 sa |
| 1 Seed | 1 sa |
| 2 Auth | 3-4 sa |
| 3 İçerik | 4-5 sa |
| 4 Vacation | 2 sa |
| 5 Otomasyon | 4-6 sa (sonra) |
| 6 Kesinleştirme | 1-2 sa |
| **TOPLAM (kritik yol Faz 0-4)** | **11-14 saat** |
| **TOPLAM (otomasyon dahil)** | **16-22 saat** |

Berkay tek başına, 2-3 günlük odaklı sprint ile bitirilir.

---

## 9. Özet — Berkay'a 1-Sayfalık Karar Listesi

1. **i18n**: JSONB (`name_i18n`) — basit, az tablo, free tier dostu.
2. **PostGIS yok**: Haversine SQL fonksiyonu yeter; 50 MB tasarruf.
3. **listings + providers ayrı**: statik içerik vs. kullanıcı içeriği — lifecycle farklı.
4. **news_items ayrı**: otomasyon workflow'u listings'in basit aktivasyonuna sığmıyor.
5. **mail_queue + Resend**: Trigger Email Extension yerine; 3K mail/ay free.
6. **Storage minimal**: dış URL'leri (Unsplash, Wikipedia) bırak; sadece kullanıcı upload Storage'da.
7. **Faz 6'ya kadar Firebase dosyaları silinmez**: rollback için.
