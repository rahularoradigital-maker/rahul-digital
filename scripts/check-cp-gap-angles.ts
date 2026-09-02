// Runnable check for the diversity-gap angle finder (strategy/gap-angles.ts). No I/O.
// node --experimental-strip-types scripts/check-cp-gap-angles.ts
import assert from "node:assert/strict";
import { findAngleGaps } from "../lib/creative-production/strategy/gap-angles.ts";

// The real account shape from the Creative DNA screenshot: ~100% Lifestyle scene, ~87% Aspirational mood.
const gaps = findAngleGaps({
  funnel: [{ label: "TOF", share: 0.62 }, { label: "BOF", share: 0.37 }, { label: "MOF", share: 0.01 }],
  scene: [{ label: "Lifestyle", share: 1.0 }, { label: "product-demo", share: 0 }],
  mood: [{ label: "Aspirational", share: 0.87 }, { label: "Premium", share: 0.13 }],
});
// scene (1.0) and mood (0.87) are over-concentrated; funnel (0.62) is under the 0.65 default -> not a gap.
const dims = gaps.map((g) => g.dimension);
assert.ok(dims.includes("scene"), "100% lifestyle scene is a gap");
assert.ok(dims.includes("mood"), "87% aspirational mood is a gap");
assert.ok(!dims.includes("funnel"), "62% TOF is below the dominance threshold -> not a gap");
assert.equal(gaps[0].dimension, "scene", "biggest concentration (100%) first");
assert.match(gaps.find((g) => g.dimension === "scene")!.suggest, /product-demo/i, "suggests the concrete missing angle");
assert.match(gaps.find((g) => g.dimension === "mood")!.suggest, /urgency|playful/i);

// A well-spread account has no gaps.
assert.deepEqual(findAngleGaps({ scene: [{ label: "a", share: 0.4 }, { label: "b", share: 0.35 }, { label: "c", share: 0.25 }] }), [], "balanced -> no gaps");

// A single-label dimension isn't flagged (nothing to diversify toward within one option).
assert.deepEqual(findAngleGaps({ scene: [{ label: "only", share: 1.0 }] }), [], "one possible label -> not a gap");

console.log("PASS: gap-angles (over-concentration flagged with concrete suggestions; balanced/single-label safe)");
