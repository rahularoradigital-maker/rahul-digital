// Runnable check for the hook x hold 2x2 (lib/scoring/hook-hold.ts). No I/O.
// Run: node --experimental-strip-types scripts/check-hook-hold.ts
import assert from "node:assert/strict";
import { classifyHookHold, hookHoldMedians, type HookHoldInput } from "../lib/scoring/hook-hold.ts";

// An account of video ads with a spread of hook (3s/impr) and hold (thruplay/3s) rates.
const ads: HookHoldInput[] = [
  { impressions: 10000, video3s: 3000, thruplays: 1500 }, // hook .30, hold .50
  { impressions: 10000, video3s: 2000, thruplays: 1000 }, // hook .20, hold .50
  { impressions: 10000, video3s: 3000, thruplays: 600 }, //  hook .30, hold .20
  { impressions: 10000, video3s: 2000, thruplays: 400 }, //  hook .20, hold .20
];
const { hookMedian, holdMedian } = hookHoldMedians(ads);
assert.ok(hookMedian !== null && Math.abs(hookMedian - 0.25) < 1e-9, `hook median = .25, got ${hookMedian}`);
assert.ok(holdMedian !== null && Math.abs(holdMedian - 0.35) < 1e-9, `hold median = .35, got ${holdMedian}`);

// high hook / high hold -> scale
assert.equal(classifyHookHold({ impressions: 10000, video3s: 3500, thruplays: 2000 }, hookMedian, holdMedian).quadrant, "scale");
// high hook / low hold -> rewrite the payoff
assert.equal(classifyHookHold({ impressions: 10000, video3s: 3500, thruplays: 500 }, hookMedian, holdMedian).quadrant, "rewrite_payoff");
// low hook / high hold -> recut the hook
assert.equal(classifyHookHold({ impressions: 10000, video3s: 1500, thruplays: 900 }, hookMedian, holdMedian).quadrant, "recut_hook");
// low hook / low hold -> kill the concept
assert.equal(classifyHookHold({ impressions: 10000, video3s: 1500, thruplays: 200 }, hookMedian, holdMedian).quadrant, "kill_concept");

// non-video (no 3s views) and below-delivery-floor -> insufficient, never a fabricated quadrant
assert.equal(classifyHookHold({ impressions: 10000, video3s: 0, thruplays: 0 }, hookMedian, holdMedian).quadrant, "insufficient");
assert.equal(classifyHookHold({ impressions: 200, video3s: 60, thruplays: 30 }, hookMedian, holdMedian).quadrant, "insufficient");
// no account baseline yet -> insufficient (can't split high/low against nothing)
assert.equal(classifyHookHold({ impressions: 10000, video3s: 3000, thruplays: 1500 }, null, null).quadrant, "insufficient");

// medians ignore ads below the delivery floor (they can't vote on the split lines)
const sparse = hookHoldMedians([{ impressions: 100, video3s: 90, thruplays: 80 }]);
assert.equal(sparse.hookMedian, null, "a sub-floor ad contributes no median");

console.log("PASS: hook x hold 2x2 (quadrants, self-baselined medians, insufficient gates)");
