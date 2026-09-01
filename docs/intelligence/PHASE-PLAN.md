# AdScale — Phase Plan (finite phases, finish lines)
**Date:** 2026-09-01 · Supersedes any earlier draft. Priority order per charter §158: **P0 correctness/security/data-integrity → P1 high-₹ diagnosis → P2 perf/scale → P3 sophistication.** Deliverable #19.

Each phase states START / SCOPE / OUTPUT / TESTS / LIVE-TEST / SUCCESS / STOP (§157). No phase is "endless." Every code change runs the full #1 loop and lands GREEN on the release gate (`RELEASE-VERIFY.md`).

---

## PHASE 0 — DISCOVERY ✅ COMPLETE (this session)
- **Output:** the 20 audit deliverables — `AUDIT-2026-09.md`, `SYSTEM-MAP.md`, `BUSINESS-LOGIC.md`, `FORMULA-LIBRARY.md`, `FAILURE-MODES.md`, `TECH-DEBT.md`, `500-LOGIC-INVENTORY.md`, `audit-parts/*`, this plan, `RELEASE-VERIFY.md`, `UNKNOWN-LIBRARY.md`.
- **SUCCESS:** every subsystem audited with file:line evidence, docs reconciled MATCH/DRIFT/UNKNOWN, 505 candidate logics inventoried. **STOP:** reached — awaiting Rahul's review before Phase 1 code.

## PHASE 1 — CORRECTNESS (P0/P1) — the review gate is here
Fix wrong numbers / wrong classifications / dead guardrails. **Nothing in this phase adds a feature; it makes existing outputs trustworthy.** Batches (each self-contained, live-verified before the next):

- **1A — Trust the headline + data-quality.** Flag (never silently swap) the headline ROAS/spend on scope-call failure [P0-1]. Make the wired DQ engine see missing-days/dupes/stale (merge the dead `lib/data-quality.ts` gate into the live path; delete the orphan after) [P1-3]. Wire sync-staleness into confidence. LIVE-TEST: a partial-day account shows a real DQ warning + the headline never changes number without a flag.
- **1B — Account-relative scoring.** Replace hard-coded `roasToScore 0.5` / `ctrToScore 0.015` with account/objective-relative baselines (external benchmark = prior only, §18) [P1-4]. Unify the three conversion floors into one sourced, objective-aware sufficiency gate; kill the 1M awareness floor [P1-5]. Volume-gate `trendScore` and `percentile`; wire `accountMedian.minAds` [P1-6,7]. **SHADOW-MODE** the new Account Health vs old (§75), compare on golden accounts, promote only after review.
- **1C — Wire the built-but-dead guardrails.** Call `decodeConfidenceFloor` before decode feeds diversity/production [P1-8]; wire the financial honesty-gate (`validateStrategistOutput`) into the live strategist path [P1-10]; route `decodeCreativeVisual` through the AI router so kill-switch + budget apply [P1-11]. De-duplicate the Account-Health waste double-count [P1-9].
- **1D — Diversity + reconciliation semantics.** Split `strategic` vs `executional` vs `effective` (spend-weighted) diversity into distinct scores [P1-12]. Define metric semantics (currency/tz/attribution) and add a reconciliation confidence downgrade [P1-13].
- **SUCCESS:** golden-account fixtures (§76/§77) prove each fixed score; 0 hard-coded universal benchmarks in scored numbers; every guardrail has a live caller. **STOP:** all P0/P1 register items closed + live-verified.

## PHASE 2 — DIAGNOSTICS
Deepen health/bleed/funnel/fatigue/half-life/winner-loser to the charter's decomposed, censoring-aware, counterfactual standard (§21-46). Fatigue state machine (§29), half-life censoring (§32), bleed counterfactual + decomposition (§24/§25), funnel largest-*meaningful*-leak (§45). Each score decomposes (§90) and carries confidence.

## PHASE 3 — DECISION INTELLIGENCE
2nd/3rd-order reasoning, portfolio fragility score (§36), next-creative engine (§42), the DATA→…→LEARNING chain surfaced in the UI (§120-127 drill-downs).

## PHASE 4 — LEARNING
decision→action→outcome→learning loop + FP/FN tracking (§113-115), golden-decision library.

## PHASE 5 — SCALE
Precompute per-ad daily rollup / cockpit snapshot during sync (kills P2-16, the first thing to break at 3k ads); durable queue (`lib/queue.ts` is stubbed); cron fan-out; cache stampede + TTL fixes (§83-87, §147-151).

## PHASE 6 — CROSS-PLATFORM
Canonical source-agnostic business objects; Google (adapter is TODO-stub today) / Shopify / Triple-Whale adapters; cross-source reconciliation (§56-60).

## PHASE 7 — ADVANCED
Forecasting, incrementality, budget/cross-channel optimization — only after foundations proven.

---

## 500-LOGIC build-set selection (deliverable #18; §101/§159 — discovery ≠ build)
From 505 candidates (77 exist / 151 partial / 277 net-new). **We build a justified subset, not 500.**
- **BUILD NOW (Phase 1-2, evidence A/B, high ₹, low cost):** fix the existing scored logics above; L100/L101 largest-meaningful-funnel-leak + cause; account-relative baselines as a shared primitive.
- **BUILD NEXT (Phase 2-3, needs Shopify/margin):** L254 contribution-margin ROAS · L253 nCAC · L279 refund-adjusted ROAS · L257/L258 LTV:CAC + payback · L262 contribution-negative alert · L273/L274 stockout/OOS-ad guard.
- **SHADOW (§75):** new Account-Health, new fatigue state machine — run beside old, compare, promote on review.
- **RESEARCH (evidence D):** L241 geo-holdout incrementality · forecasting family · L163/L381 platform-vs-Shopify attribution gap.
- **DEFER:** cross-channel budget optimization; advanced predictive.
- **REJECT as hard rules:** any C/D logic shipped as deterministic truth (charter §15) — these stay hypotheses in the inventory until account data validates them.
