// Runnable self-check for the objective-aware decision engine. No framework: plain asserts.
// Run: node --experimental-strip-types scripts/check-decision-engine.ts
import assert from "node:assert/strict";
import { decide, type DecisionInput } from "../lib/scoring/decision.ts";

// A sane baseline that each case overrides only where it matters.
function base(over: Partial<DecisionInput>): DecisionInput {
  return {
    objective: "engagement",
    objectiveScore: 50,
    performance: 50,
    fatigueState: "fresh",
    fatigueTrajectory: "stable",
    fatigueSufficiency: "ok",
    roas: null,
    conversions: 0,
    days: 10,
    roomToScale: false,
    ...over,
  };
}

// A fatiguing engagement ad that is still decent -> refresh, not pause.
const refresh = decide(base({ objectiveScore: 60, fatigueState: "fatiguing", fatigueTrajectory: "worsening" }));
assert.equal(refresh.action, "refresh", `expected refresh, got ${refresh.action}`);

// A fresh high-score engagement ad with headroom -> scale.
const scale = decide(base({ objectiveScore: 80, fatigueState: "fresh", roomToScale: true }));
assert.equal(scale.action, "scale", `expected scale, got ${scale.action}`);

// A weak, fatigued ad -> pause.
const pause = decide(base({ objectiveScore: 30, fatigueState: "fatigued", fatigueTrajectory: "worsening" }));
assert.equal(pause.action, "pause", `expected pause, got ${pause.action}`);

// Thin data -> hold, with low confidence.
const thin = decide(base({ days: 2, objectiveScore: 80 }));
assert.equal(thin.action, "hold", `expected hold, got ${thin.action}`);
assert.ok(thin.confidence < 0.45, `expected thin-data confidence < 0.45, got ${thin.confidence}`);

// Confidence must vary with data volume: same signal, different day counts -> different confidence.
const fewDays = decide(base({ objectiveScore: 30, fatigueState: "fatigued", fatigueTrajectory: "worsening", days: 5 }));
const manyDays = decide(base({ objectiveScore: 30, fatigueState: "fatigued", fatigueTrajectory: "worsening", days: 14 }));
assert.notEqual(fewDays.confidence, manyDays.confidence, "confidence should differ with day count");
assert.ok(manyDays.confidence > fewDays.confidence, "more days should mean more confidence for a pause");

// Every decision must carry a non-empty why and a clamped confidence.
for (const d of [refresh, scale, pause, thin, fewDays, manyDays]) {
  assert.ok(d.why.length > 0, "every decision must explain itself");
  assert.ok(d.confidence >= 0 && d.confidence <= 1, `confidence out of range: ${d.confidence}`);
}

console.log("PASS: decision engine checks");
