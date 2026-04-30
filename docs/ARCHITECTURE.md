# Kalkan Info — Mimari Karar Dokümanı (ADR v1)

**Tarih:** 2026-04-30 · **Durum:** Yürürlükte · **Sahip:** Berkay Elmastaş
**Bölge:** `europe-west3` (Frankfurt — KVKK için AB sınırları içinde)

---

## 1. Firebase Proje Konfigürasyonu

### 1.1 Proje
| Alan | Değer |
|---|---|
| Project ID | `kalkan-info-prod` |
| Display name | Kalkan Info |
| Default GCP region | `europe-west3` |
| Plan | Blaze (Functions için zorunlu) |
| Billing alert | $25/$50 e-posta uyarısı |

### 1.2 Authentication
- **Google** — birincil, scope: `email`, `profile`
- **Facebook** — Meta for Developers app
- **E-posta/Parola** — yedek, e-posta doğrulama zorunlu
- **Anonim** — KAPALI (KVKK izlenebilirlik)

**Authorized domains:** `kalkaninfo.com`, `www.kalkaninfo.com`, `kalkan-info-prod.web.app`, `localhost`

**Admin yetki:** Custom claim `admin: true`. Sadece Cloud Function ile set edilir. UI'dan asla.

### 1.3 Firestore
- Mode: Native · Location: `europe-west3` · Multi-region: HAYIR (KVKK)
- Backup: Günlük cron + 7 gün retention (`gcloud firestore export`)

### 1.4 Storage
| Bucket | Lokasyon | Kullanım |
|---|---|---|
| `kalkan-info-prod.appspot.com` | europe-west3 | Kullanıcı yüklemeleri |
| `kalkan-info-prod-backups` | europe-west1 | Firestore exportları |

**Path layout:**
```
users/{uid}/avatar.jpg
users/{uid}/exports/{timestamp}.json
profiles/{profileId}/cover.jpg
profiles/{profileId}/gallery/{n}.jpg
profiles/{profileId}/menu/{n}.jpg
reviews/{reviewId}/{n}.jpg
news/{newsId}/{n}.jpg
```

### 1.5 Cloud Functions (Node 20, europe-west3)

| Fonksiyon | Tetikleyici | Amaç |
|---|---|---|
| `onUserCreate` | Auth | `users/{uid}` doc + welcome email |
| `onUserDelete` | Auth | KVKK silme zinciri |
| `setAdminClaim` | callable | Admin yetkisi atama |
| `exportUserData` | callable | KVKK taşınabilirlik |
| `whatsappWebhook` | HTTPS | Meta WhatsApp Business |
| `verifyNewsItem` | callable | Claude API ile teyit |
| `publishToSocial` | Pub/Sub | Buffer/Publer'a iletim |
| `vacationPlanner` | callable | Tatil planı (timeout 540s) |
| `dailyBackup` | scheduled | `0 3 * * *` Europe/Istanbul |
| `thumbnailGenerator` | Storage | Görsel optimizasyonu |

### 1.6 Hosting
- Public root: proje kökü
- Cache: HTML 1 saat, asset 1 yıl immutable
- Rewrite: `/api/**` → Functions

### 1.7 App Check
- Faz 5+ aktive (reCAPTCHA Enterprise)
- Faz 1'de KAPALI (dev hızı için)

---

## 2. Firestore Veri Modeli

### 2.1 `users/{uid}` — özel
| Alan | Tip |
|---|---|
| email, displayName, photoURL, provider | string |
| preferredLang | `tr|en|ru|ja|ar` |
| marketingOptIn | boolean (default false) |
| kvkkConsent | `{version, timestamp, ip, userAgent}` |
| createdAt, updatedAt, deletedAt | Timestamp |
| roles | array<string> |

### 2.2 `profiles/{profileId}` — public read (active)
| Alan | Tip |
|---|---|
| ownerUid | string (indexli) |
| type | `restoran|villa|asci|transfer|tur|hizmet` |
| status | `pending|active|rejected|suspended` |
| name, slug, category, summary | string |
| descriptionML | `{tr,en,ru,ja,ar}` |
| images, coverImage | array / string |
| menu | array<map> (restoran tipi) |
| priceRange, hours | string / map |
| contact | `{phone, whatsapp, email, website}` |
| location | geopoint + address |
| ratingAvg, ratingCount | number |

**İndeksler:**
- `(type, status, ratingAvg DESC)`
- `(status, createdAt DESC)`
- `(ownerUid, status)`

### 2.3 `reviews/{reviewId}` — public read (visible)
| Alan | Tip |
|---|---|
| targetType | `profile|activity|vacation` |
| targetId, authorUid, authorName, authorPhoto | string |
| rating | 1-5 |
| text | max 2000 |
| photos | array<string>, max 5 |
| status | `visible|hidden|reported|deleted` |
| reply | `{text, byUid, at}` |
| helpful | number |

**İndeksler:** `(targetType, targetId, status, createdAt DESC)`, `(authorUid, createdAt DESC)`, `(status, createdAt DESC)`

### 2.4 `vacations/{planId}` — sadece sahip
| Alan | Tip |
|---|---|
| ownerUid | string |
| dateRange | `{start, end}` |
| groupSize | `{adults, children}` |
| budget | `{amount, currency}` |
| items | `array<{type, refId, title, price, status, bookingRef}>` |
| status | `draft|confirmed|cancelled` |
| claudeRequestId | string |

### 2.5 `activities/{activityId}` — public read (published), admin write
- title, titleML, season, dateStart/End, location, descriptionML, images, tags, status

### 2.6 `newsItems/{newsId}` — public read (published)
- source, sourceRef, rawText (admin only), verifiedSummary, summaryML, claudeConfidence
- category: `acil|etkinlik|genel|eczane|hava`
- publishedTo: `{youtube, instagram, facebook, twitter, tiktok}`
- status: `draft|verifying|verified|published|rejected`

### 2.7 `automations/{jobId}` — admin only
- type, schedule (cron), enabled, lastRun, lastStatus, runCount

### 2.8 Subcollections
- `users/{uid}/notifications/{notifId}` — push/email log
- `users/{uid}/sessions/{sessionId}` — KVKK audit
- `users/{uid}/exports/{exportId}` — KVKK taşınabilirlik
- `profiles/{profileId}/analytics/{day}` — admin only

---

## 3. KVKK Uyumluluk Akışları

### 3.1 Aydınlatma & Onay
- İlk login'de modal — `kvkkConsent.version` saklanır
- Versiyon değişince re-consent zorunlu
- IP + UA + timestamp denetim için

### 3.2 Veri Saklama Süreleri
| Veri | Süre | Sebep |
|---|---|---|
| `users/{uid}` aktif | Üyelik süresince | Hizmet |
| `users` `deletedAt` set | 30 gün | Geri alma |
| 30 gün sonra | Hard delete | KVKK silme |
| `reviews` silinmiş | 90 gün anonim | Spam audit |
| `vacations` | 1 yıl | Hizmet geçmişi |
| `users/sessions` | 90 gün | Güvenlik |
| Cloud Logging | 30 gün | Operasyonel |

### 3.3 Silme Akışı
1. `profil.html` → "Hesabımı sil" → re-auth
2. `deletedAt = now()`, displayName anonimleştir
3. Cloud Function: profiller `suspended`, yorumlar `deleted` + text `[silindi]`, vacations `ownerUid=null`
4. Cron `dailyCleanup` → 30 gün sonra Storage + Firestore + Auth temizlik
5. Audit: `kvkk-deletions/{uid}` (sadece tarih, PII yok)

### 3.4 Veri Taşınabilirlik (Madde 11)
- "Verilerimi indir" → `exportUserData` Function
- JSON: `users/{uid}/exports/{timestamp}.json`
- Signed URL 24h, e-posta ile gönderilir

### 3.5 Sub-İşleyiciler
| Hizmet | Veri | Lokasyon |
|---|---|---|
| Google Firebase | Tüm uygulama | europe-west3 |
| Anthropic Claude | Plan promptu (PII çıkarılmış) | US — zero-retention |
| Meta WhatsApp | Mesaj metni | EU/US |
| Mailgun/SendGrid | E-posta meta | EU |
| Buffer/Publer | Sosyal post | US — DPA |

### 3.6 VERBİS
- Berkay Elmastaş (gerçek kişi)
- KVKK Kurumu kaydı: Faz 1 sonu
- İrtibat: `kvkk@kalkaninfo.com`

---

## 4. Statik JSON Geçiş Stratejisi

Faz 1: `data/*.json` DOKUNULMAZ. Mevcut sayfalar fetch ile okumaya devam.

**Faz 4-7 göç:**
1. Cloud Function `migrateStaticData` → `data/villalar.json` → `profiles` (`type:'villa', status:'active'`)
2. Frontend lazy-switch: önce Firestore, fallback JSON (geçiş haftası)
3. JSON'lar git history'de kalır, dosyalar silinir

**Mevcut admin emekliliği:**
- `admin/admin.js` parola sistemi Faz 2'de kapatılır
- Yeni admin: Firebase Auth + custom claim
- `data/config.json:28-30` `passwordHash` → SİLİNECEK

---

## 5. Operasyonel Pratikler

- **Tek prod env** başlangıçta — staging 1000+ kullanıcı sonrası
- **Local emulator** her dev oturumunda zorunlu
- **Deploy** tek komut: `firebase deploy --only hosting,functions,firestore:rules,storage:rules`
- **Rules CI** her PR'da emulator test (Faz 2)
- **Bütçe alarmı** GCP Console
- **Secret yönetimi** Cloud Secret Manager (Claude key, Meta tokens)

---

## 6. Açık Kararlar

- App Check tam zamanlama (Faz 4-5 arası)
- Multi-tenancy white-label (Faz 10+)
- BigQuery export (10K+ kullanıcı sonrası)
- **KVKK pragmatizm:** Faz 1 minimum (consent + manuel silme), Faz 3 tam (cron + audit + export)
- **Supabase alternatifi steelman:** Solo founder için daha az servis, daha öngörülebilir maliyet. Ama Firebase Hosting'de zaten varız, Auth providers daha olgun. Karar Firebase'de kalır.

---

## 7. P0 Güvenlik Bulgusu (Acil)

`data/config.json:28-30` ve `admin/admin.js:10` plaintext admin parolası içeriyor (`kalkan2026`). Repo public ise herkes erişebilir. Faz 2 Auth migration tamamlanana kadar:
- `admin/` dizinini Hosting `ignore` listesine al (✅ `firebase.json`'a eklendi)
- Admin paneli sadece `firebase serve` lokal-only kullan
- Faz 2 sonu: parola sabitleri SİL
