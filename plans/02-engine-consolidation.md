# [plan-02] Engine Consolidation — one source of truth per scoring concern

## Defect

Four core concerns each have **two parallel implementations**: a fuller, spec-driven engine and a
leaner engine the cockpit actually wires. Both are built and tested, so nothing is broken today —
but the source of truth is ambiguous, fixes must be made twice, and the two will drift. This is
the highest-leverage maintainability defect and should be resolved before large new feature work
builds another layer on the leaner set.

## Symptoms (the duplicate pairs)

- **Fatigue:** `lib/rules/fatigue.ts` (heuristic `fatigue()` + multi-signal `fatigueV2` per
  spec-07, 11 signals, coverage/confidence gating) **vs** `lib/scoring/fatigue.ts`
  (`readFatigue`, day-wise objective-aware, wired to the cockpit). The cockpit uses the latter;
  `fatigueV2` is only consumed by `will-break.ts`.
- **Diversity:** `lib/rules/diversity.ts` (spec-06 I1–I5: Shannon/HHI/redundancy/coverage/
  white-space over `CreativeFingerprint`) **vs** `lib/creative/diversity.ts` (leaner, wired path).
- **Fingerprint:** `lib/fingerprint.ts` (spec-05, 11 dims + `similarity()`) **vs**
  `lib/creative/fingerprint.ts` (deterministic, wired path).
- **Decision:** `lib/decision.ts` (rule-registry-validated `buildDecision` + explainability
  trace) **vs** `lib/scoring/decision.ts` (objective-aware `decide`, wired path).
- **Forecast:** `lib/scoring/fatigue-forecast.ts` (wired) overlaps `lib/rules/will-break.ts`
  (spec-08, MODEL_ESTIMATE, richer). Same question, two answers.

## Fix sequence

1. For each concern, decide the canonical engine: either promote the fuller spec engine into the
   wired path, or formally retire the spec engine to a documented "reference/backtest only" role.
2. Where the spec engine wins (likely fatigue, forecast, diversity): adapt its inputs to the
   cockpit's real `MetricsRow` + `CreativeFingerprint` and wire it; delete the leaner duplicate.
3. Where the leaner engine wins (likely on cost/latency): fold the spec engine's honesty guards
   (coverage floor, lagging-confirmation gate, confidence layer) into it, then retire the spec one.
4. Collapse the two decision engines behind one interface so `verdict` (conversion) and `decide`
   (non-conversion) are two branches of one entry point, not two modules.
5. Update the `check:*` suite so each concern has exactly one engine under test.

## Test matrix

| Concern | Canonical engine chosen | Old duplicate | Behavior parity check |
|---|---|---|---|
| fatigue | ? | retired/reference | day-wise reads unchanged on the sample account |
| diversity | ? | retired | I-scores match on a fixed fixture |
| fingerprint | ? | retired | content-hash + similarity stable |
| decision | one entry point | folded | cockpit verdicts byte-identical pre/post |

## Out of scope

Adding new scoring dimensions. This plan removes duplication; new signals ride on the canonical
engine afterwards.
