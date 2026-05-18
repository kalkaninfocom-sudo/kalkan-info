# Kalkan Info — Content Packs

Otomatik sosyal medya ajansının içerik kaynağı. Her dosya, hazır kullanılır içerik paketi.

## Yapı

```
content/
├── antik-reels.json    # 10 antik kent reels paketi (EN voiceover + caption + hashtag + footage)
└── README.md           # bu dosya
```

## antik-reels.json — Kullanım

Her item:
- `voiceover_en` / `voiceover_tr` — Reels ses metni (ElevenLabs TTS'e ver)
- `duration_s` — Hedef reels süresi
- `caption_en` / `caption_tr` — IG post caption (line break dahil)
- `hashtags` — 15 hashtag listesi
- `music_mood` — Müzik tarzı (Epidemic Sound arama keyword)
- `footage_queries` — Pexels/YouTube drone footage arama queryleri
- `local_assets` — Mevcut /assets/img/ webp'leri (fallback görsel)
- `best_post_times_tr` / `best_post_times_uk` — En iyi yayın saatleri
- `target_audience` — Hedef kitle segmenti

### Manuel render (CapCut)
1. `footage_queries`'ten 3-5 drone clip indir (Pexels veya YouTube)
2. ElevenLabs'ta `voiceover_en` → mp3 (ses: George veya Charlotte UK accent)
3. CapCut'a yükle: clip + voiceover + auto-caption + music (mood'a göre)
4. Logo overlay + son 3 saniye CTA "Visit kalkaninfo.com"
5. Export 9:16 1080×1920

### Otonom flow (Faz 1-5'te)
1. **Cron Pazartesi 09:00 TR** — `scripts/select-weekly-content.mjs` haftalık 7 post seçer (mix: antik+plaj+restoran+etkinlik+hava+yerel)
2. **Visual builder** — local asset + Pexels footage + branding
3. **Telegram approval** — Berkay'a 7 post listesi + onay butonu
4. **Auto-publish** — Onaylananları Meta Graph API ile yayınla
5. **Performance loop** — Engagement metrics → öğrenen sistem

## Sonraki Content Pack'ler (eklenecek)

- `plajlar-reels.json` — 10 plaj/koy (Kaputaş, Patara, Kalamar, Kınık vb.)
- `restoranlar-reels.json` — 10 öne çıkan restoran
- `villalar-carousel.json` — Villa portföy carousel'leri
- `daily-templates.json` — Hava + nöbetçi eczane + "Bugün Kalkan'da" template'leri
- `events-templates.json` — Yerel etkinlik duyuruları
- `seasonal-themes.json` — Mevsim/tatil temalı planlar
