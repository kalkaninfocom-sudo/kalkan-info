# Meta App Review — Başvuru Paketi (Kalkan Info)

> **Amaç:** DM oto-cevap + hikaye mention/etiket otomasyonu için Meta'dan
> **Advanced Access** izinleri almak. Bu izinler olmadan (standart erişimde)
> DM okunamıyor ve etiketleyenin hikayesi tespit edilemiyor.
>
> **Nasıl kullanılır:** Meta Developer Panel → App → **App Review → Permissions and
> Features** → her izin için "Request Advanced Access" → aşağıdaki metinleri ilgili
> alanlara yapıştır + istenen ekran kaydını (screencast) yükle.
>
> Hazırlayan: otomasyon ekibi · Tarih: 2026-07-18

---

## 0 · Ön koşullar (başvurudan ÖNCE tamamlanmalı)
- [ ] **Business Verification** tamamlanmış olmalı (Meta Business Manager → Security Center). Advanced Access bunsuz verilmez.
- [ ] App **Live** modda (Development değil).
- [ ] Privacy Policy URL: `https://kalkaninfo.com/gizlilik`
- [ ] Data Deletion URL: `https://kalkaninfo.com/data-deletion`
- [ ] App ikonu + kategori (Business) dolu.
- [ ] Instagram hesabı **Professional (Business/Creator)** ve bir Facebook Sayfasına bağlı (@kalkan.info ✓, 239 takipçi).

---

## 1 · İstenen izinler

| İzin | Ne için | Erişim seviyesi |
|------|---------|-----------------|
| `instagram_manage_messages` | Gelen DM'leri okuyup marka-uyumlu otomatik cevap | Advanced |
| `instagram_manage_comments` | Gönderi yorumlarına otomatik cevap (turist soruları) | Advanced |
| `instagram_manage_insights` | Mention/etiket tespiti + performans | Advanced |
| `Human Agent` (özellik) | 7 gün içinde insan-benzeri yanıt penceresi (DM) | — |

> Not: Story **mention okuma** `instagram_manage_insights` + business login ile gelir.
> Ancak **başka kullanıcının hikayesini otomatik "reshare" etmek için Instagram
> Graph API'de endpoint YOKTUR** — bu izinlerle bile yalnızca *tespit + bildirim*
> mümkündür, otomatik paylaşım değil. (Dürüst kısıt; başvuruda reshare vaat etme.)

---

## 2 · Her izin için başvuru metni (İngilizce — Meta İngilizce ister)

### instagram_manage_messages
**How your app uses this permission:**
> Kalkan Info is a regional tourism guide for Kalkan/Kaş, Turkey. Visitors send
> Instagram DMs asking about restaurants, beaches, boat tours, and local services.
> Our app reads incoming DMs and replies with concise, accurate, brand-consistent
> answers in the sender's language (TR/EN/RU/DE), using our verified local database
> of 170+ businesses. When information is uncertain, the app directs the user to
> WhatsApp for human follow-up. No message content is stored beyond reply generation.

**Step-by-step for the reviewer:**
1. Send a DM to @kalkan.info, e.g. "Which beach is best for families?"
2. Within a few minutes the app fetches the message via the Messaging API.
3. The app generates a helpful reply from the local knowledge base and sends it.
4. Reviewer sees an automated, relevant, language-matched reply.

**User benefit:** Instant 24/7 answers to travel questions in the visitor's own language.

### instagram_manage_comments
**How your app uses this permission:**
> Visitors comment on our posts with questions (opening hours, prices, directions).
> The app detects new comments on our own media, generates a short helpful reply in
> the commenter's language, and posts it. Spam/emoji-only comments are skipped.

**Step-by-step for the reviewer:**
1. Comment a question on any @kalkan.info post.
2. The polling worker (every ~15 min) detects the new comment.
3. A brand-consistent reply is generated and posted under the comment.

**User benefit:** Faster answers, higher engagement, better visitor experience.

### instagram_manage_insights
**How your app uses this permission:**
> Used to (a) detect media where @kalkan.info is tagged/mentioned so we can thank
> and (with human approval) feature user-generated content, and (b) read basic
> reach/engagement metrics to improve our content calendar. We do not resell data.

**Step-by-step for the reviewer:**
1. Tag @kalkan.info in a post/story.
2. The worker fetches tagged media via the API.
3. Our team receives an internal notification (Telegram) to review and, if approved, feature it.

**User benefit:** Community recognition; higher-quality, locally relevant content.

---

## 3 · Screencast (Meta zorunlu) — çekim senaryosu
Meta her izin için ekran kaydı ister. Tek video (2–3 dk), şu akışı göster:
1. Facebook ile giriş → izin ekranında istenen izinlerin onaylanması (consent screen).
2. **DM demo:** telefondan @kalkan.info'ya DM at → uygulamanın otomatik cevabını göster.
3. **Yorum demo:** bir posta yorum yaz → otomatik cevabı göster.
4. **Mention demo:** @kalkan.info'yu etiketle → internal bildirim/tespiti göster.
5. Privacy Policy sayfasını (kalkaninfo.com/gizlilik) tarayıcıda göster.
> Kayıt İngilizce anlatımlı olmalı; consent screen mutlaka görünmeli.

## 4 · Sık ret sebepleri (kaçın)
1. **Business verification eksik** → Advanced Access reddedilir. Önce tamamla.
2. **Screencast'te consent screen yok** → en sık ret. Login akışını mutlaka çek.
3. **Reshare vaadi** → API desteklemediği için "otomatik hikaye paylaşımı" yazma; "detect & feature with approval" de.
4. **Belirsiz use-case** → genel değil, Kalkan turizmine özgü somut örnek ver (yukarıdaki metinler öyle).

---

## 5 · Onay sonrası (bizim tarafta aktifleşecek)
- DM oto-cevap: `scripts/ig-reply-poll.mjs` zaten DM okumayı deniyor; izin gelince otomatik çalışır (kod hazır, sadece `instagram_manage_messages` bekliyor).
- Story mention tespiti: `scripts/ig-story-repost.mjs` `/mentions` endpoint'ini izin gelince kullanır (yine de reshare değil, tespit+onay).
- Reshare gerçek paylaşımı: **manuel** kalır (API yok) — ya da IG uygulamasından elle.
