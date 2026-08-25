# AdBrain DESIGN.md

The design system for AdBrain, derived from the approved reference
("Yamin media cockpit", `~/Downloads/Yamin Action Dashboard v2 Jayant.html`).
Every UI decision calibrates against this file. This REPLACES the Phase 0
indigo-on-dark look, which was generic and off-brand.

## 1. The ethos: an action dashboard, not a report

AdBrain tells the user what to DO and shows its working. Every screen:
- Leads with a verdict in one plain sentence.
- Ends in a decision the user can take (approve / deny / apply).
- Can open a "show the working" drawer that names the source, the formula, and
  the reason. Rule: if you cannot see the source, the formula, and the reason, it
  does not ship.
- Quantifies impact in money and confidence, not vanity metrics.

Voice: plain, direct, human. "Do this today." "Money on the table." "What will
break, and when." No hype, no jargon, no em dashes.

## 2. Color tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F7F5EF` | page background (warm paper) |
| `--ink` | `#17170F` | primary text, primary buttons, dark panels |
| `--muted` | `#6B6A5E` | secondary text, labels |
| `--border` | `#DED9CC` | hairline borders on cards/sections |
| `--border-soft` | `#EAE6DA` / `#EFEBDF` | inner dividers |
| `--card` | `#FFFFFF` | card surfaces on the cream bg |
| `--good` | `#3F7A55` (light `#7FB98F`) | scale / healthy / positive |
| `--stop` | `#A83A2E` | stop / danger / waste |
| `--watch` | `#A8761F` | watch / warning / will-break |
| `--link` | `#2E4A7D` | links and "working" pills |
| `--selection` | `#E5DFC9` | text selection |

No gradients. No indigo/violet. Semantic status colors only, used consistently
(green = scale, rust = stop, ochre = watch).

## 3. Typography

- **Display + body:** `Schibsted Grotesk` (weights 400-800). Load via Google Fonts.
- **Numbers, labels, status tags, metadata:** `JetBrains Mono` (400-600).
- Labels are uppercase, ~9-10px, letter-spacing 0.06-0.1em, in `--muted`.
- Big numbers (scores, ROAS, money) are mono, 22-46px, weight 600, tight tracking.
- Display headlines: Schibsted Grotesk, 26-31px, weight 700, letter-spacing -0.02em.
- Body: 12.5-14.5px, line-height 1.5-1.6. Never below 12px for real content.

## 4. Components

- **Card:** white, `1px solid --border`, radius 5px, generous padding (18-30px).
- **Pill / tag:** radius 999px, 1px border, mono uppercase micro-label. Filled ink
  pill = active; outline = inactive.
- **Status dot:** 6px circle in a status color, paired with a mono label.
- **Sparkline:** inline SVG polyline, 2px stroke in the status color.
- **Progress bar:** 4-6px track (`--border-soft`), ink fill, optional rust "aim" marker.
- **Radial gauge:** the "score" donut (one honest number, e.g. 57/70 green).
- **"Show the working" drawer:** right-side slide-over, 520px, cream bg, rows of
  label + value (source, formula, logic, example, next step).
- **Fixed bottom action bar:** dark (`--ink`), live dot, projected impact, and one
  primary Apply button. "nothing launches on its own."
- Buttons: primary = ink fill / cream text, radius 3px; secondary = white / ink
  border; hover shifts border or bg to `--link` or `--stop` by intent.

## 5. Layout

- Max content width 1200px, 40px side padding.
- Sticky top nav: logo + section anchor links + live status + currency toggle.
- Single scrolling page of sections, separated by `1px solid --border` top borders
  and ~64px top margin. Each section: plain verb title + one supporting sentence.
- Grids are asymmetric and purposeful (e.g. 1.7fr / 1fr cockpit), never a
  symmetric 3-column feature grid.

## 6. Anti-slop guardrails (what NOT to do)

- No indigo/violet, no gradients, no glassmorphism as decoration.
- No symmetric 3-column icon-in-circle feature grid.
- No centered-everything. Left-align content; center only the score gauge.
- No emoji as design elements. No decorative blobs.
- Cards earn their place; data tables and rows are fine and often better than cards.
- Uniform bubbly radius is banned; use the small 3-5px / pill 999px system above.

## 7. Accessibility floor

- Body text >= 12.5px mono / 13px sans; contrast >= 4.5:1 (ink on cream passes).
- Touch targets >= 44px on mobile.
- Every status color pairs with a text label (never color alone).
- Visible focus rings; full keyboard nav on the approve/deny queue and drawers.
- Visited vs unvisited link distinction preserved.
