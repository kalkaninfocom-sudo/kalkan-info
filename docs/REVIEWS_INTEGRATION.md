# Reviews Komponenti — Entegrasyon Kılavuzu

**Dosya:** `js/reviews.js`  
**Bağımlılık:** `js/auth.js` (Firebase app init + currentUser), `js/i18n.js` (opsiyonel)  
**Firestore koleksiyonu:** `reviews/{reviewId}` — şema için bkz. `docs/ARCHITECTURE.md §2.3`

---

## Kurulum Koşulları

1. Sayfada `js/auth.js` **önceden** yüklenmiş olmalı (Firebase app init için).
2. `<script type="module">` ile import et — CDN Tailwind zaten sayfada.
3. Mount noktası DOM'da mevcut olmalı.

---

## 1. Profil Detay Sayfasında Kullanım

```html
<!-- restoran/mehmet-restaurant.html -->
<div id="reviews-mount"></div>

<script type="module">
  import { mountReviews } from '../js/reviews.js';

  mountReviews({
    target:     '#reviews-mount',
    targetType: 'profile',
    targetId:   'restoran-mehmet',
    locale:     'tr',
  });
</script>
```

`targetId` → `profiles/{profileId}` koleksiyonundaki doküman ID'si.

---

## 2. Aktivite Sayfasında Kullanım

```html
<!-- aktivite/tekne-turu.html -->
<div id="reviews-mount"></div>

<script type="module">
  import { mountReviews } from '../js/reviews.js';

  // targetType 'activity' → Firestore'da targetType == 'activity' filtresi uygulanır
  mountReviews({
    target:     '#reviews-mount',
    targetType: 'activity',
    targetId:   'tekne-turu-kalkan',
    locale:     document.documentElement.lang || 'tr',
  });
</script>
```

---

## 3. Sayfada Birden Fazla Profil (Multi-mount)

Her mount noktasına ayrı `mountReviews` çağrısı yap.  
Çağrılar birbirinden bağımsız — Firestore sorguları `targetId` ile izole edilir.

```html
<!-- karsilastirma.html -->
<div id="reviews-a"></div>
<div id="reviews-b"></div>

<script type="module">
  import { mountReviews } from '../js/reviews.js';

  const profiles = [
    { mount: '#reviews-a', id: 'restoran-mehmet' },
    { mount: '#reviews-b', id: 'villa-deniz' },
  ];

  // Paralel mount — Promise.all ile
  await Promise.all(
    profiles.map(p =>
      mountReviews({ target: p.mount, targetType: 'profile', targetId: p.id })
    )
  );
</script>
```

---

## Programatik API (İsteğe Bağlı)

```js
import { loadReviews, submitReview } from '../js/reviews.js';

// Manuel sorgu
const { reviews, lastDoc } = await loadReviews('profile', 'restoran-mehmet', { limit: 5 });

// Sayfalama — sonraki sayfa
const next = await loadReviews('profile', 'restoran-mehmet', { limit: 5, after: lastDoc });
```

---

## Notlar

- `replyToReview`, `markHelpful`, `reportReview` → **TODO** Cloud Function implemente edilince aktif et.  
- Storage path: `reviews/{tempId}/{n}.jpg` — thumbnail için `thumbnailGenerator` Function tetiklenir (Faz 4).  
- Firestore rule: `status == 'visible'` olan yorumlar herkese açık; `hidden/deleted` sadece admin okur.  
- Auth yoksa "yorum yazmak için giriş yap" linki gösterilir, liste yüklenmesi engellenmez.
