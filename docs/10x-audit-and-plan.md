# AdBrain 10x - system audit, metric dictionary, and roadmap

Executed against the master brief (world-class DTC media-buying + creative-intelligence
decision system). Labels: OFFICIAL (platform-reported), INTERNAL CALCULATION (our deterministic
math), MODELLED (a fitted/estimated value), INFERENCE, UNKNOWN. No derived metric is ever
presented as an official Meta metric.

---

## PART A - Current-system intelligence audit (KEEP / IMPROVE / MISSING)

| Area | Status | Evidence (code) | Verdict |
|------|--------|-----------------|---------|
| Account health | Built, objective-aware, spend-weighted, explainable | `lib/cockpit/analyze.ts`, `lib/scoring/rubrics.ts` | KEEP |
| Objective score (absolute) | Built (ROAS/CTR/reach benchmarks) | `lib/scoring.ts` | KEEP |
| Decision engine (Scale/Continue/Refresh/Pause/Hold) | Built, objective-aware, confidence varies | `lib/scoring/decision.ts` | KEEP |
| Creative fatigue (day-wise) | Built, objective-aware (ROAS/CTR/reach), end-date capped | `lib/scoring/fatigue.ts` | KEEP |
| Creative half-life | Built (days-to-fatigue, capped by ad set end) | `lib/scoring/fatigue.ts` | KEEP |
| Fatigue FORECAST (7/14-day probability) | MISSING -> building now | `lib/scoring/fatigue-forecast.ts` | MISSING->BUILD |
| Marginal scaling (elasticity, saturation) | MISSING -> building now | `lib/scoring/marginal.ts` | MISSING->BUILD |
| Creative winner (multi-factor, not ROAS-only) | Partial (verdict + CreativeScore) -> building winner scores | `lib/scoring/winner.ts` | IMPROVE->BUILD |
| Data-quality / confidence de-rating | MISSING -> building now | `lib/scoring/data-quality.ts` | MISSING->BUILD |
| Funnel metrics (thumb-stop, hold, LP/ATC/checkout) | Built | `lib/metrics/funnel-metrics.ts` | KEEP |
| Opportunity loss / budget waste | Built (wasted + at-risk spend) | `lib/scoring/opportunity.ts` | IMPROVE (add redundant-creative signal) |
| Creative diversity | Built (basic) | `scripts/check-diversity.ts`, `lib/rules/*` | IMPROVE (multidimensional over fingerprint) |
| Creative fingerprint (42 attrs) | Built for COMPETITORS (Gemini); MISSING for OWN ads | `lib/agents/creative/*` | IMPROVE (apply to own creatives) |
| Video DNA (frame-level 0-1/1-3/3-5s) | MISSING | - | MISSING (needs media + Gemini video) |
| Image DNA (structured) | Partial (Gemini visual attrs on competitors) | `lib/agents/creative/agents.ts` | IMPROVE |
| Hook / angle / persona intelligence | Partial (Gemini hook/offer on competitors) | competitor pipeline | IMPROVE (own ads + performance join) |
| Competitor intelligence | Built (Ad Library pull, analytics, multi-agent Gemini) | `lib/competitors/*` | KEEP |
| Creative white-space | Partial (format/CTA gaps) | `lib/competitors/analytics.ts` | IMPROVE (persona/hook/angle map) |
| Creative production ("next N concepts") | MISSING | - | MISSING (needs steer + fingerprint join) |
| Landing-page intelligence | MISSING (no LP crawl / CVR-by-LP) | - | MISSING (needs GA4/Shopify) |
| MER / nCAC | Interface + math ready, no revenue source | `lib/connectors/revenue.ts` | BLOCKED on Shopify/Triple Whale |
| RLEF audit (labeled triples) | Built (situation->recommendation->judgment) | `lib/audit/*`, `decision_triples` | KEEP |
| Explainability (Why drawer + rubric registry) | Built | `components/cockpit/WhyDrawer.tsx`, `lib/scoring/rubrics.ts` | KEEP |
| Time-window engine (per-metric windows) | Partial (custom range + presets) | `lib/app/cockpit-data.ts` | IMPROVE (per-metric window mapping - Part D) |
| Data pulling depth (pagination, 100 ads, day-wise) | Built | `lib/meta-source.ts` | KEEP |
| Device / placement breakdown | MISSING | - | MISSING (deeper Meta pull) |

REMOVE: none - no vanity-only metric is on the primary dashboard (each cockpit number ties to a
decision). Everything unavailable is shown as insufficient_data, never fabricated.

---

## PART B - Missing intelligence report (highest value first)
1. Fatigue FORECAST (7/14-day probability) - BUILDING.
2. Marginal scaling / saturation ("what happens at +X spend") - BUILDING.
3. Data-quality gate -> confidence de-rating (Simpson's/small-sample/spend-shock guard) - BUILDING.
4. Creative winner scores (efficiency x scale x stability x longevity) - BUILDING.
5. OWN-ad creative fingerprint (apply the 42-attr Gemini read to our own creatives) - NEXT.
6. Video DNA (frame-level, transcript) - NEXT (needs media URLs + Gemini video).
7. Creative production queue (next 5/10/25/50) - NEXT (fingerprint join + one gated LLM).
8. Landing-page intelligence + MER/nCAC - BLOCKED on Shopify/GA4/Triple Whale connectors.
9. Device/placement breakdown - NEXT (Meta breakdowns).

---

## PART C - Master metric dictionary (core set; condensed schema)
Schema per metric: Name | Definition | Formula | Source/Label | Window | Min sample | Decision | Confidence.

- ROAS | return on ad spend | revenue / spend | OFFICIAL inputs, INTERNAL ratio | 7-30d | spend>0 | scale/cut | high with spend
- CTR (all) | clicks / impressions | OFFICIAL clicks+impr | 7d | impr>1000 | hook read | med
- Link CTR | outbound clicks / impressions | OFFICIAL | 7d | impr>1000 | hook vs LP | med (UNKNOWN if outbound absent)
- CPM | spend / impressions * 1000 | OFFICIAL | daily-7d | impr>1000 | auction/relevance | high
- CPC | spend / clicks | OFFICIAL | 7d | clicks>50 | efficiency | med
- Frequency | impressions / reach | OFFICIAL | 7-14d | reach>1000 | saturation | high
- Thumb-stop rate | 3s video views / impressions | OFFICIAL actions, INTERNAL ratio | 7d | video impr | hook strength | med (n/a if no video)
- Hold rate | thruplays / 3s views | OFFICIAL, INTERNAL | 7d | video | retention | med
- Objective score | absolute 0-100 on objective metric vs benchmark | INTERNAL CALCULATION | 7-30d | spend>0 | health input | med
- Account Health | spend-weighted avg objective score - 25*waste share | INTERNAL CALCULATION / MODEL_ESTIMATE | 14-30d | acct spend | account triage | med
- Fatigue index | 0.4 freq saturation + 0.4 objective-metric decay slope + 0.2 CPM rise slope | INTERNAL CALCULATION | 7-14d | >=4 days | refresh/pause | med
- Creative half-life | days until primary metric hits 60% of window start; capped by ad set end | MODELLED | 14-90d | declining metric | replace timing | low-med
- Fatigue 7/14d probability | logistic on projected fatigue index | PREDICTED | 7-14d | ok read | pre-emptive refresh | low-med
- Marginal ROAS | currentRoas * spend elasticity | MODELLED | 14-30d | >=5 days | budget move | low-med
- MER | total store revenue / total ad spend | needs revenue source | 7-30d | store rev | blended efficiency | UNKNOWN until connected
- nCAC | ad spend / new customers | needs revenue source | 30d | new custs | acquisition cost | UNKNOWN until connected
- Concentration | top ad spend / total spend | INTERNAL | 30d | acct spend | risk | high
- Opportunity loss | wasted + at-risk (fatiguing) spend | INTERNAL | 14-30d | acct spend | reallocation | med

Rule applied: a metric with no attached decision is kept OFF the primary dashboard (e.g. raw
impressions are an input, not a headline number).

---

## PART D - Time-window engine (per-metric windows + WHY)
- Intraday/Daily: delivery shocks, sudden CPA/ROAS/spend moves (catch breakage fast).
- 3-day: smoothing noisy daily creative signals (reduce weekday noise).
- 7-day: core weekly performance + short-term fatigue (a full week removes day-of-week bias).
- 14-day: fatigue CONFIRMATION + strategy-shift comparison (enough exposure to trust a trend).
- 30-day: account strategy, budget/creative concentration, replacement patterns (stable base).
- 60-90-day: creative half-life + longevity + competitor pattern (long decay needs long history).
- 12-month: seasonality + YoY (only a year isolates seasonal from structural change).
Current app: user-selectable window drives the pull; fatigue/half-life read the day-wise rows in
that window. NEXT: attach the recommended window per metric in `rubrics.ts` so the UI can warn
when a metric is being read on too short a window.

---

## PART E - 29-artifact status
Built/strong: 1 audit (this), 2 missing report (this), 3 metric dict (this), 4 formula lib
(`rubrics.ts` + checks), 5 Meta API mapping (`meta-source.ts`), 11 fatigue engine, 12 half-life,
16 winner (building), 17 white-space (partial), 18 competitor engine, 22 waste, 23 decision
engine, 24 explainability, 27 benchmark/source (this + rubrics), 29 roadmap (this).
Building now: 10 diversity (improve), 13 fatigue forecast, 18/19 scaling, 24 data-quality.
Not yet: 6 Google API mapping (blocked), 7 own-ad fingerprint, 8 Video DNA, 9 Image DNA (own),
19 production engine, 20 supply model, 21 landing-page, 25 dashboard spec (partial), 26 QA
framework (checks exist; formalize), 28 edge-case library (partial in checks).

---

## PART F - Roadmap (phased, honest)
- P1 (now): fatigue forecast + marginal scaling + data-quality + winner engine (4 pure modules,
  tested) -> wire into the cockpit as new signals with confidence + Why.
- P2: own-ad creative fingerprint (reuse the competitor Gemini agents on our own creatives) ->
  unlocks diversity (multidimensional), hook/angle/persona intelligence, white-space, production.
- P3: connectors (Shopify/Triple Whale -> MER/nCAC/landing-page; GA4; Google Ads) via the
  MetricsSource interface (see orchestration-plan.md).
- P4: Video DNA (frame-level via Gemini video) + device/placement breakdown.
- Continuous: failure-analysis loop (Simpson's, small-sample, spend/survivor bias) enforced by
  the data-quality engine de-rating confidence; QA via the `check:*` suite.

## Failure-analysis notes already enforced
- Small sample: fatigue needs >=4 days; winners honor a conversions/days trust gate; the new
  data-quality engine de-rates confidence on thin data.
- Spend bias: winner `scale` is log-scaled so whales do not linearly dominate.
- Survivor bias: competitor "active ad" is treated as a HYPOTHESIS, never a proven winner.
- Attribution distortion: MER/nCAC gated as UNKNOWN until a revenue source connects (no guessing).
