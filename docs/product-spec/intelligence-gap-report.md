# Intelligence Gap Report + Priority Matrix

Date: 2026-08-25. Audit of what intelligence EXISTS (code vs spec) and what to build next.
Governing rule: reuse the existing infrastructure (auth, OAuth scaffold, schema, seams, CI) —
extend, never rebuild.

## Audit: spec vs code

| Intelligence layer | Spec | Code | Gap |
|---|---|---|---|
| Metric dictionary (A-N) | ✅ 01a-01d | `lib/rules/metrics.ts` (roas/ctr/cpa only) | most metrics unimplemented (fine — implement on demand, decision-gated) |
| Creative fingerprint | ✅ 05 | ❌ none | types + similarity/diversity math buildable now; extraction needs Gemini at runtime |
| Fatigue engine | ✅ 07 (11 signals, 8 states) | `fatigue.ts` = 2-signal heuristic | **P0 gap: implement the multi-signal model** |
| Fatigue forecasts 7/14d | ✅ 08 | ❌ none | **P0 gap: will-break per spec 08** |
| Diversity engine | ✅ 06 (5 scores, real math) | ❌ none | **P0 gap** |
| Rule library (13-field rules) | partial (in specs) | ❌ hardcoded per-function | **P0 gap: centralize rules as data** |
| Decision engine (O→D→E→R→C→A→EI) | brief + patterns | ❌ none | **P0 gap** |
| Confidence framework | ✅ concept in specs [14 pending] | ❌ none | **P0 gap** |
| Explainability | patterns + validator | validator only | **P0 gap: explain-trace generator** |
| Account intelligence (concentration/waste/next-dollar) | ✅ 01b/01c, 09-11 pending | `waste.ts` (2 buckets) | **P0 gap: concentration, scaling headroom, production requirements** |
| Data quality engine | ✅ 01d N-category | ❌ none | **P1 gap (build now — cheap, pure)** |
| Competitor/white-space | ✅ 12, 13 | ❌ none | P1 — needs competitor data flowing; math per 06/13 reused |
| Benchmark engine | spec'd shape | ❌ none | P1 — schema exists in [24]; no fabricated values, so empty until sourced |
| Executive UX | artboards | dashboard shell | P2 — after intelligence exists |

## Priority matrix (this build)

| P | Build item | Implements | Files |
|---|---|---|---|
| P0 | Rule Library + Decision Engine + Explainability | rules-as-data (13 fields), O→D→E→R→C→A→EI objects | `lib/rules/registry.ts`, `lib/decision.ts` |
| P0 | Multi-signal Fatigue v2 + 7/14d forecasts | artifacts 07 + 08 | `lib/rules/fatigue.ts` (compat), `lib/rules/will-break.ts` |
| P0 | Fingerprint types + Diversity Engine | artifacts 05 + 06 | `lib/fingerprint.ts`, `lib/rules/diversity.ts` |
| P0 | Account + Production Intelligence | concentration, next-dollar, replacement req | `lib/rules/account.ts`, `lib/rules/production.ts` |
| P0/P1 | Confidence + Data Quality | confidence scoring, trust flags | `lib/confidence.ts`, `lib/data-quality.ts` |

Everything pure + fixture-tested (one `check:*` per module, CI-wired). No infrastructure changes.
Extraction (Gemini vision), competitor feeds, and benchmarks activate when data/credentials land —
the math is ready for them.

## Non-goals of this build
Rebuilding auth/routes/schema; UI redesign; anything needing live credentials; fabricated
benchmarks or thresholds (all calibrate-at-build, insufficient_data over guesses).
