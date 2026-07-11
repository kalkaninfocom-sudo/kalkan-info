# Ajans Motoru — Abacus SuperComputer'da 7/24 (Always-On)

Kalkan İnfo ajans şirketini GitHub Actions "günde 1" yerine **sürekli** çalıştırma rehberi.
Motor: `scripts/agency/always-on.mjs`. Model: RouteLLM (Abacus Pro). Yayın: hâlâ **insan onaylı** (Telegram + basket-publish).

## Ne yapar
- **Her ~30 dk**: IG + FB hasadı → 3-kararlı + psikoloji/marka/yerleştirme kapısı → kalkan/kaş/bölge sepetleri.
  Yeni içerik düşerse → **anlık Telegram bildirimi** ("N yeni içerik onay bekliyor").
- **Her ~12 saat**: 28 karakter ajanı brifingi (RouteLLM ile güçlü model) → içerik fikirleri.
- Hata-güvenli döngü: hiçbir görev motoru çökertmez.

## SuperComputer'da kurulum (3 adım)
SuperComputer'ın GitHub entegrasyonu var. OpenClaw / Terminal'de:

```bash
# 1) Repo (özel repo → SuperComputer GitHub bağlantısıyla erişim)
git clone https://github.com/kalkaninfocom-sudo/kalkan-info.git
cd kalkan-info
npm ci   # veya: npm install

# 2) Ortam değişkenleri (.env dosyası oluştur — SEKRETLER)
cat > .env.local <<'EOF'
ROUTELLM_API_KEY=<abacus_routellm_key>
IG_BUSINESS_ID=<...>
IG_LONG_LIVED_TOKEN=<...>
FB_PAGE_ID=<...>
FB_PAGE_TOKEN=<...>
GROQ_API_KEY=<...>            # ücretsiz fallback
TELEGRAM_BOT_TOKEN=<...>
TELEGRAM_ADMIN_CHAT_ID=<...>
EOF

# 3) Motoru başlat (always-on: "Always On" toggle AÇIK olsun)
node scripts/agency/always-on.mjs
```

Test için tek tur: `node scripts/agency/always-on.mjs --once`

## OpenClaw'a talimat (istersen)
> "kalkan-info reposunu klonla, npm ci yap, .env.local'i secret'larımla doldur, sonra
> `node scripts/agency/always-on.mjs`'i sürekli çalışır tut. Çökerse yeniden başlat."

## Ayarlar (env, opsiyonel)
- `HARVEST_INTERVAL_MIN` (varsayılan 30) — hasat sıklığı
- `BRIEFING_INTERVAL_HR` (varsayılan 12) — brifing sıklığı
- `TICK_MIN` (varsayılan 5) — döngü nabzı
- `CHEAP_LLM_ORDER` (varsayılan `routellm,groq,cerebras,nvidia,gemini,claude`)

## Onay & yayın (değişmedi)
Motor içerik ÜRETİR ve sepete koyar; **yayınlamaz**. Sen Telegram bildirimini görünce:
```bash
node scripts/agency/basket-publish.mjs --list          # bekleyenleri gör
node scripts/agency/basket-publish.mjs --id <id>        # beğendiğini yayınla → gazete + IG
node scripts/agency/basket-publish.mjs --id <id> --reject
```
Hassas içerik ('hold', trajedi/PII) yalnız açık `--id` ile yayınlanır — `--all` atlar.

## GitHub Actions ile ilişki
Always-on açıkken GitHub cron'u (morning-briefing.yml) kapatabilirsin (çift üretim olmasın) VEYA
yedek olarak bırakabilirsin. İkisi de aynı repoyu/sepetleri kullanır.

## Güvenlik
- `.env.local` git'e GİRMEZ (gitignore). Secret'ları log'a basma.
- Motor sadece OKUR + sepete yazar; canlı siteye publish yalnız senin onayınla.
