# 03 — Verdict

## REDESIGN — 15/30

**The cockpit's product logic and information architecture are sound, but its presentation layer fails five of ten principles at once (aesthetic, understandable, honest, thorough, little-design), which is a system-level design failure, not a one-screen blemish — so the design layer should be rebuilt from a single explicit system rather than patched.**

**Why redesign, not refine:** total is 15 (below the 20 REFINE floor), and the five 1-scores are not isolated — they share one root cause: there is no enforced design system. Spacing, type, and radius are each expressed three or four ways; chrome (personas, dual "Live", dead KPI cards, a fake search box) accretes because nothing says "less"; states and accessibility were never completed. Refining one card at a time cannot fix a missing system; it just moves the inconsistency around.

**Scope (important):** this is a redesign of the **presentation/design layer only**. The IA (the 10-section decision flow), the server-rendered data path, the deterministic scoring engines, and the honest data framing are strong and must be **preserved**. Nothing about the Meta pull, the rules engines, or the "ship this week" task model is in question.

## Top 5 highest-leverage moves (each → principle + evidence)

1. **One design system, enforced (#3, #10).** Collapse to a single scale: one card-padding token (kill the 16/20/22/24px mix), one type ramp (kill the 8 bespoke `text-[Npx]`, dedupe `text-xl`/`text-[20px]`), one radius rule (use `--radius-card`/`--radius-pill`, delete `rounded-[70px]` literals and `rounded-full`-as-pill). Evidence: Visual §1,2,4; Structural §3.
2. **Honest chrome (#6, #4).** Remove the "Adam · Ranker" fake-agent badge; make "Ask AdBrain" either functional or a clearly-disabled "coming soon" (not a live-looking search); rename "Live" to "Real account data · synced <time>"; plain-language the jargon (MER → "Marketing efficiency", nCAC → "Cost per new customer", `insufficient_data` → "Not enough data"). Evidence: Copy §2,4,5.
3. **Accessibility floor (#8).** Darken `--accent` for text use (fails 4.5:1 at ~3.5:1); add a `focus-visible` ring to every control incl. `AdLink` and the Ask input; close dropdowns on `Escape`; add a skip-link and `aria-label` the two `<nav>` landmarks. Evidence: A11y §1,2,3,4,5.
4. **Finish the states (#8).** Add an app-level `error.tsx` boundary; add a success confirmation on Re-scan / date change; standardize the disabled opacity (currently 40/50/60). Evidence: Visual §5.
5. **Cut the decoy surface (#2, #10).** Replace the two permanently-dead MER/nCAC KPI cards with a single "Connect Shopify to unlock MER & nCAC" affordance; drop one of the two "Live" indicators. Evidence: Weight §5; Structural §4.
