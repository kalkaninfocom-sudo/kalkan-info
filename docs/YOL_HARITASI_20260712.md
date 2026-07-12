# 🗺️ Yol Haritası — 2026-07-12 oturumu (YENİ OTURUMDA İLK BU)

> Berkay: oturumu kapatıp açacak. Kaldığımız yer + sıradaki + Berkay'ın yapması gerekenler.
> Durum işaretleri: ✅ bitti · 🔨 devam · ⏳ bekliyor · ⛔ Berkay'ın aksiyonu gerekli

---

## 🆕 2026-07-12 AKŞAM GÜNCELLEMESİ (bu oturum — buradan devam)

### 🧭 Arkadaşım Nerede — 3 sorun çözüldü + CANLI KONUM ÇALIŞIYOR
- ✅ **Render crash çözüldü** — Cesium Viewer fullscreen widget'ı CSP'de `unsafe-eval` olmadığı için Knockout'ta patlıyordu → `fullscreenButton:false, vrButton:false, baseLayer:false` eklendi.
- ✅ **Pinler gerçek konumda** — sabit 20/30m elipsoid yerine `CLAMP_TO_GROUND` (Kalkan zemini 48-111m; artık binaların üstünde).
- ✅ **Sadece Kalkan MERKEZ** — veriye Kaş/çevre köy mekanları karışmıştı (31 mekan >1.5km). `AREA` kutu filtresi: 152→104 pin + kamera kutuya kilitli + `requestRenderMode` (kasma bitti).
- ✅ **Başlangıç kamerası tepeden** (pitch -90, 1650m) — Berkay'ın istediği harita görünümü.
- ✅ **Grup + canlı konum UÇTAN UCA TEST EDİLDİ** — Supabase Realtime Presence çalışıyor (grup KLK oluştur → track → arkadaşlar haritada belirir, 0 hata). `wireUI/joinGroup/renderPresence/startShare` zaten bağlıymış — stub DEĞİL, çalışıyor. (Eski roadmap notu "Faz 1 backend stub" GÜNCEL DEĞİL.)
- ⛔ **BERKAY:** hâlâ Google Cloud Map Tiles API **kota cap** + referrer kısıtı koy (yukarıdaki nota bak).

### 🏢 kalkaninfo.com/office — AJANS VİTRİNİ (YENİ, CANLI)
- ✅ Kök `office.html` → `cleanUrls` → **kalkaninfo.com/office**. CSP uyumlu (fonts + placehold + `self` görseller).
- ✅ **Premium kalkaninfo dili**: gerçek Kalkan körfezi fotosu (`assets/img/da72f67377f7.webp`) + lacivert duotone + altın scrim (homepage'in birebir reçetesi), Montserrat/Inter, altın gradient CTA, stats (170+/137/5/20+).
- ✅ **CANLI PORTFÖY** = en güçlü satış kozu: 3 gerçek iş (Çakıl Beach, Coast Kalkan, Çiku) demoya tıklanabilir kartlar + "● CANLI" rozeti. Screenshot'lar `assets/office/port-*.jpeg`.
- ✅ Hizmet kartları (Web / İçerik-Reels / AI-Otomasyon) + CTA band + iletişim formu + dev KALKANINFO footer.
- 📌 **DERS (Berkay uyardı):** İlk versiyon Mittelco'nun flat çizim dükkanının rengini değiştirmişti — konsept markaya uymuyordu. Ajansın kendi sitesi = en güçlü satış kanıtı → premium + GERÇEK portföyle baştan kuruldu.
- 🔨 **SIRADAKİ (Berkay "sonra devam" dedi):**
  - Daha çok portföy (3→6: 3B arkadasim-nerede, gazete, +demolar). 3D screenshot ayrı yöntemle (Cesium render kilidi var).
  - Gerçek testimonial / sonuç rakamı ("X işletme rezervasyonu %Y arttı").
  - Teklif formunu Resend'e gerçek gönderime bağla (Berkay key).
  - Ana site header/footer'ına "Studio/Ajans" linki ekle.

### 📄 Bölgesel Süper-App one-pager (yatırımcı/satış)
- ✅ `docs/pitch/bolgesel-superapp.html` — problem/çözüm, "neden biz değil Google", 4 gelir kanalı, traction, ölçek merdiveni. Açık premium tema, PDF alınabilir.
- 💡 Strateji tezi: Google'a **rehin olma** (map-agnostik kal), moat = grounding + marka + çok-bölge şablonu. Berkay onayladı (Google'da kal ama bağımlı olma).

### 🔒 AgentShield (güvenlik denetimi) — YARIM KALDI
- ⏳ `npx ecc-agentshield@1.4.0 scan` harness/repo güvenlik taraması. Auto-classifier dış npm çalıştırmayı engelledi.
- ⛔ **BERKAY:** çalıştırmak istersen prompt'a yapıştır: `!npx -y ecc-agentshield@1.4.0 scan --path .claude --format text --min-severity low` (veya `--path kalkan-info`). Sonra bulguları analiz ederim.
- Not: ECC framework'ü KURMADIK (OMC ile %80 çakışır + hook güvenlik riski). Sadece izole scanner öneriliyor.

---

## 🔥 EN ÖNEMLİ — 3B Kalkan "Arkadaşım Nerede"
- ✅ **Google Photorealistic 3D Tiles ÇALIŞIYOR** — Kalkan'ın gerçek 3B kapsamı VAR (test edildi, render oldu: evler/sokaklar/tepeler + mekan pinleri).
- ✅ Sayfa: `arkadasim-nerede.html` (kalkaninfo.com/arkadasim-nerede) — Cesium + Google 3D + mekan katmanı + grup UI (Join/Create + canlı konum toggle + gizlilik notu).
- ✅ Google Maps key gömülü: `AIzaSyCInloGCiTFK8UKVQaIpMMBe8iSWdLBrGM` (Map Tiles API açık, çalışıyor).
- 🔨 **SIRADAKİ — Faz 1 backend:** Supabase şema (`users`/`groups`/`group_members`/`live_positions`) + **Realtime** + `wireUI()` içindeki TODO'ları bağla (join/create → channel subscribe → `__friends.upsert(pos)`; toggle → watchPosition → channel'a gönder). Şu an UI stub.
- 🔨 "Son görülen konum" + mekanların son IG hikayeleri katmanı.
- ⛔ **BERKAY:** Google Cloud → **Map Tiles API KOTA LİMİTİ** koy (gerçek cap — budget alert sadece uyarır!). Console → APIs → Map Tiles API → Quotas → günlük istek limiti. + key'i **kalkaninfo.com referrer**'ına kısıtla.
- 💰 Google 3D Tiles = tek gerçek fatura riski. $200/ay ücretsiz kredi; viral olursa aşılır → kota şart.
- 📌 Not: Demo key "test amaçlı" — prod için düzgün key + billing gerekebilir.

## 🍽️ LA MORA (lamorakalkan) sitesi
- ✅ kalkaninfo.com/lamora — Kardelen'den klonlanıp LA MORA'ya rebrand (siyah/altın/kırmızı-gingham + zeytin dalı logo).
- ✅ Gerçek **altın tabela hero** + yemek banner (Berkay'ın gönderdiği görseller kullanıldı).
- ✅ **Mobil uyumlu** (tabela blok düzen, crop yok, full-width butonlar).
- ✅ Admin panel değişmedi (istendiği gibi).
- ⏳ Berkay: gerçek menü/telefon/foto admin panelden (`/lamora/admin.html`, şifre `lamora2026`).
- ⏳ Standalone Express sürümü (Paket B, kendi domain): `C:\Users\socie\lamora-site` + GitHub `kalkaninfocom-sudo/lamora-kalkan`. Domain lamorakalkan.com.tr kaydı bekliyor.

## 📄 LA MORA Teklif PDF
- ✅ `teklifler/lamora/Lamora-Kalkan-Teklif.pdf` (8 sayfa). Fiyatlar: Paket A ₺14.000 + ₺1.000/ay · Paket B ₺21.500 + ₺1.500/ay · Google ₺7.500 · **Fotoğraf ₺7.500** (ayrı) · Web-kendi-domain kalem ₺12.500 · ajansAI ₺10.000/ay + çekim ₺5.000/ay.
- Not: teklif klasörü git'e commit'lenmedi (public olmasın); PDF lokalde hazır.

## 🤖 Tatil Planlayıcı (kalkaninfo.com/tatil-asistani)
- ✅ **Gerçek AI** (ücretsiz NVIDIA + stub-fallback) — artık kişiselleştirilmiş plan üretiyor (stub değil).
- ✅ **Telegram bildirimi** — her yeni talepte admin Telegram'a düşüyor.
- Edge Function: `supabase/functions/vacation-planner/index.ts` (deploy edildi). Rate limit: anon 1/gün.

## 📸 Telegram Photo-Shop (foto→shop→geri)
- ✅ Kod: `api/telegram-webhook.js` foto dalı + `lib/image-shop.js` (nano-banana/Gemini), PC-bağımsız (Vercel).
- ⛔ **BERKAY:** Gemini **billing** aç (free-tier kota=0) → foto-shop çalışır. Şu an "billing gerekiyor" mesajı döner.

## 🛰️ Otomasyonlar (GitHub Actions cron)
- ✅ **skill-radar** — günlük yeni Claude skill taraması → Telegram digest. Repo: `kalkaninfocom-sudo/claude-skill-radar`.
- ✅ **agent-learn** — günlük ajan öğrenme rotasyonu (07-08'de donmuş öğrenme YENİDEN AKTİF).
- ✅ **kalkan-agency** OMC skill bundle: `venue-analyst` (satış hedef puanlama), `skill-scout` (skill radar). `~/.claude/skills/kalkan-agency/`.

## 📱 IG Reels
- ✅ webapp-promo **EN + TR** düzeltildi (İngilizce menü + yüksek-çöz açılış görseli).
- ✅ **TR reel YAYINLANDI** → @kalkan.info (instagram.com/reel/Dar7p1bE2d7/).
- ⏳ **EN reel** — "sonra" yayınlanacak. Seçenek: API (`node scripts/_publish-webapp-promo.mjs en`, hashtag+feed) VEYA elle (viral: geotag+trend ses+tag). Not: IG API geotag/trend-ses/tag YAPAMAZ (bkz `reference_ig_api_publish_limits`).

## 🏢 AjansAI Platform (28 agent B2B vizyonu)
- ✅ Teknik tasarım dokümanı: `ajansai-photoshop/AJANSAI_TEKNIK_TASARIM.md` (4 katman, veri modeli, 7 motor algoritması, provenance hash-chain, faz planı).
- ⏳ Faz 0 = Photo-Shop (billing bekliyor).

## 📧 "0'dan mail açma" (Cloudflare + Resend)
- ✅ Script: `scripts/agency/provision-email.mjs` (Email Routing + Resend + DNS).
- ⛔ **BERKAY:** Cloudflare API token (Zone DNS + Email Routing yetkili) ver → çalışır.

## 🛠️ Diğer
- ✅ claude-seo kuruldu (31 skill + 18 agent, `~/.claude/`).
- ✅ **Gizli bug fix:** `.vercelignore` `*.mjs` lib modüllerini deploy-dışı bırakıyordu → webhook 500. `!lib/**` ile düzeltildi.
- ✅ `harita-3d.html` — MapLibre ÜCRETSİZ 3B harita (mekan pinleri) — deploy edildi, gerçek tarayıcıda test edilecek.
- ⏳ "affaan/everything-claude-code" repo — bulunamadı; aday `wesammustafa/Claude-Code-Everything-You-Need-to-Know`. Berkay tam link verecek.

---

## ⛔ BERKAY'IN AKSİYON LİSTESİ (yeni oturumda)
1. **Google Cloud:** Map Tiles API kota limiti (3B harita fatura koruması) + key referrer kısıtı.
2. **Gemini billing** aç (photo-shop için).
3. **Cloudflare API token** ver (mail provision).
4. **EN reel** yayın kararı (API mı elle mi).
5. Lamora **.com.tr domain** kaydı (Paket B için).
6. everything-claude-code repo tam linki.

## 💰 Maliyet özeti
- **Şu an ~$0/ay** (Vercel/GitHub/Supabase/NVIDIA hepsi ücretsiz katman).
- Opt-in: Google 3D Tiles ($200/ay kredi → cap şart), Gemini foto (~$0.02-0.04/foto), .com.tr (~₺500/yıl, müşteri öder).
