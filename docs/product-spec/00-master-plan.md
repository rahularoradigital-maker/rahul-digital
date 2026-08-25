# AdBrain Master Spec — Build Program (the 28 artifacts)

Canonical product spec, from the owner's full brief (2026-08-25): an AI Creative + Media
Intelligence System that answers "what should we do next?", not another reporting dashboard.
This supersedes/absorbs the earlier cockpit spec; earlier work (rules engine, Strategist,
validator, show-the-working, competitor intel, confidence) is the FOUNDATION for this.

## The transform (every output serves this chain)
OBSERVATION → DIAGNOSIS → PREDICTION → RECOMMENDATION → ACTION, with confidence + explainability.

## Cross-cutting disciplines (apply to EVERY artifact)
1. **Decision gate (most important):** a metric stays on the primary surface only if it changes a
   decision. Vanity metrics move to advanced analytics or are cut.
2. **Fact labeling:** every value tagged OFFICIAL PLATFORM FACT / RESEARCH-BACKED / INDUSTRY
   BENCHMARK / INTERNAL CALCULATION / MODEL ESTIMATE / INFERENCE / UNKNOWN.
3. **Level-aware:** every metric names its level (account/campaign/adset/ad/creative/...) and its
   aggregation. Never mix levels implicitly.
4. **Time-aware:** day-wise snapshots preserved; every metric supports value/prev/change/trend/
   confidence with a minimum sample size.
5. **Confidence + explainability:** every score/recommendation carries confidence and can answer
   what/why/evidence/formula/rule/counter-explanation/action.
6. **Never fabricate:** the rules engine computes; AI narrates; insufficient data → say so.

## The 28 outputs, grouped and sequenced
**Foundation (research-dependent, build first):**
- [02] Meta Data Mapping ← DONE (this batch)
- [01] Master Metric Dictionary (per-metric: measures/why/decision/inputs/formula/source/window/
  min-sample/limits/when-not-to-trust) — categories A-N
- [03] Google Data Mapping (architecture-ready, Meta-first)
- [23] API Architecture · [24] Data Warehouse Schema (day-wise snapshots)

**Creative intelligence:**
- [04] Creative Attribute Dictionary · [05] Creative Fingerprint Spec
- [06] Diversity Formula Library · [07] Fatigue Formula Library
- [08] Forecasting Framework (7/14-day fatigue) · [12] Competitive Intelligence · [13] White Space

**Decision layer:**
- [09] Account Health Framework · [10] Budget Waste Framework · [11] Scaling Framework
- [14] Confidence Framework · [15] Rule Engine · [16] Recommendation Engine

**Surfaces:**
- [17] Dashboard IA · [18] Ad-Level · [19] Creative-Level · [20] Account-Level · [21] Executive
- [22] Day-Wise Analytics Spec · [25] Explainability Spec

**Quality + production:**
- [26] QA/Test Framework · [27] Benchmark Source Library · [28] Edge Case Library
- [29] Legal / Privacy / Compliance · [30] Production Ops & Observability
  (added per the live-web / 10k-users mandate; see `docs/production-readiness.md` + `docs/adr/ADR-0004`)

## Build sequence (decision-critical first, per the decision gate)
1. Foundation: 02 (done) → 01 → 24 → 23.
2. Creative core: 05 → 04 → 07 → 06 → 08.
3. Decision core: 15 → 16 → 14 → 09 → 10 → 11.
4. Competitive: 12 → 13.
5. Surfaces: 17 → 18/19/20/21 → 22 → 25.
6. Quality (continuous): 26, 27, 28 grow alongside.

## How this maps to what already exists
- `lib/rules/` (fatigue, waste, roas, health, will-break) → seeds [07][10][09][08].
- `lib/prompts/strategist.ts` + `lib/validator.ts` → seeds [16] + the byte-match honesty gate for [25].
- `docs/ai/*` (roles, chains, context) → the engine that runs [15][16].
- competitor spec + ScrapeCreators → [12][13].
- The gap this brief exposes: creative fingerprinting [05], the metric dictionary rigor [01], and
  marginal economics — none existed before; they are the deepest new work.
```
