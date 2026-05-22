# ARCHITECT Audit — 2026-05-22

**Scope:** kalkaninfo.com — read-only audit: sitemap vs navigation, conversion funnel, internal linking, breadcrumb coverage, 404 + auth flow.

## Özet

35/49 sayfa breadcrumb JSON-LD ile kapsanmış, 404 sayfası 5 dil + yardımcı link'lerle iyi durumda. Ama 6 sayfa drawer'da eksik, rehber↔antik kent cross-link 0, pricing→ilan-ver funnel kırık (sadece WhatsApp).

---

## 1. Sitemap vs Navigation Diff

**Sitemap (TR):** 49 unique URL. **Drawer:** 21 destination.

| Sayfa | Sitemap | Drawer | Risk |
|---|---|---|---|
| `rehber/index.html` | ✓ | ✗ | **HIGH** — 6 rehber mobil nav'dan görünmüyor |
| `events.html` | ✓ | ✗ | **HIGH** — events erişilemez |
| `transfer.html` | ✓ | ✗ | **MEDIUM** — transfer hizmeti gizli |
| `pricing.html` | ✓ | ✗ | **HIGH** — partner girişi drawer'da yok |
| `b2b-dashboard.html` | (noindex) | ✗ | OK — auth-gated |
| `data-deletion.html` | ✓ | ✗ | LOW — yasal, az ziyaret |

Referans: `js/site-drawer.js:66-127` — 21 nav link, 8 kategori. rehber/events/transfer/pricing yok.

## 2. Navigation Hiyerarşi

| Hedef | Drawer | Bottom-nav | Footer |
|---|---|---|---|
| index | ✓ | ✓ (Home) | ✓ |
| villalar/restoranlar/plajlar/turlar/antik-kentler | ✓ | - | ✓ |
| rehber/ | ✗ | - | varies |
| pricing | ✗ | - | ✓ (yalnız pricing.html'de) |
| events/transfer | ✗ | - | belirsiz |
| Concierge | - | ✓ (slot 4) | - |
| Search | - | ✓ (slot 3) | - |

**Tutarsızlık:** Bottom-nav "Hizmetler" label'ı (`js/bottom-nav.js:143`) drawer'ı açıyor — kullanıcı hizmetler sayfası bekliyor, sitemap menüsü çıkıyor.

## 3. Conversion Funnel Haritası

### Misafir Funnel
```
Hero → bottom-nav "Concierge" → window.openConcierge() [concierge-modal.js:524]
     → 2-profile modal (human/AI) → openConciergeAI() [concierge-ai-modal.js:525]
        → Claude Haiku SSE [api/concierge-ai.js:234]
        → WhatsApp fallback [concierge-ai-modal.js:259]
```

**Drop-off:**
- Eğer sayfa `concierge-modal.js` yüklemiyorsa → `window.openConcierge` undefined → bottom-nav raw WhatsApp'a fallback (`js/bottom-nav.js:192`), AI bypass.
- AI conversation sonrası: booking widget yok, sadece WhatsApp. Self-service için dead-end.

### Partner Funnel
```
pricing.html → [CTA butonları] → wa.me/905306650794
                                  ^^ KIRIK: ilan-ver.html'e link yok
ilan-ver.html → multi-step form → (inline JS submit, görünür API yok)
                                   ^^ auth gerektirir [ilan-ver.html:525]
admin/jobs.html → api/job-decision.js → admin onay
b2b-dashboard.html → auth-gated panel
```

**Kritik gap:** `pricing.html:223-270` — 3 tier CTA (`cta-basic`, `cta-premium`, `cta-featured`) hepsi WhatsApp'a gidiyor, pre-filled text. `ilan-ver.html`'e otomatik yol yok. `hizmet-ekle.html` link'i sadece footer'da (`pricing.html:375`).

## 4. Internal Linking Gap

| Kaynak | Hedef | Bulunan |
|---|---|---|
| 6 rehber makale | 10 antik kent detay | **0** |
| 6 rehber makale | villalar/turlar/plajlar | **0** (body) |
| 10 antik kent detay | rehber | **0** |
| 10 antik kent detay | villalar/turlar/plajlar | **4/sayfa** (sadece nav/footer, body cross-link yok) |

`antik-kentler/patara.html` nav'da villalar+turlar var (`patara.html:116-119`) ama body'de "ilgili tur" veya "yakın villa" yok.

## 5. Breadcrumb Coverage

**BreadcrumbList JSON-LD:** 35 root-level dosyada, 10 antik kent + 6 rehber dahil. Kapsama güçlü.
**Eksik (kabul edilebilir):** 404, login, register, admin, b2b-dashboard.

## 6. Acil CTA Erişim

eczane/acil/saglik keyword'leri 18 dosyada, index dahil. Bottom-nav'da acil slot YOK. En yakın yol: bottom-nav → drawer → (drawer'da da yok). 2 tık + scroll.

## 7. 404 + Auth

**404.html:** 5 dil i18n, 6 popular link (villalar/plajlar/turlar/antik-kentler/restoranlar/hizmetler), history.back(). Sağlam (`404.html:41-78`).

**Login/Register:** Google + Facebook + email/password, Supabase Auth. noindex (`login.html:55`). KVKK checkbox register'da. 5 dil hreflang. Password reset link head'de görünmüyor (body kontrolü gerek).

## 8. Root Cause

Site içerikten platforma evrildi (partner/B2B). Drawer (`site-drawer.js`) güncellenmedi. Partner funnel WhatsApp-first tasarlandı — ölçeklemeyi engelliyor.

## 9. Öneriler

### P1 — Wave 1 (Navigation + Linking)

1. **4 eksik sayfayı drawer'a ekle** — rehber/events/transfer/pricing → `js/site-drawer.js:66-127`. Effort: LOW. Impact: HIGH.
2. **Rehber↔antik kent cross-link** — 6 rehber her biri ilgili antik kent'lere link. 10 antik kent ilgili rehber'lere link. Effort: MEDIUM. Impact: HIGH (SEO + engagement).
3. **Antik kent detay'da "İlgili tur/villa" bölümü** — body cross-link yok şu an. Card grid ekle. Effort: MEDIUM. Impact: HIGH (content→intent).
4. **Bottom-nav "Hizmetler" → "Menü"** — `bottom-nav.js:143` label yanıltıcı. Effort: LOW. Impact: MEDIUM (UX clarity).

### P2 — Wave 2 (Funnel)

5. **Pricing tier'a `ilan-ver.html` link** — `pricing.html:223-270` her tier'a "Hemen Başvur" secondary CTA + WhatsApp birincil. Effort: LOW. Impact: HIGH (scalable onboarding).
6. **`concierge-modal.js` her sayfada yüklü olsun** — bottom-nav raw WhatsApp fallback'i önle. Effort: LOW. Impact: MEDIUM.
7. **AI conversation sonrası booking CTA** — `concierge-ai-modal.js` 3+ turn sonra contextual CTA inject. Effort: MEDIUM. Impact: HIGH.

## 10. Trade-offs

| Seçenek | Pros | Cons |
|---|---|---|
| Drawer'a tüm eksikleri ekle | Tam nav, keşfedilebilir | Drawer uzar, mobil scroll |
| Pricing WhatsApp-only | Kişisel, yüksek konversiyon | Ölçeklenmez |
| Pricing→ilan-ver | Trackable, self-service | Auth friction |
| Bottom-nav'a acil slot | Hayat güvenliği | 5 slot'tan birini değiştir |

## 11. Referanslar

- `js/site-drawer.js:66-127` — drawer nav (21 dest, 6 eksik)
- `js/bottom-nav.js:141-156` — 5 slot grid
- `js/bottom-nav.js:186-194` — concierge WhatsApp fallback
- `js/concierge-modal.js:524` — `window.openConcierge`
- `js/concierge-ai-modal.js:525` — `window.openConciergeAI`
- `js/concierge-ai-modal.js:259` — WhatsApp fallback
- `api/concierge-ai.js:234` — Haiku streaming
- `pricing.html:223-270` — tier CTA → WhatsApp
- `pricing.html:375` — footer hizmet-ekle
- `ilan-ver.html:521-525` — form auth gerek
- `404.html:41-78` — 5 dil 404
- `login.html:55` — noindex Supabase
- `antik-kentler/patara.html:116-119` — nav-only link (body cross-link yok)

---

**Toplam: 14 bulgu / 7 alan. 4 P1 (navigation+linking) + 3 P2 (funnel).**
