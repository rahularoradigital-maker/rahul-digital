# Product-Wide UX / UI Audit + Design-System Convergence Plan

_AdScale (`adbrain-mvp`) · 2026-09-02 · audit-only pass, no code changed._
_Evidence gathered by four parallel read-only passes over `app/`, `components/`, `app/globals.css`, `DESIGN.md`, `lib/app/nav.ts`. Every claim is file-cited; anything unverifiable is marked UNKNOWN._

---

## 1. Executive summary

This is a **healthier codebase than a "redesign everything" brief would assume**, and the single most important discovery is that **the design system already exists and is good** — `DESIGN.md` (the "telli" system) specifies exact tokens, a radius scale (card 10px / pill 70px), a type scale, a 44px tap-target floor, and "keyboard nav on all actions." It even says of itself: _"this is the TARGET; the shipped app still uses Phase 0 … until the re-base."_ So the work is **convergence to an existing spec, not invention of a new one.** That is the through-line of every recommendation below.

Three real problem classes, in priority order:

1. **Information architecture + product coherence (highest impact, mostly free of design risk).** 11 nav items with 8 crammed into one undifferentiated "Analyze" group; four read-only screens that diagnose but dead-end instead of routing to an action (violating the product's own principle #1, "every screen ends in an action"); several screens that re-render the same `loadCockpit` data (Cockpit vs Media vs Funnel; Cockpit vs Action Center); persistent **dead "connect" affordances** (Shopify/GA4/Finance) with no connect path; and naming drift (Studio/creative-production/"Creative Studio"; Influencer Hunt/creators/influencer).

2. **Public-site conversion incoherence (highest business risk).** Three competing conversion destinations — `/book-demo`, `/signup`, `/waitlist` — and a Free tier that says "Start free, no card required" while the product is a private beta that drops the same user on a "access is by approval" waitlist immediately after signup. Plus label↔destination mismatches ("Read Now"/"View Case Study" → a signup form) and `/signup`+`/login` that are potentially indexable.

3. **Design-system drift + accessibility gaps (contained, spec already written).** Color is ~95% tokenized already; the drift is elsewhere: ~73% of font sizes are arbitrary px (23 distinct values, incl. `12.5px`/`13.5px`) instead of the DESIGN.md scale; 10 distinct radius values; ~224 hand-rolled card `<div>`s vs 5 `Card`-primitive imports; and 7 near-identical filter dropdowns that lack listbox keyboard nav + focus management (the broadest a11y gap), which DESIGN.md §7 already requires.

**What is genuinely strong and must be preserved:** UX-state handling is best-in-class — every `/app` route has a skeleton, empty states are centralized (`connect-state.tsx` with four honest reasons; `gated-section.tsx`), errors surface retry chips instead of vanishing, and the topbar filters are near-identical by construction. Semantic HTML is strong (exactly one clickable `<div>` in the whole tree, and it's an `aria-hidden` backdrop). A global `:focus-visible` ring and a skip link exist. The accent was already darkened to pass WCAG. None of this should be touched except to standardize it further.

**On the "99% bloat" objective:** honestly, this codebase is not 99% bloat. The avoidable, provable bloat is specific and finite: ~224 inline card divs → one `Card` primitive; 5 near-identical switcher implementations → one `<FilterPopover>`; a **dead brute-force-lockout login path** (server `login()` action imported nowhere — real login is client-side); 5 copy-pasted `readCookie` helpers; and the decoy connectors. Chasing a literal 99% would mean deleting working, staged foundations — which the brief explicitly forbids. I report the real bloat, not a number.

---

## 2. Current architecture (as-is)

- **Stack:** Next.js 16 App Router (RSC-first), Tailwind v4 CSS-first (`@theme inline` in `app/globals.css`; **no `tailwind.config.*`**), shadcn/ui "new-york" (`components.json`, 11 primitives in `components/ui/`), Supabase (RLS default-deny; service-role admin client does the real reads with app-level `user_id` scoping).
- **Surfaces:** public marketing site (12 routes), authenticated app (15 screens under `app/app/*`), auth (4 screens), 47 API routes.
- **Design intent:** fully specified in `DESIGN.md` + `docs/design/HANDOFF.md` + `docs/design/*.dc.html` artboards. The shipped app has partially converged.
- **State/data:** server components load through `lib/app/cockpit-data.ts` (`loadCockpit`) and per-feature stores; topbar scope lives in 7 `adbrain.*` cookies resolved by `resolveCockpitScope`.

---

## 3. Screen inventory (authenticated app)

| Route | Name | Primary goal | Ends in an action? | Notes / friction |
|---|---|---|---|---|
| `/app` | Cockpit | Read health + this week's plan | ✅ ActionList + Re-scan | 12+ stacked sections (mega-scroll); dead MER/nCAC "Connect Shopify" tile |
| `/app/action-center` | Actions | Work the ranked queue | ✅ | **Duplicates** Cockpit's ActionList (same `view.doThis` + JudgmentButtons) |
| `/app/creative` | Creative | Diagnose fatigue/diversity (5 tabs) | ~ (analysis) | Overlaps Cockpit fatigue + **Studio** |
| `/app/creative-production` | Studio | Generate static ads | ✅ (export) | Depends on Shopify (no connect path); 3 names for one screen |
| `/app/funnel` | Funnel | TOF/MOF/BOF leak diagnosis | ❌ dead-end | Re-renders Cockpit's FunnelCard; empty state has no action |
| `/app/media` | Media | Budget/Scaling + KPIs (2 tabs) | ❌ dead-end | Re-renders Cockpit ScalingCard + KPI cards (same `loadCockpit`) |
| `/app/changes` | Change Impact | Score buyer changes | ❌ dead-end | Overlaps Cockpit CulpritBanner |
| `/app/reconcile` | Reconcile | Explain AdScale-vs-Meta number diffs | ❌ dead-end | Specialized trust/debug screen at equal nav weight |
| `/app/market` | Market | Brand + competitors (4 tabs) | ~ (per-section) | **Activation-critical** Brand tab buried as tab 1 of 4 |
| `/app/creators` | Influencer Hunt | Creator shortlist | ✅ Run hunt | Nav label ≠ route; legacy `/app/influencer` redirects here |
| `/app/creators/[id]` | Creator profile | Evaluate + contact | ~ (mailto) | "No public email" dead-end |
| `/app/settings` | Settings | Connect/switch Meta; edit weights | ✅ | 4 decoy "Not connected" rows (Shopify/GA4/Finance/Creative) |
| `/app/admin` | Admin | Cost/ops/beta-access | n/a | Orphan by design (admin-only, URL-only — no in-app link even for admins) |
| `/app/growth` | Scout | Growth-agent console | ✅ (copy/publish) | Orphan by design (admin-only); a whole separate product in the same shell |
| `/app/influencer` | — | redirect → `/app/creators` | n/a | Legacy alias |

**Read-only dead-ends (diagnose, don't route to action):** Funnel, Media (KPIs), Change Impact, Reconcile — these break the product's own principle #1.

---

## 4. Navigation + IA problems

Single source: `lib/app/nav.ts` → 3 groups, 11 items. **8 of 11 sit in one "Analyze" group** with no sub-structure, diluting the core decide→act loop (Cockpit + Actions) with six specialized/read-only analytics screens at equal weight.

- **Duplicate/overlapping destinations:** Cockpit ⟷ Action Center (same queue twice); Creative ⟷ Studio (analysis vs generation, adjacent, near-identical names); Cockpit ⟷ Media ⟷ Funnel (same `loadCockpit` data re-rendered three ways).
- **Naming drift:** Studio / `creative-production` / "Creative Studio"; Influencer Hunt / `creators` / `influencer` — nav label ≠ route ≠ H1.
- **Dead affordances:** Shopify/GA4/Finance/Creative-decoder show "Not connected" on Cockpit (the MER/nCAC tile) and Settings with **no working connect path anywhere** — persistent decoys.
- **Onboarding:** two-step `OnboardingChecklist` (connect Meta → confirm brand). The Meta OAuth callback **auto-connects `accounts[0]`** with no multi-account picker (a stated follow-up) — an agency with many accounts silently gets the wrong one. This is lever #8 (time-to-first-insight).

---

## 5. Design-system audit — drift from an existing spec

`DESIGN.md` is the source of truth and is well-designed. The shipped app has drifted:

| Dimension | Spec (DESIGN.md) | Shipped reality | Verdict |
|---|---|---|---|
| Color tokens | 8 core + semantic | **~95% tokenized** (1959 `var(--)` refs) | ✅ converged; drift localized to `studio.tsx` (20 palette classes + 7 hex), `funnel-report.tsx` (12 hex), `notification-bell` (5 hex) |
| Type scale | h1 56–64/400 · h2 40/400 · h3 18–22/500 · body 15–18 · small 12–14 | **23 distinct arbitrary `text-[Npx]`** (incl. `12.5px`, `13.5px`); ~73% off-scale | ❌ biggest token gap; scale exists on paper, not exported as tokens |
| Radius | card 10px, pill 70px (two tokens exist) | **10 distinct `rounded-[Npx]`**; cards expressed ≥3 ways (`rounded-xl`, `rounded-[10px]`, `rounded-[var(--radius-card)]`) | ❌ shape lock not held |
| Weights | 400 (headlines) / 500 / 600 | constrained to 3 (+1 stray `font-bold`) | ✅ converged |
| Semantic tokens | Scale/Iterate/Kill ink-on-tint | defined in `:root` but **not exported to `@theme`** → forced arbitrary `bg-[var(--good-bg)]` everywhere | ⚠️ token plumbing gap |
| Primitives | Card / Pill button / Input | **~224 inline card divs vs 5 `Card` imports**; 49 raw `<button>` (28 in `studio.tsx`); 21 raw `<input>`; `Select` primitive bypassed | ❌ biggest structural duplication |
| Dark mode | not specified (light-only, deliberate) | light-only | ✅ intentional, not a defect |

**#1 offender file:** `components/app/creative-production/studio.tsx` — 28 raw buttons, 20 palette-color classes, 7 hex. It ignores the primitive layer and the token layer simultaneously.

---

## 6. Accessibility audit (against DESIGN.md §7's own floor)

**Strong baseline:** global `:focus-visible` ring (`globals.css:105`), skip link, near-perfect semantic HTML (one clickable div, an `aria-hidden` backdrop), `aria-pressed`/`aria-busy`/`aria-live` in places, WCAG-tuned accent.

**Gaps (all violate a floor DESIGN.md §7 already states):**
1. **Custom dropdowns lack listbox keyboard nav + focus trap/restore** — all 7 switchers + 3 `role="dialog"` popovers. Options are Tab-reachable but there's no arrow-key nav, no roving tabindex, no focus return to trigger on close; `brand-switcher.tsx:116`/`campaign-switcher.tsx:139` advertise `aria-haspopup="listbox"` over non-`option` children (ARIA role mismatch). **Broadest gap.**
2. **`demo-form.tsx` labels unassociated** (`:97–162`, bare `<label>`, no `htmlFor`) — SR won't announce fields; label-click won't focus. Inconsistent with the correct `auth-form.tsx`.
3. **All `<th>` missing `scope`** (0 hits across every table).
4. **`notification-bell` missing Escape** (only popover with outside-click but no Esc).
5. **Sub-44px tap targets** — date-picker arrows `h-7 w-7` (28px), day cells `h-8 w-8` (32px), 11px chips — DESIGN.md §7 requires ≥44px.
6. **Reduced-motion inconsistency** — raw `animate-pulse` in `page-skeleton`, `app/app/loading.tsx`, `connect-state` ignores `prefers-reduced-motion` (while `ui/skeleton` respects it).
7. **UNKNOWN:** measured contrast of `--good/warn/bad-ink` on their tints for 11px chip text — needs a contrast run to confirm/deny.

---

## 7. Responsive / mobile

Shell adapts correctly (hidden sidebar + hamburger `MobileNav` drawer reusing `SidebarNav`; Esc/backdrop/route-change close; body-scroll lock). Overflow is safe (tables `overflow-x-auto` + `min-w`; popovers `max-w-[85vw]`).

**Weak point:** the topbar's **7 filter switchers on `flex-wrap`** (`topbar.tsx:141`) collapse to ~4 rows of pills on a 375px screen, consuming most of the viewport before any content — no mobile consolidation (e.g. a single "Filters" sheet). Highest-impact mobile gap. Minor: `h-screen`/`min-h-screen` used where `100dvh` is used elsewhere (the codebase knows `dvh`).

---

## 8. Public site / conversion / UX writing

- **Three competing conversion paths:** `/book-demo` (dominant), `/signup` (Free tier, header, "Read Now"/"View Case Study"), `/waitlist` (post-login gate). The Free tier's "Start free, no card required" **contradicts** the private-beta approval gate the same user hits after signup.
- **Label↔destination mismatch:** "Read Now" and "View Case Study" both point at `/signup` (a form, not content).
- **Header** omits both "Book a demo" and "Product" despite them being the primary funnel.
- **Two contact emails:** `hello@adscaledigital.co` (footer) vs `rahul.arora@ekaleido.co` (waitlist).
- **Pricing:** 4 tiers, 3 CTA verbs, 2 destinations + 2 toggles + estimator + FAQ (Hick's-law load); only Growth is visually emphasized (good Von Restorff).
- **SEO gap:** `/signup` + `/login` have no `robots` meta and aren't covered by the `/auth` disallow → **potentially indexable.**
- **Claims to substantiate-or-remove (for Rahul; SOC 2 already removed):** the 6-brand logo wall, 4 named testimonials, "+38% / The Pant Project" case study, "Trusted by hundreds", "certified Meta Business & Technology Partner", "Backed by top D2C operators" — all hardcoded string arrays. _(Note: a peer chat is already handling DB hardening + removed SOC 2 per CHANGELOG; these claims remain your call.)_

---

## 9. Bloat / dead code (the honest list)

| Item | Evidence | Disposition |
|---|---|---|
| Dead brute-force lockout | server `login()` in `app/(auth)/actions.ts:15` imported nowhere; real login is client `signInWithPassword` | Remove the dead action, OR move login to the server action so the lockout actually protects it (security call) |
| ~224 inline card divs | vs 5 `Card` imports | Route through `Card` primitive |
| 5 near-identical switchers | `*-switcher.tsx` share `control-styles.ts` + copy-pasted `readCookie` | Consolidate into one `<FilterPopover>` |
| Decoy connectors | Shopify/GA4/Finance rows, MER/nCAC tile — no connect path | Remove OR make honest ("coming soon") |
| `studio.tsx` off-system | 28 raw buttons, 20 palette classes, 7 hex | Migrate to primitives + tokens |

Not bloat (do not delete): the 28 staged `lib/` foundations with self-checks, the durable queue, account-deletion foundation — the brief forbids deleting working functionality.

---

## 10. Recommended design-system architecture (converge to DESIGN.md)

```
Design tokens (globals.css @theme)
  + ADD: type scale utilities (--text-xs..--text-6xl mapped from the 23 px values to DESIGN.md's scale)
  + ADD: radius scale (collapse 10 values → card 10px / pill 70px / sm 6px, all as tokens)
  + EXPORT: --good/warn/bad as first-class utilities (kills the arbitrary [var(--)] usage)
        ↓
Primitive components (components/ui/*)  — already exist, extend: Table (with scope), FilterPopover (a11y)
        ↓
Base app patterns (components/app/_patterns)
  - <FilterPopover>   (one component replaces 7 switchers; listbox keyboard + focus mgmt)
  - <SectionCard>     (one component replaces ~224 inline card divs)
  - <StatTile>        (KPI tiles + the ConfidenceTrace from intelligence's lever #10)
  - <DataTable>       (scope-correct headers, optional sort)
  - EmptyState = connect-state / gated-section (already shared — keep)
        ↓
Feature components → Page sections → Pages → Flows
```

This is not a redesign — every token value and component spec above is **already written in `DESIGN.md`**. The work is exporting the scale as tokens and routing the ~224 cards / 7 switchers / raw buttons through primitives.

---

## 11. Prioritized roadmap

**P0 (do first — business/security/a11y risk, small):**
- Resolve the conversion-model contradiction (Free-signup vs demo vs waitlist) — **needs your decision** (§13).
- `noindex` on `/signup` + `/login`.
- `demo-form.tsx` label association.
- Dropdown keyboard nav + focus management via a single `<FilterPopover>` (fixes the broadest a11y gap and the biggest duplication together).

**P1 (high — the core-product levers):**
- IA regroup: Decide (Cockpit, Actions) / Create (Creative, Studio) / Diagnose (Funnel, Media, Change, Reconcile) / Grow (Market, Influencer) / Manage (Settings) — and route the 4 read-only screens back to an action. **Some of this needs your call** (§13).
- Export the type scale + radius scale as tokens (converge to DESIGN.md §3/§4).
- Onboarding: Meta multi-account picker + reduce signup friction (lever #8).
- Naming: pick one name per feature.

**P2 (medium):**
- Route ~224 inline cards through `SectionCard`; adopt `Button`/`Input`/`Select` primitives.
- Mobile: consolidate the 7 topbar filters into a "Filters" sheet; `dvh`.
- `<th scope>`; `notification-bell` Esc; tap targets ≥44px; reduced-motion guard; measure chip contrast.

**P3 (low):**
- `studio.tsx` token/primitive migration; remove/repair the dead login action; honest-or-gone decoy connectors; dedupe `readCookie`.

---

## 12. Phased execution plan (each phase: build → `tsc`/`build`/`check:*` green → live-verify → commit; claim shared files in WIP first)

- **Phase 0 — Baseline:** this audit. ✅
- **Phase 1 — Tokens:** add type + radius scale + export semantic tokens to `@theme`; add `check:design-tokens`. Non-breaking (add, then migrate). Touches `globals.css` (shared — will claim in WIP, ping peers).
- **Phase 2 — Core components:** `<FilterPopover>` (a11y) replacing 7 switchers; `SectionCard`; `DataTable` with `scope`. Biggest single lever.
- **Phase 3 — Nav + IA:** regroup nav, fix naming, route dead-ends to actions, resolve decoy connectors. _(gated on §13 decisions)_
- **Phase 4 — Onboarding + Cockpit density:** multi-account picker, signup friction, progressive disclosure of the 12-section cockpit.
- **Phase 5 — Website conversion:** one coherent CTA model, fix label↔destination, header, pricing verbs, `/signup`+`/login` noindex. _(gated on §13)_
- **Phase 6 — Forms/tables/filters, then Phase 7 Mobile, Phase 8 A11y sweep, Phase 9 Cleanup, Phase 10 Consistency regression.**

Performance was already addressed in today's earlier Phase-0 perf work (changes/funnel caching, parallel paging, bundle trim) — not re-litigated here.

---

## 13. Decisions only you can make (execution is blocked on these)

1. **Conversion model — pick ONE story:** (a) self-serve free signup, (b) demo-led sales, or (c) private-beta-by-approval. The site currently promises all three, and Free-tier "no card required" contradicts the waitlist gate. This decides pricing CTAs, the header, and whether `/signup` stays public.
2. **Read-only diagnostic screens (Funnel / Media / Change / Reconcile):** keep as separate nav items, or fold into Cockpit/Actions as drill-ins? (Merging = removing nav destinations.)
3. **Decoy connectors (Shopify / GA4 / Finance):** remove the "Not connected" rows + MER/nCAC tile now, or keep them as an honest "coming soon" with a waitlist?
4. **Social-proof claims:** substantiate or remove the logo wall, testimonials, "+38%", "trusted by hundreds", "certified Meta Partner", "Backed by top D2C operators"?
5. **Naming:** confirm one name per feature — "Studio" (not creative-production), "Influencer Hunt" (route to match).

I will not touch any code until you approve the plan and rule on the items above.
