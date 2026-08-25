# AdBrain Product Brief (canonical, from the owner — 2026-08-25)

The definitive scope. AdBrain is an AI-powered Creative + Media Intelligence System that answers
"What should we do next?" for sophisticated US DTC brands on Meta (Google architecture-ready).
NOT another reporting dashboard. It transforms data into:
OBSERVATION → DIAGNOSIS → PREDICTION → RECOMMENDATION → ACTION.

## Persona to embody
Principal code architect + senior Meta media buyer + creative strategist + growth analyst + data
scientist + CRO + DTC operator, thinking at $100M/mo Meta spend scale.

## Ingest
Account/campaign/adset/ad/daily-performance data; creative assets (images, videos, transcripts,
frames); landing pages; product info; spend/revenue/conversions; competitor creative.

## Must identify
Creative fatigue (+ emerging + predicted); winners/losers; diversity/concentration/white-space;
budget waste; scaling opportunities; creative/persona/hook/angle/format/product/landing/funnel/
competitive gaps; account-level risks and opportunities.

## Data hierarchy (levels — every metric names its level)
ACCOUNT → BUSINESS → CAMPAIGN → AD SET → AD → CREATIVE → FRAME → ELEMENT → MESSAGE → HOOK →
ANGLE → PERSONA → LANDING PAGE → PRODUCT → OUTCOME.

## Metric taxonomy (14 categories)
A Delivery · B Attention · C Engagement · D Click quality · E Conversion · F Economics ·
G Creative · H Fatigue · I Diversity · J Scaling · K Incrementality · L Competitive ·
M Predictive · N Data quality.

## Per-metric discipline (the 10 questions — every metric answers all)
1 what it measures · 2 why it matters · 3 what decision it influences · 4 inputs · 5 formula ·
6 source · 7 comparison period · 8 minimum sample size · 9 limitations · 10 when NOT to trust it.
**A metric without a decision is a vanity metric — cut it from the primary surface.**

## Fact labeling (mandatory on every value)
OFFICIAL PLATFORM FACT / RESEARCH-BACKED / INDUSTRY BENCHMARK / INTERNAL CALCULATION /
MODEL ESTIMATE / INFERENCE / UNKNOWN. Never present a calculated metric as an official Meta metric.
Never present a prediction as a fact. Current date Aug 2026 — web-search platform specifics.

## Creative intelligence
Full creative attribute extraction (format, visual style, people, hooks, offers, CTA, ...);
video intelligence (transcript + frame-by-frame, first 1/3/5s, scene changes, pacing); computer
vision fingerprints (visual/text/audio/scene/hook/concept/persona/angle embeddings) stored once
per creative. Creative fingerprint = PERSONA + PROBLEM + DESIRE + HOOK + ANGLE + FORMAT + VISUAL +
SPEAKER + PRODUCT + OFFER + LANDING PAGE.

## Diversity (NOT "number of ads")
Measure across persona/problem/desire/awareness/hook/angle/concept/format/visual/speaker/product/
offer/background/environment/message/landing/CTA/narrative/structure. Scores: Diversity,
Concentration, Redundancy, White-Space, Coverage — each with formula, weights + reason, min sample,
confidence, limits.

## Fatigue (multi-signal, NOT frequency alone)
Signals: frequency, CPM, CTR, CPC, hook/video retention, CVR, CPA, ROAS, spend, reach, impression
growth, creative age, spend velocity, decay. Compare 1/3/7/14/21/30-day where sample permits.
States: HEALTHY / EARLY WARNING / EMERGING / FATIGUING / FATIGUED / SEVERE / RECOVERING /
INSUFFICIENT DATA. 7-day AND 14-day fatigue forecast with probability + confidence + drivers +
consequence + action. Every warning explains "why are we saying this?".

## Winners / opportunity (NOT ROAS ranking alone)
Quality, Scale, Stability, Opportunity scores. A $500/day @4x can beat a $50/day @7x.

## White space + competitor
Map our creative universe vs competitors'; find unoccupied combinations. Competitor data
(Ad Library/Apify/ScrapeCreators) generates HYPOTHESES not conclusions; active ad != winning ad.
Competitor economics = UNKNOWN.

## Waste / scale / budget
Define waste carefully (insufficient data != bad performance; low-spend weak-ROAS != waste).
Scale engine: what to scale/protect/replace with marginal analysis. Budget concentration by
campaign/adset/creative/concept/persona/angle/format/product. Marginal economics mandatory:
"what happens to efficiency if we spend another $10K?" (elasticity, diminishing returns, saturation).

## Creative supply / velocity / learning
7/14/30-day creative requirement tied to spend + fatigue + replacement rate. Velocity = useful
output, not volume. Every test stores hypothesis→result→learning→next-test.

## Landing page + product
Creative→hook→angle→promise→LP→product→conversion continuity; message-match; good-creative/bad-LP
detection. Which products have creative coverage/gaps/concentration.

## Account health score
Dimensions: creative health, diversity, fatigue, media efficiency, budget efficiency, scaling
capacity, LP health, measurement quality, incrementality confidence, data quality — each with
formula, weight, reason, confidence.

## Engines
- Benchmark engine (context-matched benchmark objects with source/date/sample/confidence/limits;
  else "benchmark unavailable" — no hardcoded generic benchmarks).
- Confidence engine (data completeness, sample, signal consistency, cross-metric agreement; no fake
  precision).
- Explainability engine (what/why/data/formula/benchmark/rule/counter-explanation/confidence/action).
- Rule engine (id/name/inputs/formula/trigger/threshold/exceptions/output/action/confidence/source/
  version; no arbitrary unvalidated thresholds).
- Decision engine: OBSERVATION→DIAGNOSIS→EVIDENCE→RULE→CONFIDENCE→ACTION→EXPECTED IMPACT→VALIDATION.
- Action prioritization: DO NOW / DO NEXT / WATCH / DO NOT ACT / NEEDS MORE DATA (impact, urgency,
  confidence, effort, expected value, risk).

## Time
Day-wise snapshots mandatory; day/3/7/14/30-day trends; distinguish trend from noise; anomaly +
forecast + confidence with min data requirements.

## Dashboards (decision-first)
Account overview, creative dashboard, ad-level view, account-level view, executive views (CMO/CFO/
CEO/creative/media-buyer lenses). Every metric: hover definition/formula/source/window/
interpretation/benchmark/confidence/"why it matters".

## Adversarial gates
AUTOPSY (false fatigue/winners, Simpson's paradox, attribution errors, small samples, survivor/
selection bias, seasonality, promos, pricing/LP/tracking/budget/audience/product changes) and
KILLCRITIC (vanity metrics, redundant metrics, unsupported benchmarks, weak forecasts, fake
precision, overloaded dashboard, unclear actions). Remove/fix what they find.

## 28 required outputs
1 Master Metric Dictionary · 2 Meta Data Mapping · 3 Google Data Mapping · 4 Creative Attribute
Dictionary · 5 Creative Fingerprint Spec · 6 Diversity Formula Library · 7 Fatigue Formula Library ·
8 Forecasting Framework · 9 Account Health Framework · 10 Budget Waste Framework · 11 Scaling
Framework · 12 Competitive Intelligence Framework · 13 White Space Framework · 14 Confidence
Framework · 15 Rule Engine · 16 Recommendation Engine · 17 Dashboard IA · 18 Ad-Level Dashboard ·
19 Creative-Level Dashboard · 20 Account-Level Dashboard · 21 Executive Dashboard · 22 Day-Wise
Analytics Spec · 23 API Architecture · 24 Data Warehouse Schema · 25 Explainability Spec ·
26 QA/Test Framework · 27 Benchmark Source Library · 28 Edge Case Library.

## Final test
Could a $100M/mo DTC media buyer use it to decide what to pause, scale, produce next, what will
fatigue, where the account is over-concentrated, where the white space is, and where the next
dollar goes — with confidence? If no, find the missing intelligence and build it.
The feeling: "an AI creative strategist sitting beside the media buyer", not "another dashboard".
