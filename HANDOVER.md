# Kalkan Info — Handover Notu (2026-05-23)

> **Bir önceki agent'tan devralıyorsun.** Berkay 2 gündür "sayfa açılıyor ama tıklama çalışmıyor, içerikler yüklenmiyor, Chrome 'Sayfa Yanıt Vermiyor' diyor" şikayetini yaşıyor. Önceki agent (ben) sorunu çözemedi. Aşağıda her şey: kanıtlar, denenenler, asıl muhtemel sebep.

## Mevcut canlı durum (önemli)

- **Tek tıkla rollback yapılabilir**: Vercel Dashboard → Deployments → 2026-05-18/19 civarı bir build → "Promote to Production". Bu yolun denenmesi tavsiye edilir.
- Repo HEAD: `4e6e39d` (emergency triage — 7 deferred script comment'lendi, supabase 2sn timeout korumalı)
- Production: yukarıdaki commit deploy edildi.

## Berkay'ın gözlemleri

- Chrome: header + bölüm başlıkları görünüyor, **içerik gelmiyor, hiçbir şeye tıklanamıyor, "Sayfa Yanıt Vermiyor" Chrome dialogu çıkıyor**.
- Hard refresh, SW unregister, gizli pencere, tüm sekmeleri kapatma — denedi, aynı.
- "3 gün önce bu sorun yoktu" diyor.

## Kanıtlanmış olgular

1. **JS main thread bloke**: Puppeteer fresh Chrome (no cache, incognito) ile prod test ettim, `page.evaluate()` ve `element.click()` her ikisi de 8sn timeout. Bu sadece browser cache veya SW sorunu DEĞİL — kodda bir şey JS thread'i kilitliyor.
2. **CDN'ler sağlam**: `curl https://cdn.jsdelivr.net/.../supabase-js@2/+esm` → 200 OK, hızlı. `curl https://esm.sh/...` → 200 OK. Demek pending görünen CDN istekleri **semptom**, sebep değil.
3. **Load event bazen ateşleniyor (2-8s), sonra hang**: yani initial parse OK, sonradan bir deferred script veya init loop JS thread'i kilitliyor.
4. **Pending görünen istekler**: jsdelivr supabase + open-meteo + /api/instagram-hashtag (401) + favicon.svg. Hiçbiri DIRECT curl'de sorunlu değil.

## Bu oturumda yapılan commit'ler (chronological)

| Hash | Mesaj | Etki |
|---|---|---|
| `4a8c78e` | revert: roll back to 2026-05-20 (4d41412) — 62 commit | 2 gün geri |
| `b04863d` | fix(perf): defer auth.js + jsdelivr | cherry-pick (sonra revert) |
| `b134590` | chore(cache): bump bottom-nav.js cache buster | 31 HTML |
| `06ce939` | fix(prod): SW disable + pwa.js bump | (sonra revert) |
| `9b54bd3` | revert: roll back to 2026-05-19 (314ea21) — 4 gün geri | tüm cherry-pick'leri sıfırladı |
| `c94d1d0` | fix(critical): supabase esm.sh → jsdelivr | tek satır |
| `4e6e39d` | **emergency(triage): 7 script disable + supabase timeout 2s** | **AKTIF HEAD** |

> Cherry-pick edilen `b04863d` (auth idle callback) ve `06ce939` (SW disable) **9b54bd3'te yok**. Eğer bunlar gerekliyse `git cherry-pick b04863d 06ce939` ile geri al.

## Test edilmemiş ve denenebilecek bir sonraki adımlar

1. **GERÇEK Chrome'la non-headless puppeteer test** — Berkay'ın gördüğü Chrome'u simüle eder. Bunu ben yapmadım, puppeteer headless'a sıkıştım kaldım. Komut:
   ```bash
   puppeteer.launch({ headless: false, devtools: true, args: ['--auto-open-devtools-for-tabs'] })
   ```
2. **CDP Profiler** — JS thread'i ne ile meşgul, gerçek stack'i çıkar:
   ```js
   const client = await page.target().createCDPSession();
   await client.send('Profiler.enable');
   await client.send('Profiler.start');
   await sleep(5000);
   const profile = await client.send('Profiler.stop');
   // analyze profile.profile.nodes for hottest function
   ```
3. **Script bisection** — `4e6e39d` zaten 7 script'i disable etti. Eğer tıklama çalışmıyorsa:
   - Kalan AKTIF 4 script: site-drawer, supabase-window, i18n, bottom-nav
   - Test: bunlardan birini daha disable et + push + test
4. **`bottom-nav.js`'i de disable et** — eğer bottom-nav.js'in DCL'deki `await import('./auth.js')` çağrısı hala bloke ediyorsa. Sonra her şey çalışıyorsa `cherry-pick b04863d` ile fix gelir.
5. **`map.js` modülünü incele** — eski commit'lerden birinde "async map.js + sw-killer" fix vardı. Modül olarak import edilmesi top-level await zincirini bloke ediyor olabilir.

## Berkay'ın güvendiği "stabil" referans noktaları (memory'den)

- `2026-05-14` deploy `ajr6z64gb` (commit `2a44172`) — Berkay "burası temiz" demiş
- `2026-05-15` "T0+T1 BİTTİ + CANLI" — kalkan-info/MEMORY.md
- `2026-05-17` — "16 sayfa EN i18n + 4 Kritik audit kapatıldı"

Vercel dashboard'da bu tarihlerden bir deploy'a promote etmek 1 dakikalık iştir.

## Proje dosyası temizliği yapıldı

- `.diag-*.mjs`, `.diag-*.json`, `.diag-*.html`, `.bump-cache-buster.mjs`, `MORNING_NOTE.md` — silindi.
- Yine de `.omc/project-memory.json` modified durumda (oturum başlangıcından beri); commit'lenmedi.

## Berkay'ın frustration kaynakları (yeni agent uyarısı)

- Sürekli soru sorma: önce kendisi yapabileceğin şeyi yap, sonra rapor ver.
- Test etmeden "tamamlandı" deme: gerçek browser'da görmeden iddia etme.
- Token israfı: aynı işi tekrar tekrar yapma, basit teşhise sıkışıp kalma.
- Proje dosyasını çöple doldurma: temp scripts/.html/.json'ları root'a atma, `/tmp/` veya `.cache/` kullan, en kötü ihtimalle sonunda sil.

## Önerilen ilk adım (yeni agent için)

```
1. Vercel dashboard üzerinden 2026-05-18 deploy'una promote (5 dakika)
2. Berkay'la doğrula: site çalışıyor mu?
3. Çalışıyorsa: o tarih sonrası eklenen özelliklerden hangileri kritik, listele, her birini AYRI commit + AYRI test ile geri ekle
4. Çalışmıyorsa: dış faktör (Berkay'ın internet, ISP DNS, browser version) — bunları araştır
```

İyi şanslar.
