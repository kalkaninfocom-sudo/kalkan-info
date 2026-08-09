# LYRA — Sesli Konsiyerj · Canlı Durum  (eski ad: Deniz)

> **⚡ GÜNCELLEME 2026-07-28 (akşam) — DENİZ = LYRA birleştirildi + CANLI VERİ araçları eklendi**
> Berkay kararı: tek AI kimliği **Lyra** (Deniz ismi emekli). ElevenLabs ajanı (`agent_0401kxt9cheme869ydvcq0akw342`) artık:
> - **Adı "Kalkan Info — Lyra (Sesli Konsiyerj)"**, açılış "Ben Lyra", persona `ai/prompts/lyra-voice.md` (ses `5MSp7yE6...` + KB korundu).
> - **2 araç ajana bağlı** (ElevenLabs tarafı): `nobetci_eczane` + `bugun_etkinlikler` (webhook → Supabase `lyra-live` edge fn). ⚠️ **2026-08-07 DÜZELTME:** `lyra-live` edge fn kaynağı repoda **YOKTU** → araçlar fiilen çalışmıyordu (endpoint 404/stale, doküman yanlış "canlı/doğrulandı" diyordu). Bu tarihte yeniden yazıldı.
> - Kuran scriptler (idempotent, repo): `ai/scripts/sync-voice-agent.mjs` (kimlik/persona), `ai/scripts/setup-voice-tools.mjs` (araçlar). Edge fn: `supabase/functions/lyra-live/index.ts` — eczane: `kalkaninfo.com/data/eczane.json` (bayatsa `antalyaeo.org.tr` canlı scrape); etkinlik: `data/etkinlik-takvimi.json` (bugünün oneoff + recurring).
> - ✅ **DEPLOY EDİLDİ + production doğrulandı (2026-08-07):** `?topic=eczane` → HTTP 200 "Buket Eczanesi–Kalkan"; `?topic=etkinlik` → HTTP 200 bugünün 3 etkinliği. Araçlar artık gerçekten canlı. ⏳ **KALAN:** Berkay uçtan uca canlı çağrı testi (araç tetikleniyor mu — transcript). ElevenLabs `simulate_conversation` 500 veriyor (kendi tarafı).
> - ✅ **Deniz→Lyra rebrand (2026-08-07):** `rehber.html` + `rehber-hd.html` başlıkları/UI Lyra oldu; KB → `docs/lyra-knowledge-base.md`; ops scriptleri → `scripts/lyra-ops-report.mjs` / `lyra-ops-call.mjs`; workflow → `.github/workflows/lyra-autonomous.yml`. ⏳ Kalan: web widget'a canlı grounding (eczane/etkinlik) + ElevenLabs "Lyra Ops" ajanının panel görünen adı (API ile).

**Vizyon (Berkay):** kalkaninfo.com'da gerçek yüzlü, mikrofonla anlık sesli konuşulabilen dijital rehber. Referans: profesyonel/güleryüzlü kadın concierge, kurumsal mavi hava.

## Mimari
| Katman | Çözüm | Durum |
|---|---|---|
| Sayfa/UX | `rehber.html` (sinematik sahne, mic, durum, altyazı, örnek sorular) | ✅ Bitti, render + QA OK. ⚡ 2026-08-07: ses/mic Simli video ile PARALEL başlar (konuşma ~1-2 sn, yüz arkadan) |
| Yüz akışı | Simli (WebRTC, gerçek zamanlı lip-sync), `simli-client@3.0.1` esm.sh | ✅ Bağlanıyor (key + faceId çalışıyor) |
| Ses/beyin | ElevenLabs Conversational AI (STT+LLM+TTS), public agent → backend'siz WSS | ✅ Ajan kuruldu (`agent_0401...`) |

## Anahtarlar / Config (`rehber.html` içinde CONFIG)
- `SIMLI_API_KEY` → `.env.local`'e eklendi + sayfada inline (Simli publishable client key).
- `faceId` = Kate `d2a5c7c6-fed9-4f55-bcb3-062f7cd20103` (hazır profesyonel kadın — anında çalışır).
- `agentId` = `agent_0401kxt9cheme869ydvcq0akw342` (ElevenLabs "Lyra" ajanı — kuruldu).

## ⛔ BLOKAJLAR (Berkay girdisi)
1. **Geçerli ElevenLabs API key.** `.env.local`'deki `sk_615...` GEÇERSİZ (REST 401 invalid_api_key). Production/panel key'i lazım (ajan zaten kurulu; key ops/güncelleme işleri için).
2. (Opsiyonel) **Birebir referans yüz.** Kulaklıklı kurumsal kadını istiyorsan: portre üretip app.simli.com'a yükle → özel faceId (~saatler işlenir; ücretsiz tier 10-30 dk/ay video sınırı — özel yüz/hacim için paid gerekebilir).

## WhatsApp & Arama (2026-07-18 eklendi)
- ✅ **Turist Lyra** ElevenLabs WhatsApp'a bağlandı (test no **+1 555-940-8820**): metin + sesli-not, grounded çalışıyor (allowlist).
- ⛔ **Canlı arama (📞):** test numarası aramayı desteklemez. Karar: **Twilio** (WhatsApp/Meta blokajını atlar).
- ✅ **Lyra Ops (ÖZEL rapor ajanı)** kuruldu: `agent_1501kxtbs1xdfpb9pbgphvpf0m6e` (private, turist Lyra'dan ayrı — ops verisi sızmaz).
- ✅ **Rapor beslemesi:** `scripts/lyra-ops-report.mjs` → daily-status + cheap-llm sesli-özet → ops ajanı KB. Test edildi, çalışıyor. Her sabah cron/PC ile çalıştır.
- ⛔ **Twilio arama:** local Twilio kimlikleri 401. Berkay geçerli **Twilio SID+Auth Token** verecek → gelen (Berkay arar→rapor) + zamanlanmış giden (Lyra Ops arar→rapor) API'den kurulacak. Numara ~$1-15/ay.
- Lyra Ops'u ŞİMDİ test: ElevenLabs dashboard → Agents → "Lyra Ops" (panel adı hâlâ "Deniz Ops" olabilir → API ile güncellenecek) → Test (tarayıcıda konuş).

## Sonraki adımlar
- [ ] Geçerli EL key → ops/güncelleme işleri + ElevenLabs panel ajan adını "Lyra Ops"a çevir → uçtan uca test (mic→Lyra konuşur, lip-sync).
- [ ] index.html + nav'a "Sesli Rehber" girişi ekle (şu an sadece rehber.html içinde link var).
- [ ] Ajana Kalkan bilgi tabanı (restoran/plaj/otel özetleri) knowledge base olarak yükle (grounding).
- [ ] (ops) Özel referans-yüz.
- [ ] Prod güvenlik: Simli key'i Supabase edge fn ile proxy'le (api/ 12/12 dolu — Vercel fn EKLEME).
