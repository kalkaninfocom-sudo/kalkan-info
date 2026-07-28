# 🏛️ Antik Anadolu — Hikâye Reel Motoru (YOL HARİTASI)

**Canlı durum belgesi.** Her büyük adımda güncelle. (ADHD kuralı: tek güncel referans.)
Son güncelleme: 2026-07-28

## Amaç
Kalkan çevresi antik kentleri için **sesli anlatımlı + altyazılı + sinematik** hikâye reel'leri
üreten sıfır-maliyet motor. Videodaki "faceless YouTube" modelinin İŞLEYEN özünü (voiceover
hikâye + pop-in altyazı + tempo) al; ÇÜRÜTEN kısmını (anonimlik + başkasının klibini reup) ALMA.
Kalkan-info'nun **grounded** markası üstüne kur. Hedef: AdSense değil → **turizm hunisi +
marka otoritesi** (her reel CTA → kalkaninfo.com).

## Mimari (hepsi ffmpeg + edge-tts, $0)
```
content/antik-reels.json  →  voiceover_tr/_en (10 kent hikâye scripti, HAZIR)
        │
        ▼
scripts/_pilot-antik-story.mjs
  1. edge-tts (tr-TR-AhmetNeural, belgesel)  → narration.mp3 + cümle-senkron SRT
  2. segment → GERÇEK foto eşleme (tarih=harabe, deniz=kumsal)
  3. her sahne: sinematik grade + koyu-matte blur-fill + Ken Burns
  4. concat + sinematik kapanış kartı (marka + CTA)
  5. libass altyazı yak + anlatım(1.9x) + müzik(0.17x, sonda fade)
        │
        ▼
dist/social/antik/<kent>-story.mp4   (1080x1920, ~38s, ~16MB)
```

## Durum
- ✅ **Motor çalışıyor** — `node scripts/_pilot-antik-story.mjs patara` (tek komut, tekrar üretilebilir)
- ✅ **Patara YAYINA-HAZIR** — 3 kusur düzeltildi+doğrulandı: (watermark foto ele / kolaj-split ele / letterbox→koyu matte / CTA ayrı kart)
- ✅ **Foto denetimi (Patara)** — kontakt sayfası ile watermark taraması yapıldı. Temiz: harabe d018/488/a1f9 + plaj hero,1,4,6,8 + tur at2. Elenen: p2(yazı) p3(VİLLACIM) p5(GÜVEN) p7(seninvillam) at1(kolaj) at3(Villa Patara).

## Sıradaki (öncelik sırasıyla)
- ⏳ **Yayın kararı (Berkay):** Patara reel'i IG/YT/TikTok'a → onay + hesap. (mp4, IG reel kuralına uygun; JPEG kuralı reels'i etkilemez.)
- ⏳ **Kent başına foto denetimi (MANUEL GATE):** her kent için watermark/kolaj taraması ZORUNLU.
  Otomatik watermark tespiti güvenilir değil → yayından önce gözle onayla. Bu yüzden batch, kent-kent vetli manifesto ile ilerler.
- ⏳ **Foto manifestosu:** `content/antik-story-photos.json` (kent → {ruins[], scenic[]} vetli liste). Şimdilik sadece Patara vetli; diğer kentler doldurulacak.
- ⏳ **Zamanlanmış motora entegrasyon:** `scripts/agency/antik-reel-approval.mjs` render adımını
  sessiz `build-antik-reel.mjs` yerine story motoruna çevir (Supabase upload + Telegram onay akışı korunur).
  Not: Supabase/Telegram secret'ları local'de invalid olabilir (bkz memory) → CI'da test et.
- ⏳ **EN sürüm:** aynı motor `voiceover_en` + `en-GB-RyanNeural` (belgesel İngiliz) ile → UK/DE turist kitlesi (yüksek RPM mantığı burada da geçerli, ama hedef trafik).
- ⏳ **10 kent batch:** Xanthos, Letoon, Tlos, Pinara, Simena, Antiphellos, Phellos, Myra, Andriake (her biri kendi hikâyesiyle content/antik-reels.json'da HAZIR). 10 kent × 2 dil = 20 reel havuzu.

## Kalite bar (teslimden önce KENDİNİ ELEŞTİR — feedback_quality_bar_10k)
- 9:16 full-bleed; letterbox varsa KOYU matte (parlak gökyüzü bandı YOK)
- Watermark/başkasının gömülü yazısı YOK (kontakt sayfası denetimi şart)
- Kolaj/split kaynak foto YOK
- CTA ayrı kapanış kartında, altyazıyla çakışmaz
- Anlatım net + altyazı senkron + müzik anlatımı bastırmıyor
- reels-critic gate'ten geçir (`scripts/agency/reels-critic.mjs`)

## Komutlar
```bash
node scripts/_pilot-antik-story.mjs patara     # Patara story reel
node scripts/_pilot-antik-story.mjs xanthos    # (foto vetlendikten sonra)
```
Çıktı: `dist/social/antik/<kent>-story.mp4`
