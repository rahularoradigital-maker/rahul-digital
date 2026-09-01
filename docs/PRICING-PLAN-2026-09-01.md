# AdBrain pricing & metering — the plan (phased)

Your ask: Free (50 tokens, must cost us ≤ ₹100/user) + $99 / $399 / $999 where higher tiers just add more
tokens. This plan grounds that in (a) real cost from our code and (b) research across ~15 recent sources
(Metronome, Stripe, Orb, Kyle Poyar/OpenView, Flexprice, Lago, freemium benchmarks). Built to ship in phases.

---

## 0. The one decision that controls everything: what is a "token"?

The research is blunt on the biggest pitfall: **credits customers can't map to a real outcome erode trust**
("our finance team likes it, our customers don't know what a credit does"). The fix: make the unit map to a
value moment the customer recognizes AND that tracks our cost.

**Recommendation — a two-layer model that keeps your exact numbers:**
- The billable unit stays a **token** (your word, your "50 free / more per tier" structure — unchanged).
- But **one AdBrain "Analysis"** (a scale/refresh/kill decision on an ad account) is what a token buys, and we
  **always translate on the page**: *"50 tokens ≈ ~7 ad-account analyses/month."* Tokens for billing, analyses
  for humans. This honors your model and dodges the "opaque credit" trap.
- **Account syncs and dashboard views are FREE / unmetered.** Only the *AI decision* burns tokens. Metering a
  sync would punish exactly what we want (connecting accounts, checking often) and it's our infra cost, not the
  product's value.

Working assumption to pin in Phase 0: **1 Analysis ≈ 7 tokens** (tunable once we measure real cost).

---

## 1. Cost model — proving Free ≤ ₹100 (the hard constraint)

From our own code (`lib/ai/token-pricing.ts`): text AI runs on **Gemini flash-lite = $0.10 per 1M input
tokens, $0.40 per 1M output**. Meta/Google API calls are free.

- A text Analysis makes a handful of flash-lite calls → **roughly ₹0.10–₹2 in list-price AI** (Phase 0 measures
  the exact figure on live runs; this is an estimate).
- Free = 50 tokens ≈ ~7 analyses → **~₹1–₹15 per free user in the worst realistic case.** Comfortably under
  ₹100. Your ceiling is met with big headroom.
- **The one rule that guarantees it:** free tokens run **text analyses only — never AI image generation.**
  Image gen (Nano Banana Pro ≈ $1.25/1M + vision) is 10–50× a text analysis; a single image on the free tier
  could blow past ₹100 alone. So image/creative generation is a **paid-tier capability**, never free.

Net: your "50 free ≤ ₹100" is safe **by construction** — bounded text-only analyses + no free image gen.

---

## 2. Tier structure (this is already a "hybrid" model — the 2026 default)

Platform fee + included tokens + overage. Research: hybrid is the single most common structure (Poyar: 37%
primary) and posts the highest median growth (21%). Yours already is hybrid — we just make overage explicit.

| Tier | Price/mo | Included tokens | ≈ Analyses/mo | ~ per-analysis | Image gen? |
|---|---|---|---|---|---|
| **Free** | ₹0 | 50 | ~7 | — | No (text only) |
| **Starter** | $99 | ~1,500 | ~200 | baseline | Yes |
| **Growth** ⭐ Most Popular | $399 | ~7,500 | ~1,000 | ~20% cheaper | Yes |
| **Scale** | $999 | ~25,000 | ~3,500 | ~33% cheaper | Yes |

- **Token counts grow faster than price** (2.5× the price from Growth→Scale gives ~3.3× the tokens) so the value
  story improves as you climb — this is what pulls buyers up. Per-token price *falls* at higher tiers (volume
  discount), which the research says rewards expansion. *(Numbers illustrative — set against measured cost + margin
  in Phase 0.)*
- **Overage:** when tokens run out, default to a **soft cap + upgrade prompt** (best for SMB trust), with
  **opt-in** pay-as-you-go overage at ~the Starter per-token rate, so heavy users are nudged to upgrade, not
  camped on overage. No silent bill shock.
- **Annual toggle, defaulting to annual, at ~15–20% off, showing the ₹/$ saved** — research calls this the
  single highest-ROI element on a pricing page (~25–30% higher revenue per customer).

⚠️ **Honest flag (research + devil's advocate):** "all tiers identical, just more tokens" ships fast but is the
model teams later evolve away from — there's no lever to pull buyers up except running out. Fine for v1. Plan to
add **1–2 genuinely tier-gated capabilities later** (e.g. number of connected accounts, refresh cadence,
agency multi-user seats, API access). Not now — just on the roadmap.

---

## 3. The phases (divided, shippable, low-risk first)

**Phase 0 — Define + measure (before any building).**
Pin what 1 token buys, instrument real per-analysis cost on live runs (replace the estimate with a measured
number), decide reset/rollover/expiry, decide display currency. Output: the final tier numbers. *No user-facing
change.*

**Phase 1 — The pricing PAGE (static, no billing). Ships first, low risk.**
A `/pricing` page: Free + 3 paid tiers, ⭐ on Growth, annual toggle (default annual, show savings), the
token→analyses translation on every tier, a short FAQ ("what's a token / what happens when I run out / do they
roll over / what's overage"), and social proof. Buttons go to sign-up / book-demo. **I can build this now** — no
Stripe needed. Header/footer already link structure exists.

**Phase 2 — Metering + enforcement (backend, the real work).**
A per-user token ledger (increment on each Analysis, monthly reset), a hard/soft cap with an upgrade prompt at
zero, a **live usage meter** in the app, and threshold alerts at 50 / 80 / 100%. Free tier blocked from image
gen here. This is what makes the tiers real.

**Phase 3 — Billing (needs your Stripe account).**
Stripe subscriptions for the 3 paid tiers. Note: Stripe retired the old Usage Records API (since
`2025-03-31.basil`) — metered billing now needs a **Meter + Credit Grants**, which is what we'd use for overage
and prepaid top-ups. Plus dunning (failed-payment retries — recovers a meaningful share of would-be churn),
proration on mid-cycle upgrades, and tax. **Don't hand-build metering** — start on native Stripe; only graduate
to Orb/Metronome/Lago if complexity later demands it.

**Phase 4 — Convert + polish.**
Upgrade nudges at ~80% usage, a "which plan fits me?" estimator, cost previews before expensive actions,
annual-savings emphasis, trust copy.

---

## 4. Decisions only you can make (these set Phase 0/1)

1. **Token model:** confirm "token = billing unit, 1 Analysis ≈ ~7 tokens, always shown as ≈ analyses." (Recommended.)
2. **Free size:** 50 tokens is affordable (≤ ₹100 ✓). Research suggests free should be "enough for the aha, not
   to run a business" (~a handful of analyses) — 50 tokens ≈ ~7 analyses fits that. Keep 50, or change?
3. **Display currency:** tiers are in $ but your cost ceiling is in ₹. Show $ only, ₹ only, or both / geo-based?
   (India-heavy audience may convert better in ₹.)
4. **Overage:** soft cap + upgrade prompt + opt-in pay-as-you-go (recommended), or hard stop only?
5. **Rollover/expiry:** monthly-included tokens reset each month (use-it-or-lose-it, clearly stated) is the
   simple, honest default. OK?
6. **Stripe:** you'll need to create/authorize a Stripe account for Phase 3 (I can't create accounts).

---

## 🔎 Devil's advocate on this plan
- ❌❌❌ **The per-analysis cost is still an estimate.** If one Analysis secretly fans out into many AI calls
  (judgment + narration + decode + …), ₹2/analysis could be optimistic and 50 free tokens could creep toward
  the ₹100 ceiling. **Phase 0 measures a real run before we commit the free size** — we do not design the free
  tier on my guess.
- ❌❌❌ **"Just more tokens" gives no reason to jump tiers except running out.** Shippable for v1, but margin and
  upgrade pressure both suffer long-term. Roadmap a real tier-gated capability (accounts / cadence / seats / API).
- ❌❌❌ **Metered pricing scares SMBs (bill shock).** Our included-tokens + caps + alerts model prevents most of
  it, but the FAQ, the live meter, and cost previews are not optional polish — they're the difference between
  trust and churn. They must ship with Phase 2, not "later."
- ❌ **USD tiers + ₹ cost ceiling = FX risk.** A rupee crash raises our real cost against a fixed $ price. Minor at
  this scale, but the display-currency decision (#3) should be deliberate.
- ❌ **We have no pricing/positioning proof yet.** These tier numbers are a starting hypothesis, not validated —
  expect to tune them after real signups, not treat them as final.

---

## What I'll do next
Once you answer the decisions above (especially #1–3, which change the page), I'll build **Phase 1 (the static
pricing page)** — it's low-risk, needs no Stripe, and gives you something to look at and react to. Phases 2–3
follow after, with Phase 3 waiting on your Stripe account.
