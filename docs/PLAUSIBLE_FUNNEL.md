# Plausible Custom Event Taxonomy & Funnel Setup — Kalkan Info

**Owner:** Berkay
**Last updated:** 2026-05-19
**Status:** Implemented in `js/analytics.js` + `js/utm-tracker.js` + `js/engagement-tracker.js`. KVKK consent gate aktif — events only fire after `analytics` rıza verildikten sonra.

---

## 1. Where events live

| File | Events fired |
|------|-------------|
| `js/analytics.js` | `outbound_link`, `wa_click` (host=wa.me), `maps_click` (host=google.*/maps), `phone_click` (tel:), `email_click` (mailto:), `instagram_visit`, `cta_click` (any `[data-cta]` element), `share` (Web Share API) |
| `js/utm-tracker.js` | `ig_arrival` (utm_source=ig\|instagram), `fb_arrival` (fbclid\|utm_source=fb), `utm_arrival` (other) |
| `js/engagement-tracker.js` | `engaged` (30s active dwell + 50% scroll), `qualified_lead` (newsletter \| concierge \| vacation_planner herhangi birinde) |
| `js/concierge-modal.js` | `concierge_open`, `concierge_select`, `concierge_close`, `wa_click` (provider) |
| `js/providers-modal.js` | `providers_modal_open`, `phone_click`, `maps_click`, `wa_click` (provider) |
| `js/newsletter.js` | `newsletter_subscribe` |
| `js/vacation-planner.js` | `vacation_planner_complete` |
| `js/i18n.js` | `lang_switch` |
| `js/page-restoranlar.js`, `page-villalar.js`, `page-plajlar.js` | `category_filter`, `search` (debounced 600ms, query_len only — no PII) |

---

## 2. Event reference

### Concierge funnel

| Event | Props | Trigger |
|-------|-------|---------|
| `concierge_open` | `source` (hero_cta\|floating_button\|strip_cta\|inline_link), `page` | Modal opens |
| `concierge_select` | `provider`, `agent` | A provider card clicked |
| `wa_click` | `provider_id`, `page_url`, `agent`, `source` | Any WhatsApp link clicked |
| `concierge_close` | `page` | Modal closed without submit |

### Lead capture

| Event | Props | Trigger |
|-------|-------|---------|
| `newsletter_subscribe` | `locale`, `source_page`, `status` (pending\|already_confirmed) | Successful subscription (PII free) |
| `vacation_planner_complete` | `nights`, `adults`, `children`, `currency`, `budget_band` (0-25k\|25-75k\|75-150k\|150-300k\|300k+), `stub`, `local_draft` | Plan rendered |
| `lead_magnet_download` | _not implemented yet_ | TBD — PDF guide hazır olduğunda |

### Engagement

| Event | Props | Trigger |
|-------|-------|---------|
| `cta_click` | `cta`, `page` | Any `[data-cta]` element clicked |
| `lang_switch` | `from`, `to`, `page` | Language changed (i18n.set) |
| `category_filter` | `page`, `category` | Filter dropdown change on listing pages |
| `search` | `page`, `query_len` (string, length only — privacy) | After 600ms debounce, length ≥ 2 |
| `share` | `has_url`, `page` | navigator.share() called |
| `phone_click` | `number`, source/provider context | `tel:` link clicked |
| `maps_click` | `dest`, source/provider context | Google Maps link clicked |
| `email_click` | `email_domain` | `mailto:` link clicked |

### Outbound

| Event | Props | Trigger |
|-------|-------|---------|
| `outbound_link` | `dest` (hostname), `category` (ota when booking/airbnb/tripadvisor) | Any external `http(s)` link clicked |
| `instagram_visit` | `url_path` | instagram.com link clicked |
| `ig_arrival` | `campaign`, `landed_path`, `medium` | utm_source=ig\|instagram |
| `fb_arrival` | `campaign`, `landed_path` | utm_source=fb\|facebook or fbclid present |
| `utm_arrival` | `source`, `medium`, `campaign`, `landed_path` | Any other UTM-tagged arrival |

### Funnel goals

| Event | Props | Trigger |
|-------|-------|---------|
| `engaged` | `page`, `dwell_s`, `scroll_pct` | 30s active dwell + 50% scroll |
| `qualified_lead` | `source` (newsletter\|concierge\|vacation_planner), `page` | First time user does any of the 3 |
| `providers_modal_open` | `service`, `page` | Service card clicked → modal opens |

---

## 3. Plausible Dashboard — Manuel kurulum gerekli

Plausible dashboard'da bu **Goal**'leri ve **Funnel**'i Berkay manuel ekleyecek (Plausible API'sı goal yaratmaz).

### Goals to add

1. **Newsletter Subscribe** — Goal type: `Custom event`, event name: `newsletter_subscribe`
2. **Concierge WA Click** — Goal type: `Custom event`, event name: `wa_click`
3. **Vacation Plan Complete** — Goal type: `Custom event`, event name: `vacation_planner_complete`
4. **Engaged Visit** — Goal type: `Custom event`, event name: `engaged`
5. **Qualified Lead** — Goal type: `Custom event`, event name: `qualified_lead`
6. **Concierge Modal Open** — Goal type: `Custom event`, event name: `concierge_open`
7. **Providers Modal Open** — Goal type: `Custom event`, event name: `providers_modal_open`
8. **CTA Click** — Goal type: `Custom event`, event name: `cta_click`
9. **Lang Switch** — Goal type: `Custom event`, event name: `lang_switch`
10. **IG Arrival** — Goal type: `Custom event`, event name: `ig_arrival`
11. **Outbound (OTA)** — Goal type: `Custom event`, event name: `outbound_link` (filter prop `category=ota`)

### Funnel — "Concierge Lead"

Plausible Business plan'da Funnel oluştur:

```
Step 1: Pageview (any)
Step 2: engaged
Step 3: concierge_open  (OR qualified_lead)
Step 4: wa_click
```

### Funnel — "Instagram → Plan"

```
Step 1: ig_arrival
Step 2: engaged
Step 3: vacation_planner_complete  (OR newsletter_subscribe)
```

### Custom Properties (Plausible dashboard'da görmek için)

Plausible Settings → Custom Properties → şu prop'ları manuel allowlist'e ekle:

- `source`
- `provider_id`
- `agent`
- `page_url`
- `cta`
- `from` (lang)
- `to` (lang)
- `category`
- `campaign`
- `dest`
- `budget_band`
- `locale`
- `status`

(Plausible varsayılan olarak custom prop'ları yutar; dashboard'da görmek için yukarıdaki listeyi Site Settings → Custom Properties altında elle eklemen lazım.)

---

## 4. Dev mode test workflow

Lokal test:

```bash
node serve.mjs   # http://localhost:3000
```

Tarayıcı konsolu otomatik olarak şu formatı gösterir (analytics.js içindeki `DEV` flag):

```
[plausible] concierge_open { source: "hero_cta", page: "/" }
[plausible] wa_click       { provider_id: "berkay", page_url: "/", agent: "Berkay", source: "concierge_modal" }
[plausible] engaged        { page: "/", dwell_s: 30, scroll_pct: 50 }
```

`?debug=1` query parametresi prod domain'de de dev mode'u açar (örn. https://kalkaninfo.com/?debug=1).

KVKK consent verilmemişse event'ler **drop edilir** (gönderilmez) — dev console'da yine log görünür, network'te plausible.io çağrısı olmaz.

---

## 5. Privacy notes (KVKK / GDPR)

- **No PII**: email/telefon/isim Plausible'a hiçbir zaman gönderilmez. Sadece domain, length, band gibi türetilmiş metrikler.
- **Consent gate**: `KalkanConsent.has('analytics')` false ise event'ler tamamen drop olur (queue da temizlenir).
- **Search query masking**: `search` event'i sadece `query_len` (string olarak) yollar, gerçek sorgu yok.
- **Email domain only**: `email_click`'te `name@example.com` → sadece `example.com` yollanır.
- **Phone number**: `phone_click`'te number prop yollanır (tel: linkleri zaten kamuya açık page content, KVKK Article 5/2-d istisna).
