# AdBrain AI — Design Handoff

Creative Decision Intelligence for Meta growth teams. Marketing site + web app, built to the **telli.com** style system.

## What's in this folder
- `Deepsolv.dc.html` — marketing landing page (file name is legacy; brand is **AdBrain AI**)
- `Product.dc.html` — product / how-it-works page
- `BookDemo.dc.html` — book-a-demo page (form + success state)
- `Dashboard.dc.html` — the web app (11 screens, single-file router)

> These are **Design Components** (`.dc.html`) authored in an internal runtime, but every file is plain, inline-styled HTML you can read directly. Treat the markup + tokens below as the source of truth and rebuild in your stack (React/Next + Tailwind recommended).

---

## Design tokens (extracted from telli.com)
```
color.bg          #F7F7F7   page background
color.surface     #FFFFFF   cards / inputs
color.surfaceAlt  #EFEFEF   subtle fills, tracks, inactive
color.ink         #252525   primary text + dark buttons
color.inkMuted    #6B6B6B   secondary text
color.accent      #038BF7   brand blue (use sparingly)
color.accentSoft  #E6F2FE   blue tint backgrounds
color.hairline    #E4E4E4   borders / dividers

radius.card       10px
radius.pill       70px      buttons, inputs, tabs, chips (fully rounded)

font              'Inter', 'Helvetica Neue', Arial, sans-serif
                  (telli ships a proprietary face "Review"; Inter is the free match)

type.h1  56–64px / 400 (LIGHT — do not bold headlines)
type.h2  40px / 400
type.h3  18–22px / 500
type.body 15–18px / 400
type.small 12–14px

space.section  ~96–112px vertical rhythm
```

### Semantic (verdict) colors — app only
```
Scale / Won / good   text #0f8a4d  bg #e7f4ec
Iterate / warn       text #b06b00  bg #fbf1df
Kill / Failed / bad  text #c0392b  bg #fbecea
Neutral chip         text #6B6B6B  bg #EFEFEF
```

### Rules
- Mono ink on light ground; blue is an accent (dots, active states, links, key CTAs), never a field.
- Headlines are weight 400. Dark near-black (#252525) sections/cards for contrast bands.
- Everything rounded: 10px cards, 70px pills.

---

## Marketing site — section order (landing)
1. Announcement bar (accent blue)
2. Nav — 3×3 logomark, links, EN/DE, Book a demo, Sign up (→ Dashboard)
3. Hero — two-line headline (ink + muted), pill email capture
4. Product demo widget — tabs (Overview/Analytics/Integrations/API), agent picker, "Build my test plan"
5. Trust band — 6 logos
6. Use cases — "Driving results across teams", group tabs, card grid + accent-soft "Discover more"
7. Funding — dark card
8. How it works — "method" stepper (Scan/Decide/Create/Scale) + bullets
9. Features — 6 cards
10. Security — gradient card + compliance chips
11. Testimonials — 2-col quotes
12. Case study — big stat row
13. Final CTA — dark card + capture
14. Footer — 5 columns

Animations: scroll-reveal (IntersectionObserver fade-up per section), card hover lift, shimmer on hero demo, live pulse dot, animated bars.

---

## Web app (Dashboard) — 11 screens
Layout: fixed 256px sidebar (grouped nav) + sticky topbar (title, "Agents live", Ask AdBrain search, source/week selector, Re-scan). Client-side router via active state.

**Decide**
- **Dashboard** — Account Health ring (0–100) + 7 component bars; decision KPIs (Blended ROAS, MER, nCAC, Concentration) with hover tips; ranked test plan; "Needs your attention" → Action Center.
- **Action Center** — cards: Observation → Diagnosis → Evidence (+ rule ID) → Confidence bar → Action + est. impact. Buckets: DO NOW / DO NEXT / WATCH (filterable).
- **Test Plan** — ranked list: name, type, why-signal, confidence bar, expected lift, Kill/Iterate/Scale.

**Creative**
- **Creative Fatigue** — states (Healthy→Fatigued), 7-day & 14-day fatigue probability bars, drivers, confidence, action. Labelled model-estimate.
- **Diversity & White Space** — Diversity/Concentration/Coverage scores, spend-by-concept concentration bars, testable white-space combos.
- **Brand Brain** — searchable Won/Failed memory (live filter input).

**Media**
- **Budget & Scaling** — marginal ROAS (next +$10K → est. ROAS) with diminishing-returns bar curve, Scale/Protect/Replace columns, budget-waste list.
- **Analytics** — ROAS-by-week bar chart, top formats, fatigue watch.

**Intelligence**
- **Competitors** — filtered feed (New angle/offer/format); "active ≠ winning" caveat.
- **Voice of Customer** — signals tagged Barrier/Desire/Objection/Motivator + "Turn into brief".

**Account**
- **Settings** — workspace, data sources (Meta first; Google/Shopify/GA4/Klaviyo/Ads Library toggles), team, brand voice.

Actions fire a confirmation toast. Charts use CSS % heights inside a fixed-height flex row with `align-items:stretch` + column `height:100%` (so bar percentages resolve).

---

## Product principles (for the AI/analytics layer)
Decision-first, not a reporting tool. For every metric: definition, formula, source, aggregation level, time window, limitations. Distinguish OFFICIAL PLATFORM FACT / RESEARCH-BACKED / BENCHMARK / INTERNAL CALCULATION / MODEL ESTIMATE / INFERENCE. Every recommendation: Observation → Diagnosis → Evidence → Rule → Confidence → Action → Expected impact. Guardrails: small samples flagged, "insufficient data ≠ waste", "active ≠ winning", confidence on all forecasts, no arbitrary thresholds presented as truth.
