# Mobile App — Capacitor Setup

**Hedef:** kalkaninfo.com web app → iOS App Store + Google Play Store
**Yöntem:** Capacitor v6 wrapper (hybrid PWA + native shell)
**Sorumlu agent:** `app-bundler` (`.claude/agents/app-bundler.md`)
**Detaylı submission rehberi:** `../COMPANY/APP_SUBMISSION.md`

---

## Hızlı Başlangıç

### 1. Bağımlılıkları kur (Berkay onayı şart — npm install)

```bash
cd kalkan-info
npm install --save-dev @capacitor/cli @capacitor/core
npm install --save @capacitor/ios @capacitor/android \
  @capacitor/push-notifications \
  @capacitor/geolocation \
  @capacitor/share \
  @capacitor/app \
  @capacitor/preferences \
  @capacitor/status-bar \
  @capacitor/splash-screen
```

### 2. Init (dosya zaten yazılı — `capacitor.config.ts`)

```bash
# Sadece doğrulama, init etmiyoruz (config var)
cat capacitor.config.ts
```

### 3. Native platform ekle

```bash
npx cap add ios       # macOS gerekli, Xcode 15+
npx cap add android   # Java 17 + Android Studio
```

### 4. Web → Native sync

```bash
node scripts/build-supabase-config.mjs
node scripts/build-tailwind.mjs
npx cap sync
```

### 5. Native build

```bash
# iOS
npx cap open ios
# Xcode'da: Product → Archive → Distribute App

# Android
npx cap open android
# Android Studio'da: Build → Generate Signed Bundle/APK
```

---

## Gereksinimler

### iOS
- macOS (Capacitor iOS build sadece Mac'te çalışır)
- Xcode 15+
- Apple Developer Program ($99/yıl) — Berkay manuel
- Bundle ID: `com.kalkaninfo.app`
- Test cihaz: iPhone XS+ (iOS 15+)

### Android
- JDK 17
- Android Studio 2024+
- Google Play Console ($25 tek seferlik) — Berkay manuel
- Package: `com.kalkaninfo.app`
- Test cihaz: Pixel 6+ veya emülatör (Android 10+)

---

## Önemli Kararlar

### URL stratejisi: Remote Web (önerilen)
- `capacitor.config.ts.server.url = 'https://kalkaninfo.com'`
- Avantaj: web update'ler App Store onayı olmadan canlıya
- Dezavantaj: offline kapsamı `sw.js`'e bağımlı

### Alternatif: Bundled Web (statik)
- `webDir: '.'` + sync ile JS/HTML native bundle içine kopyalanır
- Update için yeni store submission gerekli
- Daha hızlı first-paint

### Karar
Şimdilik **Remote Web** (hızlı iterasyon). Faz 4'te Bundled (offline-first) düşünülebilir.

---

## Assets

- `mobile/icons/` — 1024x1024 master, otomatik resize (Capacitor CLI tool)
- `mobile/splash/` — 2732x2732 master
- `mobile/screenshots/` — Store listing için (her platform 3-10 adet)

Mevcut `icons/` dizini PWA için yetersiz olabilir — App Store/Play için yeni master gerekli.

---

## Deep Linking

Universal Link + App Link için:
- `kalkaninfo.com/.well-known/apple-app-site-association`
- `kalkaninfo.com/.well-known/assetlinks.json`

Bu dosyaları Vercel'da static-serve etmek için `vercel.json`'a route eklemek gerekebilir.

---

## CI/CD (gelecek)

`.github/workflows/mobile-release.yml`:
- Trigger: `git tag v*.*.*`
- Steps:
  1. Web build (Tailwind + Supabase config)
  2. `npx cap sync`
  3. Fastlane iOS beta → TestFlight
  4. Fastlane Android internal → Play Console
- Secrets: `APPLE_API_KEY`, `ANDROID_KEYSTORE_BASE64` (Berkay ekleyecek)

---

## Açık Görevler (P0 — Berkay manuel)

- [ ] Apple Developer Program hesabı aç ($99/yıl)
- [ ] Google Play Console hesabı aç ($25)
- [ ] App icon 1024x1024 final tasarım
- [ ] Splash screen 2732x2732 final
- [ ] Bundle ID `com.kalkaninfo.app` rezervasyon
- [ ] Test cihaz seçimi (iPhone + Android)

## Açık Görevler (P1 — Claude/AppBundler)

- [ ] `npm install` çalıştır (Berkay onayı sonrası)
- [ ] `npx cap add ios + android`
- [ ] `mobile/icons/` master üret
- [ ] Privacy Manifest (`PrivacyInfo.xcprivacy`)
- [ ] `.well-known/` dosyaları
- [ ] Fastlane setup
- [ ] CI/CD workflow

---

## Risk Yönetimi

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| Apple review reddi | Orta | 1-2 hafta gecikme | Reviewer notları + test hesap hazır |
| Bundle ID conflict | Düşük | Yeniden başvuru | Şimdiden rezerve et |
| KVKK + Apple Privacy uyumsuzluk | Düşük | Submission reddi | Privacy Manifest + privacy.html senkron |
| Native plugin breaking change | Orta | Build hatası | Versiyonu lock + manuel test |
| App Store komisyonu (%15-30) | Yüksek | Marj düşer | Fiyatlandırma stratejisi |
