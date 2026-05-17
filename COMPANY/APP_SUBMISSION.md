# App Store + Google Play Yayın Rehberi

**Versiyon:** 1.0
**Tarih:** 2026-05-17
**Sahip:** AppBundler agent (`.claude/agents/app-bundler.md`)
**Hedef:** Web sitesi → iOS + Android native bundle (Y1 Q3 deadline)

---

## 1. Strateji: Capacitor (önerilen)

**Neden Capacitor (Ionic):**
- Mevcut web app değişmeden native shell sarar
- Tek codebase: web + iOS + Android
- PWA + Capacitor hibrit (offline + push + native API)
- Mevcut `sw.js` + `manifest.json` zaten PWA temeli → Capacitor üstüne kurar
- App Store + Play Store onay süreci: 3-7 gün (Apple), 1-3 gün (Google)

**Alternatif düşünüldü ama seçilmedi:**
- Trusted Web Activity (TWA) — sadece Android, iOS yok
- React Native rewrite — 4-6 ay ekstra iş
- Native (Swift + Kotlin) — solo founder için fazla yük

## 2. Kurulum Adımları (Capacitor v6)

### 2.1 NPM packages
```bash
cd kalkan-info
npm install --save-dev @capacitor/cli @capacitor/core @capacitor/ios @capacitor/android
npx cap init "Kalkan Info" com.kalkaninfo.app --web-dir=.
```

### 2.2 capacitor.config.ts
```ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kalkaninfo.app',
  appName: 'Kalkan Info',
  webDir: '.',
  server: {
    url: 'https://kalkaninfo.com',
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#072136'
  },
  android: {
    backgroundColor: '#072136',
    allowMixedContent: false
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#072136',
      showSpinner: false
    }
  }
};

export default config;
```

### 2.3 Platform ekleme
```bash
npx cap add ios
npx cap add android
npx cap sync
```

### 2.4 Native plugins (eklenecek)
- `@capacitor/push-notifications` — bildirim
- `@capacitor/geolocation` — kullanıcı konumu (rotaya yakın)
- `@capacitor/share` — sosyal paylaşım
- `@capacitor/app` — deep link (kalkaninfo.com/villa/x → uygulama)
- `@capacitor/preferences` — local storage (PWA cache'in üzerine)
- `@capacitor/status-bar` — status bar tema

## 3. App Store (iOS) Submission Checklist

### 3.1 Apple Developer hesap
- [ ] Apple Developer Program üyelik ($99/yıl)
- [ ] Tax + bank info (Berkay'ın TC + IBAN)
- [ ] Sözleşmeler imzalı (Paid Apps + Free Apps)

### 3.2 App Store Connect kurulum
- [ ] Yeni uygulama oluştur: `Kalkan Info`
- [ ] Bundle ID: `com.kalkaninfo.app`
- [ ] SKU: `kalkan-info-v1`
- [ ] Primary Category: Travel
- [ ] Secondary: Lifestyle

### 3.3 App metadata
- [ ] App name: "Kalkan Info"
- [ ] Subtitle (30 char): "Tatil rehberi & rezervasyon"
- [ ] Description (4000 char): Türkçe + İngilizce
- [ ] Keywords: kalkan, kaş, antalya, tatil, villa, rezervasyon
- [ ] Support URL: https://kalkaninfo.com
- [ ] Marketing URL: https://kalkaninfo.com
- [ ] Privacy Policy: https://kalkaninfo.com/privacy.html

### 3.4 Privacy
- [ ] Data collection: Konum, E-posta, Cihaz ID, Kullanım, Yorumlar, Fotoğraflar
- [ ] Data linked to user: Email, Name, Phone, Photos
- [ ] Data used for tracking: Yok (AppTrackingTransparency dialog gerekli değil)
- [ ] Privacy policy URL aktif

### 3.5 Screenshots (zorunlu boyutlar)
- [ ] iPhone 6.7" (1290x2796) — 3-10 adet
- [ ] iPhone 6.5" (1284x2778) — 3-10 adet
- [ ] iPad Pro 12.9" (2048x2732) — 3-10 adet
- [ ] App preview video (opsiyonel) 15-30 sn

### 3.6 Build + upload
```bash
npx cap sync ios
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App archive
# Xcode Organizer → Distribute App → App Store Connect
```

### 3.7 Review notes
- Test hesabı: berkay@kalkaninfo.com / [test_pwd]
- KVKK + Türkiye odaklı not
- Apple review süresi: 24-72 saat (TR app'ler genelde hızlı)

## 4. Google Play Submission Checklist

### 4.1 Google Play Console
- [ ] Google Play Developer hesap ($25 tek seferlik)
- [ ] Sözleşmeler imzalı

### 4.2 Yeni app
- [ ] App name: Kalkan Info
- [ ] Default language: Turkish
- [ ] App or Game: App
- [ ] Free or paid: Free
- [ ] Category: Travel & Local

### 4.3 Store listing
- [ ] Short description (80 char)
- [ ] Full description (4000 char)
- [ ] Feature graphic 1024x500
- [ ] App icon 512x512
- [ ] Phone screenshots 1080x1920 — min 2 adet
- [ ] Tablet screenshots (opsiyonel)

### 4.4 Content rating
- [ ] IARC questionnaire — All ages (turizm/bilgi)

### 4.5 Data safety
- [ ] Data collected: Location, Email, Phone, Photos, App activity
- [ ] Data shared: Sadece backend (Supabase) — 3rd party paylaşım yok
- [ ] Encryption: TLS in transit, AES-256 at rest

### 4.6 Build + upload
```bash
npx cap sync android
cd android
./gradlew bundleRelease
# Play Console → Internal testing → Promote → Production
```

### 4.7 Signing
- [ ] Keystore oluştur: `keytool -genkey -v -keystore kalkaninfo.keystore -alias kalkan -keyalg RSA -keysize 2048 -validity 10000`
- [ ] Play App Signing enrolled (Google'a key yükle)
- [ ] **KESINLİKLE keystore'u commit etme** — `.gitignore` + ayrı yedek

## 5. PWA-only fallback (Capacitor onayı gecikirse)

- Mevcut PWA install prompt çalışıyor (`manifest.json` + `sw.js`)
- Web Push: VAPID key + subscription endpoint (FAZ 5)
- "Add to Home Screen" iOS Safari + Android Chrome

## 6. Deep linking

- iOS: `apple-app-site-association` dosyası `https://kalkaninfo.com/.well-known/`
- Android: `assetlinks.json` aynı dizinde
- Format örneği:
  ```json
  // .well-known/assetlinks.json
  [{
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.kalkaninfo.app",
      "sha256_cert_fingerprints": ["..."]
    }
  }]
  ```

## 7. CI/CD (gelecek)

- GitHub Actions: web build → Capacitor sync → Fastlane lane:
  - Fastlane iOS: `beta` (TestFlight), `release` (App Store)
  - Fastlane Android: `internal`, `production`
- Trigger: git tag `v1.0.0` push

## 8. AppBundler Agent çalıştırma

```bash
claude -p "AppBundler agent: yeni release tag v1.0.0 için iOS+Android bundle hazırla, screenshot'lar üret, store listing metadatasını kontrol et"
```

## 9. Hukuki gereksinim — Türk Uygulama Yayıncılığı

- BTK içerik bildirim (5651 ek): mobil uygulama da kapsam
- Apple TR developer hesabı için TC kimlik + vergi
- Google Play TR: TC kimlik + IBAN
- Apple/Google %15-30 komisyon — fiyatlama planına yansıt

## 10. Açık görevler

- [ ] Apple Developer Program üyelik ($99/yıl) — Berkay manuel
- [ ] Google Play Console hesap ($25) — Berkay manuel
- [ ] App icon 1024x1024 final tasarım (PixelAgents kullanılabilir)
- [ ] Screenshots — gerçek cihazda + Capacitor screenshot script
- [ ] Privacy policy URL kontrol (mevcut /privacy.html App Store gereksinimini karşılar mı?)
- [ ] Bundle ID rezervasyon: `com.kalkaninfo.app`
- [ ] Capacitor scaffold (npm install + init + sync)
- [ ] CI/CD pipeline (GitHub Actions + Fastlane)
