# Phase 0 Audit — #4 Business-Logic Map + #5 Formula Inventory + #6 Decision Inventory (READ-ONLY)

## How the numbers flow
Real daily Meta rows → `lib/scoring.ts::toCockpitInputs` (per-ad sub-scores, deterministic, account-relative) →
`lib/cockpit/analyze.ts::analyzeAccount` runs THREE parallel verdict layers on the same ad: (1) verdict engine
`lib/rules/verdict.ts` (conversion, CreativeScore + causality ladder), (2) objective-aware decision engine
`lib/scoring/decision.ts` (awareness), (3) Triple-Label Judge `lib/judgment/engine.ts`+`agent.ts` (traced to the
1,061-rule corpus). Fatigue/winner/opportunity/funnel/marginal/culprit/change-impact are separate deterministic
engines. AI (Gemini) touches only creative semantic decode (`lib/creative/decode.ts`, feeds diversity) and
narration (`agent.ts::narrate`). "The MATH decides; AI narrates" holds EXCEPT the semantic-decode path.

## Formula inventory (36 metrics — file / gate / determinism). Highlights:
- Fatigue index (canonical) `scoring/fatigue.ts:195`: 0.4·freqSat+0.4·decay+0.2·cpmRise; gates MIN_ADSET_SPEND_SHARE=0.2, MIN_DAYS=4. **D**
- TWO rival fatigue engines also exist: `rules/fatigue.ts::fatigue` (0.5/0.5, feeds waste) and `::fatigueV2` (9-signal, feeds will-break). **D**
- Per-ad objective/health score `scoring.ts:94`: roasToScore=100(1-e^-0.5·roas), ctrToScore=100(1-e^-ctr/0.015) — **ABSOLUTE universal benchmark, not account-relative**. **D**
- trendScore `scoring.ts:75`: (late-early)/early on midpoint split, **no volume gate**. **D**
- percentile `scoring.ts:126`: rank within same-objective, **no min-ad-count gate**. **D**
- CreativeScore (J10) `verdict.ts:94`: 0.30 perf+0.30 trend+0.20(100-fatigue)+0.20 funnel. **D**
- Verdict `verdict.ts:103`: winner needs conv≥100,days≥3,score≥70; loser only if cause=creative_fatigue & score≤40. **D**
- Objective decision `decision.ts:105`: conv≥15/clicks≥100·1k/awareness≥10k, days≥4. **D**
- Triple-Label Evidence `engine.ts:57`: share≥0.2, conv≥50, awareness≥1,000,000 impr, days≥4, settled≥3. **D**
- Account Health `analyze.ts:180`: spend-weighted mean objective score − 25·wasteShare; MODEL_ESTIMATE. **D**
- Marginal ROAS `marginal.ts:51`: log-log OLS elasticity; MIN_DAYS=5, refuses if var(ln spend)≈0. **D**
- Funnel-leak `funnel/diagnosis.ts:94`: gap vs account's OWN-BEST same-objective ad; INR300/USD5 floor, 10% gap, MIN_BASELINE_ADS=3. **D**
- Culprit `culprit.ts:43`: 7d vs prior-7d; group is culprit if share≥10% AND fell to ≤15%; MIN_DROP=0.2. **D**
- Creative diversity `diversity.ts:86`: per-dimension 1-HHI over format + **AI semantic labels**. **AI**
- Semantic decode `decode.ts:59`: Gemini classifies hook/emotion/subject/scene; **no confidence gate**. **AI**
- Headline totals `meta-source.ts:742`: account-level Σrev/Σspend with use_account_attribution_setting (matches Ads Manager). **D**
- Attribution tail-trim `attribution.ts:21`: drop last 2 days from directional reads (not headline). **D**
(Full 36-row table + Decision Inventory of ~14 recommendation types in the reader transcript.)

## Reconciliation vs docs — key DRIFT
- **MEASUREMENT-CANON rule 1** ("never a public benchmark inside a score") → **DRIFT**: health/objective scores use universal roasToScore/ctrToScore constants.
- **FORMULA-RIGOR-AUDIT #9** (objective benchmarks self-baselined) → **DRIFT (not done)**: still hard-coded 0.5/0.015.
- **Canon "don't score an ad under ~USD50"** → **DRIFT**: funnel floor is USD5/INR300; `TRUST_GATES.perAdScore.spendUsd=50` defined but **enforcement not found** (possibly dead).
- **Canon "accept AI label only ≥97% conf"** → **DRIFT**: `decode.ts` takes Gemini labels with no confidence check.
- Fatigue "fatigued" threshold: canon 70 vs code 75 (`fatigue.ts:33`) vs 0.7 (`rules/account.ts`) → DRIFT.
- AccountGrade rollup (0.40/0.30/0.20/0.10) → DRIFT (code is spend-weighted objective − waste; canon's rollup not implemented).
- MATCH: sufficiency gates 15/100·1k/10k; STRONG70/GOOD55/WEAK45; freq curve; near-zero + 120d half-life cap; tail-trim 2d; winner weights; marginal ≥5 days; recommend-never-act (D12).

## 8 statistical-rigor risks (most severe first)
1. **Three inconsistent volume floors on the SAME ad** run in parallel: conv 15 (decision) vs 50 (Judge) vs 100 (winner); awareness 10k vs 1,000,000. Decision engine can say "scale" while Judge says "INSUFFICIENT"; the 1M awareness floor makes almost every awareness ad unjudgeable. `change-impact.ts` hard-copies the set with a "keep in sync" comment (manual-sync liability). **Biggest coherence risk.**
2. **Hard-coded universal benchmarks inside scored numbers** (roasToScore 0.5, ctrToScore 0.015) drive Account Health + every objective score — against canon rule 1.
3. **trendScore has no volume/materiality gate** (tiny÷tiny), and it's 30% of CreativeScore. Same for funnelScore/percentile (guard only n≤1).
4. **Percentiles computed with no minimum-ad-count gate** in scoring (`TRUST_GATES.accountMedian.minAds=30` NOT applied); a 2-4 ad account gets noise-driven percentiles feeding scale/pause gates.
5. **AI decode values feed a production recommendation with no confidence gate** — Gemini labels (hook/emotion/scene) are the buckets behind diversity + "produce more X creatives"; contradicts the 97% floor.
6. **metricVsMedian is a percentile-as-ratio proxy** (`analyze.ts:352` perf/50), flagged as approximation, yet can trigger SCALE/KILL.
7. **Multiple fatigue sources of truth** can disagree on the same ad; only one is documented.
8. **Waste double-counts** (below-floor + fatigued, acknowledged) and Account Health compounds it (−25·wasteShare).

## Good rigor worth preserving
Attribution tail-trim before directional reads; MIN_ADSET_SPEND_SHARE=0.2 materiality on fatigue AND Judge;
funnel diagnosis refusing (Hold) when thin; marginal refusing when spend has no variance; culprit attributes
revenue drops only to revenue-earning entities; null-on-zero-denominator throughout; narrate strictly isolated.

## UNKNOWNs (not verified this pass)
Enforcement of `TRUST_GATES.perAdScore.spendUsd=50`; app-wide COMPARISON_DAYS / "90-day" baseline location
(audit refs a nonexistent `cockpit-data.ts`); runtime AI provider the router resolves; served in-force corpus
count (corpus.ts comment: ~721 of 1,061 filtered as "planned").

Central files for Phase-1 rigor: lib/scoring.ts, lib/scoring/decision.ts, lib/judgment/engine.ts,
lib/rules/verdict.ts + trust-gates.ts, lib/scoring/fatigue.ts (+ 2 rivals), lib/cockpit/analyze.ts, lib/creative/decode.ts.
