# Abacus/OpenClaw Brief — @LykianRepublic topluluğundan güvenli haber

> Kullanım: SuperComputer'da `git pull` → OpenClaw'a *"docs/ABACUS_TOPLULUK_HABER_BRIEF.md'yi oku ve uygula"* de.
> Kurulum şartı: OpenClaw'ın Telegram **kullanıcı oturumu** bağlı olmalı (bot grup geçmişini okuyamaz).

## GÖREV
@LykianRepublic (Kaş & Kalkan yabancı/Rus topluluğu) mesajlarını izle; SADECE haber-değeri olan
OLAYLARI çıkar, anonimleştir, mevcut haber hattımıza besle. Amaç sohbet kopyalamak DEĞİL; olayı
yakalayıp KENDİ haberimizi yapmak. Rol: Kalkan İnfo Haber Merkezi saha muhabiri.

## OKUMA
- Grubu OpenClaw'ın Telegram entegrasyonuyla oku (Berkay üye; kullanıcı oturumu bağlı).
- Repo: `/home/ubuntu/github_repos/kalkan-info` (önce `git pull`).

## SERT ETİK/HUKUKİ ÇİZGİ (İHLAL = DUR)
- Mesajı/ekran görüntüsünü/fotoğrafı ASLA birebir yayınlama veya kopyalama.
- Üye adı/kullanıcı adı/kişisel veri/özel detay ASLA alma. Tam anonim.
- Sadece KAMUSAL OLAYIN OLGUSUNU çıkar: yangın, yol kapanışı, su/elektrik kesintisi, festival/etkinlik,
  kaza, hava/deniz uyarısı, resmi duyuru, açılış/kapanış vb.
- Çıkardığın her şey DOĞRULANMAMIŞ İPUCU'dur → yayından önce BAĞIMSIZ TEYİT şart (söylenti yayınlama).
- Trajedi/ölüm/kişisel/hassas → 'hold' (insan onayı şart), sansasyon YOK.
- KVKK/GDPR: kişisel veri işleme yok. Kaynak atfı grubun/kişinin adına DEĞİL — "Haber Merkezi doğrulaması".
- Yayın İNSAN ONAYLI (basket-publish). Grup kurallarına saygı; topluluğu rahatsız edecek kullanım yok.

## BESLEME (mevcut hattı kullan — yeni boru yapma)
Haber-değeri + doğrulanabilir bir olay bulunca `data/ig-venue-news.json` → `items[]`'a şu formatta ekle:
```json
{ "venueName": "Kalkan/Kaş Topluluk Sinyali", "username": "topluluk", "category": "topluluk-ihbar",
  "headline": "<olayın OLGUSU, kendi kısa cümlenle, isim/alıntı YOK>", "permalink": "tip:lykian:<tarih-saat>",
  "_origin": "tg-community", "_needs_verification": true }
```
Mevcut kapı (`scripts/agency/ig-news-harvest.mjs`) bunu haber-değeri/uygunluk/scope/hassas/yerleştirme
süzgecinden geçirip sepete koyar. Aynı `permalink`'i tekrar ekleme (dedup).

## RUS KİTLE İÇERİĞİ
Topluluk Rus/yabancı ağırlıklı. Uygun haberlerin RUSÇA (RU) + İngilizce (EN) sürümünü de üret
(dil-cevirmen kalıbı). Kalkan İnfo'nun Rus kitleye ulaşan içeriğini büyüt.

## NASIL ÇALIŞ
1. Grubu izle; her mesajı "haber-değeri olan kamusal olay mı?" diye ELE. Reklam/sohbet/kişisel/dedikodu → ATLA.
2. Geçeni anonimleştir + olguya indir → `ig-venue-news.json`'a ekle.
3. Kapı + haber ajanları (Muhabir/NewsVerifier) doğrular + kendi sözcüklerimizle yazar → sepet → onay.
4. Şüpheli/tek-kaynaklıyı 'hold'da bırak; asla otomatik yayınlama.

## İLK ÇIKTI (kod/aksiyon öncesi)
- A) Son 24-48 saatte grupta haber-değeri taşıyan kaç olay var, örnek 3 (anonim, olgu halinde).
- B) Kaçı reklam/sohbet/kişisel diye elendi (oran).
- C) Önerilen ilk beslemeler (ig-venue-news.json'a eklenecek anonim olgular).
Onaylanınca beslemeye başla; yayın Berkay onayıyla.
