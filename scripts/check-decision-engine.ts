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
    // Enough volume to clear the statistical-sufficiency gate for the default (engagement) objective, so
    // the non-volume cases exercise the branch they mean to. Individual cases override to test the gate.
    impressions: 5000,
    clicks: 300,
    days: 10,
    roomToScale: false,
    ...over,
  };
}

// A fatiguing engagement ad that is still decent -> refresh, not pause.
const refresh = decide(base({ objectiveScore: 60, fatigueState: "fatiguing", fatigueTrajectory: "worsening" }));
assert.equal(refresh.action, "refresh", `expected refresh, got ${refresh.action}`);

// A fresh high-score engagement ad that is ALSO top of the account, with headroom -> scale.
const scale = decide(base({ objectiveScore: 80, performance: 85, fatigueState: "fresh", roomToScale: true }));
assert.equal(scale.action, "scale", `expected scale, got ${scale.action}`);

// A weak, fatigued ad that is ALSO bottom of the account -> pause.
const pause = decide(base({ objectiveScore: 30, performance: 15, fatigueState: "fatigued", fatigueTrajectory: "worsening" }));
assert.equal(pause.action, "pause", `expected pause, got ${pause.action}`);

// SELF-BASELINING: strong absolute BUT only mid standing vs the account -> keep running, do NOT scale.
const strongNotTop = decide(base({ objectiveScore: 80, performance: 50, fatigueState: "fresh", roomToScale: true }));
assert.equal(strongNotTop.action, "continue", `strong-but-not-leading must continue, got ${strongNotTop.action}`);

// SELF-BASELINING: weak absolute BUT relatively the BEST of a weak account -> do NOT pause the least-bad ad.
const weakButBest = decide(base({ objectiveScore: 30, performance: 85, fatigueState: "fatigued", fatigueTrajectory: "worsening" }));
assert.notEqual(weakButBest.action, "pause", `must not pause the account's least-bad ad, got ${weakButBest.action}`);

// Thin data (days) -> hold, with low confidence.
const thin = decide(base({ days: 2, objectiveScore: 80 }));
assert.equal(thin.action, "hold", `expected hold, got ${thin.action}`);
assert.ok(thin.confidence < 0.45, `expected thin-data confidence < 0.45, got ${thin.confidence}`);

// STATISTICAL SUFFICIENCY (the core hardening): even with plenty of days and a strong score, an ad without
// enough VOLUME to be real must HOLD, never scale/pause.
// Engagement ad, 14 days, score 85, roomToScale - but only 20 clicks -> hold, not scale.
const thinVolume = decide(base({ objectiveScore: 85, roomToScale: true, days: 14, clicks: 20, impressions: 800 }));
assert.equal(thinVolume.action, "hold", `thin volume must hold, got ${thinVolume.action}`);
assert.ok(/clicks/.test(thinVolume.why.join(" ")), "the why should name the missing click volume");

// Conversion ad, strong ROAS score, 14 days, headroom - but only 5 conversions -> hold (need >=15).
const thinConversions = decide(base({ objective: "conversion", objectiveScore: 85, roas: 6, conversions: 5, roomToScale: true, days: 14, impressions: 20000, clicks: 400 }));
assert.equal(thinConversions.action, "hold", `too few conversions must hold, got ${thinConversions.action}`);

// Same conversion ad once it has real volume (40 conversions) -> now it may scale.
const enoughConversions = decide(base({ objective: "conversion", objectiveScore: 85, performance: 85, roas: 6, conversions: 40, roomToScale: true, days: 14, impressions: 20000, clicks: 400 }));
assert.equal(enoughConversions.action, "scale", `with enough conversions it should scale, got ${enoughConversions.action}`);

// Awareness ad judged on CPM/reach: needs impressions, not conversions. 3k impressions is too thin -> hold.
const thinAwareness = decide(base({ objective: "awareness", objectiveScore: 80, roomToScale: true, days: 14, impressions: 3000, clicks: 40 }));
assert.equal(thinAwareness.action, "hold", `thin awareness impressions must hold, got ${thinAwareness.action}`);

// Confidence must vary with data volume: same signal, different day counts -> different confidence.
const fewDays = decide(base({ objectiveScore: 30, performance: 15, fatigueState: "fatigued", fatigueTrajectory: "worsening", days: 5 }));
const manyDays = decide(base({ objectiveScore: 30, performance: 15, fatigueState: "fatigued", fatigueTrajectory: "worsening", days: 14 }));
assert.notEqual(fewDays.confidence, manyDays.confidence, "confidence should differ with day count");
assert.ok(manyDays.confidence > fewDays.confidence, "more days should mean more confidence for a pause");

// Every decision must carry a non-empty why and a clamped confidence.
for (const d of [refresh, scale, pause, strongNotTop, weakButBest, thin, thinVolume, thinConversions, enoughConversions, thinAwareness, fewDays, manyDays]) {
  assert.ok(d.why.length > 0, "every decision must explain itself");
  assert.ok(d.confidence >= 0 && d.confidence <= 1, `confidence out of range: ${d.confidence}`);
}

console.log("PASS: decision engine checks");
