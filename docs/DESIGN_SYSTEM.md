# Kalkan Info — Design System (Canonical)

> **Owner:** MORPHEUS (Visual System Architect)
> **Version:** 1.0.0 — 2026-05-22
> **Status:** Source of truth for visual decisions. Override only with written agreement.
> **Companion:** [DESIGN.md](../DESIGN.md) (machine-readable tokens) · [tailwind.config.js](../tailwind.config.js) (build tokens)

Kalkan Info is a Turkish-Mediterranean tourism brand. The visual language is **sea + sun**:
deep navy water (`sea-*`), warm Lycian gold (`sun-*`), a single coral accent for emergency
signal. The system is built for a static, multi-page site with hand-authored HTML
(no SPA framework), Tailwind JIT, and self-hosted `dist/tw.css`. **No CDN.**

---

## 1. Color Tokens

All colors are defined in [`tailwind.config.js`](../tailwind.config.js) and surfaced as
Tailwind utilities. **Never use** Tailwind's default `blue`, `indigo`, `sky`, `cyan`,
`teal` — they break the brand silhouette.

### 1.1 Sea (primary — water, navigation, depth)

| Token        | Hex       | Use                                                              |
|--------------|-----------|------------------------------------------------------------------|
| `sea-50`     | `#eaf2f9` | Lightest tints, alt section background hover                     |
| `sea-100`    | `#cfdfee` | Borders, dividers, soft separators                               |
| `sea-200`    | `#9cc0dd` | Disabled state, soft icons                                       |
| `sea-300`    | `#5d97c4` | Muted secondary text, captions                                   |
| `sea-400`    | `#2f74a8` | Secondary icon, hover-state link                                 |
| `sea-500`    | `#1a5e93` | **Primary link, focus accent, secondary CTA outline**            |
| `sea-600`    | `#134c79` | Heading on white, body emphasis                                  |
| `sea-700`    | `#0d3a5f` | Dark band background, navy ribbon                                |
| `sea-800`    | `#0a2e4c` | **Body text default, navigation primary**                        |
| `sea-900`    | `#072136` | Deepest header background, ribbon pattern dark stop              |

### 1.2 Sun (accent — gold, CTA, "premium" signal)

| Token        | Hex       | Use                                                              |
|--------------|-----------|------------------------------------------------------------------|
| `sun-50`     | `#fff8eb` | Premium tier card wash                                           |
| `sun-100`    | `#fdedc6` | Highlight pill background                                        |
| `sun-200`    | `#fcd98a` | Tag, soft badge                                                  |
| `sun-300`    | `#f8c25a` | Decorative gold                                                  |
| `sun-400`    | `#f4b53d` | **Focus ring (gold), "nav-active" label, target pulse**          |
| `sun-500`    | `#e89812` | **Primary CTA base, underline-grow accent**                      |
| `sun-600`    | `#c97c08` | CTA hover (deepen, never on bare white)                          |
| `sun-700`    | `#a35f06` | CTA gradient bottom stop                                         |
| `sun-800`    | `#7a4805` | Deep gold (rare; pricing tier-premium gradient)                  |
| `sun-900`    | `#4e2f04` | Reserved                                                         |

### 1.3 Coral (single-purpose — emergency, "live" badge)

| Token         | Hex       | Use                                                              |
|---------------|-----------|------------------------------------------------------------------|
| `coral-500`   | `#e74c3c` | **Live/breaking badge background, emergency callouts**           |
| `coral-600`   | `#c0392b` | Coral hover (rare)                                               |

> **Rule:** Coral never appears in body text or large surfaces. It's the **alarm color**.

### 1.4 Ink (deep text-on-dark variants)

`ink-700 #1a3a5c` · `ink-800 #0a2e4c` · `ink-900 #061d33` — used in dark-mode panels
and inverted hero overlays.

---

## 2. Typography

### 2.1 Font families

```css
font-family: 'Montserrat', system-ui, sans-serif;  /* display, headings */
font-family: 'Inter', system-ui, sans-serif;       /* body, UI */
```

**Loaded via Google Fonts preconnect.** Inter is permitted as body font despite the
global guardrail — the alternative (DM Sans, Lato) would require regression testing
on all 27 pages × 5 locales and the audit flagged this as P2-low.

### 2.2 Weight scale

| Element       | Family       | Weight       | Tracking    | Line-height |
|---------------|--------------|--------------|-------------|-------------|
| Hero h1       | Montserrat   | 900 (black)  | `-0.03em`   | `1.0`       |
| Section h2    | Montserrat   | 800          | `-0.02em`   | `1.1`       |
| Card h3       | Montserrat   | 800 (extra)  | `-0.02em`   | `1.15`      |
| Eyebrow/label | Montserrat   | 700          | `0.14em` up | `1.2`       |
| Body          | Inter        | 400          | normal      | `1.65`      |
| Body emphasis | Inter        | 600          | normal      | `1.65`      |

### 2.3 Size tokens (Tailwind utilities — do not invent new sizes)

- Hero h1: `text-5xl md:text-7xl` (pricing exception: `text-4xl md:text-6xl lg:text-7xl`)
- Section h2: `text-2xl md:text-3xl`
- Card h3: `text-lg`
- Body: `text-sm md:text-base`
- Caption / meta: `text-xs`

### 2.4 Heading rule

`h1, h2, h3, h4, .font-display` MUST receive Montserrat + `letter-spacing: -0.02em`.
Achieved via the inline `<style>` block at the top of every page. **Card titles use
`font-extrabold` (800)**, never `font-bold` (700) — extrabold reads as a heading,
bold reads as emphasized body.

---

## 3. Card System

**Decision:** One base class, three optional modifiers. Removes the prior `.villa-card`,
`.stat-card`, `.fact-card`, `.panel` fragmentation. Inline page CSS remains the
delivery vehicle (small footprint, no extra HTTP).

### 3.1 Base

```css
.card-base {
  background: #fff;
  box-shadow: 0 1px 3px rgba(7,33,54,.07), 0 6px 20px -6px rgba(7,33,54,.14);
}
```

Render this exactly in every page that uses cards.

### 3.2 Modifiers

| Modifier                | Adds                                                                 | Used by                              |
|-------------------------|----------------------------------------------------------------------|--------------------------------------|
| `.card-base--villa`     | `border-radius:16px; overflow:hidden; cursor:pointer;`               | villalar.html grid items             |
| `.card-base--stat`      | `border:1px solid #cfdfee; border-radius:14px; padding:20px;`        | b2b-dashboard.html, pricing stats    |
| `.card-base--fact`      | `border:1px solid #e3edf6; border-radius:14px; padding:18px;`        | antik-kentler/*.html fact tiles      |

### 3.3 Hover state

```css
.card-hover { transition: box-shadow .22s ease, transform .22s ease, border-color .22s ease; }
.card-hover:hover {
  box-shadow: 0 4px 8px rgba(7,33,54,.09), 0 16px 40px -8px rgba(7,33,54,.24);
  transform: translateY(-3px);
}
```

> **Never** `transition-all`. Always enumerate properties.

---

## 4. CTA Hierarchy

Three tiers. Pick by intent, not by "what looks nice."

### 4.1 Primary — gradient gold (booking, signup, conversion)

```html
<a class="cta-gradient">…</a>
```

```css
.cta-gradient {
  background: linear-gradient(135deg, #e89812 0%, #c97b09 100%); /* sun-500 → sun-700 */
  color: #fff;
  box-shadow: 0 8px 22px -6px rgba(232,152,18,.55);
}
.cta-gradient:hover { transform: translateY(-1px); box-shadow: 0 12px 28px -6px rgba(232,152,18,.7); }
```

Use **once per visible viewport**. Multiple gradient CTAs in one screen flatten hierarchy.

### 4.2 Secondary — sea outline (alternate path, "see more")

```html
<a class="border-2 border-sea-500 text-sea-800 hover:bg-sea-50 px-5 py-3 rounded-md font-bold">…</a>
```

### 4.3 Tertiary — text link with underline-grow

```html
<a class="underline-grow text-sea-500 font-bold">…</a>
```

The `.underline-grow::after` pseudo provides a 3px gold underline scaling on hover.

### 4.4 Anti-patterns

- **Never** `bg-sun-600` or `bg-sun-700` as a flat CTA — always use `cta-gradient`.
- **Never** WhatsApp `bg-emerald-600` for primary site CTAs — emerald is the WhatsApp
  brand convention and is whitelisted only for direct WhatsApp links.

---

## 5. Shadow Scale

| Token              | Value                                                                  | When                       |
|--------------------|------------------------------------------------------------------------|----------------------------|
| `shadow-card`      | `0 1px 2px rgba(13,58,95,.06), 0 8px 24px -8px rgba(13,58,95,.18)`     | Resting card               |
| `shadow-deep`      | `0 8px 32px -8px rgba(13,58,95,.35)`                                   | Modal, floating action btn |
| `shadow-glow`      | `0 0 0 4px rgba(232,152,18,.18)`                                       | **Focus / interactive accent on stat surface** |

> All shadows are tinted with sea/sun rgba — **never** Tailwind default `shadow-md`
> (it uses neutral grey and reads as generic).

`shadow-glow` is **mandatory** on:
- `pricing.html` `.card-base--stat` focus/hover
- `b2b-dashboard.html` `.stat-card` (alias for `.card-base--stat`) focus/hover

---

## 6. Hero Overlay

All hero sections use the same dual-layer overlay over the hero image:

```html
<header class="relative overflow-hidden" style="background:#072136;min-height:380px;">
  <img class="absolute inset-0 w-full h-full object-cover opacity-50" src="…" alt="…">
  <div class="absolute inset-0 hero-overlay"></div>
  …
</header>
```

```css
.hero-overlay {
  background:
    radial-gradient(ellipse 80% 60% at 60% 40%, rgba(26,94,147,.45) 0%, transparent 70%),
    linear-gradient(180deg, rgba(7,33,54,.55) 0%, rgba(7,33,54,.30) 40%, rgba(7,33,54,.92) 100%);
}
```

**Image opacity is always `opacity-50`.** Lower (30/40) drowns the image; higher (60+)
washes out white hero text.

---

## 7. Motion

Only `transform` and `opacity` may animate. **`transition-all` is forbidden.**

| Duration | Curve                                | Use                              |
|----------|--------------------------------------|----------------------------------|
| `150ms`  | `ease`                               | Hover color shift                |
| `220ms`  | `ease`                               | Card lift, shadow swap           |
| `280ms`  | `cubic-bezier(.34,1.56,.64,1)`       | Icon spring (tile-icon)          |
| `400ms`  | `cubic-bezier(.34,1.56,.64,1)`       | Modal / drawer open              |

---

## 8. Interactive State Quartet

Every clickable element implements four states. Missing any = bug.

1. **Default**
2. **Hover** — `transform: translateY(-1px)` or color shift + shadow uplift
3. **Focus-visible** — `outline: 3px solid #f4b53d; outline-offset: 3px;` (gold ring)
4. **Active** — `transform: scale(.98)` or darker shade

`outline:none` is **banned** unless an alternative visible focus indicator is provided.

---

## 9. Spacing Rhythm

Use these tokens — don't sprinkle arbitrary Tailwind steps:

| Token              | Tailwind                | Use                                  |
|--------------------|-------------------------|--------------------------------------|
| utility section    | `py-4`                  | Toolbar, filter strip                |
| standard section   | `py-10 md:py-14`        | Default page sections                |
| hero-attached band | `py-6`                  | Below-hero meta strip                |
| section vertical   | `space-y-6` to `gap-6`  | Inter-card spacing                   |
| card padding       | `p-5` or `p-6`          | Standard card interior               |
| eyebrow → h2       | `mt-2`                  | Label-to-heading                     |
| h2 → body          | `mt-3` to `mt-6`        | Heading-to-content                   |

---

## 10. Surface Layering (z-plane)

Three layers, never co-planar:

1. **base** (`#dce6ef` page background)
2. **elevated** (`#eef4f9` section-alt, `#fff` cards)
3. **floating** (modals, sticky nav, FAB — uses `shadow-deep`)

Sticky header always uses `nav-primary` gradient or `bg-white` with `shadow-card`.

---

## 11. Internationalization

Turkish (TR) is baseline content. EN, DE, RU, FR live as `data-en`, `data-de`,
`data-ru`, `data-fr` attributes on the element. The build script
(`scripts/build-multilang.mjs`) renders `/{lang}/page.html` statically. Visual tokens
above are language-agnostic — **never** add per-locale color or font overrides.

---

## 12. Anti-Generic Checklist (commit blocker)

Before opening a PR with visual changes, confirm:

- [ ] No default Tailwind `indigo`, `blue`, `sky`, `cyan`, `teal`
- [ ] No `shadow-md` / `shadow-lg` / `shadow-xl` (use tinted scale)
- [ ] No `transition-all` (enumerate properties)
- [ ] No same-font body + heading (Montserrat heading, Inter body — locked)
- [ ] No purple gradients on white (AI slop)
- [ ] All clickable elements have hover + focus-visible + active states
- [ ] Hero image opacity = `opacity-50`
- [ ] Primary CTA = `cta-gradient`, not flat `bg-sun-*`
- [ ] Card uses `card-base` (+ modifier), not a one-off bespoke class

---

## Appendix A — Migration map

For agents porting legacy markup:

| Legacy class         | New class                          |
|----------------------|------------------------------------|
| `villa-card`         | `card-base card-base--villa`       |
| `stat-card`          | `card-base card-base--stat`        |
| `fact-card`          | `card-base card-base--fact`        |
| `panel`              | `card-base card-base--stat`        |
| `bg-sun-600` (CTA)   | `cta-gradient`                     |
| `bg-sun-700` (CTA)   | `cta-gradient`                     |
| `shadow-md`          | `shadow-card`                      |
| `shadow-lg`          | `shadow-deep`                      |

## Appendix B — Audit references

- `docs/AUDIT_AESTHETIC_20260522.md` — sourced findings for this revision
- `DESIGN.md` — machine-readable token spec (design.md v0.1)
- `.claude/agents/morpheus.md` — visual system architect role spec
