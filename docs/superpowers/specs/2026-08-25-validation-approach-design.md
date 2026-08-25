# Validation Approach — Design

**Date:** 2026-08-25
**Status:** Approved design, ready for implementation planning
**Why:** Four analyses (strategy canvas, opportunity analysis, tech-debt register, testing
strategy) converged on one point: the entire cockpit build is a bet that AdBrain's
recommendations are correct AND non-obvious, and that bet is untested. This validates it.

## Goal
Prove the recommendations are good enough to justify building the full cockpit — or find out
cheaply that the heuristics need rework first.

## Constraint accepted by the owner
Backtest data comes from the real Meta API (not a manual CSV export). So validation waits behind
the Meta OAuth + sync build (V0). Tradeoff: not the cheapest path, but it builds the connection we
need anyway and uses real API-pulled data.

## Sequence

### V0 — Data access (build)
Meta OAuth connect + historical metrics sync (ADR-0002 + ADR-0003 action items). Pull one real
account's daily ad-level metrics into `ad_metrics` (spend, impressions, clicks, purchases, revenue,
frequency, by ad, by day). This is the OAuth build; it also feeds the backtest.
- Minimum data: an account with >= ~30 days of history and several ads, or the backtest is thin.

### V1 — Rules backtest (held-out accuracy)
A harness (`scripts/backtest.ts`) using the built rules engine (`lib/rules/`):
1. **Self-test first:** run the harness on SYNTHETIC data with known outcomes to prove the
   time-split + scoring logic is correct (`scripts/check-backtest.ts`, PASS gate) BEFORE trusting
   it on the real account.
2. **Time-split:** for each ad, cut history at date T (T = latest minus 7-14 days). Compute
   `fatigue` / `wasteForAd` / the will-break signal using ONLY data <= T.
3. **Verify vs held-out actuals** in (T, T+7]: did a "will break" / "past half life" call actually
   come true (the metric degraded past threshold)? Record hit / false-positive / false-negative.
4. **Report:** per-account accuracy, precision/recall on the "will break" calls, and a simple
   calibration view (predicted vs actual).
- **Pass bar:** >= 70% of "will break" calls correct on held-out data (tune per account size).
  Below that → the fatigue/will-break heuristics need rework before more build.

### V2 — Expert check
A media buyer (owner or hired) reviews the recommendations the rules + Strategist produce for the
real account and rates each: correct/incorrect AND obvious/non-obvious (a rating sheet template is
the only artifact).
- **Pass bar:** >= 80% judged correct AND a meaningful share judged non-obvious ("I would not have
  caught that"). Obviousness matters — correct-but-obvious calls do not justify the product.

### V3 — Concierge test (only if V1 + V2 pass)
For 3-5 real D2C accounts, hand-produce the full cockpit verdict + do-this queue (via the pipeline
or semi-manually). Measure: do owners agree, would they act, would they pay?
- **Success:** enough owners find it worth acting on / paying for → the whole value prop is validated.

## Components
- **Reuse:** `lib/rules/` (built + tested), `lib/prompts/strategist.ts` + `lib/validator.ts`
  (built + tested), `ad_metrics` schema, the Meta sync (V0, to build).
- **New:** `scripts/backtest.ts` (time-split runner + scorer), `scripts/check-backtest.ts`
  (synthetic self-test), a backtest report format, an expert-rating sheet template.

## Data flow
OAuth (V0) → sync history → `backtest.ts` reads `ad_metrics` → time-split per ad → rules
predictions vs held-out actuals → accuracy report (V1) → recommendations reviewed by a buyer (V2)
→ concierge with real owners (V3).

## Error handling / edge cases
- Accounts with < minimum history → cannot backtest; report "insufficient data", do not fabricate
  a pass. (Mirrors the rules engine's own insufficient-data contract.)
- Ads with no variance / too few days → skipped, counted as skipped (no silent drop).
- The harness must never count an ad it lacked data for as a "correct" prediction.

## Testing
- The backtest harness is validated on synthetic data first (V1 step 1) — test the tester before
  trusting its numbers. This is itself a runnable check.

## Overall gate
V1 held-out accuracy >= bar AND V2 expert agreement >= bar → build the full cockpit with
confidence. Otherwise → rework the heuristics first. This is the decision the whole exercise
exists to inform.

## Out of scope
- Validating the AI *creative* concepts (V3 territory / later).
- Google Ads data (Meta-first, matching the product).
- A statistically rigorous study — this is a directional founder-grade validation, not a paper.
