# Deniz — Sesli Görüntülü Rehber · Canlı Durum

**Vizyon (Berkay):** kalkaninfo.com'da gerçek yüzlü, mikrofonla anlık sesli konuşulabilen dijital rehber. Referans: profesyonel/güleryüzlü kadın concierge, kurumsal mavi hava.

## Mimari
| Katman | Çözüm | Durum |
|---|---|---|
| Sayfa/UX | `rehber.html` (sinematik sahne, mic, durum, altyazı, örnek sorular) | ✅ Bitti, render + QA OK |
| Yüz akışı | Simli (WebRTC, gerçek zamanlı lip-sync), `simli-client@3.0.1` esm.sh | ✅ Bağlanıyor (key + faceId çalışıyor) |
| Ses/beyin | ElevenLabs Conversational AI (STT+LLM+TTS), public agent → backend'siz WSS | ⛔ Ajan kurulacak (geçerli EL key lazım) |

## Anahtarlar / Config (`rehber.html` içinde CONFIG)
- `SIMLI_API_KEY` → `.env.local`'e eklendi + sayfada inline (Simli publishable client key).
- `faceId` = Kate `d2a5c7c6-fed9-4f55-bcb3-062f7cd20103` (hazır profesyonel kadın — anında çalışır).
- `agentId` = "" → **ElevenLabs "Deniz" ajanı kurulunca doldurulacak**.

## ⛔ BLOKAJLAR (Berkay girdisi)
1. **Geçerli ElevenLabs API key.** `.env.local`'deki `sk_615...` GEÇERSİZ (REST 401 invalid_api_key). Production/panel key'i lazım → ajanı REST ile kurup public yapacağım, agentId'yi CONFIG'e koyacağım. (Ajan promptu hazır: `scratchpad/create-agent.mjs` — "Deniz" Kalkan rehberi, TR/EN, grounded.)
2. (Opsiyonel) **Birebir referans yüz.** Kulaklıklı kurumsal kadını istiyorsan: portre üretip app.simli.com'a yükle → özel faceId (~saatler işlenir; ücretsiz tier 10-30 dk/ay video sınırı — özel yüz/hacim için paid gerekebilir).

## WhatsApp & Arama (2026-07-18 eklendi)
- ✅ **Turist Deniz** ElevenLabs WhatsApp'a bağlandı (test no **+1 555-940-8820**): metin + sesli-not, grounded çalışıyor (allowlist).
- ⛔ **Canlı arama (📞):** test numarası aramayı desteklemez. Karar: **Twilio** (WhatsApp/Meta blokajını atlar).
- ✅ **Deniz Ops (ÖZEL rapor ajanı)** kuruldu: `agent_1501kxtbs1xdfpb9pbgphvpf0m6e` (private, turist Deniz'den ayrı — ops verisi sızmaz).
- ✅ **Rapor beslemesi:** `scripts/deniz-ops-report.mjs` → daily-status + cheap-llm sesli-özet → ops ajanı KB. Test edildi, çalışıyor. Her sabah cron/PC ile çalıştır.
- ⛔ **Twilio arama:** local Twilio kimlikleri 401. Berkay geçerli **Twilio SID+Auth Token** verecek → gelen (Berkay arar→rapor) + zamanlanmış giden (Deniz arar→rapor) API'den kurulacak. Numara ~$1-15/ay.
- Deniz Ops'u ŞİMDİ test: ElevenLabs dashboard → Agents → "Deniz Ops" → Test (tarayıcıda konuş).

## Sonraki adımlar
- [ ] Geçerli EL key → `create-agent.mjs` çalıştır → `agentId` doldur → uçtan uca test (mic→Deniz konuşur, lip-sync).
- [ ] index.html + nav'a "Sesli Rehber" girişi ekle (şu an sadece rehber.html içinde link var).
- [ ] Ajana Kalkan bilgi tabanı (restoran/plaj/otel özetleri) knowledge base olarak yükle (grounding).
- [ ] (ops) Özel referans-yüz.
- [ ] Prod güvenlik: Simli key'i Supabase edge fn ile proxy'le (api/ 12/12 dolu — Vercel fn EKLEME).
