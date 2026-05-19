# Microsoft Clarity Heatmap Entegrasyonu

Microsoft Clarity, **tamamen ücretsiz** heatmap, session recording ve insight aracı. KVKK uyumlu çalışacak şekilde projemize entegre edildi.

## Neden Clarity?

- **Ücretsiz** — Trafik limiti yok, ücretsiz sınırsız session recording.
- **KVKK / GDPR uyumlu** — Cookie banner'daki "Analytics" rızası gate'inin arkasında çalışır, rıza verilmeden tetiklenmez.
- **Plausible'ı tamamlar** — Plausible "kim, kaç kez" derken Clarity "neresine bastı, nerede takıldı, niye geri döndü" sorularını cevaplar.

## Berkay'ın Yapacağı Manuel Adımlar

### 1. Clarity hesabı aç

1. https://clarity.microsoft.com adresine git.
2. **Sign in** → Microsoft hesabıyla giriş yap (Outlook / Hotmail / Live mail).
3. **New project** butonuna tıkla:
   - Name: `Kalkan Info`
   - Website URL: `https://kalkaninfo.com`
   - Category: `Travel & Tourism` (veya en yakını)
4. **Create** → karşına Project ID gelir (10 karakterlik alfanumerik kod, örn. `abc123xyz9`).

### 2. Project ID'yi siteye uygula

İki seçenek var. **Berkay biri yeterli.**

#### Seçenek A — Global window değişkeni (önerilen)

Her HTML sayfasının `<head>` kısmında, `js/clarity-loader.js` script tag'inden **önce** şu inline script eklenmeli:

```html
<script>window.KALKAN_CLARITY_PROJECT_ID = 'ABC123XYZ9';</script>
<script src="js/clarity-loader.js" defer></script>
```

(`ABC123XYZ9` yerine kendi project ID'ni yapıştır.)

#### Seçenek B — Meta tag (tek değişiklikle global)

`<head>` içinde:

```html
<meta name="clarity-project-id" content="ABC123XYZ9">
```

`clarity-loader.js` bu meta tag'i de okur.

#### Seçenek C — Script tag attribute

```html
<script src="js/clarity-loader.js" data-clarity-id="ABC123XYZ9" defer></script>
```

### 3. Vercel env (opsiyonel — ileri seviye)

Eğer build-time inject yapmak istersek: Vercel Project Settings → Environment Variables → `CLARITY_PROJECT_ID=ABC123XYZ9`. Sonra `scripts/build-all.mjs` içine bir replacer adımı eklenir. Bu **şu an gerekli değil** — direkt seçenek A yeterli.

## Dashboard'da Kullanılabilecek Özellikler

Clarity Dashboard (https://clarity.microsoft.com/projects/view/<proje-id>) üzerinden:

### Heatmaps
- **Click heatmap** — Hangi düğmeye, banner'a, görsele kaç kez tıklandı.
- **Scroll heatmap** — Kullanıcılar sayfanın hangi noktasına kadar iniyor.
- **Area maps** — Belirli bir bölgenin (örn. "villalar grid") engagement oranı.

### Session Recordings (Anonim)
- Gerçek kullanıcı oturumlarının video kaydı.
- **PII otomatik mask** — Form alanları, input'lar, "data-pii" işaretli elementler bulanık.
- Filtreleme: rage click yapan kullanıcılar, dead click, JS error, mobil vs masaüstü.

### Insights
- **Rage clicks** — Aynı yere tekrar tekrar tıklayan (= sinirlenen) kullanıcılar. UX problemi sinyali.
- **Dead clicks** — Tıklanan ama hiçbir aksiyon almayan elementler. Yanlış buton ipucu.
- **Quick backs** — Sayfa açılır açılmaz geri dönen kullanıcılar. SEO/içerik problemi.
- **Excessive scrolling** — Çok scroll yapan kullanıcılar. Bilgi mimari sorunu.
- **JS errors** — Tarayıcıdaki JavaScript hataları, hangi sayfada hangi hata.

## KVKK Uyumluluk Detayları

`js/clarity-loader.js` aşağıdaki güvenlik önlemlerini içerir:

1. **Consent gate** — `KalkanConsent.has('analytics')` `true` olmadan Clarity script'i yüklenmez.
2. **PII koruması** — `clarity.identify()` kullanmıyoruz, kullanıcı email/ad gibi veriler Clarity'ye gönderilmez.
3. **Auto-masking** — Tüm `<input>`, `<textarea>`, `<select>`, `[data-pii]`, `.ki-clarity-mask` elementleri Clarity recording'lerde otomatik bulanıklaştırılır.
4. **Cookie banner kategorisi** — Plausible ile aynı "Analytics" kategorisinde. Kullanıcı "Yalnızca Zorunlu" seçerse Clarity de çalışmaz.
5. **Privacy & KVKK dokümanları güncel** — Hem `privacy.html` hem `kvkk.html` Microsoft Clarity kullandığımızı belirtiyor.

## CSP

`vercel.json` Content-Security-Policy header'ı şu Clarity domain'lerini whitelist eder:

- `script-src` → `https://www.clarity.ms https://*.clarity.ms`
- `connect-src` → `https://www.clarity.ms https://*.clarity.ms`
- `img-src` → zaten `https:` (pixel/heatmap için yeterli)

## Plausible Entegrasyonu

Clarity başarıyla yüklendiğinde Plausible'a `clarity_loaded` event'i atılır. Plausible Goal'larına `clarity_loaded` ekleyerek **analytics rızası verme oranını** ölçebilirsin (örn. "1000 ziyaretten 720'si rıza verdi → %72 opt-in").

## Test

Lokal test:

```bash
node serve.mjs       # localhost:3000
# Tarayıcıda: çerez banner'ında "Tümünü Kabul Et"
# DevTools → Network → "clarity.ms/tag/..." istek 200 mü?
# DevTools → Console → window.clarity yüklü mü?
```

Canlıda test:

```bash
# kalkaninfo.com'a git, çerez kabul et
# Clarity Dashboard → Sessions sekmesi → ~2-3 dk içinde kayıt görünür
```

## Sorun Giderme

| Belirti | Sebep | Çözüm |
|---|---|---|
| Network'te `clarity.ms` isteği yok | Consent verilmedi | Çerez banner'dan analytics kabul et |
| `[clarity] project id missing or placeholder` console'da | ID set edilmemiş veya hala `XXXXXXXXXX` | `window.KALKAN_CLARITY_PROJECT_ID` set et |
| Dashboard'da session yok | Tarayıcı adblock'u Clarity'yi engelliyor | uBlock/Brave Shield kapat |
| CSP error console'da | Domain whitelist atlanmış | `vercel.json` CSP'sini kontrol et |
