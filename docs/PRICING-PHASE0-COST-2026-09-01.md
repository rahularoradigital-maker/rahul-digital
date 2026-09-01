# Pricing Phase 0 — measured cost + token spec

Goal of Phase 0: replace my per-analysis *estimate* with a *measured* number, and define exactly what a token
costs us so the tiers are provably profitable and Free stays ≤ ₹100/user. Measured from the live `ai_usage`
and `cp_generations` tables (our own instrumentation) on 2026-09-01.

## 1. What the data actually says

| Action | Model | Measured cost/action | ≈ ₹ (@ ₹84/$) |
|---|---|---|---|
| **Account analysis** (judge all ads + 1 narration) | Gemini flash | ~$0.0001–0.0005 | **₹0.01–0.04** |
| **Creative copy / concept** | GPT-4o | $0.0099 | ₹0.83 |
| **AI image generation** | Nano Banana Pro / image models | $0.069 avg, **$0.134 max** | **₹5.8–11.3** |

**The key finding that changes the plan:** the *analysis itself is essentially free* — the scale/refresh/kill
decision is computed by a deterministic engine (the judgment code's own note: "The MATH decides… the AI layer
only explains"), so one full analysis makes just **one** cheap narration call. The cost that actually matters is
**image generation — ~150× an analysis.** My earlier "₹2 per analysis" estimate was ~50× too high.

**Consequence:** metering analyses barely affects our costs; **what must be metered to protect margin is image
generation.** A naïve "1 token = 1 of anything" model would lose money badly — e.g. a $999 user generating
25,000 images would cost us ~₹145,000 (a huge loss). Tokens have to be **weighted by real cost.**

## 2. The token spec (measured-justified)

**1 token = 1 standard AI action.** Weighted so the expensive actions cost more tokens:

| Action | Tokens | Why (cost basis) |
|---|---|---|
| Analysis / decision / explanation / chat answer | **1 token** | ₹0.04 — trivial |
| Creative copy / concept generation | **2 tokens** | ₹0.83 |
| **AI image generation** | **20 tokens** | ₹5.8–11.3 — the cost driver |

## 3. Margins at these weights (worst case = user spends everything on images, at MAX image cost)

| Tier | Price | Tokens | Max images (÷20) | Worst-case COGS | Gross margin |
|---|---|---|---|---|---|
| Free | ₹0 | 50 | 0 (no image gen) | ~₹2 (50 analyses) | n/a — cost ≤ ₹2 |
| Starter | $99 | 1,500 | 75 | ~$10 | **~90%** |
| Growth | $399 | 7,500 | 375 | ~$50 | **~87%** |
| Scale | $999 | 25,000 | 1,250 | ~$167 | **~83%** |

Every paid tier stays **≥ 83% gross margin even if the user does nothing but generate images at the most
expensive model.** On realistic mixed usage, margins are 95%+. The model is financially safe.

## 4. Free ≤ ₹100 — proven, not estimated

Free = 50 tokens, **decisions/chat only, no creative generation.** 50 analyses × ₹0.04 = **~₹2 per free user**,
worst case. That is **₹98 under your ceiling** — even 1,000 free users cost ~₹2,000/month total. Excluding image
generation from Free is the one rule that guarantees this; with it, Free is essentially free to us.

## 5. What this changes on the pricing page (honesty fix)

My Phase-1 page said "a full analysis uses about 7 tokens" — the measurement shows an analysis is **one** cheap
action, so the honest mapping is **1 token = 1 analysis.** Fixing the page:
- Free: **50 tokens ≈ 50 analyses** (was mis-labeled ~7).
- Paid tiers: token count stays the hero; value described as "analyses + creative generation" (a raw
  "25,000 analyses" number is meaningless — the real scarcity on paid tiers is image generation).
- Footnote/FAQ corrected to: 1 token = 1 AI action; image generation uses ~20 tokens.

## 6. One decision for you (it's a funnel call, not a cost one)

At the honest 1:1 mapping, **Free = 50 analyses/month** — more generous than the ~7 I first showed. It still
costs us ~₹2 and still can't touch image generation. Options:
- **Keep 50** (your stated number) — a strong free taste; converts on *volume + creative*, not on starving
  analyses. Recommended, and honors what you said.
- **Tighten** (e.g. 15 analyses free) — pushes to paid sooner. Cost is irrelevant either way; this is purely
  how hard you want the funnel to squeeze.

## 7. Still to pin (Phase 2 will enforce these)
- Reset: monthly, no rollover (simple, stated) — confirm.
- Overage when tokens run out: soft cap + upgrade prompt (recommended) — confirm.
- The exact image-token weight (20) should be re-checked once the final image model is locked, since Nano Banana
  Pro pricing is the cost anchor.
