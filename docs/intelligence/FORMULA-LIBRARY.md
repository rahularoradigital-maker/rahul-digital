# FORMULA-LIBRARY.md — The math (Phase 0, READ-ONLY)

> Charter §103 library. One row per deterministic formula: **ID · math · source(file:line) · assumptions ·
> edge-cases · version · tests · evidence level (A/B/C/D)**. Companion `BUSINESS-LOGIC.md` holds the
> per-metric business context + DECISION-LIBRARY seed. No formula invented here; every line is transcribed
> from code. `UNKNOWN` where the code does not say. 40 formulas catalogued.

Evidence: **A** measurable from account data · **B** strong external/platform · **C** practitioner heuristic · **D** hypothesis/unvalidated prior.

---

## 1. Per-ad scoring (`lib/scoring.ts`)

**F01 roasToScore** — `100·(1−e^(−0.5·roas))`, roas≤0→0, clamp 0-100. `scoring.ts:94`.
Assumptions: universal 0.5 slope. Edge: roas=0→0. Evidence **D**. Test: check-scoring. Version: none.

**F02 ctrToScore** — `100·(1−e^(−ctr/0.015))`, ctr≤0→0. `scoring.ts:98`.
Assumptions: universal 0.015 (1.5%) CTR anchor across all verticals. Evidence **D**.

**F03 healthScoreOf** — conversion→F01(roas)‖F02(ctr); awareness→`0.7·(100−F04(freq))+0.3·F02(ctr)`; else→F02(ctr). `scoring.ts:107`.
Edge: null when no impressions. Evidence **D** (inherits F01/F02 constants). Charter §18/§90 violation.

**F04 fatigueScore (exposure curve)** — `100·(1−(freq+1)^−0.4)`. `scoring.ts:55`.
Assumptions: Meta published exposure-decay shape. Evidence **B** (platform). Edge: freq<0 clamped to 0.

**F05 trendScore** — split settled rows at midpoint; `clamp(round(50+((late−early)/early)·100),0,100)`. `scoring.ts:75`.
Edge: <2 rows→50; early=0→50. **No volume gate** → tiny÷tiny. Evidence **D**. §145 risk.

**F06 percentile** — `round(#{v'<v}/(n−1)·100)`; n≤1→50. `scoring.ts:126`.
Edge: no min-n gate (minAds=30 defined, unused). Evidence **B** method / DRIFT §92.

**F07 funnelScore** — conversion→`round((F06(ctr)+F06(cvr))/2)`; else→F06(ctr). `scoring.ts:136`. Evidence **B/C**.

**F08 isStable** — `stdev(dailyRoas)/mean < 0.5` over settled spend-days; <3 days→false. `scoring.ts:146`.
Assumptions: CV cut 0.5 un-sourced; ROAS-based even for non-conversion. Evidence **C**.

**F09 roomToScale** — `roas>medianRoas(conversion ads) && fatigue<60`. `scoring.ts:234`. Evidence **C**. median ungated.

**F10 wastedRs (per-ad)** — conversion & roas<1 → `spend`, else 0. `scoring.ts:235`.
Assumptions: ROAS<1 == waste (ignores margin, attribution). Evidence **C**. §23/§64 DRIFT.

**F11 deliveringNow** — last spend day within 7d of asOf data-day. `scoring.ts:205`. Evidence **C** (RECENT_DELIVERY_DAYS=7).

## 2. Account roll-up (`lib/cockpit/analyze.ts`)

**F12 accountHealth** — `clamp(round(Σ(spend·healthScore)/Σspend − 25·(wasted/spend)),0,100)`. `analyze.ts:205-207`.
Assumptions: waste coeff 25 arbitrary; waste double-counted (F10 already depresses base). Edge: no spend→0. Evidence **D**. §18/§90 DRIFT.

## 3. Verdict engine (`lib/rules/verdict.ts`)

**F13 creativeScore (J10)** — `0.30·perf + 0.30·trend + 0.20·(100−fatigue) + 0.20·funnel`; weights cookie-overridable (sum=1±.01). `verdict.ts:94`, `parseWeights:34`. Evidence **C**.

**F14 verdict gates** — winner = conv≥100 ∧ days≥3 ∧ stable ∧ funnel≥60 ∧ fatigue<60 ∧ room ∧ score≥70; loser = diagnosis.cause==creative_fatigue ∧ score≤40; else refresh/do_not_kill_yet. `verdict.ts:103-177`.
Edge: no diagnosis → routes on fatigue/funnel. Confidence hard-coded per branch. Evidence **C**. Honors §95/§96.

## 4. Objective decision engine (`lib/scoring/decision.ts`)

**F15 volumeSufficiency** — conv/leads/installs: conv≥15; awareness: impr≥10000; else clicks≥100 ∧ impr≥1000. `decision.ts:68`. Evidence **C**.

**F16 decide** — thin→hold; score≥70 ∧ fresh ∧ !worsening ∧ room ∧ pctl≥70→scale; score≥55 ∧ wearing→refresh; score<45 ∧ (worsening∨fatigued) ∧ pctl≤30→pause; else hold. `decision.ts:105`. Evidence **C**. Self-baselined (good).

**F17 confidence ramp** — `clamp01(base + span·min(days/14,1))`. `decision.ts:92`. Evidence **C**.

## 5. Fatigue (canonical, `lib/scoring/fatigue.ts`)

**F18 fatigue index** — `clamp(round(0.4·sat + 0.4·decay + 0.2·cpmRise),0,100)`. `fatigue.ts:195`.
sat=F-sat curve on latest freq; decay=`clamp(−primaryRelSlope·1400,0,100)`; cpmRise=`clamp(cpmRelSlope·1400,0,100)`. Evidence **D** (weights, gain 1400).

**F19 saturation** — `round(100·(1−(f+1)^−0.4))`. `fatigue.ts:67`. Evidence **B**.

**F20 state cuts** — fresh<30, watch<55, fatiguing<75, else fatigued. `fatigue.ts:33`. Evidence **C**. DRIFT (75 vs 0.7 vs 70 elsewhere).

**F21 daysToFatigue** — extrapolate primary decline to 0.6·start; `round((latest−floor)/−slope)`, cap 120, capped by ad-set end. `fatigue.ts:207-228`. Evidence **C**. Near-zero + cap guards honor §145.

**F22 slope / gates** — OLS slope vs day index; MIN_DAYS=4; materiality MIN_ADSET_SPEND_SHARE=0.2; primary floors ROAS 0.1 / CTR 0.001. `fatigue.ts:40,47,179`. Evidence **C**.

## 6. Fatigue rivals

**F23 fatigue V1** — `clamp01(0.5·min(avgFreq/3,1) + 0.5·relCtrDrop)`; MIN_ROWS=7; pastHalfLife≥0.7. `rules/fatigue.ts:32`. Evidence **C**.

**F24 fatigueV2** — `Σ(wᵢ·cᵢ)/Σwᵢ` over observed signals S1-S11(−S6/S7); coverage floor 0.3; leading-signal required; lagging-confirmation gate; bands 0.2/0.35/0.5/0.65/0.8; confidence=`coverage·(0.6+0.4·min(rows/14,1))`. `rules/fatigue.ts:268`. Evidence **D** (v0 priors). Honest renormalization (§79).

**F25 fatigueForecast** — `futureIndex=clamp(index+drift·h)`, drift by trajectory {3,0.25,−2.5} sharpened by half-life; `p=1/(1+e^(−(future−75)/12))`; half-life-inside-horizon bias +0.3·(1−p). `fatigue-forecast.ts:66`. Evidence **D**.

**F26 willBreak** — `clamp01(0.7·projectedIndex + 0.3·hazard)`; projectedIndex=index+(0.6·ctrSlope+0.4·freqSlope)·h; hazard=`0.6·index+0.25·ageFactor+0.15·burnFactor`; confidence=diag.conf·{7:0.9,14:0.7}. `will-break.ts:76-95`. Evidence **D**.

## 7. Money / scaling

**F27 marginalScaling** — `e=Σ(dx·dy)/Σ(dx²)` on (ln spend, ln rev); `marginalRoas=currentRoas·e`; MIN_DAYS=5; refuse if Σdx²≤1e−9; R²; class cuts 1.0/0.8/0.5; conf=`0.4·min(n/20,1)+0.6·R²`. `marginal.ts:51`. Evidence **B** (method), **C** (cuts). Best-grounded formula in repo.

**F28 opportunityLoss** — `wastedRs + Σspend(fatiguing∪fatigued)`; lossShare=/totalSpend; underScaled=Σspend(winners). `opportunity.ts:19`. Evidence **C**.

**F29 wasteForAd** — belowFloor(totalSpend<floor→+totalSpend) + fatigued(F23 pastHalfLife→+last3d spend). `waste.ts:20`. Evidence **C**. Admitted double-count.

## 8. Winner rank (`lib/scoring/winner.ts`)

**F30 winnerScores** — `overall=0.4·quality+0.25·scale+0.2·stability+0.15·opportunity`; quality=clamp(objScore·freshness{1.1/1.0/0.85/0.6}); scale=`ln(1+spend)/ln(1+maxSpend)·100`; stability=base(70/35)+dayRamp(≤30 at 14d)−fatiguePenalty(40); opportunity=quality≥55 ∧ fresh ? quality·halfLifeMult : 0. `winner.ts:64`. Evidence **C**. log-scale prevents whale dominance (good).

## 9. Culprit (`lib/scoring/culprit.ts`)

**F31 diagnoseCulprit** — 7d vs prior-7d on dropped metric; drop=`max(0,(prior−recent)/prior)`; culprit if share≥0.10 ∧ recent≤0.15·prior; report if drop≥0.20. `culprit.ts:43`. Evidence **C**. Attributes on the metric that actually fell (§23 good).

## 10. Funnel (`lib/funnel/*`)

**F32 diagnoseFunnel** — per step gap=`max(0,(ownBest−value)/ownBest·100)`; ownBest=max same-objective value clearing step volume floor; rank by gap; leak if gap≥10 ∧ !weakBar ∧ !thin ∧ baselineAds≥3. `diagnosis.ts:126-145`. Evidence **B/C**. Refuses when thin (§45).

**F33 STEP_VOLUME_FLOOR / thresholds** — floors 5000/100/100/25/25; spend floor INR300·USD5; materiality 10%; MIN_BASELINE_ADS 3; THIN_FRACTION 0.25. `thresholds.ts`. Evidence **C** (self-labelled heuristic).

**F34 classifyStage** — goal-map beats objective; confidence 92 (agree)/75 (disagree)/80/60; review flag on disagreement or arguable objective. `stage.ts:44`. Evidence **C**.

## 11. Creative (`lib/creative/*`)

**F35 assessDiversity (HHI)** — `hhi=Σshare²`; `normConc=(hhi−1/k)/(1−1/k)`; `diversity=round((1−normConc)·100)`; k<2→0. white-space: avgWinner≥60 ∧ share<0.15. `diversity.ts:86-160`. Evidence **B** (HHI) / **C** (cuts). Semantic buckets from ungated AI.

**F36 buildCreativeStrategy** — lift=bucket avgWinner − spend-weighted acct avg (need count≥2, avgWinner≥60); fragility from top2Share≥0.5 + fatiguingWinnerShare≥0.2; liveShare=Σspend(delivering ∧ !fatigued)/total. `strategy.ts`. Evidence **C**.

**F37 semanticDecode** — Gemini classification; **NO confidence gate** (decodeConfidenceFloor 0.97 unused). `decode.ts`. Evidence **D**. §68/§94 DRIFT.

## 12. Judgment (`lib/judgment/engine.ts`)

**F38 judge (triple-label)** — Evidence gates (materiality 0.2, volume conv≥50/clicks≥100·impr≥1000/awareness impr≥1,000,000, runtime≥4d, settled≥3d, !learning); Agreement N/3 from {efficiency vs median ≥1.1/≤0.9, wear, momentum}; Confidence=volPts(0-2)+trendPts(0-1)+agPts(0-2)→high≥4/med≥2/low; action only if agree≥2 ∧ tier≠low. `engine.ts:110`. Evidence **C**. Awareness 1M-impr floor over-strict.

## 13. Account/change/trust helpers

**F39 account rollups** — budgetConcentration (top1/3/5 spend share, refuse on 0 spend); trappedBudget (Σspend where fatigueIndex≥0.7, null→unassessed not trapped); scalingHeadroom (roas>median ∧ fatigue<0.7 candidates, marginal always MARGINAL_UNKNOWN); wasteRollup (Σwasted/totalSpend). `rules/account.ts:49,87,121,161`. Evidence **B/C**. Honors §79 (unknown≠zero).

**F40 change-impact / ranking / gates** — measureChangeImpact (settled after-trim, both-window volume gate copied from decision.ts, `improvePct` oriented, ±10%→flat) `change-impact.ts:88`; rankBuyers (buyer-only, MIN_SAMPLE 3, score=hitRate·100+medianΔ·0.1) `change-ranking.ts:63`; rebalanceWeights (renormalize survivors) + meetsGate `trust-gates.ts:30,40`; objectiveAverage/adScore §J2 `comparator.ts:37`; applySpendFloor `spend-floor.ts:24`. Evidence **B/C**.

---

## Evidence-level tally
Of 40 catalogued formulas: **A** 0 · **B** ~6 (F04, F06 method, F19, F27 method, F32 method, F35 HHI + attribution-trim helper) · **C** ~22 · **D** ~12 (F01, F02, F03, F05, F12, F18, F23-F26, F37, plus fatigue weights). **~30 of 40 are evidence-level C or D** — heuristics or unvalidated priors, not measurable-from-account (A) or platform-sourced (B). Under the Charter this is the central risk: the scored spine of the product (health, objective score, fatigue index, forecasts) rests on C/D constants.

## Charter-violation flags (quick index)
- §18 universal hard-coded benchmarks: **F01, F02, F03, F12**.
- §20/§145 tiny-sample / tiny÷tiny dominance: **F05 (trend), F06 (percentile, ungated), F09 median**.
- §92 ranking without sample: **F06** (minAds=30 unwired), **F38** metricVsMedian proxy.
- §93 fatigue-without-time: NOT violated (F18-F22 gate on days) — good.
- §90 score-without-decomposition: **F12** (waste double-count, un-decomposed base).
- §94 diversity-without-meaning / §68 AI owning truth: **F37** (decode ungated) → F35/F36.
- §97 causality-without-design: NOT violated — F27/F40 labelled MODELLED/correlation-with-controls.
- §141 rule conflict: **F15 vs F38 vs F14** (volume floors 15/50/100; awareness 10k/1M) run in parallel on one ad.

*Written 2026-09-01. READ-ONLY. Update in lockstep with BUSINESS-LOGIC.md and FORMULA-RIGOR-AUDIT.md.*
