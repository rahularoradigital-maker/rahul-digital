# BUSINESS-LOGIC.md — Per-metric business-logic map (Phase 0, READ-ONLY)

> Charter §10 deliverable. For every critical calculation: metric · definition · source · formula ·
> assumptions · threshold · comparison-set · date-window · timezone · currency · minimum-sample ·
> confidence · known-failure-modes · tests · version. Companion: `FORMULA-LIBRARY.md` (the math).
> Evidence levels per §15: **A** measurable from account data · **B** strong external/platform ·
> **C** practitioner heuristic · **D** hypothesis. Every formula cites `file:line`. Where a fact is
> not in the code it is written `UNKNOWN`.
>
> Reconciles with the earlier pass `docs/intelligence/audit/02-business-logic-formulas.md` and
> `docs/FORMULA-RIGOR-AUDIT.md`. Tags: MATCH / DRIFT / UNKNOWN vs those docs and the Charter.
> Scope note: TIMEZONE and CURRENCY are almost never handled per-metric in the calc layer — dates are
> raw `YYYY-MM-DD` strings from Meta (string-sorted, no TZ normalization seen), and currency is INR/USD
> only where a floor needs it. Both are marked UNKNOWN per metric unless the code touches them.

## How the numbers flow (source → decision)
Real daily Meta rows (`MetricsRow[]`) → `lib/scoring.ts::toCockpitInputs` (per-ad deterministic sub-scores,
account-relative) → `lib/cockpit/analyze.ts::analyzeAccount` runs THREE parallel verdict layers on the same
ad: (1) verdict engine `lib/rules/verdict.ts` (conversion — CreativeScore + causality ladder), (2)
objective-aware decision engine `lib/scoring/decision.ts` (awareness family), (3) Triple-Label Judge
`lib/judgment/engine.ts` (traced to the corpus). Fatigue / winner / opportunity / funnel / marginal /
culprit / change-impact are separate deterministic engines. AI (Gemini) touches only creative semantic
decode (`lib/creative/decode.ts`, feeds diversity) and narration. "MATH decides, AI narrates" holds
EXCEPT the semantic-decode path, whose labels feed a production recommendation ungated.

---

## Core scored metrics

### HEALTH — Account Health
- **Definition:** 0-100 account-level health. Spend-weighted mean of each ad's absolute objective score, minus a waste penalty.
- **Source:** `lib/cockpit/analyze.ts:180-235` (base `scoring.ts::healthScoreOf`).
- **Formula:** `base = Σ(spend·healthScore)/Σspend`; `score = clamp(round(base − 25·wasteShare), 0, 100)`; `wasteShare = totalWasted/totalSpend`.
- **Assumptions:** absolute per-ad score is meaningful (see HEALTH-OBJ); waste penalty coefficient 25 is arbitrary; unscorable ads (null) drop out of the weighted mean.
- **Threshold:** none (continuous). Waste coefficient **25** — `analyze.ts:207`.
- **Comparison-set:** the account itself (spend-weighted own ads). No peer set. **Date-window:** the display window rows. **TZ/currency:** UNKNOWN (spend used as weight, currency-agnostic). **Min-sample:** none — a 1-ad account produces a score.
- **Confidence:** `factLabel: "MODEL_ESTIMATE"` always; no numeric confidence.
- **Failure modes:** double-counts waste (penalty stacks on a base already depressed by low-ROAS ads); waste coefficient un-sourced; no minimum ad/spend gate; base inherits the universal-benchmark problem of `healthScoreOf`.
- **Tests:** `scripts/check-*` (analyze path). **Version:** none stamped. **Evidence: D.** **DRIFT** vs Charter §18/§90; vs canon rollup 0.40/0.30/0.20/0.10 (not implemented).

### HEALTH-OBJ — Per-ad objective ("health") score
- **Definition:** absolute 0-100 "is this ad doing its objective's job", on the objective's own metric vs a benchmark.
- **Source:** `lib/scoring.ts:107` (`healthScoreOf`), via `roasToScore` `:94` / `ctrToScore` `:98`; awareness blend `:119`.
- **Formula:** conversion → `roasToScore(roas)=100(1−e^(−0.5·roas))`, fallback `ctrToScore`; awareness → `0.7·(100−fatigueScore(freq)) + 0.3·ctrToScore(ctr)`; else → `ctrToScore(ctr)=100(1−e^(−ctr/0.015))`.
- **Assumptions (the core problem):** the constants **0.5** (ROAS) and **0.015** (CTR) are UNIVERSAL, hard-coded benchmarks applied to every account/vertical/geo.
- **Threshold:** benchmark anchors ROAS 1x→39, 2x→63, 4x→86; CTR 1%→49, 2%→74, 4%→93. **Comparison-set:** a fixed external curve, NOT the account. **Currency:** ROAS is unit-free; CTR unit-free. **Min-sample:** none.
- **Confidence:** none attached. **Failure modes:** a 2%-CTR luxury brand and a 2%-CTR game score identically; no volume gate so a 1-impression ad can score; awareness "reach/rupee" not actually used here (uses freshness).
- **Evidence: D.** **DRIFT** vs Charter §18, FORMULA-RIGOR-AUDIT #9 (still not self-baselined), MEASUREMENT-CANON rule 1.

### PERF — Performance percentile
- **Definition:** the ad's objective metric as a percentile within its own account, same objective.
- **Source:** `lib/scoring.ts:126` (`percentile`), fed per objective `:179-186`.
- **Formula:** `round(#{peers with value < v} / (n−1) · 100)`; returns 50 when `n≤1`.
- **Comparison-set:** same-objective ads in the account (§J2 — MATCH). **Min-sample:** none applied — `TRUST_GATES.accountMedian.minAds=30` exists (`trust-gates.ts:20`) but is **not** wired in.
- **Failure modes:** a 2-4 ad account produces noise percentiles that then gate SCALE/PAUSE (`decision.ts:138,181`); ties handled by strict `<`.
- **Evidence: B** (method) but **DRIFT** vs §92/§20 (no sample gate). **Version:** none.

### CREATIVE-SCORE (J10) — CreativeScore
- **Definition:** 0-100 overall creative strength relative to its account.
- **Source:** `lib/rules/verdict.ts:94` (`creativeScore`).
- **Formula:** `0.30·performance + 0.30·trend + 0.20·(100−fatigue) + 0.20·funnel`. Weights runtime-overridable via cookie (`parseWeights` `:34`, strict, sums to 1).
- **Assumptions:** the four inputs are comparable 0-100; trend has no volume gate (see TREND). **Comparison-set:** mixed (performance is account-relative, fatigue/trend absolute).
- **Failure modes:** inherits TREND's tiny÷tiny; a good ad with noisy 2-day trend swings 30% of its score. **Evidence: C.** **Version:** `VERDICT_WEIGHTS` build default.

### TREND — Trend score
- **Definition:** 0-100 direction of the objective metric over the ad's own window (50=flat).
- **Source:** `lib/scoring.ts:75`.
- **Formula:** split settled rows at midpoint; `change=(late−early)/early`; `clamp(round(50+change·100),0,100)`.
- **Assumptions:** midpoint split is a fair before/after; early≠0. **Min-sample:** `<2` rows → 50; **no volume/materiality gate otherwise.**
- **Failure modes:** tiny÷tiny (a ROAS 0.02→0.04 reads +100 → ~100 trend); 30% of CreativeScore. **Evidence: D.** **DRIFT** vs §145/§20.

### FUNNEL-SCORE — Funnel health (per-ad, scoring)
- **Definition:** 0-100 funnel health, objective-aware.
- **Source:** `lib/scoring.ts:136`.
- **Formula:** conversion → `round((pctile(ctr)+pctile(cvr))/2)`; else → `pctile(ctr)`.
- **Comparison-set:** account CTR/CVR distributions. **Min-sample:** none beyond `percentile` n≤1 guard. **Evidence: B/C.** Distinct from the FUNNEL-DIAG engine below.

### STABLE — Stability flag
- **Definition:** is day-to-day ROAS steady enough to trust.
- **Source:** `lib/scoring.ts:146`, `STABLE_CV=0.5`.
- **Formula:** `stdev(dailyRoas)/mean < 0.5` over settled spend-days; `<3` days → false.
- **Failure modes:** ROAS-only (undefined for awareness → uses revenue/spend anyway); CV cut un-sourced. **Evidence: C.** Used as a hard winner gate (`verdict.ts:120`).

---

## Fatigue engines (THREE co-exist — §141 conflict)

### FATIGUE-CANON — Day-wise fatigue (canonical)
- **Definition:** temporal fatigue STATE + index + trajectory + days-to-fatigue from daily rows.
- **Source:** `lib/scoring/fatigue.ts:87` (`readFatigue`), index `:195`.
- **Formula:** `index = 0.4·freqSaturation + 0.4·decay + 0.2·cpmRise`; `saturation(f)=100(1−(f+1)^−0.4)` `:67`; decay/cpm = relative daily slope × `REL_SLOPE_GAIN(1400)` clamped 0-100.
- **Threshold:** state cuts fresh<30, watch<55, fatiguing<75, else fatigued (`:33`). **Min-sample:** `MIN_DAYS=4`; materiality `MIN_ADSET_SPEND_SHARE=0.2` → `insufficient_spend`; primary-metric floor (ROAS 0.1 / CTR 0.001) blocks tiny÷tiny; half-life cap 120 days.
- **Comparison-set:** the ad vs its own window. **Date-window:** 90-day baseline rows (`scoring.ts:220`). **Confidence:** via sufficiency enum; no numeric.
- **Failure modes:** weights 0.4/0.4/0.2 unvalidated; `REL_SLOPE_GAIN` maps "7%/day ≈ 100" by assertion; ROAS-decay path can mislabel an awareness ad (falls back to CTR).
- **Tests:** `scripts/check-fatigue*.ts`. **Evidence: mixed** — saturation curve **B** (platform shape), weights/cuts/gain **D**. **Good rigor:** near-zero + time gates honor §93/§145.

### FATIGUE-V1 — `rules/fatigue.ts::fatigue`
- **Source:** `lib/rules/fatigue.ts:32`. `score = 0.5·min(avgFreq/3,1) + 0.5·relCtrDrop`; `MIN_ROWS=7`, `pastHalfLife = score≥0.7`. Feeds `waste.ts`. **Evidence: C.** **DRIFT:** different weights (0.5/0.5) and threshold (0.7) than canon (75/100).

### FATIGUE-V2 — `rules/fatigue.ts::fatigueV2`
- **Source:** `lib/rules/fatigue.ts:268`. 9-signal composite (S1-S11 minus video S6/S7), weight-renormalised over observed signals; refuses if coverage <0.3 or no leading signal; lagging-confirmation gate; state bands 0.2/0.35/0.5/0.65/0.8. Feeds `will-break.ts`. **Evidence: D** (all weights "v0 priors"). Genuinely honest about missing-signal renormalization (§79).

### FATIGUE-FORECAST — `scoring/fatigue-forecast.ts`
- Projects P(fatigued) at +7/+14 via linear index drift → logistic around cut 75. `label:"PREDICTED"`, confidence separate, capped 0.9. **Evidence: D.** Honors §98 (forecast carries uncertainty).

### WILL-BREAK — `rules/will-break.ts`
- Forward sibling of V2: 0.7·trend-extrapolation + 0.3·hazard; `MODEL_ESTIMATE`; 14d confidence < 7d. **Evidence: D** (uncalibrated blend, admitted). Honors §98.

---

## Money / waste / scaling

### BLEED-WASTE — Per-ad wasted spend (two implementations)
- **scoring.ts:235:** conversion ads with ROAS<1 → whole spend is waste. **rules/waste.ts:20:** below-floor spend + (if fatigued) last-3-days spend; **acknowledged double-count** (`waste.ts:49`).
- **Failure modes:** ROAS<1 ≠ waste when margin>100% or attribution incomplete (no margin/counterfactual, contra §23/§64); double-count flows into Account Health penalty. **Evidence: C.** **DRIFT** vs §23-§27 (no Expected−Actual counterfactual; whole gap treated as loss).

### BLEED-OPP — Opportunity loss
- **Source:** `lib/scoring/opportunity.ts:19`. `totalLoss = wastedRs + atRiskRs(fatiguing/fatigued spend)`; `underScaledRs` = spend on winners (labelled proxy). **Evidence: C.** Honest basis string; atRisk = full spend on fatiguing ads (over-states — not all at-risk spend is lost).

### SCALE-MARGINAL — Marginal ROAS / elasticity
- **Source:** `lib/scoring/marginal.ts:51`. Log-log OLS: `e = cov(ln spend, ln rev)/var(ln spend)`; `marginalRoas = currentRoas·e`. `MIN_DAYS=5`; refuses if `var(ln spend)≈0`; classification cuts 1.0/0.8/0.5; confidence `0.4·dayFactor + 0.6·R²`.
- **Evidence: B** (method sound, real diminishing-returns curve — best-in-repo). Cuts **C**. Honors §47-§49. **Failure:** confounds spend changes with time/creative changes (no controls, labelled MODELLED).

### SCALE-ROOM — roomToScale flag
- **Source:** `lib/scoring.ts:234`. `roas>medianRoas(conversion ads) && fatigue<60`. Hard input to SCALE verdicts. **Evidence: C.** median has no min-count gate.

---

## Funnel

### FUNNEL-DIAG — Funnel leak diagnosis
- **Source:** `lib/funnel/diagnosis.ts:94`. 5-step chain (link_ctr→lpv→atc→checkout→purchase); each ad's step rate vs the account's OWN-BEST same-objective ad that cleared a per-step volume floor.
- **Threshold:** spend floor INR300/USD5 (`thresholds.ts:14`); `MATERIALITY_GAP_PCT=10`; `MIN_BASELINE_ADS=3`; per-step volume floors 5000/100/100/25/25; `THIN_FRACTION=0.25`.
- **Comparison-set:** account own-best (§45 MATCH — largest MEANINGFUL leak by spend, not lowest %). **Refuses** (Hold) on thin/weak-bar/small-baseline. **Evidence:** floors **C** (heuristic, self-labelled), method **B**. Strong rigor.

### FUNNEL-STAGE — TOF/MOF/BOF classifier
- **Source:** `lib/funnel/stage.ts:44`. Optimization-goal map beats objective; disagreement lowers confidence + flags review. Confidence numbers 92/80/75/60 are **C** heuristics (self-labelled). Honors §46.

---

## Creative intelligence

### DIV-HHI — Creative diversity
- **Source:** `lib/creative/diversity.ts:86`. Per-dimension spend-weighted HHI normalized `(hhi−1/k)/(1−1/k)`; diversity=`(1−normConc)·100`. Dimensions: format + AI semantic (hook/emotion/subject/scene/setting/palette/mood).
- **White-space:** bucket with `avgWinner≥60 && spendShare<0.15`. **Evidence:** HHI **B**; PROVEN_WINNER 60 / UNDERINVESTED 0.15 **C**.
- **Failure:** semantic buckets come from ungated AI decode (see AI-DECODE) → §94 risk; `coverage` reported honestly.

### DIV-STRAT — Creative strategy (DNA / fragility / brief)
- **Source:** `lib/creative/strategy.ts`. WinningDNA = bucket avgWinner − spend-weighted account avg (lift), needs `MIN_EVIDENCE=2` + `PROVEN=60`. Fragility from top-2 spend share (≥0.5) + fatiguing-winner share (≥0.2). **Evidence: C.** Liveness-aware (dead ads excluded — §95-adjacent good practice).

### AI-DECODE — Semantic creative decode
- **Source:** `lib/creative/decode.ts` (Gemini). Classifies hook/emotion/subject/scene/setting/palette/mood.
- **Failure mode (severe):** **NO confidence gate.** `TRUST_GATES.decodeConfidenceFloor=0.97` + `needsHumanReview()` exist (`trust-gates.ts:26,65`) but are **not called** in decode. Labels feed DIV-HHI + production recommendations directly. **Evidence: D.** **DRIFT** vs canon 97% floor, §68, §94.

---

## Verdict engines

### VERDICT-J10 — Conversion verdict
- **Source:** `lib/rules/verdict.ts:103`. Winner needs ALL: conv≥100 (`trust-gates.winnerFlag`), days≥3, stable, funnel≥60, fatigue<60, roomToScale, score≥70. Loser only when causality `cause==="creative_fatigue"` AND score≤40; else `do_not_kill_yet`/`refresh`. **Evidence: C.** Honors §95/§96 (winner needs delivery/volume; loser needs ruled-out causes). Confidence hard-coded (0.8/0.6/0.5/…).

### DECISION-OBJ — Objective-aware decision (awareness family)
- **Source:** `lib/scoring/decision.ts:105`. Volume gate first (conv≥15 / clicks≥100·1000impr / awareness≥10000impr), days≥4. SCALE needs objectiveScore≥70 AND performance≥70th pctl AND room; PAUSE needs <45 AND worsening/fatigued AND ≤30th pctl. Confidence `base + span·min(days/14,1)`.
- **Evidence: C.** Good: self-baselined SCALE/PAUSE (both absolute + relative must agree). **DRIFT:** its floors (15/10000) differ from Judge's (50/1,000,000).

### JUDGE — Triple-Label Judge
- **Source:** `lib/judgment/engine.ts:110`. Evidence gates (materiality 0.2, volume conv≥50 / clicks≥100 / awareness≥**1,000,000** impr, runtime≥4d, settled≥3d, learning), Agreement (efficiency vs median / wear / momentum → N/3), Confidence (volume 0-2 + trend 0-1 + agreement 0-2 → high/med/low). Action only when ≥2/3 agree at Med+.
- **Comparison-set:** `metricVsMedian` passed as `performance/50` proxy (`analyze.ts:352`). **Evidence: C.** **Failure:** awareness 1,000,000-impression floor makes nearly every awareness ad `INSUFFICIENT`; median proxy can drive KILL.
- **Corpus:** `lib/judgment/corpus.ts` — of 1,061 rules ~721 are "planned"; only shipped/partly are in-force (`corpus.ts:67`). Honest audit note in code.

---

## Change intelligence

### CHANGE-IMPACT — Single change before/after
- **Source:** `lib/scoring/change-impact.ts:88`. Trim settling tail from after-window; volume-gate both windows (floors **hard-copied** from decision.ts `:17`, "keep in sync" comment); compare objective metric oriented positive=better; `|Δ|<10%`→flat. **Evidence: C.** Labelled correlation-with-controls (honors §50/§97 — not fabricated causality). **Risk:** manual-sync duplication of floors.

### CHANGE-RANK — Buyer / change-type rollup
- **Source:** `lib/scoring/change-ranking.ts`. Buyer-source only; `MIN_SAMPLE=3` usable verdicts before "confident"; score = hitRate·100 + medianΔ·0.1. **Evidence: B/C.** Honors §51 (rank by measured impact, not activity).

### CULPRIT — Drop attribution
- **Source:** `lib/scoring/culprit.ts:43`. 7d vs prior-7d; entity is culprit if share≥10% of prior AND fell to ≤15%; drop must be ≥20%. Attributes on the metric that dropped (revenue if any). Corroborates with logged status events. **Evidence: C.** Strong: won't blame a zero-revenue campaign for a revenue drop (§23/§66).

---

## Data-trust & helpers

### DQ — Data quality
- **Source:** `lib/scoring/data-quality.ts:128`. Flags small-sample (≤2 critical / <4 or <10 purchases warning), spend-shock (>3x), delivery-gap (≥2d), outlier (>3σ), zero-revenue-with-spend; penalty info .05 / warning .2 / critical .4, capped 1; reliable if no critical AND penalty<0.5. **Evidence: C.** Emits penalty, never rewrites numbers (§128). **UNKNOWN:** where downstream actually subtracts this penalty.

### ATTR-TRIM — Attribution tail trim
- **Source:** `lib/scoring/attribution.ts:21`. Drop most-recent 2 distinct dates from directional reads; never below 3 settled days; headline totals keep full window. **Evidence: B** (attribution lag real). Best-practice, widely reused.

### TRUST-GATES — Gate constants + rebalance
- **Source:** `lib/rules/trust-gates.ts`. perAdScore spendUsd 50/spendInr 4000/days 3; fatigue 1000 impr/day; funnel 2000 sessions; winner conv 100/days 3; median minAds 30; decode floor 0.97. `rebalanceWeights` renormalizes surviving weights (§79). **Evidence: C** (owner anchors). **DRIFT:** `perAdScore` + `accountMedian.minAds` + `decodeConfidenceFloor` are defined but **never enforced** in the calc paths (dead config).

### SPEND-FLOOR / COMPARATOR / OBJECTIVE-METRICS
- `spend-floor.ts` INR300/USD5 last-7d gate; `comparator.ts` same-objective weighted average + adScore=distance (§J2, refuses on no peer); `objective-metrics.ts` sales/awareness family split + headline metric. **Evidence: B/C.** MATCH the "compare like with like" canon.

---

## Reconciliation summary (vs Charter + prior docs)
- **DRIFT — universal hard-coded benchmarks:** `roasToScore` 0.5 / `ctrToScore` 0.015 inside scored numbers (§18, §90). Confirmed still open (FORMULA-RIGOR-AUDIT #9).
- **DRIFT — three volume floors on one ad:** decision 15 / Judge 50 / winner 100; awareness 10k vs 1,000,000 (§141, §20).
- **DRIFT — no sample gate on percentile/trend:** `minAds=30` unwired; trend has no volume gate (§92, §145).
- **DRIFT — AI decode ungated:** 0.97 floor unused (§68, §94).
- **DRIFT — dead trust-config:** `perAdScore.spendUsd`, `accountMedian.minAds`, `decodeConfidenceFloor` never enforced.
- **DRIFT — fatigue thresholds:** 75 (canon fatigue.ts) vs 0.7 (rules) vs 70 (doc).
- **MATCH:** attribution trim; fatigue materiality/time gates; funnel refusal-when-thin; marginal refusal on no spend variance; culprit revenue-attribution; §J2 same-objective comparison; null-on-zero-denominator throughout.

---

# DECISION-LIBRARY (seed) — recommendation → candidate rule ID

Each user-visible recommendation gets a rule ID (§11) for the full DECISION-LIBRARY. Inputs / calc /
confidence / failure-cases below reference the formula rows above.

| Rule ID | Recommendation | Trigger (file:line) | Evidence | Notes / failure case |
|---|---|---|---|---|
| HEALTH-001 | Account Health headline 0-100 | analyze.ts:207 | D | universal benchmark base; waste double-count |
| HEALTH-002 | "Why this score" decomposition | analyze.ts:219 | C | honors §90 UI; base still un-decomposed statistically |
| BLEED-001 | Flag wasted spend (ROAS<1) | scoring.ts:235 | C | no margin/counterfactual (§23) |
| BLEED-002 | Below-floor + fatigued waste | waste.ts:33-48 | C | admitted double-count |
| BLEED-003 | Opportunity/at-risk loss total | opportunity.ts:29 | C | at-risk = full fatiguing spend (overstated) |
| BLEED-004 | Culprit "what did you turn off" | culprit.ts:96 | C | needs 2 full 7d windows; ≥20% drop |
| FATIGUE-001 | Fatigue state + days-to-line | fatigue.ts:201 | B/D | 3 rival engines disagree |
| FATIGUE-002 | +7/+14 fatigue probability | fatigue-forecast.ts:66 | D | linear drift heuristic |
| FATIGUE-003 | "will break" refresh/queue | will-break.ts:103 | D | uncalibrated blend |
| SCALE-001 | Scale budget (winner + room) | verdict.ts:161 / decision.ts:138 | C | two engines, different gates |
| SCALE-002 | Marginal ROAS / saturation class | marginal.ts:122 | B | best-grounded; no controls |
| REFRESH-001 | Refresh creative (good but wearing) | decision.ts:164 / verdict.ts:167 | C | — |
| PAUSE-001 | Pause weak+worsening+bottom-pctl | decision.ts:181 | C | percentile ungated on small accounts |
| KILL-001 | Loser only after causality ladder | verdict.ts:161 | C | honors §96; needs diagnosis |
| WINNER-001 | Winner rank (quality/scale/stab/opp) | winner.ts:92 | C | weights unvalidated |
| FUNNEL-001 | Weakest funnel step vs own-best | diagnosis.ts:144 | B/C | refuses when thin (good) |
| STAGE-001 | TOF/MOF/BOF + review flag | stage.ts:48 | C | heuristic confidence numbers |
| DIV-001 | Creative diversity + white-space | diversity.ts:157 | C | AI buckets ungated |
| DIV-002 | Production brief / winning DNA | strategy.ts:87 | C | grounded in ungated decode |
| JUDGE-001 | Triple-label second opinion | engine.ts:126 | C | awareness 1M floor → INSUFFICIENT |
| CHANGE-001 | Change improved/worsened | change-impact.ts:107 | C | correlation-with-controls (honest) |
| CHANGE-002 | Rank buyers by outcome | change-ranking.ts:63 | B/C | buyer-source only, MIN_SAMPLE 3 |
| DQ-001 | Data-quality confidence de-rating | data-quality.ts:128 | C | consumer path UNKNOWN |

*Written 2026-09-01. Phase 0 READ-ONLY: no code changed, no formula invented. Any formula change must
update this doc AND `FORMULA-LIBRARY.md` AND `FORMULA-RIGOR-AUDIT.md`.*
