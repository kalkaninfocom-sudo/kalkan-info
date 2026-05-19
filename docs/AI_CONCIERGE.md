# AI Concierge — Kalkan Info

Bu doküman: AI Claude Haiku fallback sisteminin nasıl çalıştığı, prompt'u nereden değiştirebilirsin, maliyet/limit ayarları.

## Ne Yapıyor?
- Mevcut concierge modal'ına (sağ alt yüzen buton) **"AI ile Sohbet Et"** seçeneği eklendi.
- Kullanıcı bu seçeneği tıklayınca **Claude Haiku 4.5** destekli sohbet ekranı açılır.
- AI Kalkan/Kaş/Patara bölgesi hakkında soru cevaplar, ama:
  - **Fiyat söylemez** → Berkay'a yönlendirir
  - **Rezervasyon yapmaz** → Berkay'ın WhatsApp'ına gönderir
  - **PII (telefon, e-posta) istemez** → Berkay'a yönlendirir

## Mimari

```
Frontend                       Backend                       Anthropic
┌──────────────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│ js/concierge-modal.js│      │ api/concierge-ai.js  │      │ Claude Haiku 4.5│
│ + WhatsApp seçenek   │      │ + Rate limit         │      │ + Prompt caching│
│ + AI seçeneği──────► │ ───► │ + System prompt cache│ ───► │ + Streaming SSE │
│                      │      │ + Data context       │      │                 │
│ js/concierge-ai-modal│      │ + KVKK-safe log      │      │                 │
│ (streaming chat UI)  │      │                      │      │                 │
└──────────────────────┘      └──────────────────────┘      └─────────────────┘
```

## Dosya Haritası

| Dosya | Görev |
|---|---|
| `api/concierge-ai.js` | Vercel serverless function. Body: `{ message, lang, context, history }`. Streaming SSE response. |
| `data/ai-system-prompt.md` | **System prompt — değiştirmek istersen buradan.** Karakter, fiyat yasağı, KVKK kuralları. |
| `js/concierge-ai-modal.js` | Chat UI. Mesaj baloncuğu, typing indicator, streaming render. |
| `js/concierge-modal.js` | WhatsApp + AI toggle. Üstte 2 sekme. |
| `data/*.json` | Mekan verisi (restaurantlar, plajlar, vb.) — sistem prompt'a inline eklenir. |

## System Prompt Nereden Değişir?

`data/ai-system-prompt.md` dosyasını düzenle. Değişiklik anında geçerli **DEĞİL** — Vercel cold start sonra yansır (~5-30 sn). Cold restart için:
```bash
git add data/ai-system-prompt.md && git commit -m "tune AI prompt" && git push origin main
```

Vercel otomatik deploy eder ve yeni instance yeni prompt'u yükler.

## Model Değişikliği

`api/concierge-ai.js` içinde:
```js
const MODEL = 'claude-haiku-4-5-20251001';
```

**Maliyet tablosu (1M token):**
| Model | Input | Output | Notlar |
|---|---|---|---|
| Claude Haiku 4.5 | $0.80 | $4.00 | **Şu an seçili — en uygun** |
| Claude Sonnet 4.5 | $3.00 | $15.00 | Daha akıllı, 4x maliyet |
| Claude Opus 4.7 | $15.00 | $75.00 | Aşırı pahalı, gerek yok |

## Rate Limit
- **10 mesaj / dakika / IP**
- **30 mesaj / saat / IP**
- In-memory (Vercel cold start ile reset). Production için Vercel KV/Redis'e geçilebilir.

Limit aşımında `429` + `Retry-After` header döner. Frontend kullanıcıya WA'ya yönlendirme mesajı gösterir.

## Maliyet Tahmini

**Tek mesaj başına:**
- Input: ~3000 tokens (system + data + history) → $0.0024 (ama %90'ı cached → gerçekte ~$0.00024)
- Output: ~150 tokens cevap → $0.0006
- **Toplam:** ~$0.0008/mesaj (cache miss) — **~$0.0007/mesaj (cache hit, %90)**

**Aylık tahmin:**
- 100 kullanıcı × 5 mesaj = 500 mesaj/ay → **~$0.35/ay**
- 1000 kullanıcı × 5 mesaj = 5000 mesaj/ay → **~$3.5/ay**
- 10000 mesaj/ay → **~$7/ay**

**Rate limit ile worst-case:**
- 30 msg/saat × 24 saat × 30 gün = 21,600 msg/IP/ay
- 100 kötü niyetli IP olsa: 2.16M msg → ~$1500/ay
- Bu noktada Vercel KV + auth gating gerekir

## Prompt Caching
Anthropic prompt caching (`cache_control: { type: 'ephemeral' }`) sistem prompt + data bloğuna uygulandı. 5dk TTL. Cache hit'te input token maliyeti %10'a düşer.

Loglarda:
```
[concierge-ai] ok { tokens: { in: 3142, out: 187, cache_r: 2820 } }
```
`cache_r > 0` = cache hit.

## KVKK
- Kullanıcı mesaj içeriği **loglanmaz**. Sadece olay sayacı + IP'nin ilk 3 karakteri.
- AI cevap içeriği **loglanmaz**.
- PII (ad, telefon, e-posta) AI'a sorulmaz — prompt'ta engellenir.
- Conversation history **client-side**'da tutulur, modal kapanınca silinir.

## Plausible Event'ler
- `ai_concierge_open` — modal açıldı (source, page, context, lang)
- `ai_message_sent` — kullanıcı mesaj gönderdi (lang, context, len)
- `ai_conversation_start` — ilk mesaj
- `ai_conversation_complete` — 3+ tur tamamlandı (engaged)
- `ai_fallback_to_wa` — kullanıcı AI'dan WA'ya geçti
- `ai_concierge_close` — modal kapandı (turns, lang)

## Test

### Localhost
```bash
# .env.local dosyasında ANTHROPIC_API_KEY=sk-ant-... olmalı
node serve.mjs  # ama serve.mjs API route'u SERVE ETMİYOR — sadece statik dosyalar
```
**Önemli:** `serve.mjs` Vercel serverless function'ları çalıştırmaz. Lokal API testi için `vercel dev` kullan:

```bash
npx vercel dev
# Sonra başka terminalde:
curl -X POST http://localhost:3000/api/concierge-ai \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  --no-buffer \
  -d '{"message":"En iyi balık restoranı?","lang":"tr"}'
```

### Production
```bash
curl -X POST https://kalkaninfo.com/api/concierge-ai \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  --no-buffer \
  -d '{"message":"Patara antik kenti hakkında bilgi?","lang":"tr"}'
```

Beklenen output (SSE):
```
event: delta
data: {"text":"Patara"}

event: delta
data: {"text":" Likya"}

...

event: done
data: {"tokens":{"input":3142,"output":187,"cache_read":2820,"cache_create":0}}
```

## Sorun Giderme

**"AI service unavailable" 503:**
ANTHROPIC_API_KEY env vars'da yok. Vercel dashboard → Settings → Environment Variables → ekle.

**"Rate limit" 429:**
Normal davranış. Kullanıcı çok hızlı yazıyor. Frontend WA yönlendirme gösterir.

**Cache miss her seferinde:**
System prompt 1024 token'dan az. Cache minimum 1024 token gerektirir. Data bloğu eksik → `data/*.json` dosyalarını kontrol et.

**Yanlış dil:**
Frontend `lang` parametresini `KalkanI18n.get()` veya `localStorage.lang` veya `<html lang>`'dan okur. i18n yüklenmemişse default `tr`.
