# AjansAI / kalkaninfo.com — Maliyet, Eksik Araç & Ortaklık Raporu

**Tarih:** 2026-07-03 · **Amaç:** SaaS vizyonu için (1) eksik araçlar + aylık maliyet, (2) ortaklık
araştırması, (3) SaaS'ta partner/sağlayıcı şirketlere sağlanacak gelir modeli. Fiyatlar Temmuz 2026 web
araştırmasıyla doğrulandı (kaynaklar en altta). Rakamlar TAHMİN; kullanım arttıkça değişir.

---

## 1) EKSİK ARAÇLAR + AYLIK MALİYET (bugünkü aşama)

Mevcut stack büyük ölçüde ücretsiz katmanda ve limitlere takılıyor. Sistemin **güvenilir + sellable** olması
için gereken minimum ödemeli stack:

| Araç | Neden gerekli (mevcut eksik) | Plan | Aylık $ |
|---|---|---|---|
| **Vercel Pro** | Hobby'de api/*.js 12/12 dolu, 2 cron limiti dolu → yeni özellik eklenemiyor | Pro (1 seat) | **$20** + kullanım |
| **Supabase Pro** | Free tier prod için yetersiz (7 gün log, pause riski, 500MB DB) | Pro | **$25** + kullanım |
| **Claude API** | Agent'lar NVIDIA NIM'de timeout ("Signal timed out") → güvenilir LLM şart | Kullanım bazlı | **~$100** (değişken) |
| **Görsel üretim (fal.ai FLUX)** | imagen-3 free 404; antik 360°/reels/kart görselleri için | Pay-per-image ($0.025–0.05) | **~$30** |
| **Video üretim (Seedance)** | Reels/tanıtım videoları; şu an placeholder bozuk | Basic/Std abonelik | **~$18–30** |
| **ElevenLabs** | Antik kent sesli rehber + reels anlatım; free plan bloklu | Creator ($22) | **$22** |
| **SerpApi** | Yeni bölge içerik edinme (Google Maps scrape) + veri tazeleme | 5k arama | **$75** |
| **Resend** | E-posta (newsletter/onay); free limiti düşük | Pro (opsiyonel) | **$0–20** |
| **Alan adı / misc** | Domain + küçük servisler | — | **~$10** |
| | | **TOPLAM** | **~$300–350 / ay** |

> Not: Claude/görsel/video/SerpApi kullanım bazlı → tek bölgede düşük, çok bölgede (SaaS) doğrusal artar.
> Ücretsiz router (`lib/cheap-llm.mjs`: Ollama→NVIDIA) angarya işi bedava tutup Claude'u kaliteli işe saklar → maliyeti kırar.

### "Agent" (AI sağlayıcı) eksikleri
- **Metin/muhakeme**: Claude API (birincil), NVIDIA NIM (angarya, ücretsiz), Gemini (fallback — key var).
- **Görsel**: fal.ai (FLUX) veya Gemini-image. **Eksik: ödemeli görsel key.**
- **Video**: Seedance / Kling / Runway. **Eksik: hiç kurulu değil.**
- **Ses**: ElevenLabs. **Eksik: ödemeli plan.**
- **Arama/veri**: SerpApi (Maps). **Var ama kredisi bitiyor.**

---

## 2) ORTAKLIK ARAŞTIRMASI (sellable ürün için)

### A. Startup kredi programları (asıl "destekçi" yolu — nakit değil kredi)
Toplamda $500K+ kredi erişilebilir. Bunlar seni **maliyetsiz kurup pazarlamana** izin verir:

| Program | Kredi (tavan) | Not |
|---|---|---|
| **Google for Startups Cloud** | **$200K–350K** (AI Tier) | Sen zaten görüşmedesin (Lara Dinçer/Elif). EN YÜKSEK kaldıraç. Vertex/Gemini için +$150K. |
| **Microsoft for Startups Founders Hub** | ~$150K + GitHub Enterprise | 10 dk başvuru, fon şartı yok. Kolay al. |
| **AWS Activate** | $1K–100K | Son 12 ayda fon şartı üst katman için. |
| **Vercel AI Accelerator** | $8M havuz (40 katılımcı) | 6 haftalık program; başvur. |
| **Supabase** (YC/Vercel partner) | değişken | Partner programlarıyla. |

> ⚠️ **Anthropic**: sürekli ücretsiz tier YOK ($5 deneme). Kredi ancak YC/accelerator/Claude for Startups ile.
> Yani "Anthropic beni destekler" pek olası değil; **Google Cloud senin gerçek büyük destekçin** (görüşme de var).

### B. Ürün ortakları (SaaS'ı satılabilir kılan)
- **Google Maps Platform** — bölge veri edinme (işletme/harita). Ürünün çekirdek verisi.
- **Ödeme**: iyzico (TR) / Stripe (global) — SaaS abonelik faturalama.
- **Meta (IG/FB)** — sosyal otomasyon; app review + kalıcı token.
- **Dağıtım ortakları**: belediyeler, turizm dernekleri, yerel ticaret odaları, bölgesel girişimciler → her yeni
  bölge için satış kanalı. (Asıl zor kısım teknik değil, bu dağıtım.)

---

## 3) SAAS GELİR MODELİ + SAĞLAYICILARA SAĞLANAN GELİR

**Varsayım (muhafazakâr):** bölge başı ortalama SaaS fiyatı **$150/ay** (paketler: Info $99 / Info+Ajans $199 /
Tam $299). Bölge başı marjinal sağlayıcı maliyeti **~$40/ay** (LLM + görsel/video + altyapı payı + veri tazeleme).

| Bölge (tenant) | Senin gelirin/ay | Sağlayıcılara giden/ay | Senin brüt marjın/ay |
|---|---|---|---|
| 1 (Kalkan pilot) | $150 | ~$40 + sabit $300 altyapı | (yatırım aşaması) |
| 10 | $1.500 | ~$400 + $300 sabit = ~$700 | ~$800 |
| 50 | $7.500 | ~$2.000 + $300 = ~$2.300 | ~$5.200 |
| 100 | $15.000 | ~$4.000 + $300 = ~$4.300 | ~$10.700 |

**Sağlayıcı şirketlere sağladığın yıllık gelir (sponsorluk pazarlığının temeli):**
- 50 bölgede: ~$2.000/ay × 12 = **~$24K/yıl** sağlayıcılara (Google Cloud/Claude/fal/ElevenLabs/SerpApi).
- 100 bölgede: **~$48K/yıl**.

> Bu rakam **kredi/sponsorluk pazarlığının kozu**: "Ölçeklenince size yılda $X getireceğim, başlangıçta kredi verin."
> Google Cloud için bu güçlü bir argüman (zaten görüşme var). Diğerleri için accelerator başvurusu daha gerçekçi.

**Dürüst uyarı:** Model, ürün **gerçekten çalışır + genelleştirilmiş** olduğunda geçerli. Bugün önce Faz 1
(agent↔gazete + agent tamir) bitmeli. Gelir tahminleri satış/dağıtımın çözülmesine bağlı — asıl risk orada.

---

## Kaynaklar
- Vercel Pro: https://vercel.com/pricing
- Supabase Pro: https://supabase.com/pricing
- Claude API: https://platform.claude.com/docs/en/about-claude/pricing
- ElevenLabs: https://elevenlabs.io/pricing
- Seedance: https://seedance.io/pricing · https://fal.ai/pricing
- SerpApi: https://serpapi.com/pricing
- fal.ai: https://fal.ai/pricing
- Startup kredileri: Google for Startups, Microsoft Founders Hub, AWS Activate, Vercel AI Accelerator
