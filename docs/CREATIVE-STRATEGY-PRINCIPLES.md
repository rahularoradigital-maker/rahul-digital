# Creative Strategy & Paid-Ads Principles (AdBrain canon)

> AdBrain's own, name-free distillation of how a top media buyer builds and scales paid social — the
> generic, industry-standard principles, not any one agency's branded "system." Rule: capture the
> *principle*, map it to where it grounds in the product, and never invent a number. Concrete thresholds
> live (and are graded) in [FORMULA-RIGOR-AUDIT.md](./FORMULA-RIGOR-AUDIT.md); this doc is the methodology
> those formulas serve.

## The mindset
Treat ads as a **research problem you solve**, not creative you post and hope. Every ad grounded in the
real reason a customer buys lowers acquisition cost; every ad that copies a competitor or chases
"engagement" teaches the algorithm nothing. AdBrain's job is to make each recommendation trace to a real
reason, with an evidence tag — never a vanity metric or a guess.

## The pipeline (research → creative → build → scale → report)

| Stage | Principle (name-free) | Where it grounds in AdBrain | Rigor note |
|---|---|---|---|
| **1. Customer desire triggers** | Find the *real* reason people buy (desire, fear, identity), not features. Ads built on this acquire cheaper. | Brand Brain / persona / ICP (Market). Feeds concept `audienceNeed`. | Grounded in the brand's own data + research; never assumed. |
| **2. Competitor read** | Start from proven ground: read what's actually running in the market, don't imitate blindly. | Market → competitor ads (Meta Ad Library). Feeds `creativeWhiteSpace`. | Real ads only; no fabricated competitor data. |
| **3. Angles** | Turn research into *distinct reasons to buy* — one asset per angle, not one ad reworded. | Concept generation (Studio) — one concept per angle. | Angles must cite the desire trigger they serve. |
| **4. Hooks** | The first second earns the next. A weak hook wastes the whole spend. | Concept hooks; measured by **thumb-stop rate** (3s views / impressions). | Thumb-stop is a real funnel ratio, guarded (null on 0 impressions). |
| **5. Creative briefs** | An angle+hook must become something shootable in a day — concrete, not abstract. | Studio briefs (deterministic brief → compose). | Brief is deterministic + hashed (idempotent, no re-bill). |
| **6. Copy** | Sell without sounding like an ad; copy carries the angle, not adjectives. | Concept copy (grounded LLM pass on the brief). | Copy is generated on the brief only; never fabricated claims. |
| **7. Campaign build** | Structure must fit the account's spend and margins — not a template. | Campaign/ad-set structure read (Cockpit hierarchy). | Read off the account's real structure. |
| **8. Landing page** | The click becomes a customer *on the page*; a leak there wastes upstream spend. | Funnel metrics: **LP-view rate → ATC → checkout → purchase**. | Every ratio guarded (null on 0 denominator), never a false floor. |
| **9. Retargeting** | Warm audiences are not one audience — different message per intent stage. | Retargeting segmentation (planned). | Segment by real behaviour, not assumed personas. |
| **10. Scaling** | Raise spend without watching margin disappear — respect diminishing returns. | **Marginal-ROAS / diminishing-returns fit** + the **statistical-sufficiency gate**. | Grounded: elasticity fit needs ≥5 valid days; never scale on thin volume. |
| **11. Reporting** | Know exactly what to scale and what to kill — decisions, not dashboards. | The **decision engine** (scale/refresh/pause/hold), self-baselined + volume-gated. | Both absolute AND account-relative must agree (audit #1, #3). |

## The overlay that makes it AdBrain (not a playbook PDF)
1. **Every number carries an evidence tag** (A/B/C/Judgement) — a judgement never masquerades as a platform fact.
2. **Nothing is assumed** — a principle without data behind it is flagged, not shipped as a formula (see the audit's 🔴 items).
3. **Self-baselined** — judge each ad/creative against the account's *own* 90-day history, not absolute magic numbers.
4. **Statistical sufficiency first** — no scale/kill until the ad has the volume to be real.

## What is deliberately NOT here
No competitor/agency names, no branded "system," no verbatim third-party copy, and no numbers we can't
defend. External frameworks are distilled to their generic principle and grounded in AdBrain's own data —
never hard-coded as someone else's IP.

*Created 2026-08-30. Update this when a principle becomes a shipped, grounded formula (cross-link the audit row).*
