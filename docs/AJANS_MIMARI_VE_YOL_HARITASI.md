# 🏢 Kalkan Info — 7/24 Otonom AI Ajansı · Mimari & Yol Haritası

> Vizyon (Berkay, 2026-07-02): Gerçek bir şirket gibi çalışan, 7/24 canlı bir AI ajansı.
> Agentlar sadece masada oturmaz — mesai saatleri vardır, işlerini bitirince ortak
> alanlarda dolaşıp "Kalkan Info'yu nasıl daha iyi yaparız?" diye tartışır, bu tartışmalar
> kayıt altına alınıp **kurucuya haftalık sunum** olarak gider. Her işin sabit bir saati
> vardır, hata olmayacak şekilde kurgulanır. Her agent kendi mesleğinde derin uzmandır ve
> her gün internetten alanındaki gelişmeleri takip edip kendini günceller.

Bu belge CANLI tutulur (ADHD kuralı). Durum işaretleri: ✅ bitti · 🔨 yapılıyor · ⏳ sırada · ⛔ bloke.

---

## 0. Şu an neyimiz var (temel)
- ✅ **Ajans backend CANLI** — Supabase Edge Function `agency` (`/status /enqueue /run /approve /publish`), NVIDIA NIM ile gerçek agent çalıştırma. DB: `agency_jobs/content/state`. Bkz `project_kalkan_agency_live_20260702`.
- ✅ **Cockpit** `/oyun/` — izometrik tek oda, 8 agent masada (statik), şifre `123`, canlı `/status` polling.
- ✅ **Gazete otomasyonu** — `newspaper/generator/build.mjs` (morning+magazine), GitHub Actions `newspaper-daily.yml` (06:00), 4:5 sosyal kart, Telegram onay.
- ✅ **Haber/sosyal** — RSS aggregator, IG haber kartı+post, FB responder, cheap-llm router (ollama→nvidia→gemini→claude).
- ✅ **24 agent tanımı** — `data/agency/agents.json` (system prompt'lar).

Eksik olan: **(1)** her işin SABİT SAATLİ 7/24 orkestrasyonu, **(2)** agent davranışı (mesai/dolaşma/tartışma), **(3)** yürünebilir çok-odalı BİNA görseli, **(4)** derin meslek personaları + günlük self-update, **(5)** haftalık kurucu raporu.

---

## 1. Bina Mimarisi (görsel katman — yürünebilir çok-odalı)
Tek "dollhouse kesiti" bina; tüm alanlar aynı anda görünür, agentlar aralarında **kapı/geçişlerle** dolaşır. Alanlar:

| Alan | İçerik | Kim kullanır |
|---|---|---|
| **Çalışma Katı** | Departman masaları (mevcut 8+ agent), deniz manzarası | Mesaideki agentlar |
| **Toplantı Odası** | Uzun masa, ekran, beyaz tahta | Tartışma/brainstorm oturumları |
| **Ortak Dinlenme Alanı** | Kanepe, kahve, TV | Molada dolaşan agentlar |
| **Mutfak** | Tezgah, buzdolabı, kahve, yemek masası | Mola |
| **Bahçe** | Yeşillik, banklar, pergola | Rahat tartışma / mola |
| **Havuz** | Havuz + şezlong | Mola / "sosyal" alan |

**Kurallar:** izometrik tutarlılık, marka paleti (#0a2e4c navy / #f4b53d gold / deniz mavileri), yürüme = tile-tile animasyon (transform/opacity), kapılardan geçiş, doğru derinlik sıralaması (zOf). Cockpit'in mevcut motoru (iso projeksiyon, placeObj, personSVG, isoBoxSVG) genişletilerek yapılır — sıfırdan değil.

---

## 2. Davranış Motoru (agentlar canlı yaşar)
Her agent bir **durum makinesi**dir; durumu takvim + iş kuyruğu belirler:

1. **`commute` (mesaiye 1 saat kala):** İş saatinden 1 saat önce dinlenme alanından **masasına yürür**, `work` durumuna geçer.
2. **`work`:** Atanmış görev(ler)i yapar (agency backend'de gerçek LLM işi). Masada, "çalışıyor" balonu.
3. **`free` (görev bitti):** Ortak alanlara (bahçe/havuz/mutfak/toplantı) **dolaşmaya** gider.
4. **`discuss`:** İki+ boş agent aynı alanda buluşunca **tartışma oturumu** başlatır (bkz §4).
5. **`off` (mesai dışı):** Dinlenme alanında bekler / minimal hareket.

Durum, cockpit'in `agency_state` tablosundan okunur → görselde agent o alana yürür. Yani **görsel = gerçek durumun yansıması** (sahte animasyon değil).

---

## 3. Sabit Saatli Orkestrasyon (7/24 "her işin bir saati")
### 3.1 Teknik omurga (kısıt-uyumlu)
- **Vercel'e DOKUNMA** (api 12/12, cron 2/2 dolu).
- **Zamanlayıcı = GitHub Actions cron** (`*/10 * * * *`, public repo = ücretsiz) → bir "tick" scripti çalışır:
  `scripts/agency/scheduler.mjs tick` → `data/agency/schedule.json`'daki O ANA denk gelen görevleri bulur → agency Edge Function'a (`/enqueue` veya `/run`) yollar VEYA ilgili script'i çalıştırır.
- LLM işi Edge Function + NVIDIA'da (zaten canlı). Yayın işleri mevcut scriptlerde.
- Onay kapısı: Telegram (mevcut `telegram-webhook`).

### 3.2 Bayrak akış — Günlük Gazete (Berkay'ın verdiği örnek, birebir)
| Saat | Aksiyon | Sorumlu agent | Nasıl |
|---|---|---|---|
| **07:00–07:50** (her 10 dk) | Kalkan bölgesel haber araştırması → haber + magazin başlıkları taslağı | `muhabir` + `magazin-editoru` | RSS + web araştırma → cheap-llm → `agency_content` (taslak) |
| **07:55** | O günün başlıkları **onaya sunulur** (Telegram) | `yayin-yonetmeni` | Telegram onay mesajı (Onayla/Değiştir/Reddet) |
| **08:00** | Onay geldiyse → **2 sayfalı gazete üret** (haber + magazin) → **web + Instagram + Facebook** yayınla | `yayin-yonetmeni` orkestrasyon | `newspaper-daily.mjs` + IG/FB publish |

### 3.3 Diğer işlerin saat tablosu (v1 taslak — her agent sıra ile)
| Saat | İş | Agent |
|---|---|---|
| 05:00 & 17:00 | Trend/hashtag tarama | `trend` (TrendScout) |
| 06:00 | Günün içerik kararı | `director` (ContentDirector) |
| 07:00–08:00 | Gazete akışı (§3.2) | muhabir, magazin, foto, yayin-yonetmeni, reklam-uyum |
| Gün içi (her mesaj) | WhatsApp/IG triage + oto-cevap | `reception` |
| Sürekli (lean bütçe) | Ads ROAS izleme | `ads` |
| Pzt 07:00 | Haftalık büyüme planı | `growth` |
| Pzt 08:00 | Haftalık analitik digest | `analyst` |
| Yayın öncesi (her caption) | Marka/risk denetimi | `guard` (BrandGuard) |
| Her gün 09:00 | **Self-update**: her agent kendi alanındaki güncel gelişmeleri tarar (§5) | tüm agentlar |
| Cuma 16:00 | **Haftalık kurucu raporu** derle+gönder (§4) | `analyst` + `director` |

> Hedef: her işin net saati, çakışma yok, hata-toleranslı (bir adım başarısızsa loglanır + eskale edilir, sessiz geçmez).

---

## 4. Tartışma + Haftalık Kurucu Raporu
- Boş agentlar ortak alanda buluşunca **tartışma oturumu**: 2-4 agent, konu "Kalkan Info'yu nasıl daha iyi yaparız?" (departman bağlamıyla). Çok-turlu LLM diyaloğu.
- Her oturum `agency_discussions` tablosuna kaydedilir (katılımcılar, konu, çıkan fikirler, aksiyon önerileri).
- **Cuma 16:00**: hafta boyu biriken tartışmalar + iş sonuçları + metrikler → tek **haftalık sunum** (özet + öneriler) → kurucuya Telegram/e-posta.

---

## 5. Derin Meslek Personaları + Günlük Self-Update
- Her agent'ın `system` promptu, o mesleğin **en ince detayına kadar** uzmanı olacak şekilde yeniden yazılır (ör. SocialWriter = platform algoritmaları, hook yapıları, 2026 trend formatları; AdsOptimizer = ROAS/CAC/LTV, kampanya yapıları, pixel/CAPI). `data/agency/agents.json` genişletilir.
- **Günlük self-update (09:00):** her agent kendi alanında "bugün dünyada ne değişti?" araştırması yapar (web) → `agency_state.knowledge` alanına özet düşer → sonraki görevlerde bu güncel bilgi bağlama eklenir. Böylece agentlar "kendini güncelleyip yeni fikir üretir".

---

## 6. Fazlı Yol Haritası (her faz tek başına çalışır halde biter)
- **Faz 1 — Zamanlayıcı omurgası** ⏳: `schedule.json` + `scheduler.mjs` + GitHub Actions (*/10). Gazete akışını (§3.2) uçtan uca sabit saatli çalıştır. (En yüksek değer: şirket gerçekten 7/24 çalışmaya başlar.)
- **Faz 2 — Derin personalar + self-update** ⏳: agents.json'u derinleştir + 09:00 self-update döngüsü.
- **Faz 3 — Tartışma + haftalık rapor** ⏳: `agency_discussions` + oturum motoru + Cuma raporu.
- **Faz 4 — Bina görseli** ⏳: çok-odalı yürünebilir bina + davranış motoru (§1-2), durum tablosundan beslenir.
- **Faz 5 — Sağlamlaştırma** ⏳: hata-tolerans, eskalasyon, gözlemlenebilirlik, çakışma denetimi.

> Not: Faz 1-3 "beyin" (şirketi gerçekten çalıştırır), Faz 4 "yüz" (görsel). Değer sırası: beyin → yüz. Ama Berkay görseli önce isterse Faz 4 öne alınır.
